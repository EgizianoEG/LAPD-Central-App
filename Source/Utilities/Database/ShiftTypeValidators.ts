import { IsValidDiscordId, IsValidShiftTypeName } from "@Utilities/Other/Validators.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import GuildModel from "@Models/Guild.js";

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
  return GuildModel.aggregate([
    {
      $match: {
        _id: GuildId,
      },
    },
    {
      $project: {
        exists: {
          $in: [ShiftType, "$settings.shift_management.shift_types.name"],
        },
      },
    },
  ]).then((Result) => Result[0]?.exists ?? false);
}

/**
 * Handles validation of the `name` interaction option (Shift Type Name).
 * @param ShiftTypeName - The provided shift type name from the user.
 * @param Interaction - The user command interaction.
 * @param DBCheck - If `true`, checks the database for the existence of the shift type. Defaults to `false`.
 * @returns If the interaction has been handled and a response has been sent, returns `true`; otherwise returns `false`.
 */
export async function HandleShiftTypeValidation(
  CmdInteraction: SlashCommandInteraction<"cached">,
  ShiftTypeName: string,
  DBCheck: boolean = false
): Promise<boolean> {
  if (!IsValidShiftTypeName(ShiftTypeName)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(CmdInteraction, true)
      .then(() => true);
  } else if (DBCheck && !(await ShiftTypeExists(CmdInteraction.guildId, ShiftTypeName))) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentShiftTypeUsage")
      .replyToInteract(CmdInteraction, true)
      .then(() => true);
  }

  return false;
}
