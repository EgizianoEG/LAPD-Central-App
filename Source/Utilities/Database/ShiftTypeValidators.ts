import { IsValidDiscordId, IsValidShiftTypeName } from "@Utilities/Helpers/Validators.js";
import { RepliableInteraction } from "discord.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import GetGuildSettings from "./GetGuildSettings.js";

/**
 * Checks if a given shift type exists for a specific guild.
 * @param GuildId - The unique identifier of the guild.
 * @param ShiftType - The name of the shift type to check. If the shift type is "Default" (case-insensitive), it will always return `true`.
 * @returns A promise that resolves to `true` if the shift type exists, otherwise `false`.
 *
 * The function queries the database to determine if the specified shift type exists
 * in the guild's shift management settings.
 */
export async function ShiftTypeExists(GuildId: string, ShiftType: string): Promise<boolean> {
  if (!IsValidDiscordId(GuildId)) throw new TypeError("Invalid Guild Id provided.");
  if (ShiftType.match(/^Default$/i)) return true;
  return GetGuildSettings(GuildId).then((GuildSettings) => {
    if (!GuildSettings?.shift_management.shift_types.length) {
      return false;
    }

    return (
      GuildSettings.shift_management.shift_types.findIndex((Type) => Type.name === ShiftType) !== -1
    );
  });
}

/**
 * Handles validation of the `name` interaction option (Shift Type Name).
 * @param ShiftTypeName - The provided shift type name from the user.
 * @param Interaction - The user command interaction.
 * @param DBCheck - If `true`, checks the database for the existence of the shift type. Defaults to `false`.
 * @returns If the interaction has been handled and a response has been sent, returns `true`; otherwise returns `false`.
 */
export async function HandleShiftTypeValidation(
  Interaction: RepliableInteraction<"cached">,
  ShiftTypeName: string,
  DBCheck: boolean = false
): Promise<boolean> {
  if (!IsValidShiftTypeName(ShiftTypeName)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (DBCheck && !(await ShiftTypeExists(Interaction.guildId, ShiftTypeName))) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentShiftTypeUsage")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}
