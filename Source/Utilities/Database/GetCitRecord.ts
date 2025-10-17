import CitationModel from "@Models/Citation.js";
import { GuildCitations } from "@Source/Typings/Utilities/Database.js";
import type { Types } from "mongoose";

/**
 * Retrieves a citation record from the database based on the provided parameters.
 * @param GuildId - The ID of the guild to which the citation belongs.
 * @param CitNumId - The citation identifier, which can be a number, string, or a MongoDB ObjectId.
 * @param Lean - Optional. If `true`, the result will be returned as a plain JavaScript object
 *               rather than a Mongoose document. Defaults to `true`.
 * @returns A promise that resolves to the citation record if found, or `null` if no record matches the query.
 */
export default async function GetCitationRecord(
  GuildId: string,
  CitNumId: number | string | Types.ObjectId,
  Lean: boolean = true
): Promise<GuildCitations.AnyCitationData | null> {
  const SearchLabel = typeof CitNumId === "number" ? "num" : "_id";
  return CitationModel.findOne({
    guild: GuildId,
    [SearchLabel]: CitNumId,
  }).lean(Lean);
}
