import { DiscordAPIError, DiscordjsError, DiscordjsErrorCodes } from "discord.js";
import { AxiosError } from "axios";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Mongoose from "mongoose";

const FileLabel = "Handlers:ErrorHandler";
const ProcessTerminationDelaySecs = 5;
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
 * @param Err
 * @param ErrorType
 * @remarks
 * - A non-fatal error is one that can be logged and ignored without terminating the process.
 * - A fatal error is one that compromises the application's core functionality and requires process termination.
 */
function HandleError(Err: Error, ErrorType: "uncaughtException" | "unhandledRejection"): void {
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
    message: `${FatalMessage}. Terminating process in %s seconds. [%s]:`,
    label: FileLabel,
    splat: [ProcessTerminationDelaySecs, Err.constructor.name],
    stack: Err.stack,
    error: Err,
  });

  setTimeout(() => {
    process.exit(1);
  }, ProcessTerminationDelaySecs * 1000);
}

// ---------------------------------------------------------------------------------------
/**
 * Initializes global error handlers for uncaught exceptions and unhandled promise rejections.
 * Logs errors and determines if they are fatal or non-fatal.
 * Fatal errors will terminate the process after a short delay to allow for logging.
 */
export default function ErrorHandler() {
  process.on("uncaughtException", (Err) => {
    HandleError(Err, "uncaughtException");
  });

  process.on("unhandledRejection", (Reason) => {
    const Err = Reason instanceof Error ? Reason : new Error(String(Reason));
    HandleError(Err, "unhandledRejection");
  });
}
