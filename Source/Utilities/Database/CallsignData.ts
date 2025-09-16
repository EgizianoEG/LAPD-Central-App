import { GenericRequestStatuses } from "@Config/Constants.js";
import { Callsigns } from "@Typings/Utilities/Database.js";
import CallsignModel from "@Models/Callsign.js";

export interface CallsignValidationData {
  ExistingCallsign: Callsigns.CallsignDocument | null;
  PendingRequests: Callsigns.CallsignDocument[];
  MostRecentCallsign: Callsigns.CallsignDocument | null;
  ActiveCallsign: Callsigns.CallsignDocument | null;
}

/**
 * Fetches all necessary callsign data in a single database query for validation.
 * This replaces multiple separate queries with one efficient aggregation.
 * @param GuildId - The Id of the guild.
 * @param UserId - The Id of the user making the request.
 * @param Division - The division number for the requested callsign.
 * @param UnitType - The unit type for the requested callsign.
 * @param BeatNum - The beat number for the requested callsign.
 * @param RequestTime - The time of the request, used for expiry checks.
 * @returns An object containing existing callsign, pending requests, most recent callsign, and active callsign.
 */
export async function GetCallsignValidationData(
  GuildId: string,
  UserId: string,
  Division: number,
  UnitType: string,
  BeatNum: string,
  RequestTime: Date
): Promise<CallsignValidationData> {
  const Result = await CallsignModel.aggregate([
    {
      $facet: {
        ExistingCallsign: [
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

        PendingRequests: [
          {
            $match: {
              guild: GuildId,
              requester: UserId,
              request_status: GenericRequestStatuses.Pending,
            },
          },
        ],

        MostRecentCallsign: [
          {
            $match: {
              guild: GuildId,
              requester: UserId,
            },
          },
          { $sort: { requested_on: -1 } },
          { $limit: 1 },
        ],

        ActiveCallsign: [
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
  ]);

  const Data = Result[0];
  return {
    ExistingCallsign: Data.ExistingCallsign[0] || null,
    PendingRequests: Data.PendingRequests || [],
    MostRecentCallsign: Data.MostRecentCallsign[0] || null,
    ActiveCallsign: Data.ActiveCallsign[0] || null,
  };
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
