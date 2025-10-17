import { GuildArrests } from "@Source/Typings/Utilities/Database.js";
import { Types } from "mongoose";
import ArrestModel from "@Models/Arrest.js";

/**
 * Retrieves an arrest record from the database based on the provided parameters.
 * @param Guild - The identifier of the guild to which the arrest record belongs.
 * @param BookingNumOrId - The booking number, ID, or ObjectId of the arrest record to retrieve.
 *                          If a number is provided, it is treated as a booking number.
 *                          If a string or ObjectId is provided, it is treated as the record's ID.
 * @param Lean - Optional. If `true`, the result will be a plain JavaScript object instead of a Mongoose document.
 *               Defaults to `true`.
 * @returns A promise that resolves to the arrest record if found, or `null` if no record matches the criteria.
 */
export default async function GetArrestRecord(
  Guild: string,
  BookingNumOrId: number | string | Types.ObjectId,
  Lean: boolean = true
): Promise<GuildArrests.ArrestRecord | null> {
  const SearchLabel = typeof BookingNumOrId === "number" ? "booking_num" : "_id";
  return ArrestModel.findOne({
    guild: Guild,
    [SearchLabel]: BookingNumOrId,
  }).lean(Lean);
}
