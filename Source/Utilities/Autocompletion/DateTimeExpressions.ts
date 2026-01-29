import GetClosestMatches, { ReturnTypeEnums } from "didyoumean2";

// ---------------------------------------------------------------------------------------
// Types & Constants:
// ------------------
type Choice = { name: string; value: string };
type AutocompleteMode = "start" | "end" | "any";
type AutocompleteOpts = {
  /**
   * Adjusts default suggestions (e.g., end date prefers "today").
   * This does not prevent users from typing any valid Chrono expression.
   */
  mode?: AutocompleteMode;

  /**
   * Reference date used for month/day generation (defaults to now).
   * This is only used for generating suggestions; parsing still happens elsewhere.
   */
  reference_date?: Date;
};

const MinuteSteps = [0, 15, 30, 45] as const;

const Weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const Months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const SmallNumberWords: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TensNumberWords: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

// ---------------------------------------------------------------------------------------
// Autocompletion Functions:
// -------------------------
/**
 * Smart autocomplete for human-readable date/time expressions.
 *
 * This is intentionally suggestion-based (not parsing-based): it generates likely expressions
 * that Chrono package can parse later during execution.
 *
 * @param Typed - Raw user input.
 * @param Opts - Autocomplete options.
 * @return List of suggestion choices. Max 25 items.
 */
