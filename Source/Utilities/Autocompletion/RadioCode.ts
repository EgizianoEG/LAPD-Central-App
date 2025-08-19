import type { ApplicationCommandOptionChoiceData } from "discord.js";
import { TenCodes, ElevenCodes, LiteralCodes } from "@Resources/RadioCodes.js";
import { PoliceCodeToWords } from "@Utilities/Strings/Converters.js";

const AllCodes = [...LiteralCodes, ...TenCodes, ...ElevenCodes];
const CodeNames: string[] = [];
for (const Code of AllCodes) {
  const CodeInWords = PoliceCodeToWords(Code.code);
  CodeNames.push(`${Code.code} (${Code.code === CodeInWords ? "..." : CodeInWords})`);
}

/**
 * Autocompletes an input radio code.
 * @param Typed - The typed string.
 * @returns An array of objects containing name and value properties.
 */
export default function AutocompleteRadioCode(
  Typed: string
): Array<ApplicationCommandOptionChoiceData> {
  let Suggestions: string[] = [];
  const LowerCaseTyped = Typed.toLowerCase();

  if (Typed.match(/^\s*$/)) {
    Suggestions = CodeNames;
  } else if (Typed.match(/^C[\d-]+$/i)) {
    const CodeNumber = Typed.slice(1);
    const CodeName = `Code ${CodeNumber}`;
    Suggestions = CodeNames.filter((Name) => {
      return Name.toLowerCase().includes(CodeName.toLowerCase());
    });
  } else {
    Suggestions = CodeNames.filter((Name) => {
      const LowerCaseName = Name.toLowerCase();
      return LowerCaseName.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseName);
    });
  }

  if (!Suggestions.length) Suggestions = CodeNames;
  return Suggestions.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}
