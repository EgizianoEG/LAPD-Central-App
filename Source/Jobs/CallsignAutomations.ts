/* eslint-disable sonarjs/no-duplicate-string */
import { GenericRequestStatuses } from "#Config/Constants.js";
import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import { Callsigns } from "#Typings/Utilities/Database.js";
import { subDays } from "date-fns";

import CallsignModel from "#Models/Callsign.js";
import CallsignsEventLogger from "#Utilities/Classes/CallsignsEventLogger.js";
import HandleCallsignStatusUpdates from "#Utilities/Discord/HandleCallsignStatusUpdates.js";

const CallsignEventLogger = new CallsignsEventLogger();
interface ProcessingResult {
  type: "expiry" | "auto_release";
  callsign_id: string;
  success: boolean;
}

/**
 * Processes both expired callsigns (manual/administrative expiry) and scheduled auto-releases (inactivity-based).
 * Only processes callsigns expired/scheduled within the last 7 days to avoid false positives.
 * @param Now - The current date, or "init"/"manual" for initialization/manual runs.
 * @param Client - The Discord client instance.
 */
async function ProcessCallsignExpiryAndAutoReleases(
  Now: Date | "init" | "manual",
  Client: DiscordClient
) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const SevenDaysAgo = subDays(CurrentDate, 7);
  const ProcessingResults: ProcessingResult[] = [];

  const [AggregationResult] = await CallsignModel.aggregate<{
    expired_callsigns: Callsigns.CallsignDocument[];
    auto_released_callsigns: Callsigns.CallsignDocument[];
  }>([
    {
      $facet: {
        // Branch 1: Expiry processing (`expiry` field)
        expired_callsigns: [
          {
            $match: {
              expiry_notified: false,
              request_status: GenericRequestStatuses.Approved,
              expiry: { $ne: null, $lte: CurrentDate, $gte: SevenDaysAgo },
            },
          },
          {
            $lookup: {
              from: "callsigns",
              as: "other_active",
              let: { guild_id: "$guild", user_id: "$requester", current_id: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $ne: ["$_id", "$$current_id"] },
                        { $eq: ["$guild", "$$guild_id"] },
                        { $eq: ["$requester", "$$user_id"] },
                        { $eq: ["$request_status", GenericRequestStatuses.Approved] },
                        {
                          $or: [{ $eq: ["$expiry", null] }, { $gt: ["$expiry", CurrentDate] }],
                        },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
            },
          },
          {
            $match: {
              other_active: { $eq: [] },
            },
          },
          {
            $project: {
              other_active: 0,
            },
          },
        ],

        // Branch 2: Auto-release processing (`scheduled_release_date` field)
        auto_released_callsigns: [
          {
            $match: {
              expiry_notified: false,
              request_status: GenericRequestStatuses.Approved,
              scheduled_release_date: {
                $ne: null,
                $lte: CurrentDate,
                $gte: SevenDaysAgo,
              },
            },
          },
          {
            $lookup: {
              from: "callsigns",
              as: "other_active",
              let: { guild_id: "$guild", user_id: "$requester", current_id: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $ne: ["$_id", "$$current_id"] },
                        { $eq: ["$guild", "$$guild_id"] },
                        { $eq: ["$requester", "$$user_id"] },
                        { $eq: ["$request_status", GenericRequestStatuses.Approved] },
                        {
                          $or: [{ $eq: ["$expiry", null] }, { $gt: ["$expiry", CurrentDate] }],
                        },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
            },
          },
          {
            $match: {
              other_active: { $eq: [] },
            },
          },
          {
            $project: {
              other_active: 0,
            },
          },
        ],
      },
    },
  ]).exec();

  const ExpiredCallsigns = AggregationResult?.expired_callsigns ?? [];
  const AutoReleasedCallsigns = AggregationResult?.auto_released_callsigns ?? [];

  if (!ExpiredCallsigns.length && !AutoReleasedCallsigns.length) {
    return;
  }

  // Process expired callsigns:
  if (ExpiredCallsigns.length) {
    const GroupedByGuild = Object.groupBy(ExpiredCallsigns, (CS) => CS.guild);
    for (const [GuildId, Callsigns] of Object.entries(GroupedByGuild)) {
      const Guild = await Client.guilds.fetch(GuildId).catch(() => null);
      if (!Guild || !Callsigns?.length) continue;

      for (const Callsign of Callsigns) {
        const Results = await Promise.allSettled([
          HandleCallsignStatusUpdates(Client, Callsign),
          CallsignEventLogger.LogCallsignExpiry(Client, Callsign),
        ]);

        ProcessingResults.push({
          callsign_id: Callsign._id.toString(),
          success: Results.some((R) => R.status === "fulfilled"),
          type: "expiry",
        });
      }
    }
  }

  // Process auto-released callsigns:
  if (AutoReleasedCallsigns.length) {
    const GroupedByGuild = Object.groupBy(AutoReleasedCallsigns, (CS) => CS.guild);
    for (const [GuildId, Callsigns] of Object.entries(GroupedByGuild)) {
      const Guild = await Client.guilds.fetch(GuildId).catch(() => null);
      if (!Guild || !Callsigns?.length) continue;

      for (const Callsign of Callsigns) {
        const Results = await Promise.allSettled([
          HandleCallsignStatusUpdates(Client, Callsign),
          CallsignEventLogger.LogCallsignAutoRelease(Client, Callsign),
        ]);

        ProcessingResults.push({
          callsign_id: Callsign._id.toString(),
          success: Results.some((R) => R.status === "fulfilled"),
          type: "auto_release",
        });
      }
    }
  }

  const SuccessfullyProcessed = ProcessingResults.filter((R) => R.success).map(
    (R) => R.callsign_id
  );

  if (SuccessfullyProcessed.length) {
    await CallsignModel.updateMany(
      { _id: { $in: SuccessfullyProcessed } },
      { $set: { expiry_notified: true } }
    ).exec();
  }
}

export default {
  cron_exp: "*/5 * * * *",
  cron_func: ProcessCallsignExpiryAndAutoReleases as any,
  cron_opts: {
    timezone: "America/Los_Angeles",
    awaitAppOnline: true,
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
