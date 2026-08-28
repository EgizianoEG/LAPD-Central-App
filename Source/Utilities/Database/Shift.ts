/* eslint-disable sonarjs/no-duplicate-string */
import type { AggregateResults, Shifts } from "#Typings/Utilities/Database.js";
import type { QueryFilter } from "mongoose";
import type { Guild, User } from "discord.js";
import { LiveMongoDBCache } from "#Utilities/Helpers/Cache.js";
import { ReadableDuration } from "#Utilities/Strings/Formatters.js";
import { Falsey, PropertiesToString } from "utility-types";
import ShiftModel, { ShiftFlags } from "#Models/Shift.js";
import GetGuildSettings from "./GetGuildSettings.js";

type ActivityNoticeInfo = {
  has_loa: boolean;
  has_ra: boolean;
  quota_scale: number | null;
};

type RawShiftStatistics = {
  shift_count: number;
  total_onduty: number;
  total_onbreak: number;
  total_arrests: number;
  total_citations: number;
  avg_onduty: number;
  avg_onbreak: number;
  frequent_shift_type: string;

  activity_notice_info: ActivityNoticeInfo | null;

  excluded_shift_count: number;
  excluded_onduty: number;
  excluded_onbreak: number;
};

export type UserShiftStatistics = {
  shift_count: number;
  total_onduty: string;
  total_onbreak: string;
  total_arrests: number;
  total_citations: number;
  avg_onduty: string;
  avg_onbreak: string;

  /** Whether the user has met the guild's configured shift quota; `null` when no quota is configured. */
  quota_met: boolean | null;

  /** The shift type with the highest number of completed shifts; `"N/A"` when no applicable shifts were found. */
  frequent_shift_type: string;

  /** Active LOA/RA information affecting quota calculation; `null` when no applicable notice exists. */
  active_notice: ActivityNoticeInfo | null;
};

/**
 * Increments a record-event counter on the user's currently active shift.
 *
 * These counters are transient shift-level statistics used for end-of-shift
 * reporting and shift-log output. They are not authoritative records or
 * performance statistics; those are derived directly from the Arrest,
 * Citation, and Incident collections.
 *
 * Record logging does not necessarily require an active shift. If the user has no active
 * shift, no shift counter is incremented and the record may remain an
 * "orphaned" event with respect to shift attribution.
 *
 * @param GuildId - The Id of the guild containing the active shift.
 * @param UserId - The Discord Id of the user whose active shift should be updated.
 * @param Event - The type of record event to increment.
 * @returns The result of the update operation. `true` if a shift was found and updated, `false` if no active shift was found for the user.
 */
export async function IncrementShiftEvent(
  GuildId: string,
  UserId: string,
  Event: keyof Omit<Shifts.ShiftEvents, "breaks">
): Promise<boolean> {
  return ShiftModel.updateOne(
    { guild: GuildId, user: UserId, end_timestamp: null },
    { $inc: { [`events.${Event}`]: 1 } }
  ).then((Result) => Result.matchedCount > 0);
}

/**
 * Retrieves active shifts for the guild associated with the interaction,
 * optionally restricted to the initiating user's active shift and/or specified shift types.
 *
 * @note When `UserOnly` is enabled, `null` is returned when the user has no matching active shift.
 *
 * @param Interaction - Discord interaction data containing the guild and user Ids.
 * @param ShiftType - Optional shift type or types to include.
 * @param CurrentUserOnly - Whether to return only the initiating user's active shift.
 * @returns Matching active shift documents, or a single shift / `null` when `UserOnly` is enabled.
 */
export async function GetActiveShifts<UOType extends boolean | undefined = false>({
  Interaction,
  ShiftType,
  CurrentUserOnly = false,
}: {
  /** Whether or not to return the active shift for the individual who initiated the interaction only. */
  CurrentUserOnly?: UOType;
  /** The types of duty shifts that will be retrieved; e.g. `"Default"`, `["Default", "Night Shift"]` */
  ShiftType?: null | string | string[];
  /** The received discord.js guild interaction */
  Interaction: { user: { id: string }; guildId: string };
}): Promise<
  UOType extends Falsey ? Shifts.HydratedShiftDocument[] : Shifts.HydratedShiftDocument | null
