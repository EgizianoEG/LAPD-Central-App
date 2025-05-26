import { milliseconds, subMilliseconds } from "date-fns";
import { CronJobFileDefReturn } from "@Typings/Global.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import GuildModel from "@Models/Guild.js";
import ArrestModel from "@Models/Arrest.js";
import CitationModel from "@Models/Citation.js";
import IncidentModel from "@Models/Incident.js";

const FileLabel = "Jobs:AutodeleteGuildLogs";
const GuildCleanupInterval = milliseconds({ minutes: 15 });

async function AutodeleteGuildLogs(Now: Date | "init" | "manual") {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const GuildDocuments = await GuildModel.find(
    {
      deletion_scheduled_on: { $eq: null },
      "settings.duty_activities.log_deletion_interval": { $gt: 0 },
      $or: [
        { last_logs_cleanup: { $eq: null } },
        { last_logs_cleanup: { $lte: subMilliseconds(CurrentDate, GuildCleanupInterval) } },
      ],
    },
    { "settings.duty_activities.log_deletion_interval": 1 }
  )
    .lean()
    .exec();

  if (GuildDocuments.length === 0) return;
  const GuildDeletionPromises = GuildDocuments.map(
    async function DeleteExpiredGuildDALogs(GuildDoc) {
      const LogDeletionInterval = GuildDoc.settings.duty_activities.log_deletion_interval;
      if (!LogDeletionInterval) return [null, null];

      try {
        const CleanupDeletionPromises = [
          ArrestModel.deleteMany({
            guild: GuildDoc._id,
            made_on: { $lte: subMilliseconds(CurrentDate, LogDeletionInterval) },
          }),
          CitationModel.deleteMany({
            guild: GuildDoc._id,
            issued_on: { $lte: subMilliseconds(CurrentDate, LogDeletionInterval) },
          }),
          IncidentModel.deleteMany({
            guild: GuildDoc._id,
            reported_on: { $lte: subMilliseconds(CurrentDate, LogDeletionInterval) },
          }),
        ];

        const CleanupResults = await Promise.allSettled(CleanupDeletionPromises);
        const CleanupDeletionResults = {
          ArrestsDeleted: 0,
          CitationsDeleted: 0,
          IncidentsDeleted: 0,
        };

        CleanupResults.forEach((Result, Index) => {
          if (Result.status === "fulfilled") {
            const DeletedCount = Result.value.deletedCount;
            if (Index === 0) CleanupDeletionResults.ArrestsDeleted = DeletedCount;
            if (Index === 1) CleanupDeletionResults.CitationsDeleted = DeletedCount;
            if (Index === 2) CleanupDeletionResults.IncidentsDeleted = DeletedCount;
          } else {
            const DeletionCategory =
              Index === 0 ? "arrest logs" : Index === 1 ? "citation logs" : "incident logs";

            AppLogger.error({
              message: `Failed to delete ${DeletionCategory}.`,
              label: FileLabel,
              stack: Result.reason.stack,
              guild_id: GuildDoc._id,
            });
          }
        });

        AppLogger.debug({
          message: `Successfully executed duty logs cleanup for guild '${GuildDoc._id}'.`,
          details: CleanupDeletionResults,
          label: FileLabel,
        });

        return [GuildDoc._id, CleanupDeletionResults];
      } catch (Err: any) {
        AppLogger.error({
          message: "Unexpected error occurred during duty activities log deletion.",
          guild_id: GuildDoc._id,
          label: FileLabel,
          stack: Err.stack,
          error: {
            ...Err,
          },
        });
      }
    }
  );

  const CleanupResults = await Promise.allSettled(GuildDeletionPromises);
  const SuccessfulResults = CleanupResults.filter(
    (
      Result
    ): Result is PromiseFulfilledResult<
      [string, { ArrestsDeleted: number; CitationsDeleted: number; IncidentsDeleted: number }]
    > => Result.status === "fulfilled" && Array.isArray(Result.value) && Result.value[0] !== null
  );

  if (SuccessfulResults.length > 0) {
    const GuildIds = SuccessfulResults.map((Result) => Result.value[0]).filter(Boolean);
    return GuildModel.updateMany({ _id: { $in: GuildIds } }, { last_logs_cleanup: CurrentDate });
  }
}

export default {
  cron_exp: "*/3 * * * *",
  cron_func: AutodeleteGuildLogs,
  cron_opts: {
    timezone: "America/Los_Angeles",
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
