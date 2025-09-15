import { DiscordAPIError, DiscordjsError, DiscordjsErrorCodes } from "discord.js";
import { AxiosError } from "axios";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Mongoose from "mongoose";

const FatalDiscordAPIErrorCodes: DiscordAPIError["code"][] = [50_014, 50_017];
const NonFatalErrorsFromConstructors: string[] = ["ValidationError", "VersionError", "CastError"];
const FatalDiscordJSErrors: DiscordjsErrorCodes[] = [
  DiscordjsErrorCodes.TokenInvalid,
  DiscordjsErrorCodes.TokenMissing,
  DiscordjsErrorCodes.ClientNotReady,
  DiscordjsErrorCodes.ClientMissingIntents,
];

const NetworkErrorPatterns = [
  /getaddrinfo ENOTFOUND/i,
  /connect ETIMEDOUT/i,
  /network timeout/i,
  /socket hang up/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
];

export default function ErrorHandler() {
  process.on("uncaughtException", (Err) => {
    const IsNetworkError = NetworkErrorPatterns.some(
      (pattern) => pattern.test(Err.message || "") || pattern.test(Err.stack || "")
    );

    if (
      (Err instanceof DiscordAPIError && !FatalDiscordAPIErrorCodes.includes(Err.code)) ||
      (Err instanceof DiscordjsError && !FatalDiscordJSErrors.includes(Err.code)) ||
      (Err instanceof AppError && Err.code !== 0) ||
      Err instanceof Mongoose.mongo.MongoServerError ||
      Err instanceof AxiosError ||
      Err instanceof RangeError ||
      Err instanceof ReferenceError ||
      NonFatalErrorsFromConstructors.includes(Err.constructor.name) ||
      IsNetworkError
    ) {
      // Non-fatal errors that can be logged and ignored without terminating the process.
      // These errors are either recoverable or do not compromise the app's core functionality.
      return AppLogger.error({
        message: IsNetworkError
          ? "Network connectivity issue detected. Will retry automatically when connection is restored. [%s]:"
          : "A non-fatal error has occurred. [%s]:",
        label: "Handlers:ErrorHandler",
        splat: [Err.constructor.name],
        error: { ...Err },
        stack: Err.stack,
      });
    }

    AppLogger.fatal({
      message: "An unrecoverable error has occurred. Terminating process in 5 seconds. [%s]:",
      label: "Handlers:ErrorHandler",
      splat: [Err.constructor.name],
      error: { ...Err },
      stack: Err.stack,
    });

    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });
}
