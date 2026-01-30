import { Client, DiscordAPIError, DiscordjsError, DiscordjsErrorCodes } from "discord.js";
import AppLogger, { FlushCloudLogs } from "#Utilities/Classes/AppLogger.js";
import { AxiosError } from "axios";
import AppError from "#Utilities/Classes/AppError.js";
import Mongoose from "mongoose";

const FileLabel = "Handlers:ErrorHandler";
const GracefulShutdownTimeoutSecs = 15;
export const ShutdownStatus = {
  IsShuttingDown: false,
};

const FatalDiscordAPIErrorCodes: Set<DiscordAPIError["code"]> = new Set([50_014, 50_017]);
const NonFatalErrorsFromConstructors: Set<string> = new Set([
  "ValidationError",
  "VersionError",
  "CastError",
]);

const FatalDiscordJSErrors: Set<DiscordjsErrorCodes> = new Set([
  DiscordjsErrorCodes.TokenInvalid,
  DiscordjsErrorCodes.TokenMissing,
  DiscordjsErrorCodes.ClientNotReady,
  DiscordjsErrorCodes.ClientMissingIntents,
]);

const NetworkErrorPatterns = [
  /getaddrinfo ENOTFOUND/i,
  /connect ETIMEDOUT/i,
  /network timeout/i,
  /socket hang up/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
];

function IsNetworkError(Err: Error): boolean {
  return NetworkErrorPatterns.some(
    (pattern) => pattern.test(Err.message || "") || pattern.test(Err.stack || "")
  );
}

function IsNonFatalError(Err: Error): boolean {
  return (
    (Err instanceof DiscordAPIError && !FatalDiscordAPIErrorCodes.has(Err.code)) ||
    (Err instanceof DiscordjsError && !FatalDiscordJSErrors.has(Err.code)) ||
    (Err instanceof AppError && Err.code !== 0) ||
    Err instanceof Mongoose.mongo.MongoServerError ||
    Err instanceof AxiosError ||
    Err instanceof RangeError ||
    Err instanceof ReferenceError ||
    NonFatalErrorsFromConstructors.has(Err.constructor.name) ||
    IsNetworkError(Err)
  );
}

/**
 * Performs a graceful shutdown of the application by disconnecting from MongoDB,
 * destroying the Discord client, and flushing cloud logs before exiting the process.
 * Ensures that shutdown procedures are only executed once, and enforces a timeout
 * to prevent indefinite waiting during cleanup.
 *
 * @param App - The Discord client instance to be destroyed.
 * @param ExitCode - The exit code to use when terminating the process.
 * @returns A promise that resolves when the shutdown sequence is complete.
 */
export async function PerformGracefulShutdown(App: Client, ExitCode: number): Promise<void> {
  if (ShutdownStatus.IsShuttingDown) return;
  ShutdownStatus.IsShuttingDown = true;

  const CleanupPromises = Promise.allSettled([
    Mongoose.disconnect().catch((Err) => {
      AppLogger.debug({
        message: "Error during MongoDB disconnect (non-blocking): [%s]",
        label: FileLabel,
        splat: [Err?.constructor?.name || "Unknown"],
        stack: Err?.stack,
      });
    }),
    App.destroy().catch((Err) => {
      AppLogger.debug({
        message: "Error during Discord client destroy (non-blocking): [%s]",
        label: FileLabel,
        splat: [Err?.constructor?.name || "Unknown"],
        stack: Err?.stack,
      });
    }),
  ]);

  const TimeoutPromise = new Promise<void>((Resolve) =>
    setTimeout(() => {
      AppLogger.warn({
        message: "Graceful shutdown cleanup exceeded %s seconds, forcing exit...",
        label: FileLabel,
        splat: [GracefulShutdownTimeoutSecs],
      });
      Resolve();
    }, GracefulShutdownTimeoutSecs * 1000)
  );

  await Promise.race([CleanupPromises, TimeoutPromise]);
  await FlushCloudLogs();
  process.exit(ExitCode);
}

/**
 * Handles exceptions and promise rejections by logging the error and determining whether the process should terminate.
 *
 * @remarks
 * - Non-fatal errors (including network-related errors) are logged as errors and do not terminate the process.
 * - Fatal errors are logged as fatal and trigger a graceful shutdown of the application.
 *
 * @param App - The Discord client instance used by the application.
 * @param Err - The error object that was thrown or rejected.
 * @param ErrorType - The type of error event, either "uncaughtException" or "unhandledRejection".
 */
function ProcessErrorHandling(
  App: DiscordClient,
  Err: Error,
  ErrorType: "uncaughtException" | "unhandledRejection"
): void {
  const IsNetwork = IsNetworkError(Err);
  const IsNonFatal = IsNonFatalError(Err);

  if (IsNonFatal) {
    const MessagePrefix =
      ErrorType === "unhandledRejection"
        ? "An unhandled promise rejection occurred (non-fatal)"
        : "A non-fatal error has occurred";

    AppLogger.error({
      message: IsNetwork
        ? `Network connectivity issue ${ErrorType === "unhandledRejection" ? "in async operation" : "detected"}. Will retry automatically${ErrorType === "uncaughtException" ? " when connection is restored" : ""}. [%s]:`
        : `${MessagePrefix}. [%s]:`,
      label: FileLabel,
      splat: [Err.constructor.name],
      stack: Err.stack,
      error: Err,
    });

    return;
  }

  const FatalMessage =
    ErrorType === "unhandledRejection"
      ? "An unhandled promise rejection occurred"
      : "An unrecoverable error has occurred";

  AppLogger.fatal({
    message: `${FatalMessage}. Terminating process. [%s]:`,
    label: FileLabel,
    splat: [Err.constructor.name],
    stack: Err.stack,
    error: Err,
  });

  PerformGracefulShutdown(App, 1);
}

// ---------------------------------------------------------------------------------------
/**
 * Sets up global error and signal handlers for the application.
 *
 * Registers listeners for process-level events such as uncaught exceptions,
 * unhandled promise rejections, and termination signals (SIGTERM, SIGINT).
 * On error events, it delegates error handling to `HandleError`. On termination
 * signals, it logs the event and initiates a graceful shutdown via `PerformGracefulShutdown`.
 *
 * @param App - The Discord client instance to be used for error handling and shutdown procedures.
 */
export default function SetupShutdownHandlers(App: DiscordClient): void {
  process.on("uncaughtException", (Err) => {
    ProcessErrorHandling(App, Err, "uncaughtException");
  });

  process.on("unhandledRejection", (Reason) => {
    const Err = Reason instanceof Error ? Reason : new Error(String(Reason));
    ProcessErrorHandling(App, Err, "unhandledRejection");
  });

  process.on("SIGTERM", () => {
    AppLogger.info({
      message: "SIGTERM received, initiating graceful shutdown...",
      label: FileLabel,
    });
    PerformGracefulShutdown(App, 0);
  });

  process.on("SIGINT", () => {
    AppLogger.info({
      message: "SIGINT received (Ctrl+C), initiating graceful shutdown...",
      label: FileLabel,
    });
    PerformGracefulShutdown(App, 0);
  });
}
