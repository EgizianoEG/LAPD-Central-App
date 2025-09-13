import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { ServiceUnitTypes, DivisionBeats } from "@Resources/LAPDCallsigns.js";

/**
 * Autocompletes an input callsign service unit type.
 * @param Typed The input value from user.
 * @returns An array of suggestions.
 */
export function AutocompleteServiceUnitType(
  Typed: string
): Array<ApplicationCommandOptionChoiceData> {
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: { name: string; value: string }[];

  if (Typed.match(/^\s*$/)) {
    Suggestions = ServiceUnitTypes.map((u) => ({
      name: `${u.unit}  –  (${u.desc})`,
      value: u.unit,
    }));
  } else {
    Suggestions = ServiceUnitTypes.filter((u) => {
      const LowerCaseUnit = u.unit.toLowerCase();
      return LowerCaseUnit.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseUnit);
    }).map((u) => ({
      name: `${u.unit}  –  (${u.desc})`,
      value: u.unit,
    }));
  }

  if (!Suggestions.length)
    Suggestions = ServiceUnitTypes.map((u) => ({
      name: `${u.unit}  –  (${u.desc})`,
      value: u.unit,
    }));

  return Suggestions.slice(0, 25);
}

/**
 * Autocompletes an input division beat number.
 * @param Typed The input value from user.
 * @returns An array of suggestions.
 */
export function AutocompleteDivisionBeat(Typed: string): Array<ApplicationCommandOptionChoiceData> {
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: { name: string; value: string }[];

  if (Typed.match(/^\s*$/)) {
    Suggestions = DivisionBeats.map((b) => ({ name: b.name, value: `${b.num}` }));
  } else {
    Suggestions = DivisionBeats.filter((b) => {
      const LowerCaseName = b.name.toLowerCase();
      const NumMatch = `${b.num}`.includes(Typed);
      const NameMatch =
        LowerCaseName.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseName);
      return NameMatch || NumMatch;
    }).map((b) => ({ name: `(${b.num}) ${b.name}`, value: `${b.num}` }));
  }

  if (!Suggestions.length)
    Suggestions = DivisionBeats.map((b) => ({ name: `(${b.num}) ${b.name}`, value: `${b.num}` }));

  return Suggestions.slice(0, 25);
}
