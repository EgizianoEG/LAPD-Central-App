/* eslint-disable sonarjs/no-duplicate-string */
import type { Shifts } from "#Typings/Utilities/Database.js";
import type { QueryFilter } from "mongoose";
import type { PropertiesToString } from "utility-types";
import { ReadableDuration } from "#Utilities/Strings/Formatters.js";
import ShiftModel, { ShiftFlags } from "#Models/Shift.js";
import GetGuildSettings from "./GetGuildSettings.js";

export type UserMainShiftsData = {
  shift_count: number;
  total_onduty: number;
  total_onbreak: number;
  total_arrests: number;
  total_citations: number;
  avg_onduty: number;
  avg_onbreak: number;

  /** An indicator of whether the user has met their server set default shift quota or not. Null if this setting was not set. */
  quota_met: boolean | null;

  /** The shift type with the highest total on-duty time. **/
  frequent_shift_type: string;

  /** Active activity notice information affecting quota calculation. Null if no active notices. */
  active_notice: {
    has_loa: boolean;
    has_ra: boolean;
    quota_scale: number | null;
  } | null;
};

type RawShiftsAggregationRow = Omit<UserMainShiftsData, "active_notice" | "quota_met"> & {
  activity_notice_info: {
    has_loa: boolean;
    has_ra: boolean;
    quota_scale: number | null;
  } | null;
  quota_met?: boolean | null;
};

/**
 * Returns an object containing main data for a user's shifts.
 * This function utilizes the `aggregate` method of the `Shift` mongoose model and calculates
 * durations independently using mathematical operations on timestamps rather than relying on
 * stored duration field values to ensure consistency.
 *
 * @param InputQueryFilter - The query filter.
 * @param [HasActiveShift=false] - Whether the user has an active shift.
 * This parameter is mainly used to consider increasing shift count by one and without adding any durations.
 * @returns An object that contains main shifts data which also contains converted shift durations in human readable format.
 *
 * The returned object includes:
 * - `shift_count`: Total number of shifts.
 * - `total_onduty`: Total time spent on duty across all shifts (calculated from timestamps).
 * - `total_onbreak`: Total time spent on break across all shifts (calculated from break events).
 * - `total_arrests`: Total number of arrests across all shifts.
 * - `total_citations`: Total number of citations issued across all shifts.
 * - `avg_onduty`: Average time spent on duty per shift. Imported shifts are excluded from this calculation.
 * - `avg_onbreak`: Average time spent on break per shift. Imported shifts are excluded from this calculation.
 * - `frequent_shift_type`: The shift type with the highest total on-duty time.
 * - `quota_met`: Whether the user met their quota (considers active LOA/RA notices).
 * - `active_notice`: Information about active LOA/RA notices affecting quota calculation (null if none).
 */
