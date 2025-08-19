import { Guilds } from "@Typings/Utilities/Database.js";
import GetGuildSettings from "./GetGuildSettings.js";

/**
 * Returns all created shift types for a given guild id.
 * @param GuildId - The ID of the guild to get the shift types from.
 * @returns A promise resolves to an array of shift types
 */
export default async function GetShiftTypes(GuildId: string): Promise<Guilds.ShiftType[]> {
  return GetGuildSettings(GuildId).then((Settings) => {
    if (!Settings?.shift_management.shift_types.length) return [] as any;
    return Settings.shift_management.shift_types;
  });
}
