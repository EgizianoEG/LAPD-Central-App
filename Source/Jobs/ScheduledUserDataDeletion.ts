import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import { milliseconds } from "date-fns";
import GuildProfile from "#Models/GuildProfile.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

async function CleanupLeftUserProfiles(Now: Date | "init" | "manual", Client: DiscordClient) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const GracePeriodMs = milliseconds({ days: 3 });
  const GracePeriodCutoff = new Date(CurrentDate.getTime() - GracePeriodMs);
  const ScheduledProfiles = await GuildProfile.find(
    {
      left_at: { $ne: null, $lte: GracePeriodCutoff },
    },
    { _id: 1, user: 1, guild: 1, left_at: 1 },
    { lean: true }
  ).exec();

  if (ScheduledProfiles.length === 0) return;
  const ProfileIdsToDelete: string[] = [];

  for (const Profile of ScheduledProfiles) {
    const Guild = Client.guilds.cache.get(Profile.guild);
    if (Guild?.members.cache.has(Profile.user)) {
      continue;
    }

    ProfileIdsToDelete.push(Profile._id.toString());
  }

  if (ProfileIdsToDelete.length === 0) return;
  const DeleteResult = await GuildProfile.deleteMany({ _id: { $in: ProfileIdsToDelete } }).exec();
  AppLogger.debug({
    splat: [DeleteResult.deletedCount ?? 0, ProfileIdsToDelete.length],
    label: "Jobs:ScheduledUserDataDeletion",
    message: "%i out of %i guild profiles were deleted after the grace period elapsed.",
  });
}

export default {
  cron_exp: "*/30 * * * *",
  cron_func: CleanupLeftUserProfiles,
  cron_opts: {
    errorHandlingMechanism: "silent/log",
    timezone: "America/Los_Angeles",
  },
} as CronJobFileDefReturn;
