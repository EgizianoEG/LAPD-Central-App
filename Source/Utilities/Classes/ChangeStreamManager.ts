import AppLogger from "./AppLogger.js";
import Mongoose from "mongoose";

/**
 * A callback function that is called when the change stream connects successfully.
 * @param was_resumable - Indicates whether the reconnection was resumable (i.e., the change stream can continue from the last known position, if available).
 * Becomes `undefined` if the change stream was started for the first time.
 */
type ConnectEventHandler = (was_resumable?: boolean) => void | Promise<void>;
type ErrorEventHandler = (error: Error) => void | Promise<void>;
type EventHandler<T> = (data: T) => void | Promise<void>;
type GenericEventHandler = () => void | Promise<void>;
type ChangeEventHandler<T extends object> = (
  change: Mongoose.mongo.ChangeStreamDocument<T>
) => void | Promise<void>;

interface ChangeStreamOptions extends Mongoose.mongo.ChangeStreamOptions {
  MaxReconnectAttempts?: number;
  BaseReconnectDelay?: number;
  MaxReconnectDelay?: number;
  LoggerLabel: string;

  /**
   * A callback function that is called when the change stream is attempting to reconnect, right before starting the new change stream.
   * @param IsResumable - Indicates whether the reconnection is resumable (i.e., the change stream can continue from the last known position, if available).
   * @returns
   */
  OnReconnect?: (IsResumable: boolean) => Promise<void> | void;
}

/**
 * A utility class to manage MongoDB change streams with automatic reconnection logic.
 * It watches a Mongoose model for changes and handles events such as change, error, close, end, connected, and disconnected.
 * @template T - The type of the documents in the change stream.
 */
export default class ChangeStreamManager<T extends object> {
  private readonly Model: Mongoose.Model<T>;
  private readonly Options: Mongoose.mongo.ChangeStreamOptions;
  private readonly LoggerLabel: string;
  private readonly CollectionName: string;

  private readonly OnChangeHandlers: ChangeEventHandler<T>[] = [];
  private readonly OnErrorHandlers: ErrorEventHandler[] = [];
  private readonly OnCloseHandlers: GenericEventHandler[] = [];
  private readonly OnEndHandlers: GenericEventHandler[] = [];
  private readonly OnConnectedHandlers: GenericEventHandler[] = [];
  private readonly OnDisconnectedHandlers: GenericEventHandler[] = [];

  private readonly MaxReconnectAttempts: number;
  private readonly BaseReconnectDelay: number;
  private readonly MaxReconnectDelay: number;
  private readonly OnReconnect?: (IsResumable: boolean) => Promise<void> | void;

  private Pipeline: Array<Record<string, unknown>> = [];
  private Stream: Mongoose.mongo.ChangeStream<T> | null = null;
  private ResumeToken: Mongoose.mongo.ResumeToken | null = null;

  private ReconnectTimeoutId: NodeJS.Timeout | null = null;
  private ReconnectAttempts: number = 0;
  private IsReconnecting: boolean = false;
  private IsConnected: boolean = false;
  private IsStopped: boolean = false;

  /**
   * Creates a new ChangeStreamManager to handle MongoDB change streams with reconnection logic.
   * @param model - Mongoose model to watch for changes.
   * @param options - Options for the change stream and manager.
   */
  constructor(model: Mongoose.Model<T>, options: ChangeStreamOptions) {
    const {
      OnReconnect,
      LoggerLabel,
      MaxReconnectAttempts = 10,
      BaseReconnectDelay = 1000,
      MaxReconnectDelay = 30_000,
      ...MongoOptions
    } = options;

    this.Model = model;
    this.CollectionName = model.collection.name;
    this.LoggerLabel = LoggerLabel;
    this.MaxReconnectAttempts = MaxReconnectAttempts;
    this.BaseReconnectDelay = BaseReconnectDelay;
    this.MaxReconnectDelay = MaxReconnectDelay;
    this.OnReconnect = OnReconnect;

    this.Options = {
      fullDocument: "updateLookup",
      ...MongoOptions,
    };
  }

  /**
   * Start watching the collection for changes
   * @param pipeline - Optional aggregation pipeline to filter changes
   */
  public async Start(pipeline: Array<Record<string, unknown>> = []): Promise<void> {
    this.IsStopped = false;
    this.Pipeline = pipeline;
    await this.StartChangeStream();
  }

