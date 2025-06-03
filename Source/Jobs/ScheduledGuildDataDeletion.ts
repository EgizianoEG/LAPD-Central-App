import { CronJobFileDefReturn } from "@Typings/Core/System.js";
import DeleteAllAssociatedGuildData from "@Utilities/Database/DeleteAssociatedGuildData.js";
import GuildModel from "@Models/Guild.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

async function CleanupUnavailableGuilds(Now: Date | "init" | "manual", Client: DiscordClient) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const ScheduledGuilds = await GuildModel.find(
    {
      deletion_scheduled_on: { $lte: CurrentDate },
    },
    { deletion_scheduled_on: 1, _id: 1 },
    { lean: true }
  ).exec();

  if (ScheduledGuilds.length === 0) return;
  const GuildIds = ScheduledGuilds.map((Guild) => Guild._id);
  const PendingDeletionGuildIds = GuildIds.filter((GuildId) => !Client.guilds.cache.has(GuildId));

  if (PendingDeletionGuildIds.length === 0) return;
  return GuildModel.deleteMany({
    _id: { $in: PendingDeletionGuildIds },
    deletion_scheduled_on: { $lte: CurrentDate },
  })
    .exec()
    .then((DeleteResult) => {
      AppLogger.debug({
        splat: [DeleteResult.deletedCount, PendingDeletionGuildIds.length],
        label: "Jobs:ScheduledDataDeletion",
        message:
          "%i out of %i guilds was successfully deleted from the database due to their deletion schedule. Continuing to delete associated profiles and data...",
      });

      return DeleteAllAssociatedGuildData(PendingDeletionGuildIds);
    });
}

export default {
  cron_exp: "*/10 * * * *",
  cron_func: CleanupUnavailableGuilds as any,
  cron_opts: {
    errorHandlingMechanism: "silent/log",
    timezone: "America/Los_Angeles",
  },
} as CronJobFileDefReturn;