> {
  if (CurrentUserOnly && LiveMongoDBCache.StreamChangeConnected.ActiveShifts) {
    const ActiveShiftId = LiveMongoDBCache.ActiveShifts.findKey(
      (Shift) =>
        Shift.guild === Interaction.guildId &&
        Shift.user === Interaction.user.id &&
        Shift.end_timestamp == null &&
        (ShiftType == null ||
          (Array.isArray(ShiftType) ? ShiftType.includes(Shift.type) : Shift.type === ShiftType))
    );

    return ActiveShiftId
      ? (LiveMongoDBCache.ActiveShifts.getHydrated(ActiveShiftId) ?? (null as any))
      : (null as any);
  }

  const ActiveShifts = await ShiftModel.find({
    guild: Interaction.guildId,
    user: CurrentUserOnly ? Interaction.user.id : { $exists: true },
    type: ShiftType || { $exists: true },
    end_timestamp: null,
  }).exec();

  return (CurrentUserOnly ? (ActiveShifts[0] ?? null) : ActiveShifts) as any;
}

/**
 * Retrieves shift records with calculated durations for a specific user.
 * @param TargetUser - The targeted user whose shifts to retrieve.
 * @param GuildId - The guild id where the shifts were recorded.
 * @param ShiftType - Optional shift type filter.
 * @param CurrentDate - Date to use for calculating active shift durations (defaults to current date).
 * @returns Array of processed shift records with calculated durations.
 */
