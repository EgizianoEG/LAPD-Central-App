import { addMilliseconds, subMilliseconds } from "date-fns";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { AggregationResults } from "@Typings/Utilities/Database.js";
import CallsignModel from "@Models/Callsign.js";
export type CallsignValidationData = AggregationResults.CallsignsModel.GetCallsignValidationData;

/**
 * Fetches all necessary callsign data in a single database query for validation.
 * This replaces multiple separate queries with one efficient aggregation.
 * @param GuildId - The Id of the guild.
 * @param UserId - The Id of the user making the request.
 * @param Division - The division number for the requested callsign.
 * @param UnitType - The unit type for the requested callsign.
 * @param BeatNum - The beat number for the requested callsign.
 * @param RequestTime - The time of the request, used for expiry checks. Defaults to current time.
 * @returns An object containing existing callsign, pending requests, most recent callsign, and active callsign.
 */
export async function GetCallsignValidationData(
  GuildId: string,
  UserId: string,
  Division: number,
  UnitType: string,
  BeatNum: string,
  RequestTime: Date = new Date()
): Promise<AggregationResults.CallsignsModel.GetCallsignValidationData> {
  const Result =
    await CallsignModel.aggregate<AggregationResults.CallsignsModel.GetCallsignValidationData>([
      {
        $facet: {
          existing_callsign: [
            {
              $match: {
                guild: GuildId,
                "designation.division": Division,
                "designation.unit_type": UnitType,
                "designation.beat_num": BeatNum,
                request_status: {
                  $in: [GenericRequestStatuses.Approved, GenericRequestStatuses.Pending],
                },
                $or: [{ expiry: null }, { expiry: { $gt: RequestTime } }],
              },
            },
            { $limit: 1 },
          ],

          pending_requests: [
            {
              $match: {
                guild: GuildId,
                requester: UserId,
                request_status: GenericRequestStatuses.Pending,
              },
            },
            { $sort: { requested_on: -1 } },
            { $limit: 1 },
          ],

          most_recent_callsign: [
            {
              $match: {
                guild: GuildId,
                requester: UserId,
              },
            },
            { $sort: { requested_on: -1 } },
            { $limit: 1 },
          ],

          active_callsign: [
            {
              $match: {
                guild: GuildId,
                requester: UserId,
                request_status: GenericRequestStatuses.Approved,
                $or: [{ expiry: null }, { expiry: { $gt: RequestTime } }],
              },
            },
            { $limit: 1 },
          ],
        },
      },
      {
        $project: {
          most_recent_callsign: { $ifNull: [{ $arrayElemAt: ["$most_recent_callsign", 0] }, null] },
          active_callsign: { $ifNull: [{ $arrayElemAt: ["$active_callsign", 0] }, null] },
          existing_callsign: {
            $ifNull: [{ $arrayElemAt: ["$existing_callsign", 0] }, null],
          },
          pending_request: {
            $ifNull: [{ $arrayElemAt: ["$pending_requests", 0] }, null],
          },
        },
      },
    ]);

  return Result[0];
}

/**
 * Fetches comprehensive callsign data for a target user for administrative purposes.
 * @param GuildId - The guild Id where the callsigns are located.
 * @param TargetUserId - The Id of the user to fetch callsign data for.
 * @param ComparisonDate - The date to use for expiry comparisons.
 * @returns An object containing pending, active, and previous callsigns.
 */
export async function GetCallsignAdminData(
  GuildId: string,
  TargetUserId: string,
  ComparisonDate: Date = new Date()
): Promise<AggregationResults.CallsignsModel.GetCallsignAdminData> {
  const Result =
    await CallsignModel.aggregate<AggregationResults.CallsignsModel.GetCallsignAdminData>([
      {
        $facet: {
          pending_callsign: [
            {
              $match: {
                guild: GuildId,
                requester: TargetUserId,
                request_status: GenericRequestStatuses.Pending,
              },
            },
            { $limit: 1 },
          ],

          active_callsign: [
            {
              $match: {
                guild: GuildId,
                requester: TargetUserId,
                request_status: GenericRequestStatuses.Approved,
                expiry_notified: false,
                $or: [{ expiry: null }, { expiry: { $gt: ComparisonDate } }],
              },
            },
            { $limit: 1 },
          ],

          previous_callsigns: [
            {
              $match: {
                guild: GuildId,
                requester: TargetUserId,
                $or: [
                  { request_status: GenericRequestStatuses.Denied },
                  {
                    request_status: GenericRequestStatuses.Approved,
                    expiry: { $lte: ComparisonDate },
                  },
                  {
                    request_status: GenericRequestStatuses.Approved,
                    expiry_notified: true,
                    expiry: {
                      $lte: addMilliseconds(ComparisonDate, 1000),
                      $gte: subMilliseconds(ComparisonDate, 1000),
                    },
                  },
                ],
              },
            },
            { $sort: { requested_on: -1 } },
            { $limit: 10 },
          ],

          callsign_history: [
            {
              $match: {
                guild: GuildId,
                requester: TargetUserId,
                $or: [
                  {
                    request_status: {
                      $in: [GenericRequestStatuses.Denied, GenericRequestStatuses.Cancelled],
                    },
                  },
                  {
                    request_status: GenericRequestStatuses.Approved,
                    expiry: { $lte: ComparisonDate },
                  },
                  {
                    request_status: GenericRequestStatuses.Approved,
                    expiry_notified: true,
                    expiry: {
                      $lte: addMilliseconds(ComparisonDate, 1000),
                      $gte: subMilliseconds(ComparisonDate, 1000),
                    },
                  },
                ],
              },
            },
            { $sort: { requested_on: -1 } },
            { $limit: 25 },
          ],
        },
      },
      {
        $project: {
          previous_callsigns: "$previous_callsigns",
          callsign_history: "$callsign_history",
          active_callsign: { $ifNull: [{ $arrayElemAt: ["$active_callsign", 0] }, null] },
          pending_callsign: {
            $ifNull: [{ $arrayElemAt: ["$pending_callsign", 0] }, null],
          },
        },
      },
    ]);

  return Result[0];
}
