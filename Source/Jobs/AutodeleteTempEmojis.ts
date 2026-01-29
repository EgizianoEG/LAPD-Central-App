import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import { ApplicationEmoji } from "discord.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
const FileLabel = "Jobs:AutodeleteTempAppEmojis";

async function AutodeleteTempAppEmojis(Now: Date | "init" | "manual", Client: DiscordClient) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const AppEmojis = await Client.application.emojis.fetch();

  if (AppEmojis.size === 0) return;
  const DeletionPromises: Map<ApplicationEmoji, Promise<any>> = new Map();

  for (const Emoji of AppEmojis.values()) {
    if (!Emoji.name?.includes("_temp_")) continue;

    const ExpirationTimestamp = Number.parseInt(Emoji.name.split("_").pop() || "0");
    if (Number.isNaN(ExpirationTimestamp)) continue;

    const ExpirationDate = new Date(ExpirationTimestamp);
    if (Number.isNaN(ExpirationDate.getTime())) continue;

    if (ExpirationDate < CurrentDate) {
      DeletionPromises.set(Emoji, Client.application.emojis.delete(Emoji.id));
    }
  }

  if (DeletionPromises.size === 0) {
    return;
  }

  const EmojisToDelete = Array.from(DeletionPromises.keys());
  const Results = await Promise.allSettled(DeletionPromises.values());

  for (const [index, Result] of Results.entries()) {
    if (Result.status === "rejected") {
      const FailedEmoji = EmojisToDelete[index];
      AppLogger.error({
        message: "Failed to delete expired temporary emoji '%s' (%s);",
        splat: [FailedEmoji.name, FailedEmoji.id],
        label: FileLabel,
        error: Result.reason,
        stack: (Result.reason as Error)?.stack,
      });
    }
  }
}

export default {
  cron_exp: "*/10 * * * *",
  cron_func: AutodeleteTempAppEmojis,
  cron_opts: {
    timezone: "America/Los_Angeles",
    noOverlap: true,
    awaitAppOnline: true,
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
