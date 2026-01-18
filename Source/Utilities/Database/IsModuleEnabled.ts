import { Guilds } from "#Typings/Utilities/Database.js";
import GetGuildSettings from "./GetGuildSettings.js";

/**
 * Checks if a module is enabled in a guild.
 * @param GuildId - The id of the guild to check the module for.
 * @param ModuleName - The name of the module to check.
 * @returns
 */
export default async function IsModuleEnabled(
  GuildId: string,
  ModuleName: keyof Omit<Guilds.GuildSettings, "require_authorization" | "role_perms">
) {
  return GetGuildSettings(GuildId).then((Settings) => {
    if (!Settings) return false;
    return (typeof Settings[ModuleName] === "object" && Settings[ModuleName].enabled) ?? false;
  });
}
