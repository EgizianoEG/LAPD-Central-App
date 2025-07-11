import { GuildMember } from "discord.js";
import IncidentModel from "@Models/Incident.js";
import CitationModel from "@Models/Citation.js";
import ArrestModel from "@Models/Arrest.js";

export interface StaffFieldActivityReturn {
  arrests_made: number;
  incidents_reported: number;
  arrests_assisted: number;
  citations_issued: {
    warnings: number;
    fines: number;
    total: number;
  };
}

/**
 * Returns the field activity data for a specific staff member.
 * @param StaffMember - The staff member whose field activity data should be returned.
 * @param [After] - The date after which the field activity data should be returned/considered.
 * @param [Until] - The date until which the field activity data should be returned/considered.
 * @returns The field activity data for the specified staff member.
 */
export default async function GetStaffFieldActivity(
  StaffMember: GuildMember,
  After?: Date | null,
  Until?: Date | null
): Promise<StaffFieldActivityReturn> {
  const GuildId = StaffMember.guild.id;
  const StaffDiscordId = StaffMember.id;
  const DateFilter = {};

  if (After) {
    Object.assign(DateFilter, { $gte: After });
  }

  if (Until) {
    Object.assign(DateFilter, { $lte: Until });
  }

  const [ArrestsMade, ArrestsAssisted, Citations, Incidents] = await Promise.all([
    ArrestModel.countDocuments({
      guild: GuildId,
      "arresting_officer.discord_id": StaffDiscordId,
      ...(Object.keys(DateFilter).length > 0 ? { made_on: DateFilter } : {}),
    }),
    ArrestModel.countDocuments({
      guild: GuildId,
      assisting_officers: StaffDiscordId,
      ...(Object.keys(DateFilter).length > 0 ? { made_on: DateFilter } : {}),
    }),
    CitationModel.find({
      guild: GuildId,
      "citing_officer.discord_id": StaffDiscordId,
      ...(Object.keys(DateFilter).length > 0 ? { issued_on: DateFilter } : {}),
    }).lean(),
    IncidentModel.countDocuments({
      guild: GuildId,
      "reporter.discord_id": StaffDiscordId,
      ...(Object.keys(DateFilter).length > 0 ? { reported_on: DateFilter } : {}),
    }),
  ]);

  const Warnings = Citations.filter((Citation) => Citation.cit_type === "Warning").length;
  const Fines = Citations.filter((Citation) => Citation.cit_type === "Fine").length;

  return {
    arrests_made: ArrestsMade,
    arrests_assisted: ArrestsAssisted,
    incidents_reported: Incidents,
    citations_issued: {
      warnings: Warnings,
      fines: Fines,
      total: Citations.length,
    },
  };
}
