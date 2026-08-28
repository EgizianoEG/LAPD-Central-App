import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { GetBookingAutocompleteEntries } from "../Database/Arrest.js";

/**
 * Autocompletes an input booking number.
 * @param Typed The input value from user.
 * @param GuildId The interaction guild id.
 * @returns An array of suggestions.
 */
export default async function AutocompleteBookingNum(
  Typed: string,
  GuildId: string
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  const LowerCaseTyped = Typed.toLowerCase();
  const Bookings = await GetBookingAutocompleteEntries(GuildId, true);
  let Suggestions: typeof Bookings;

  if (Typed.match(/^\s*$/)) {
    Suggestions = Bookings;
  } else {
    Suggestions = Bookings.filter((Bk) => {
      const LowerCaseLabel = Bk.autocomplete_label.toLowerCase();
      return LowerCaseLabel.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseLabel);
    });
  }

  if (!Suggestions.length) Suggestions = Bookings;
  return Suggestions.map((Bk) => ({
    name: Bk.autocomplete_label,
    value: Bk.num,
  })).slice(0, 25);
}
