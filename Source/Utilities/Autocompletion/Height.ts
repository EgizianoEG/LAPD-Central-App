const HeightOptions: string[] = [];

for (let i = 0; i <= 7; i++) {
  for (let j = 0; j <= 11; j++) {
    const Height = `${i}'${j}"`;
    HeightOptions.push(Height);
  }
}

/**
 * Autocompletes an input height value
 * @param TypedValue - The input height
 * @returns An array of height suggestions
 */
export default function AutocompleteHeight(
  TypedValue: string
): Array<{ name: string; value: string }> {
  let Suggestions: string[];

  if (TypedValue.match(/^\s*$/)) {
    Suggestions = HeightOptions.filter((Element) => {
      return Element.startsWith("5");
    });
  } else if (TypedValue.match(/^(10|11)"?$/)) {
    Suggestions = HeightOptions.filter((Element) => {
      return Element.endsWith(`${TypedValue}"`);
    });
  } else if (TypedValue.match(/^\d"$/)) {
    Suggestions = HeightOptions.filter((Element) => {
      return Element.endsWith(TypedValue);
    });
  } else {
    Suggestions = HeightOptions.filter((Element) => {
      return Element.includes(TypedValue);
    });
  }

  return Suggestions.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}
