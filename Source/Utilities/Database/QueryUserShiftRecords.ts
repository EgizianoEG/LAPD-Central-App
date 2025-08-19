/* eslint-disable sonarjs/no-duplicate-string */
import type { AggregateResults } from "@Typings/Utilities/Database.js";
import type { Guild, User } from "discord.js";
import ShiftModel from "@Models/Shift.js";

/**
 * Retrieves shift records with calculated durations for a specific user.
 * @param TargetUser - The targeted user whose shifts to retrieve.
 * @param GuildId - The guild id where the shifts were recorded.
 * @param ShiftType - Optional shift type filter.
 * @param CurrentDate - Date to use for calculating active shift durations (defaults to current date).
 * @returns Array of processed shift records with calculated durations.
 */
export default async function QueryUserShiftRecords(
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