export async function GetUserShiftRecords(
  TargetUser: User | string,
  GuildId: Guild | string,
  ShiftType: Nullable<string>,
  CurrentDate: Date = new Date()
): Promise<AggregateResults.DutyAdminShiftRecordsShow[]> {
  TargetUser = typeof TargetUser === "string" ? TargetUser : TargetUser.id;
  GuildId = typeof GuildId === "string" ? GuildId : GuildId.id;
  return ShiftModel.aggregate<AggregateResults.DutyAdminShiftRecordsShow>([
    {
      $match: {
        user: TargetUser,
        guild: GuildId,
        type: ShiftType || { $exists: true },
      },
    },
    {
      $project: {
        _id: 1,
        type: 1,
        flag: 1,
        started: {
          $toLong: {
            $toDate: "$start_timestamp",
          },
        },
        ended: {
          $cond: [
            {
              $eq: ["$end_timestamp", null],
            },
            "Currently Active",
            {
              $toLong: {
                $toDate: "$end_timestamp",
              },
            },
          ],
        },
        duration: {
          $add: [
            {
              $ifNull: ["$durations.on_duty_mod", 0],
            },
            {
              $cond: [
                {
                  $eq: ["$end_timestamp", null],
                },
                {
                  $subtract: [
                    CurrentDate,
                    {
                      $toDate: "$start_timestamp",
                    },
                  ],
                },
                {
                  $subtract: [
                    {
                      $toDate: "$end_timestamp",
                    },
                    {
                      $toDate: "$start_timestamp",
                    },
                  ],
                },
              ],
            },
          ],
        },
        break_duration: {
          $reduce: {
            input: "$events.breaks",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $subtract: [
                    {
                      $toLong: {
                        $ifNull: [
                          {
                            $arrayElemAt: ["$$this", 1],
                          },
                          CurrentDate,
                        ],
                      },
                    },
                    {
                      $toLong: {
                        $arrayElemAt: ["$$this", 0],
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    {
      $addFields: {
        duration: {
          $subtract: ["$duration", "$break_duration"],
        },
      },
    },
    {
      $sort: {
        started: -1,
      },
    },
  ]).exec();
}

/**
 * Aggregates a user's shift history into the statistics used by shift summaries and activity reports.
 *
 * Duration totals are calculated from shift timestamps and break intervals
 * rather than the stored duration fields. This keeps the statistics
 * consistent with the recorded shift boundaries.
 *
 * @note Imported, administrative, and system shifts are excluded from average duration calculations.
 * @note An active shift may optionally be included in the reported shift count.
 *       Its duration and event counters are not included because the shift has not yet ended.
 *
 * @param InputQueryFilter - Additional filters identifying the shifts to aggregate. The guild identifier is required.
 * @param HasActiveShift - Whether an active shift should be counted as an
 *                         additional shift without contributing duration or completed-shift statistics.
 * @returns Aggregated shift statistics, including duration, event counts, the most frequent shift type, and quota status.
 */
export async function GetUserShiftStatistics(
  InputQueryFilter: QueryFilter<Shifts.ShiftDocument> & {
    guild: string;
  },
  IncludeActiveShift = false
): Promise<
  ExpandRecursively<
    PropertiesToString<
      UserShiftStatistics,
      "shift_count" | "total_arrests" | "total_citations" | "quota_met" | "active_notice"
    >
  >
> {
  const Filter = BuildShiftStatisticsFilter(InputQueryFilter);
  const ServerQuota = await GetGuildSettings(Filter.guild as string)
    .then((Settings) => Settings?.shift_management.default_quota ?? 0)
    .catch(() => 0);

  const [Aggregated] = await ShiftModel.aggregate<RawShiftStatistics>(
    BuildShiftStatisticsPipeline(Filter) as any
  ).exec();

  const Raw = Aggregated ?? CreateEmptyShiftStatistics();
  return FormatShiftStatistics(
    Raw,
    ServerQuota,
    IncludeActiveShift
  ) as unknown as ExpandRecursively<
    PropertiesToString<
      UserShiftStatistics,
      "shift_count" | "total_arrests" | "total_citations" | "quota_met" | "active_notice"
    >
  >;
}

// ---------------------------------------------------------------------------------------
// Local Helpers:
// --------------
function CreateEmptyShiftStatistics(): RawShiftStatistics {
  return {
    shift_count: 0,
    total_onduty: 0,
    total_onbreak: 0,
    total_arrests: 0,
    total_citations: 0,
    avg_onduty: 0,
    avg_onbreak: 0,
    frequent_shift_type: "N/A",
    activity_notice_info: null,
    excluded_shift_count: 0,
    excluded_onduty: 0,
    excluded_onbreak: 0,
  };
}

function BuildShiftStatisticsFilter(
  Input: QueryFilter<Shifts.ShiftDocument> & { guild: string }
): Record<string, unknown> {
  const Filter = { ...Input } as Record<string, unknown>;
  Filter.type ??= { $exists: true };

  if (typeof Filter.end_timestamp === "object" && Filter.end_timestamp !== null) {
    Filter.end_timestamp = {
      $ne: null,
      ...Filter.end_timestamp,
    };
  } else {
    Filter.end_timestamp = { $ne: null };
  }

  return Filter;
}

function BuildShiftStatisticsPipeline(Filter: Record<string, unknown>) {
  return [
    { $match: Filter },

    {
      $addFields: {
        total_duration: {
          $subtract: [{ $ifNull: ["$end_timestamp", "$$NOW"] }, "$start_timestamp"],
        },

        break_duration: {
          $cond: {
            if: {
              $gt: [{ $size: { $ifNull: ["$events.breaks", []] } }, 0],
            },

            then: {
              $let: {
                vars: {
                  total_dur: {
                    $subtract: [{ $ifNull: ["$end_timestamp", "$$NOW"] }, "$start_timestamp"],
                  },

                  raw_break_dur: {
                    $reduce: {
                      input: { $ifNull: ["$events.breaks", []] },
                      initialValue: 0,
                      in: {
                        $add: [
                          "$$value",
                          {
                            $max: [
                              {
                                $subtract: [
                                  {
                                    $ifNull: [
                                      { $arrayElemAt: ["$$this", 1] },
                                      {
                                        $toLong: {
                                          $ifNull: ["$end_timestamp", "$$NOW"],
                                        },
                                      },
                                    ],
                                  },
                                  { $arrayElemAt: ["$$this", 0] },
                                ],
                              },
                              0,
                            ],
                          },
                        ],
                      },
                    },
                  },
                },

                in: {
                  $max: [
                    {
                      $min: ["$$raw_break_dur", "$$total_dur"],
                    },
                    0,
                  ],
                },
              },
            },

            else: 0,
          },
        },
      },
    },

    {
      $addFields: {
        onduty_duration: {
          $max: [
            {
              $add: [
                {
                  $subtract: ["$total_duration", "$break_duration"],
                },
                { $ifNull: ["$durations.on_duty_mod", 0] },
              ],
            },
            0,
          ],
        },
      },
    },

    {
      $group: {
        _id: "$type",
        user_id: { $first: "$user" },
        guild_id: { $first: "$guild" },

        shift_count: { $sum: 1 },
        total_onbreak: { $sum: "$break_duration" },
        total_arrests: { $sum: { $ifNull: ["$events.arrests", 0] } },
        total_citations: { $sum: { $ifNull: ["$events.citations", 0] } },
        total_onduty: { $sum: "$onduty_duration" },

        excluded_onduty: {
          $sum: {
            $cond: {
              if: {
                $in: ["$flag", [ShiftFlags.Imported, ShiftFlags.Administrative, ShiftFlags.System]],
              },
              then: "$onduty_duration",
              else: 0,
            },
          },
        },

        excluded_onbreak: {
          $sum: {
            $cond: {
              if: {
                $in: ["$flag", [ShiftFlags.Imported, ShiftFlags.Administrative, ShiftFlags.System]],
              },
              then: "$break_duration",
              else: 0,
            },
          },
        },

        excluded_shift_count: {
          $sum: {
            $cond: {
              if: {
                $in: ["$flag", [ShiftFlags.Imported, ShiftFlags.Administrative, ShiftFlags.System]],
              },
              then: 1,
              else: 0,
            },
          },
        },
      },
    },

    // The "frequent" shift type is defined by number of completed shifts.
    {
      $sort: {
        shift_count: -1,
      },
    },

    {
      $group: {
        _id: null,
        user_id: { $first: "$user_id" },
        guild_id: { $first: "$guild_id" },

        frequent_shift_type: { $first: "$_id" },
        shift_count: { $sum: "$shift_count" },
        total_onduty: { $sum: "$total_onduty" },
        total_onbreak: { $sum: "$total_onbreak" },
        total_arrests: { $sum: "$total_arrests" },
        total_citations: { $sum: "$total_citations" },

        excluded_shift_count: { $sum: "$excluded_shift_count" },
        excluded_onduty: { $sum: "$excluded_onduty" },
        excluded_onbreak: { $sum: "$excluded_onbreak" },
      },
    },

    {
      $lookup: {
        as: "activity_notices",
        from: "activity_notices",
        let: {
          guild: "$guild_id",
          user: "$user_id",
          retrieve_date: "$$NOW",
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$user"] },
                  { $eq: ["$guild", "$$guild"] },
                  { $eq: ["$status", "Approved"] },
                  { $ne: ["$review_date", null] },
                  { $eq: ["$early_end_date", null] },
                  { $gt: ["$end_date", "$$retrieve_date"] },
                ],
              },
            },
          },

          {
            $facet: {
              active_loa: [
                { $match: { type: "LeaveOfAbsence" } },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
                { $project: { type: 1 } },
              ],

              active_ra: [
                { $match: { type: "ReducedActivity" } },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
                { $project: { type: 1, quota_scale: 1 } },
              ],
            },
          },

          {
            $project: {
              loa: { $arrayElemAt: ["$active_loa", 0] },
              ra: { $arrayElemAt: ["$active_ra", 0] },
            },
          },
        ],
      },
    },

    {
      $addFields: {
        activity_notice_info: {
          $let: {
            vars: {
              notice_data: {
                $arrayElemAt: ["$activity_notices", 0],
              },
            },

            in: {
              has_loa: {
                $ne: [{ $ifNull: ["$$notice_data.loa", null] }, null],
              },

              has_ra: {
                $and: [
                  {
                    $eq: [{ $ifNull: ["$$notice_data.loa", null] }, null],
                  },
                  {
                    $ne: [{ $ifNull: ["$$notice_data.ra", null] }, null],
                  },
                ],
              },

              quota_scale: {
                $cond: {
                  if: {
                    $ne: [{ $ifNull: ["$$notice_data.loa", null] }, null],
                  },

                  then: null,

                  else: {
                    $ifNull: ["$$notice_data.ra.quota_scale", null],
                  },
                },
              },
            },
          },
        },
      },
    },

    {
      $project: {
        _id: 0,

        shift_count: 1,
        total_onduty: 1,
        total_onbreak: 1,
        total_arrests: 1,
        total_citations: 1,
        frequent_shift_type: 1,
        activity_notice_info: 1,

        avg_onduty: {
          $cond: {
            if: {
              $eq: [
                {
                  $subtract: ["$shift_count", "$excluded_shift_count"],
                },
                0,
              ],
            },

            then: 0,
            else: {
              $round: {
                $divide: [
                  {
                    $subtract: ["$total_onduty", "$excluded_onduty"],
                  },
                  {
                    $subtract: ["$shift_count", "$excluded_shift_count"],
                  },
                ],
              },
            },
          },
        },

        avg_onbreak: {
          $cond: {
            if: {
              $eq: [
                {
                  $subtract: ["$shift_count", "$excluded_shift_count"],
                },
                0,
              ],
            },

            then: 0,
            else: {
              $round: {
                $divide: [
                  {
                    $subtract: ["$total_onbreak", "$excluded_onbreak"],
                  },
                  {
                    $subtract: ["$shift_count", "$excluded_shift_count"],
                  },
                ],
              },
            },
          },
        },
      },
    },
  ];
}

function CalculateQuotaStatus(
  TotalOnDuty: number,
  ServerQuota: number,
  ActivityNotice: ActivityNoticeInfo | null
): boolean | null {
  if (!ServerQuota) {
    return null;
  }

  if (ActivityNotice?.has_loa) {
    return true;
  }

  if (ActivityNotice?.has_ra && ActivityNotice.quota_scale !== null) {
    const ScaledQuota = ServerQuota * (1 - ActivityNotice.quota_scale);
    return TotalOnDuty >= ScaledQuota;
  }

  return TotalOnDuty >= ServerQuota;
}

function FormatShiftDuration(Duration: number, Average = false): string {
  if (Average) {
    if (Duration > 500) {
      return ReadableDuration(Duration);
    }

    return Duration > 0 ? "less than 1 minute" : "*insufficient data*";
  }

  return Duration < 500 && Duration > 0 ? "less than 1 minute" : ReadableDuration(Duration);
}

function FormatShiftStatistics(
  Raw: RawShiftStatistics,
  ServerQuota: number,
  IncludeActiveShift: boolean
): UserShiftStatistics {
  return {
    shift_count: Raw.shift_count + (IncludeActiveShift ? 1 : 0),
    total_onduty: FormatShiftDuration(Raw.total_onduty),
    total_onbreak: FormatShiftDuration(Raw.total_onbreak),
    total_arrests: Raw.total_arrests,
    total_citations: Raw.total_citations,
    avg_onduty: FormatShiftDuration(Raw.avg_onduty, true),
    avg_onbreak: FormatShiftDuration(Raw.avg_onbreak, true),
    quota_met: CalculateQuotaStatus(Raw.total_onduty, ServerQuota, Raw.activity_notice_info),
    frequent_shift_type: Raw.frequent_shift_type,
    active_notice: Raw.activity_notice_info,
  };
}
