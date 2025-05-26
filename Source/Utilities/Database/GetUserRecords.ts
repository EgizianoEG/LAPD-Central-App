import { AggregateResults } from "@Typings/Utilities/Database.js";
import ArrestModel from "@Models/Arrest.js";
import CitationModel from "@Models/Citation.js";
import IncidentModel from "@Models/Incident.js";

/**
 * Retrieves user records (arrests, citations, and incidents as a suspect) from the database.
 * @param GuildId - The ID of the guild where the records are being queried.
 * @param RobloxId - The Roblox user ID of the target user.
 * @param RobloxUsername - The Roblox username of the target user (used for incident suspect searches).
 * @returns An object containing the user's records, including arrests, citations, and incidents as a suspect.
 *
 * The returned object includes:
 * - `arrests`: An array of arrest records for the user.
 * - `citations`: An array of citation records for the user.
 * - `total_arrests`: The total number of arrests for the user.
 * - `total_citations`: The total number of citations for the user.
 * - `total_incidents_as_suspect`: The total number of incidents where the user is identified as a suspect.
 * - `recent_arrest`: The most recent arrest record, or `null` if none exist.
 * - `recent_citation`: The most recent citation record, or `null` if none exist.
 */
export default async function GetUserRecords(
  GuildId: string,
  RobloxId: number,
  RobloxUsername: string
): Promise<AggregateResults.GetUserRecords> {
  const [IncidentsAsSuspect, Citations, Arrests] = await Promise.all([
    IncidentModel.find({ guild: GuildId, suspects: { $in: [RobloxUsername] } }, { num: 1 }).lean(),
    CitationModel.find({ guild: GuildId, "violator.id": RobloxId }).sort({ issued_on: -1 }).lean(),
    ArrestModel.find({ guild: GuildId, "arrestee.roblox_id": RobloxId })
      .sort({ made_on: -1 })
      .lean(),
  ]);

  return {
    arrests: Arrests,
    citations: Citations,
    total_arrests: Arrests.length,
    total_citations: Citations.length,
    incidents_as_suspect: IncidentsAsSuspect,
    recent_arrest: Arrests[0] ?? null,
    recent_citation: Citations[0] ?? null,
  };
}
