import { GenericRequestStatuses } from "@Config/Constants.js";
import { AggregationResults, Callsigns } from "@Typings/Utilities/Database.js";
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
          previous_callsigns: "$previous_callsigns",
          active_callsign: { $ifNull: [{ $arrayElemAt: ["$active_callsign", 0] }, null] },
          existing_callsign: {
            $ifNull: [{ $arrayElemAt: ["$existing_callsign", 0] }, null],
          },
          pending_callsign: {
            $ifNull: [{ $arrayElemAt: ["$pending_requests", 0] }, null],
          },
        },
      },
    ]);

  return Result[0];
}

/**
 * Fetches the callsign history for a specific user regardless of status.
 * @param GuildId - The Id of the guild to fetch the callsign history from.
 * @param UserId - The Id of the user to fetch the callsign history for.
 * @param Limit - The maximum number of history entries to return.
 * @returns An array of callsign history documents sorted by `requested_on` in descending order.
 */
export async function GetCallsignHistoryForUser(
  GuildId: string,
  UserId: string,
  Limit: number = 10
): Promise<Callsigns.CallsignDocument[]> {
  return CallsignModel.find({
    guild: GuildId,
    requester: UserId,
  })
    .limit(Limit)
    .sort({ requested_on: -1 })
    .exec();
}

/**
 * Retrieves the history of a specific callsign designation, including previous and current holders.
 * @param Guild - The guild where the callsign history is being retrieved.
 * @param Designation - The callsign designation to get history for.
 * @param Limit - The maximum number of history entries to return (default is `10`).
 * @returns A Promise resolving to an array of callsign documents sorted by request date (newest first).
 */
export async function GetCallsignHistoryFor(
  GuildId: string,
  Designation: Callsigns.CallsignDesignation,
  Limit: number = 10
): Promise<Callsigns.CallsignDocument[]> {
  return CallsignModel.find({
    guild: GuildId,
    designation: Designation,
    request_status: { $in: ["Approved", "Denied"] },
  })
    .sort({ requested_on: -1 })
    .limit(Limit)
    .exec();
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
                ],
              },
            },
            { $sort: { requested_on: -1 } },
            { $limit: 10 },
          ],
        },
      },
      {
        $project: {
          previous_callsigns: "$previous_callsigns",
          active_callsign: { $ifNull: [{ $arrayElemAt: ["$active_callsign", 0] }, null] },
          pending_callsign: {
            $ifNull: [{ $arrayElemAt: ["$pending_callsign", 0] }, null],
          },
        },
      },
    ]);

  return Result[0];
}
