import { type ApplicationCommandOptionChoiceData } from "discord.js";
import GuildModel from "@Models/Guild.js";

const DefaultSuggestion = {
  name: "[Default Shift Type]",
  value: "Default",
};

/**
 * Autocompletes a shift type based on the typed value.
 * @param TypedValue - The value to be autocompleted.
 * @param GuildId - The id of the guild where the shift types should be retrieved.
 * @param IncludeDefault - Whether to include the default suggestion. Default is `true`.
 * @returns
 */
export default async function AutocompleteShiftType(
  TypedValue: string,
  GuildId: string,
  IncludeDefault = true
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  let Suggestions: (string | { name: string; value: string })[];
  const LowerCaseTyped = TypedValue.toLowerCase();
  const ShiftTypes = await GuildModel.findById(GuildId)
    .select("settings.shift_management.shift_types")
    .then((GuildData) => {
      if (!GuildData) return [];
      return GuildData.settings.shift_management.shift_types
        .map((ShiftType) => ShiftType.name)
        .sort((a, b) => a.localeCompare(b));
    });

  if (!ShiftTypes.length) {
    Suggestions = [];
  } else if (TypedValue.match(/^\s*$/)) {
    Suggestions = ShiftTypes;
  } else {
    Suggestions = ShiftTypes.filter((Element) => {
      const LowerCaseElement = Element.toLowerCase();
      return LowerCaseElement.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseElement);
    });
  }

  if (IncludeDefault) {
    Suggestions.unshift(DefaultSuggestion);
  }

  return Suggestions.slice(0, 25).map((Choice) =>
    typeof Choice === "string" ? { name: Choice, value: Choice } : Choice
  ) as { name: string; value: string }[];
}
