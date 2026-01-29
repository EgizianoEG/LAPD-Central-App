import { GenericRequestStatuses } from "#Source/Config/Constants.js";
import { Callsigns } from "#Source/Typings/Utilities/Database.js";
import CallsignModel from "#Source/Models/Callsign.js";

export default async function GetActiveCallsign(
  GuildId: string,
  TargetUserId: string
): Promise<Callsigns.CallsignDocument | null> {
  return CallsignModel.findOne({
    guild: GuildId,
    requester: TargetUserId,
    request_status: GenericRequestStatuses.Approved,
    $or: [{ expiry: null }, { expiry: { $gt: new Date() } }],
  }).lean();
}
