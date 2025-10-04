import { GenericRequestStatuses } from "@Config/Constants.js";
import { CronJobFileDefReturn } from "@Typings/Core/System.js";
import { Callsigns } from "@Typings/Utilities/Database.js";
import { subDays } from "date-fns";

import CallsignModel from "@Models/Callsign.js";
import CallsignsEventLogger from "@Utilities/Classes/CallsignsEventLogger.js";
import HandleCallsignStatusUpdates from "@Utilities/Discord/HandleCallsignStatusUpdates.js";
const CallsignEventLogger = new CallsignsEventLogger();

/**
 * Handle activity notices expiration and role assignment if the `end_processed` property is still `false`.
 * This will only handle notices expired in the last 7 days or less to avoid false positives or very late responses.
 * @param _
 * @param Client
 * @returns
 */
async function ProcessExpiredCallSigns(Now: Date | "init" | "manual", Client: DiscordClient) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const SevenDaysAgo = subDays(CurrentDate, 7);
  const ExpiredCallsignsProcessed: string[] = [];
  const ExpiryHandledPromises = new Map<string, ReturnType<typeof Promise.allSettled>>();

  const ExpiredCallSigns = await CallsignModel.aggregate<Callsigns.CallsignDocument>([
    {
      $match: {
        expiry_notified: false,
        request_status: GenericRequestStatuses.Approved,
        $expr: {
          $or: [
            { $ne: ["$expiry", null] },
            {
              $and: [
                {
                  $lte: ["$expiry", CurrentDate],
                },
                {
                  $gte: ["$expiry", SevenDaysAgo],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "callsigns",
        as: "assigned_callsigns",
        let: { guild_id: "$guild", user_id: "$requester" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild_id"] },
                  { $eq: ["$requester", "$$user_id"] },
                  { $eq: ["$request_status", GenericRequestStatuses.Approved] },
                  { $or: [{ $eq: ["$expiry", null] }, { $gt: ["$expiry", CurrentDate] }] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $match: {
        assigned_callsigns: { $eq: [] },
      },
    },
    {
      $project: {
        assigned_callsigns: 0,
      },
    },
  ]).exec();

  if (!ExpiredCallSigns.length) return;
  const CategorizedByGuild = Object.groupBy(ExpiredCallSigns, (Notice) => Notice.guild);
  const GuildIds = Object.keys(CategorizedByGuild);

  for (const GuildId of GuildIds) {
    const GuildInst = await Client.guilds.fetch(GuildId).catch(() => null);
    if (!GuildInst) continue;
    if (!CategorizedByGuild[GuildId]?.length) continue;
    for (const Callsign of CategorizedByGuild[GuildId]) {
      ExpiryHandledPromises.set(
        Callsign._id.toString(),
        Promise.allSettled([
          HandleCallsignStatusUpdates(Client, Callsign),
          CallsignEventLogger.LogCallsignExpiry(Client, Callsign),
        ])
      );
    }
  }

  if (!ExpiryHandledPromises.size) return;
  const ExpiryResults = await Promise.all(
    Array.from(ExpiryHandledPromises.entries()).map(async ([CSId, PromiseHandle]) => {
      const Result = await PromiseHandle;
      return { CSId, Result };
    })
  );

  for (const { CSId, Result } of ExpiryResults) {
    if (Result.some((R) => R.status === "fulfilled")) {
      ExpiredCallsignsProcessed.push(CSId);
    }
  }

  if (!ExpiredCallsignsProcessed.length) return;
  return CallsignModel.updateMany(
    { _id: { $in: ExpiredCallsignsProcessed } },
    { $set: { expiry_notified: true } }
  ).exec();
}

export default {
  cron_exp: "*/5 * * * *",
  cron_func: ProcessExpiredCallSigns as any,
  cron_opts: {
    timezone: "America/Los_Angeles",
    awaitAppOnline: true,
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
