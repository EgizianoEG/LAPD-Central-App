import { BaseUserActivityNoticeLogger } from "@Utilities/Classes/UANEventLogger.js";
import { CronJobFileDefReturn } from "@Typings/Core/System.js";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { subDays } from "date-fns";

import HandleNoticeRoleAssignment from "@Utilities/Discord/HandleUANRoleAssignment.js";
import ActivityNoticeModel from "@Models/UserActivityNotice.js";
const BaseUANLogger = new BaseUserActivityNoticeLogger(true);

/**
 * Handle activity notices expiration and role assignment if the `end_processed` property is still `false`.
 * This will only handle notices expired in the last 7 days or less to avoid false positives or very late responses.
 * @param _
 * @param Client
 * @returns
 */
async function HandleExpiredUserActivityNotices(
  Now: Date | "init" | "manual",
  Client: DiscordClient
) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const SevenDaysAgo = subDays(CurrentDate, 7);
  const NoticesHandled: string[] = [];
  const Notices =
    await ActivityNoticeModel.aggregate<UserActivityNotice.UserActivityNoticeDocument>([
      {
        $match: {
          status: "Approved",
          end_processed: false,
          $or: [
            { early_end_date: { $lte: CurrentDate, $gte: SevenDaysAgo } },
            { end_date: { $lte: CurrentDate, $gte: SevenDaysAgo } },
          ],
        },
      },
      {
        $lookup: {
          from: "activity_notices",
          as: "active_notices",
          let: { guild_id: "$guild", user_id: "$user" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$guild", "$$guild_id"] },
                    { $eq: ["$user", "$$user_id"] },
                    { $eq: ["$status", "Approved"] },
                    { $eq: ["$early_end_date", null] },
                    { $gt: ["$end_date", CurrentDate] },
                  ],
                },
              },
            },
          ],
        },
      },
      {
        $match: {
          active_notices: { $eq: [] },
        },
      },
      {
        $project: {
          active_notices: 0,
        },
      },
    ]).exec();

  if (!Notices.length) return;
  const CategorizedByGuild = Object.groupBy(Notices, (Notice) => Notice.guild);
  const GuildIds = Object.keys(CategorizedByGuild);

  for (const GuildId of GuildIds) {
    const GuildInst = await Client.guilds.fetch(GuildId).catch(() => null);
    if (!GuildInst) continue;
    if (!CategorizedByGuild[GuildId]?.length) continue;
    for (const Notice of CategorizedByGuild[GuildId]) {
      NoticesHandled.push(Notice._id as unknown as string);
      HandleNoticeRoleAssignment(Notice.user, GuildInst, Notice.type, false).catch(() => null);
      BaseUANLogger.LogActivityNoticeEnd(Client, ActivityNoticeModel.hydrate(Notice));
    }
  }

  return ActivityNoticeModel.updateMany(
    { _id: { $in: NoticesHandled } },
    { $set: { end_processed: true } }
  ).exec();
}

export default {
  cron_exp: "*/3 * * * *",
  cron_func: HandleExpiredUserActivityNotices as any,
  cron_opts: {
    timezone: "America/Los_Angeles",
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
