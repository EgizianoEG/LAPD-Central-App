import { IsValidShiftTypeName } from "./Validators.js";
import { ShiftTypeExists } from "@Utilities/Database/ShiftTypeValidators.js";

/**
 * Retrieves the **valid** target shift type(s) based on the provided interaction options.
 * @param Interaction - The slash command interaction object.
 * @param ValidateExisting - A boolean flag indicating whether to validate the existence of the shift types in the settings. Defaults to `false`.
 * @remarks Normalizes the shift type names to a standard format (e.g., "Default" for "default").
 * @returns A promise that resolves to a tuple containing two arrays:
 * - The first array contains the *valid* target shift types.
 * - The second array contains the target shift types.
 */
export default async function GetValidTargetShiftTypes(
  Interaction: SlashCommandInteraction<"cached">,
  ValidateExisting: boolean = false
): Promise<[string[], string[]]> {
  let TargetShiftTypes: string[] = [];
  let ValidShiftTypes: string[] = [];
  const CmdShiftType =
    Interaction.options.getString("type", false)?.trim() ??
    Interaction.options.getString("shift-type", false)?.trim();

  // Shift type name must not be less than 3 characters, and as a result,
  // the minimum length for multiple shift types must be at least 7 characters long when comma separated.
  if (CmdShiftType && CmdShiftType.length >= 7 && CmdShiftType.includes(",")) {
    TargetShiftTypes = CmdShiftType.trim()
      .split(",")
      .map((Type) => {
        Type = Type.trim();
        if (Type.toLowerCase() === "default") return "Default";
        return Type;
      });

    if (ValidateExisting) {
      ValidShiftTypes = await Promise.all(
        TargetShiftTypes.map(async (Type) => {
          if (IsValidShiftTypeName(Type)) {
            const DoesExist = await ShiftTypeExists(Interaction.guildId, Type);
            return DoesExist ? Type : null;
          }
          return null;
        })
      ).then((Results) => Results.filter((Type) => Type !== null));
    } else {
      ValidShiftTypes = TargetShiftTypes.filter((Type) => IsValidShiftTypeName(Type));
    }
  } else if (CmdShiftType) {
    if (IsValidShiftTypeName(CmdShiftType)) ValidShiftTypes = [CmdShiftType];
    TargetShiftTypes = [CmdShiftType];
  }

  return [ValidShiftTypes, TargetShiftTypes];
}
