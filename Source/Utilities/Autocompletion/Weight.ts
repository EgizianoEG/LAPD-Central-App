import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { EscapeRegExp } from "#Utilities/Strings/Formatters.js";

const WeightOptions: string[] = [];
const Cache: Record<string, { name: string; value: string }[]> = {};

for (let i = 25; i <= 700; i++) {
  WeightOptions.push(i.toString());
}

Cache.Default = WeightOptions.filter((Element) => {
  return Element.match(/^1\d0$/);
}).map((Choice) => ({ name: `${Choice} lbs`, value: Choice }));

/**
 * Autocompletes an input weight.
 * @param TypedValue - The user's input value.
 * @returns An array of weight suggestions.
 */
export default function AutocompleteWeight(
  TypedValue: string
): Array<ApplicationCommandOptionChoiceData> {
  let Suggestions: string[];

  if (TypedValue in Cache) return Cache[TypedValue];
  if (TypedValue.match(/^\D*$/)) {
    return Cache.Default;
  } else if (TypedValue.length === 1) {
    Suggestions = WeightOptions.filter((Element) => {
      return Element.match(new RegExp(`^${EscapeRegExp(TypedValue)}\\d0$`));
    });
  } else {
    Suggestions = WeightOptions.filter((Element) => {
      return Element.startsWith(TypedValue.replaceAll(/[^\d]+/g, ""));
    });
  }

  Cache[TypedValue] = Suggestions.slice(0, 25).map((Choice) => ({
    name: `${Choice} lbs`,
    value: Choice,
  }));

  return Cache[TypedValue];
}
