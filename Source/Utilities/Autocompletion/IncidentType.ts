import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { IncidentCategories } from "@Resources/IncidentConstants.js";

const IncidentTypesWithCategories = Object.entries(IncidentCategories)
  .flatMap(([Category, Types]) =>
    Types.map((Type: string) => ({ name: `${Category} – ${Type}`, value: Type }))
  )
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Autocompletes an input incident type.
 * @param Typed The input value from user.
 * @param GuildId The interaction guild id.
 * @returns An array of suggestions.
 */
export default async function AutocompleteIncidentType(
  Typed: string
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: { name: string; value: string }[];

  if (Typed.match(/^\s*$/)) {
    Suggestions = IncidentTypesWithCategories;
  } else {
    Suggestions = IncidentTypesWithCategories.filter((Incident) => {
      const LowerCaseIncidentType = Incident.name.toLowerCase();
      return (
        LowerCaseIncidentType.includes(LowerCaseTyped) ||
        LowerCaseTyped.includes(LowerCaseIncidentType)
      );
    });
  }

  if (!Suggestions.length) Suggestions = IncidentTypesWithCategories;
  return Suggestions.toSorted((a, b) => a.name.localeCompare(b.name)).slice(0, 25);
}
