/* eslint-disable sonarjs/no-duplicate-string */
import type { PropertiesToString } from "utility-types";
import type { Shifts } from "@Typings/Utilities/Database.js";
import type { FilterQuery } from "mongoose";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import ShiftModel, { ShiftFlags } from "@Models/Shift.js";
import Guild from "@Models/Guild.js";

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
};

/**
 * Returns an object containing main data for a user's shifts.
 * This function utilizes the `aggregate` method of the `Shift` mongoose model.
 * @param QueryFilter - The query filter.
 * @param [HasActiveShift=false] - Whether the user has an active shift.
 * This parameter is mainly used to consider increasing shift count by one and without adding any durations.
 * @returns An object that contains main shifts data which also contains converted shift durations in human readable format.
 *
 * The returned object includes:
 * - `shift_count`: Total number of shifts.
 * - `total_onduty`: Total time spent on duty across all shifts.
 * - `total_onbreak`: Total time spent on break across all shifts.
 * - `total_arrests`: Total number of arrests across all shifts.
 * - `total_citations`: Total number of citations issued across all shifts.
 * - `avg_onduty`: Average time spent on duty per shift. Imported shifts are excluded from this calculation.
 * - `avg_onbreak`: Average time spent on break per shift. Imported shifts are excluded from this calculation.
 * - `frequent_shift_type`: The shift type with the highest total on-duty time.
 */
export default async function GetMainShiftsData(
  QueryFilter: FilterQuery<Shifts.ShiftDocument>,
  HasActiveShift: boolean = false
) {
  QueryFilter.end_timestamp = { $ne: null };
  QueryFilter.type = QueryFilter.type || { $exists: true };

  const ServerSetShiftQuota = await Guild.findById(
    QueryFilter.guild,
    {
      "settings.shift_management.default_quota": 1,
    },
    { lean: true }
  )
    .then((Doc) => Doc?.settings.shift_management.default_quota || 0)
    .catch(() => 0);

  return ShiftModel.aggregate<UserMainShiftsData>([
    { $match: QueryFilter },
    {
      $group: {
        _id: "$type",
        shift_count: { $sum: 1 },
        total_onbreak: { $sum: "$durations.on_break" },
        total_arrests: { $sum: "$events.arrests" },
        total_citations: { $sum: "$events.citations" },

        total_onduty: {
          $sum: {
            $add: [
              "$durations.on_duty",
              {
                $ifNull: ["$durations.on_duty_mod", 0],
              },
            ],
          },
        },

        total_onduty_manual: {
          $sum: {
            $cond: {
              if: {
                $in: ["$flag", [ShiftFlags.Imported, ShiftFlags.Administrative, ShiftFlags.System]],
              },
              then: {
                $add: [
                  "$durations.on_duty",
                  {
                    $ifNull: ["$durations.on_duty_mod", 0],
                  },
                ],
              },
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
      $project: {
        _id: 0,
        shift_count: 1,
        total_onduty: 1,
        total_onbreak: 1,
        total_arrests: 1,
        total_citations: 1,
        frequent_shift_type: 1,
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
      };
    }

    if (HasActiveShift) {
      Resp[0].shift_count++;
    }

    for (const [Key, Duration] of Object.entries(Resp[0])) {
      if (Key === "total_onduty" && typeof Duration === "number") {
        Resp[0].quota_met = ServerSetShiftQuota ? Duration >= ServerSetShiftQuota : null;
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

    return Resp[0] as unknown as ExpandRecursively<
      PropertiesToString<
        UserMainShiftsData,
        "shift_count" | "total_arrests" | "total_citations" | "quota_met"
      >
    >;
  });
}
