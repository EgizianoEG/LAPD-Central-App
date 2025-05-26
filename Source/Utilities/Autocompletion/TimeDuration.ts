import GetClosestMatches, { ReturnTypeEnums } from "didyoumean2";

const PredefinedDurations: string[] = [];
for (let i = 15; i <= 45; i += 15) {
  PredefinedDurations.push(`${i} minutes`);
}

for (let i = 1; i <= 8; i++) {
  for (let j = 0; j <= 45; j += 15) {
    if (j === 0) {
      PredefinedDurations.push(`${i} hour${i > 1 ? "s" : ""}`);
    } else {
      PredefinedDurations.push(`${i} hour${i > 1 ? "s" : ""} and ${j} minutes`);
    }
  }
}

export default function AutocompleteTimeDuration(
  Typed: string
): Array<{ name: string; value: string }> {
  let Suggestions: string[] = [];
  const Snz = Typed.toLowerCase()
    .replace(/and|,|;/gi, " and ")
    .replace(/\s+/g, " ")
    .replace(/\b(\d+)\s*(\w+)\b/g, (Match, Num, Unit) => {
      if (IsHour(Unit)) {
        return `${Num} hour${Num > 1 ? "s" : ""}`;
      } else if (IsMinute(Unit)) {
        return `${Num} minute${Num > 1 ? "s" : ""}`;
      } else if (IsDay(Unit)) {
        return `${Num} day${Num > 1 ? "s" : ""}`;
      } else {
        return Match;
      }
    });

  if (Typed.match(/^\s*$/)) {
    Suggestions = PredefinedDurations.filter((Duration) => !/,|and/gi.test(Duration));
  } else {
    Suggestions = PredefinedDurations.filter((Duration) => {
      const LowerCaseDuration = Duration.toLowerCase();
      return LowerCaseDuration.includes(Snz) || Snz.includes(LowerCaseDuration);
    });
  }

  if (!Suggestions.length) {
    Suggestions = GetClosestMatches(Snz, PredefinedDurations, {
      returnType: ReturnTypeEnums.ALL_CLOSEST_MATCHES,
    });
  }

  return Suggestions.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}

function IsDay(Keyword: string): boolean {
  return /days?|ds?/gi.test(Keyword);
}

function IsHour(Keyword: string): boolean {
  return /hours?|hrs?|hs?/gi.test(Keyword);
}

function IsMinute(Keyword: string): boolean {
  return /minutes?|m/gi.test(Keyword);
}