  /**
   * Stop watching the collection and clean up resources.
   */
  public async Stop(): Promise<void> {
    this.IsStopped = true;

    if (this.ReconnectTimeoutId) {
      clearTimeout(this.ReconnectTimeoutId);
      this.ReconnectTimeoutId = null;
    }

    await this.CleanupChangeStream();
    AppLogger.debug({
      message: "[%s] Change stream manager stopped and resources cleaned up at request.",
      splat: [this.CollectionName],
      label: this.LoggerLabel,
    });
  }

  /**
   * Check if the change stream is currently connected.
   */
  public IsActive(): boolean {
    return this.IsConnected;
  }

  /**
   * Register a handler for change events.
   * @param handler - Function to call when a change occurs.
   */
  public OnChange(handler: ChangeEventHandler<T>): this {
    this.OnChangeHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for error events.
   * @param handler - Function to call when an error occurs.
   */
  public OnError(handler: ErrorEventHandler): this {
    this.OnErrorHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for close events.
   * @param handler - Function to call when the stream closes.
   */
  public OnClose(handler: GenericEventHandler): this {
    this.OnCloseHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for end events.
   * @param handler - Function to call when the stream ends.
   */
  public OnEnd(handler: GenericEventHandler): this {
    this.OnEndHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for when the stream successfully connects.
   * @param handler - Function to call when the stream connects.
   */
  public OnConnected(handler: ConnectEventHandler): this {
    this.OnConnectedHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for when the stream disconnects due to an error or is closed.
   * @param handler - Function to call when the stream disconnects.
   */
  public OnDisconnected(handler: GenericEventHandler): this {
    this.OnDisconnectedHandlers.push(handler);
    return this;
  }

  private async StartChangeStream(): Promise<void> {
    try {
      const IsReconnection = this.IsReconnecting;
      if (this.ReconnectTimeoutId) {
        clearTimeout(this.ReconnectTimeoutId);
        this.ReconnectTimeoutId = null;
      }

      const WatchOptions = { ...this.Options };
      if (this.ResumeToken) {
        WatchOptions.resumeAfter = this.ResumeToken;
        AppLogger.debug({
          message: "[%s] Resuming change stream from last known position.",
          splat: [this.CollectionName],
          label: this.LoggerLabel,
        });
      }

      if (Mongoose.connection.readyState !== Mongoose.ConnectionStates.connected) {
        AppLogger.debug({
          message:
            "[%s] Mongoose connection is not ready to start change stream yet. Waiting for MongoDB connection to establish...",
          splat: [this.CollectionName],
          label: this.LoggerLabel,
        });

        await new Promise<void>((Resolve) => {
          Mongoose.connection.once("connected", () => Resolve());
        });
      }

      this.Stream = this.Model.watch<T, Mongoose.mongo.ChangeStreamDocument<T>>(
        this.Pipeline,
        WatchOptions
      );

      this.Stream.on("change", this.HandleChange.bind(this));
      this.Stream.on("error", this.HandleError.bind(this));
      this.Stream.on("close", this.HandleClose.bind(this));
      this.Stream.on("end", this.HandleEnd.bind(this));

      this.IsConnected = true;
      this.IsReconnecting = false;
      this.ReconnectAttempts = 0;

      AppLogger.debug({
        message: "[%s] Change stream started successfully.",
        splat: [this.CollectionName],
        label: this.LoggerLabel,
      });

      await this.NotifyHandlers(
        this.OnConnectedHandlers,
        IsReconnection ? this.ResumeToken !== null : undefined
      );
    } catch (Err: any) {
      AppLogger.error({
        message: "[%s] Failed to start change stream.",
        splat: [this.CollectionName],
        label: this.LoggerLabel,
        stack: Err.stack,
        error: Err,
      });

      await this.ScheduleReconnection();
    }
  }

  private async HandleChange(Change: Mongoose.mongo.ChangeStreamDocument<T>): Promise<void> {
    this.ResumeToken = Change._id;
    await Promise.all(
      this.OnChangeHandlers.map(async (Handler) => {
        try {
          await Promise.resolve(Handler(Change));
        } catch (Err: any) {
          AppLogger.error({
            message: "[%s] Error occurred in change handler callback.",
            splat: [this.CollectionName],
            label: this.LoggerLabel,
            stack: Err.stack,
            error: Err,
          });
        }
      })
    );
  }

  private async HandleError(Err: any): Promise<void> {
    this.IsConnected = false;
    const IsResumable = this.IsErrorResumable(Err);

    AppLogger.error({
      message: "[%s] %s change stream error has occurred.",
      splat: [this.CollectionName, IsResumable ? "Resumable" : "Non-resumable"],
      label: this.LoggerLabel,
      resumable: IsResumable,
      stack: Err.stack,
      error: Err,
    });

    await this.CleanupChangeStream();
    if (!IsResumable) {
      this.ResumeToken = null;
      AppLogger.debug({
        message: "[%s] Cleared resume token due to non-resumable error.",
        splat: [this.CollectionName],
        label: this.LoggerLabel,
      });
    }

    await this.NotifyHandlers(this.OnErrorHandlers, Err);
    await this.NotifyHandlers(this.OnDisconnectedHandlers);
    await this.ScheduleReconnection();
  }

  private async HandleClose(): Promise<void> {
    if (!this.IsConnected) return;

    this.IsConnected = false;
    AppLogger.debug({
      message: "[%s] Change stream closed.",
      splat: [this.CollectionName],
      label: this.LoggerLabel,
    });

    await this.NotifyHandlers(this.OnCloseHandlers);
    await this.NotifyHandlers(this.OnDisconnectedHandlers);
    await this.ScheduleReconnection();
  }

  private async HandleEnd(): Promise<void> {
    if (!this.IsConnected) return;

    this.IsConnected = false;
    AppLogger.debug({
      message: "[%s] Change stream ended.",
      splat: [this.CollectionName],
      label: this.LoggerLabel,
    });

    await this.NotifyHandlers(this.OnEndHandlers);
    await this.NotifyHandlers(this.OnDisconnectedHandlers);
    await this.ScheduleReconnection();
  }

  private async CleanupChangeStream(): Promise<void> {
    if (this.Stream && !this.Stream.closed) {
      try {
        await this.Stream.close();
      } catch (Err) {
        AppLogger.warn({
          message: "[%s] Error while closing change stream.",
          splat: [this.CollectionName],
          label: this.LoggerLabel,
          error: Err,
        });
      } finally {
        this.Stream = null;
      }
    }
  }

  private async ScheduleReconnection(): Promise<void> {
    if (this.IsStopped || this.IsReconnecting) return;
    if (this.ReconnectAttempts >= this.MaxReconnectAttempts) {
      AppLogger.error({
        message: "[%s] Maximum reconnection attempts (%o) reached. Stopping change stream.",
        splat: [this.CollectionName, this.MaxReconnectAttempts],
        label: this.LoggerLabel,
      });
      return;
    }

    this.IsReconnecting = true;
    this.ReconnectAttempts++;

    const ExponentialDelay = Math.min(
      this.BaseReconnectDelay * 2 ** (this.ReconnectAttempts - 1),
      this.MaxReconnectDelay
    );

    const JitteredDelay = Math.round(ExponentialDelay + Math.random() * 2000);

    AppLogger.debug({
      message: "[%s] Scheduling change stream reconnection attempt %o/%o in %oms.",
      label: this.LoggerLabel,
      splat: [
        this.CollectionName,
        this.ReconnectAttempts,
        this.MaxReconnectAttempts,
        JitteredDelay,
      ],
    });

    this.ReconnectTimeoutId = setTimeout(async () => {
      try {
        if (this.OnReconnect) {
          await Promise.resolve(this.OnReconnect(this.ResumeToken !== null));
        }

        await this.StartChangeStream();
      } catch (Err: any) {
        AppLogger.error({
          message: "[%s] Error during scheduled reconnection.",
          splat: [this.CollectionName],
          label: this.LoggerLabel,
          stack: Err.stack,
          error: Err,
        });

        this.IsReconnecting = false;
        await this.ScheduleReconnection();
      }
    }, JitteredDelay);
  }

  private IsErrorResumable(Err: any): boolean {
    const ResumableErrorNoCodes: (string | number)[] = [-4092, -4077];
    return ("errno" in Err && ResumableErrorNoCodes.includes(Err.errno)) || false;
  }

  private async NotifyHandlers(handlers: EventHandler<any>[], data?: any): Promise<void> {
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await Promise.resolve(handler(data));
        } catch (Err: any) {
          AppLogger.error({
            message: "[%s] Error in event handler callback.",
            splat: [this.CollectionName],
            label: this.LoggerLabel,
            stack: Err.stack,
            error: Err,
          });
        }
      })
    );
  }
}