export default async function GetMainShiftsData(
  InputQueryFilter: QueryFilter<Shifts.ShiftDocument> & { guild: string },
  HasActiveShift: boolean = false
) {
  const Filter = { ...InputQueryFilter };
  Filter.type = Filter.type || { $exists: true };

  if (typeof Filter.end_timestamp === "object" && Filter.end_timestamp !== null) {
    Filter.end_timestamp = {
      $ne: null,
      ...Filter.end_timestamp,
    };
  } else {
    Filter.end_timestamp = { $ne: null };
  }

  const ServerSetShiftQuota = await GetGuildSettings(Filter.guild)
    .then((Settings) => Settings?.shift_management.default_quota || 0)
    .catch(() => 0);

  return ShiftModel.aggregate<RawShiftsAggregationRow>([
    { $match: Filter as Record<string, unknown> },
    {
      $addFields: {
        total_duration: {
          $subtract: [{ $ifNull: ["$end_timestamp", "$$NOW"] }, "$start_timestamp"],
        },

        break_duration: {
          $cond: {
            if: { $gt: [{ $size: { $ifNull: ["$events.breaks", []] } }, 0] },
            then: {
              $let: {
                vars: {
                  total_dur: {
                    $subtract: [{ $ifNull: ["$end_timestamp", "$$NOW"] }, "$start_timestamp"],
                  },
                  raw_break_dur: {
                    $reduce: {
                      input: "$events.breaks",
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
                                      { $toLong: { $ifNull: ["$end_timestamp", "$$NOW"] } },
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
                  $max: [{ $min: ["$$raw_break_dur", "$$total_dur"] }, 0],
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
        total_arrests: { $sum: "$events.arrests" },
        total_citations: { $sum: "$events.citations" },

        total_onduty: {
          $sum: "$onduty_duration",
        },

        total_onduty_manual: {
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

        manual_shift_count: {
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
    { $sort: { shift_count: -1 } },
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

        manual_shift_count: { $sum: "$manual_shift_count" },
        total_onduty_manual: { $sum: "$total_onduty_manual" },
      },
    },
    {
      $lookup: {
        as: "activity_notices",
        from: "activity_notices",
        let: { guild: "$guild_id", user: "$user_id", retrieve_date: "$$NOW" },
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
              notice_data: { $arrayElemAt: ["$activity_notices", 0] },
            },
            in: {
              has_loa: { $gt: [{ $ifNull: ["$$notice_data.loa", null] }, null] },
              has_ra: {
                $and: [
                  { $eq: [{ $ifNull: ["$$notice_data.loa", null] }, null] },
                  { $gt: [{ $ifNull: ["$$notice_data.ra", null] }, null] },
                ],
              },
              quota_scale: {
                $cond: {
                  if: { $gt: [{ $ifNull: ["$$notice_data.loa", null] }, null] },
                  then: null,
                  else: { $ifNull: ["$$notice_data.ra.quota_scale", null] },
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
            if: { $eq: [{ $subtract: ["$shift_count", "$manual_shift_count"] }, 0] },
            then: 0,
            else: {
              $round: {
                $divide: [
                  {
                    $subtract: ["$total_onduty", "$total_onduty_manual"],
                  },
                  {
                    $subtract: ["$shift_count", "$manual_shift_count"],
                  },
                ],
              },
            },
          },
        },
        avg_onbreak: {
          $cond: {
            if: { $eq: [{ $subtract: ["$shift_count", "$manual_shift_count"] }, 0] },
            then: 0,
            else: {
              $round: {
                $divide: [
                  "$total_onbreak",
                  {
                    $subtract: ["$shift_count", "$manual_shift_count"],
                  },
                ],
              },
            },
          },
        },
      },
    },
  ]).then((Resp) => {
    if (Resp.length === 0) {
      Resp[0] = {
        shift_count: 0,
        total_onduty: 0,
        total_onbreak: 0,
        total_arrests: 0,
        total_citations: 0,
        quota_met: null,
        avg_onduty: 0,
        avg_onbreak: 0,
        frequent_shift_type: "N/A",
        activity_notice_info: null,
      };
    }

    if (HasActiveShift) {
      Resp[0].shift_count++;
    }

    for (const [Key, Duration] of Object.entries(Resp[0])) {
      if (Key === "total_onduty" && typeof Duration === "number") {
        const NoticeInfo = Resp[0].activity_notice_info;

        if (!ServerSetShiftQuota) {
          Resp[0].quota_met = null;
        } else if (NoticeInfo?.has_loa) {
          Resp[0].quota_met = true;
        } else if (NoticeInfo?.has_ra && NoticeInfo.quota_scale !== null) {
          const ScaledQuota = ServerSetShiftQuota * (1 - NoticeInfo.quota_scale);
          Resp[0].quota_met = Duration >= ScaledQuota;
        } else {
          Resp[0].quota_met = Duration >= ServerSetShiftQuota;
        }
      }

      if (Key === "shift_count" || Key.endsWith("s") || typeof Duration !== "number") continue;
      if (Key === "avg_onduty" || Key === "avg_onbreak") {
        (Resp[0][Key] as unknown as string) =
          Duration > 500
            ? ReadableDuration(Duration)
            : Duration > 0
              ? "less than 1 minute"
              : "*insufficient data*";
      } else {
        Resp[0][Key] =
          Duration < 500 && Duration > 0 ? "less than 1 minute" : ReadableDuration(Duration);
      }
    }

    const ReturnData: Record<string, unknown> = {
      shift_count: Resp[0].shift_count,
      total_onduty: Resp[0].total_onduty,
      total_onbreak: Resp[0].total_onbreak,
      total_arrests: Resp[0].total_arrests,
      total_citations: Resp[0].total_citations,
      avg_onduty: Resp[0].avg_onduty,
      avg_onbreak: Resp[0].avg_onbreak,
      quota_met: Resp[0].quota_met ?? null,
      frequent_shift_type: Resp[0].frequent_shift_type,
      active_notice: Resp[0].activity_notice_info
        ? {
            has_loa: Resp[0].activity_notice_info.has_loa,
            has_ra: Resp[0].activity_notice_info.has_ra,
            quota_scale: Resp[0].activity_notice_info.quota_scale,
          }
        : null,
    };

    return ReturnData as unknown as ExpandRecursively<
      PropertiesToString<
        UserMainShiftsData,
        "shift_count" | "total_arrests" | "total_citations" | "quota_met" | "active_notice"
      >
    >;
  });
}
