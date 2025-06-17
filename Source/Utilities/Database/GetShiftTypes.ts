import { Guilds } from "@Typings/Utilities/Database.js";
import GuildModel from "@Models/Guild.js";

/**
 * Returns all created shift types for a given guild id.
 * @param GuildId - The ID of the guild to get the shift types from.
 * @returns A promise resolves to an array of shift types
 */
export default async function GetShiftTypes(GuildId: string): Promise<Guilds.ShiftType[]> {
  return GuildModel.findById(GuildId)
    .select("settings.shift_management.shift_types")
    .lean()
    .then((GuildData) => {
      if (!GuildData) return [] as any;
      return GuildData.settings.shift_management.shift_types;
    });
}
