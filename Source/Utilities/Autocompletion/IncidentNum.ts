import { type ApplicationCommandOptionChoiceData } from "discord.js";
import GetAllIncidentNums from "@Utilities/Database/GetIncidentNumbers.js";

/**
 * Autocompletes an input incident number.
 * @param Typed The input value from user.
 * @param GuildId The interaction guild id.
 * @returns An array of suggestions.
 */
export default async function AutocompleteIncidentNum(
  Typed: string,
  GuildId: string
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  const Incidents = await GetAllIncidentNums(GuildId, true);
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: typeof Incidents;

  if (Typed.match(/^\s*$/)) {
    Suggestions = Incidents;
  } else {
    Suggestions = Incidents.filter((Incident) => {
      const LowerCasedIncident = Incident.autocomplete_label.toLowerCase();
      return (
        LowerCasedIncident.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCasedIncident)
      );
    });
  }

  if (!Suggestions.length) Suggestions = Incidents;
  return Suggestions.slice(0, 25).map((Incident) => ({
    name: Incident.autocomplete_label,
    value: Incident.num,
  }));
}
