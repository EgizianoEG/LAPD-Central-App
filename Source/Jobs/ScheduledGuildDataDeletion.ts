import { Collection } from "discord.js";
import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import DeleteAllAssociatedGuildData from "#Utilities/Database/DeleteAssociatedGuildData.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

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
  const GuildIds = new Collection(ScheduledGuilds.map((Guild) => [Guild._id, Guild._id]));
  const [PendingDeletionGuildIds, GuildIdsToRevokePending] = GuildIds.partition(
    (GuildId) => !Client.guilds.cache.has(GuildId)
  );

  if (GuildIdsToRevokePending.size > 0) {
    const UpdateResult = await GuildModel.updateMany(
      { _id: { $in: GuildIdsToRevokePending.values().toArray() } },
      { $set: { deletion_scheduled_on: null } }
    ).exec();

    AppLogger.debug({
      splat: [UpdateResult.matchedCount],
      label: "Jobs:ScheduledGuildDataDeletion",
      message:
        "%i guilds were found to be available again and had their pending deletion schedule revoked.",
    });
  }

  if (PendingDeletionGuildIds.size === 0) return;
  const GuildIdsToDelete = PendingDeletionGuildIds.values().toArray();
  const Session = await GuildModel.startSession();
  Session.startTransaction();

  const DeleteResult = await GuildModel.deleteMany(
    {
      _id: { $in: GuildIdsToDelete },
      deletion_scheduled_on: { $lte: CurrentDate },
    },
    {
      session: Session,
    }
  ).exec();

  AppLogger.debug({
    splat: [DeleteResult.deletedCount, GuildIdsToDelete.length],
    label: "Jobs:ScheduledGuildDataDeletion",
    message:
      "%i out of %i guilds was successfully deleted from the database due to their deletion schedule. Continuing to delete associated profiles and data...",
  });

  return DeleteAllAssociatedGuildData(GuildIdsToDelete, Session);
}

export default {
  cron_exp: "*/10 * * * *",
  cron_func: CleanupUnavailableGuilds,
  cron_opts: {
    errorHandlingMechanism: "silent/log",
    timezone: "America/Los_Angeles",
  },
} as CronJobFileDefReturn;