export default function AutocompleteDateTimeExpressions(
  Typed: string,
  Opts: AutocompleteOpts = {}
): Choice[] {
  const Mode = Opts.mode ?? "any";
  const ReferenceDate = Opts.reference_date ?? new Date();
  const Snz = Normalize(Typed);

  const Suggestions: string[] = [];

  // 1. Base presets (also used as a pool for fuzzy matches)
  Suggestions.push(...BuildBaseSuggestions(Mode));

  // 2a. Number-driven suggestions ("7" / "two" -> "7 days ago" / "two days ago", etc.)
  const Quantity = ParseLeadingQuantity(Snz);
  if (Quantity) {
    const N = Quantity.quantity;
    const Q = Quantity.phrase;
    const Pl = (Unit: string) => {
      if (N === 1 && (Q === "a" || Q === "an")) {
        const Article = GetIndefiniteArticleForUnit(Unit);
        return `${Article} ${Unit}`;
      }

      return `${Q} ${Unit}${N === 1 ? "" : "s"}`;
    };

    Suggestions.push(
      `${Pl("minute")} ago`,
      `${Pl("hour")} ago`,
      `${Pl("day")} ago`,
      `${Pl("week")} ago`,
      `in ${Pl("minute")}`,
      `in ${Pl("hour")}`,
      `in ${Pl("day")}`,
      `in ${Pl("week")}`
    );
  }

  // 2b. Time-of-day suggestions ("5pm", "17:30", "at 5:15")
  // Only add these when the input looks time-related to avoid fighting with duration suggestions.
  if (IsTimeOfDayInput(Snz)) {
    Suggestions.push(...BuildTimeOfDaySuggestions(Snz, Mode));
  }

  // 3. "last ..." / "this ..." suggestions
  if (Snz.startsWith("last") || Snz.startsWith("this")) {
    Suggestions.push(
      "last week",
      "last month",
      "last year",
      "this week",
      "this month",
      "this year"
    );

    for (const D of Weekdays) {
      Suggestions.push(`last ${D}`, `this ${D}`);
    }
  }

  // 4. Month-name suggestions ("jan" -> "January 1", "January 15", "January 31")
  //    Works for partial month prefixes too.
  const MonthPrefix = Snz.match(/^([a-z]{3,9})\b/)?.[1] ?? "";
  const MonthIdx = MonthPrefix ? MonthIndexFromPrefix(MonthPrefix) : -1;
  if (MonthIdx >= 0) {
    const Year = ReferenceDate.getFullYear();
    const MonthName = Months[MonthIdx];
    const LastDay = GetLastDayOfMonth(Year, MonthIdx);
    const TitleMonth = MonthName.charAt(0).toUpperCase() + MonthName.slice(1);

    Suggestions.push(
      `${TitleMonth} 1`,
      `${TitleMonth} 15`,
      `${TitleMonth} ${LastDay}`,
      `${TitleMonth} 1, ${Year}`,
      `${TitleMonth} 15, ${Year}`,
      `${TitleMonth} ${LastDay}, ${Year}`
    );
  }

  const Unique = UniquePreserveOrder(Suggestions);
  const Filtered = FilterByInput(Unique, Typed);

  return Filtered.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Normalizes user input for matching.
 * @param Input - Raw user input.
 * @returns Normalized string.
 * @example
 * Normalize("  Two   HOURS \n") // "two hours"
 */
function Normalize(Input: string): string {
  return Input.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Deduplicates a list (case-insensitive), preserving original order.
 * @param Items - Candidate strings.
 * @returns Deduplicated list.
 * @example
 * UniquePreserveOrder(["Now", "now", "today"]) // ["Now", "today"]
 */
function UniquePreserveOrder(Items: string[]): string[] {
  const Seen = new Set<string>();
  const Out: string[] = [];

  for (const Item of Items) {
    const Key = Item.toLowerCase();
    if (Seen.has(Key)) continue;
    Seen.add(Key);
    Out.push(Item);
  }

  return Out;
}

/**
 * Reorders items so that any preferred values appear first.
 * Matching is case-insensitive.
 * @param Items - Candidate strings.
 * @param Preferred - Values to promote to the front.
 * @returns Reordered array with preferred items first.
 * @example
 * PreferOrder(["now", "today", "yesterday"], ["today"]) // ["today", "now", "yesterday"]
 */
function PreferOrder(Items: string[], Preferred: string[]): string[] {
  const PreferredSet = new Set(Preferred.map((s) => s.toLowerCase()));
  const Head: string[] = [];
  const Tail: string[] = [];

  for (const Item of Items) {
    (PreferredSet.has(Item.toLowerCase()) ? Head : Tail).push(Item);
  }

  return [...Head, ...Tail];
}

/**
 * Gets a month index from a typed prefix (e.g., "jan" -> 0).
 * @param Prefix - Month prefix.
 * @returns Month index (0-11), or -1 if not found.
 * @example
 * MonthIndexFromPrefix("jan") // 0
 * @example
 * MonthIndexFromPrefix("zzz") // -1
 */
function MonthIndexFromPrefix(Prefix: string): number {
  const P = Prefix.toLowerCase();
  return Months.findIndex((m) => m.startsWith(P));
}

/**
 * Returns the last day of a month (28-31).
 * @param Year - Full year.
 * @param MonthIndex - Month index (0-11).
 * @returns Last day of month.
 * @example
 * GetLastDayOfMonth(2024, 1) // 29
 */
function GetLastDayOfMonth(Year: number, MonthIndex: number): number {
  return new Date(Year, MonthIndex + 1, 0).getDate();
}

/**
 * Builds baseline date/time suggestions.
 * @param Mode - Autocomplete mode.
 * @returns List of suggestion strings.
 * @example
 * BuildBaseSuggestions("end") // includes "today" and "now" early
 */
function BuildBaseSuggestions(Mode: AutocompleteMode): string[] {
  const Base = [
    "now",
    "today",
    "yesterday",
    "tomorrow",
    "this week",
    "last week",
    "this month",
    "last month",
    "this year",
    "last year",
    "3 days ago",
    "7 days ago",
    "14 days ago",
    "30 days ago",
  ];

  if (Mode === "end") {
    return PreferOrder(Base, ["today", "now"]);
  }

  if (Mode === "start") {
    return PreferOrder(Base, ["yesterday", "7 days ago", "14 days ago"]);
  }

  return Base;
}

/**
 * Filters suggestions based on user input. Falls back to fuzzy matching.
 * @param Suggestions - Candidate suggestions.
 * @param Typed - Raw user input.
 * @returns Filtered suggestions (may be fuzzy-matched).
 * @example
 * FilterByInput(["today", "yesterday"], "tod") // ["today"]
 */
function FilterByInput(Suggestions: string[], Typed: string): string[] {
  const T = Normalize(Typed);
  if (!T.length) return Suggestions;

  const Direct = Suggestions.filter((s) => Normalize(s).includes(T) || T.includes(Normalize(s)));
  if (Direct.length) return Direct;

  // Fallback: fuzzy matching against our suggestion pool
  return GetClosestMatches(T, Suggestions, {
    returnType: ReturnTypeEnums.ALL_CLOSEST_MATCHES,
  });
}

/**
 * Attempts to parse a spelled-out number phrase.
 * Supports values like: "two", "nine", "twenty", "twenty one", "twenty-one".
 * @param Input - Normalized input.
 * @returns Parsed number and how many tokens were consumed, or null if not matched.
 * @example
 * ParseWordNumberPrefix("twenty one hours") // { value: 21, tokens: 2 }
 * @example
 * ParseWordNumberPrefix("blah") // null
 */
function ParseWordNumberPrefix(Input: string): { value: number; tokens: number } | null {
  const Tokens = Input.split(" ")
    .slice(0, 2)
    .map((t) => t.replace(/[^a-z-]/g, ""))
    .filter(Boolean);

  if (Tokens.length === 0) return null;
  if (Tokens[0].includes("-")) {
    // Handle hyphenated forms like "twenty-one".
    const Parts = Tokens[0].split("-").filter(Boolean);

    if (Parts.length === 2) {
      const Tens = TensNumberWords[Parts[0]];
      const Ones = SmallNumberWords[Parts[1]];
      if (typeof Tens === "number" && typeof Ones === "number") {
        return { value: Tens + Ones, tokens: 1 };
      }
    }
  }

  const First = Tokens[0];
  if (First === "a" || First === "an") {
    return { value: 1, tokens: 1 };
  }

  const Small = SmallNumberWords[First];
  if (typeof Small === "number") {
    return { value: Small, tokens: 1 };
  }

  const Tens = TensNumberWords[First];
  if (typeof Tens !== "number") return null;

  if (Tokens.length >= 2) {
    const Second = Tokens[1];
    const Ones = SmallNumberWords[Second];
    if (typeof Ones === "number" && Ones > 0) {
      return { value: Tens + Ones, tokens: 2 };
    }
  }

  return { value: Tens, tokens: 1 };
}

/**
 * Parses a leading numeric token from user input.
 * Supports both digits ("7") and words ("two", "twenty one").
 * @param Snz - Normalized user input.
 * @returns Parsed quantity and the phrase used, or null if not found.
 * @example
 * ParseLeadingQuantity("7 days") // { quantity: 7, phrase: "7" }
 * @example
 * ParseLeadingQuantity("two hours") // { quantity: 2, phrase: "two" }
 */
function ParseLeadingQuantity(Snz: string): { quantity: number; phrase: string } | null {
  const DigitMatch = Snz.match(/^(?:in\s+)?(\d{1,4})\b/);
  if (DigitMatch) {
    const N = Number.parseInt(DigitMatch[1], 10);
    if (!Number.isNaN(N) && N > 0) {
      return { quantity: N, phrase: DigitMatch[1] };
    }
  }

  const WordParsed = ParseWordNumberPrefix(Snz.replace(/^in\s+/, ""));
  if (!WordParsed || WordParsed.value <= 0) return null;

  const Phrase = Snz.replace(/^in\s+/, "")
    .split(" ")
    .slice(0, WordParsed.tokens)
    .join(" ");

  return { quantity: WordParsed.value, phrase: Phrase };
}

/**
 * Chooses the correct indefinite article ("a" vs "an") for a unit word.
 * This is used only for suggestion display quality.
 * @param Unit - Unit word (e.g., "hour", "minute").
 * @returns Indefinite article for the unit.
 * @example
 * GetIndefiniteArticleForUnit("hour") // "an"
 * @example
 * GetIndefiniteArticleForUnit("day") // "a"
 */
function GetIndefiniteArticleForUnit(Unit: string): "a" | "an" {
  const U = Unit.toLowerCase();
  if (U === "hour") return "an";
  return /^[aeiou]/.test(U) ? "an" : "a";
}

/**
 * Returns true if the input looks like a time-of-day expression (hours/minutes).
 * Examples: "5", "5p", "5pm", "17", "17:30", "at 5", "5:15 pm".
 * @returns True when the input likely represents a time-of-day.
 * @example
 * IsTimeOfDayInput("5pm") // true
 * @example
 * IsTimeOfDayInput("90") // false
 * @param Snz - Normalized input.
 */
function IsTimeOfDayInput(Snz: string): boolean {
  if (!Snz.length) return false;
  if (/(\d\s*:\s*\d)/.test(Snz)) return true;
  if (/\b(am|pm)\b/.test(Snz) || /\b[ap]\b/.test(Snz)) return true;
  if (Snz.startsWith("at ") || /\bat\s+\d/.test(Snz)) return true;

  // Avoid treating pure numbers as time-of-day if they are large (more likely a duration)
  const Match = Snz.match(/^(?:at\s+)?(\d{1,2})\b/);
  if (!Match) return false;
  const H = Number.parseInt(Match[1], 10);
  return !Number.isNaN(H) && H >= 0 && H <= 23;
}

/**
 * Parses hour/minute and meridiem hints from normalized input.
 * Accepts: "at 5", "5", "5:30", "5 pm", "5p", "5:30pm", "17:30".
 * @param Snz - Normalized input.
 * @returns Parsed time components, or `null` if parsing failed.
 * @example
 * ParseTimeOfDayInput("5:15 pm") // { hour: 5, minute: 15, meridiem: "pm" }
 * @example
 * ParseTimeOfDayInput("nope") // null
 */
function ParseTimeOfDayInput(
  Snz: string
): { hour: number; minute?: number; meridiem?: "am" | "pm" } | null {
  const Match = Snz.match(
    /^(?:at\s+)?(\d{1,2})(?:\s*:\s*(\d{1,2}))?\s*(a\.m\.|p\.m\.|am|pm|a|p)?\b/
  );

  if (!Match) return null;
  const Hour = Number.parseInt(Match[1], 10);
  if (Number.isNaN(Hour) || Hour < 0 || Hour > 23) return null;

  const MinuteRaw = typeof Match[2] === "string" ? Number.parseInt(Match[2], 10) : undefined;
  const Minute =
    typeof MinuteRaw === "number" && !Number.isNaN(MinuteRaw) && MinuteRaw >= 0 && MinuteRaw <= 59
      ? MinuteRaw
      : undefined;

  const Mer = (Match[3] ?? "").replaceAll(".", "").toLowerCase();
  const Meridiem =
    Mer === "am" || Mer === "a" ? "am" : Mer === "pm" || Mer === "p" ? "pm" : undefined;

  return { hour: Hour, minute: Minute, meridiem: Meridiem };
}

/**
 * Formats a time-of-day string in a Chrono-friendly way.
 * @param Hour - 0-23.
 * @param Minute - 0-59.
 * @param Meridiem - Optional meridiem hint.
 * @returns Formatted time string.
 * @example
 * FormatTimeOfDay(17, 0) // "17:00"
 * @example
 * FormatTimeOfDay(5, 30, "pm") // "5:30pm"
 */
function FormatTimeOfDay(Hour: number, Minute: number, Meridiem?: "am" | "pm"): string {
  // If meridiem is provided, prefer 12-hour format (e.g., 5:30pm)
  if (Meridiem) {
    const H12 = ((Hour + 11) % 12) + 1;
    const MM = String(Minute).padStart(2, "0");
    return Minute === 0 ? `${H12}${Meridiem}` : `${H12}:${MM}${Meridiem}`;
  }

  // Otherwise, prefer 24-hour format when hour > 12 to reduce ambiguity.
  const MM = String(Minute).padStart(2, "0");
  return Minute === 0 ? `${Hour}:00` : `${Hour}:${MM}`;
}

/**
 * Builds time-of-day suggestions (hours/minutes) based on the typed input.
 * @param Snz - Normalized and Standardized input.
 * @param Mode - Autocomplete mode.
 * @returns List of suggestion strings.
 * @example
 * BuildTimeOfDaySuggestions("5pm", "start") // includes "at 5pm" and "today 5pm"
 */
function BuildTimeOfDaySuggestions(Snz: string, Mode: AutocompleteMode): string[] {
  const Parsed = ParseTimeOfDayInput(Snz);
  if (!Parsed) return [];

  const Minutes = typeof Parsed.minute === "number" ? [Parsed.minute] : [...MinuteSteps];
  const Mer = Parsed.meridiem;

  const Times = Minutes.map((Min) => FormatTimeOfDay(Parsed.hour, Min, Mer));
  const Out: string[] = [];

  Out.push(...Times, ...Times.map((t) => `at ${t}`));
  const DatePrefixes =
    Mode === "start"
      ? ["yesterday", "today", "last friday", "last week"]
      : Mode === "end"
        ? ["today", "now", "tomorrow", "this friday"]
        : ["today", "yesterday", "tomorrow"];

  for (const P of DatePrefixes) {
    for (const T of Times) {
      Out.push(`${P} ${T}`);
    }
  }

  return Out;
}
