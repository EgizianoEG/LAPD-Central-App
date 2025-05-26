/* eslint-disable sonarjs/duplicates-in-character-class */
/**
 * Converts an input string into title case format with optional strict formatting.
 * @param Str - The string to convert into title case format
 * @param Strict - Whether or not to strict format the input string; defaults to `true`
 * @returns The converted string. When parameter `Strict` is `false`, every word in the input string would be capitalized.
 * @requires {@link UpperFirst `Converter.UpperFirst()`}
 * @example
 * TitleCase("hello, world of the earth!")  // returns "Hello, World of the Earth!"
 * TitleCase("testing X3")  // returns "Testing x3"
 */
export function TitleCase(Str: string, Strict: boolean = true): string {
  if (!Str) return "";

  const Uppers = [
    "id",
    "po",
    "pd",
    "swat",
    "dmv",
    "leo",
    "adw",
    "atm",
    "lapd",
    "chp",
    "bolo",
    "aka",
    "ems",
    "emt",
    "emr",
    "eta",
    "dui",
    "hq",
    "gta",
    "doa",
    "veh",
    "hwy",
    "lasd",
    "fbi",
    "dea",
    "lc",
    "mph",
  ];

  const Lowers = [
    "a",
    "an",
    "or",
    "in",
    "on",
    "of",
    "up",
    "at",
    "by",
    "to",
    "as",
    "so",
    "and",
    "the",
    "but",
    "for",
    "not",
    "yet",
    "out",
    "nor",
    "from",
    "with",
    "atop",
    "over",
    "down",
    "into",
    "near",
    "over",
    "plus",
    "past",
    "under",
    "until",
  ];

  // Capitalize the first letter of each word except numbers starting with "x" (e.g. "Tasks: x3")
  let Modified = Str.replace(/[^\W]+[^\s-]* */g, (Cap) => {
    return Cap.match(/\bx\d+\b/i) ? Cap.toLowerCase() : UpperFirst(Cap);
  });

  // Preserve certain words in lower-case and some acronyms in upper-case.
  if (Strict) {
    for (const Lower of Lowers) {
      const Regex = new RegExp("\\b" + Lower + "\\b", "gi");
      Modified = Modified.replace(Regex, Lower.toLowerCase());
    }

    for (const Acronym of Uppers) {
      const Regex = new RegExp("\\b" + Acronym + "\\b", "gi");
      Modified = Modified.replace(Regex, Acronym.toUpperCase());
    }
  }

  if (!Modified.match(/^x\d{1,9}/i)) {
    return UpperFirst(Modified, false);
  }

  return Modified;
}

/**
 * Converts an input string of basic Latin alphabet, numbers, and special characters to camel case format.
 * @see {@link https://stackoverflow.com/a/2970667 Stack Overflow Reference}
 * @notice
 * - With the exception of a single initial `$` sign, which is included if it exists,
 *   this function will not retain any other special characters at the start, middle, or end of the string.
 * - The input string's in between special characters will be ignored and handled as regular whitespace.
 *
 * @param Str - The string to convert.
 * @returns The input string in camel case format if succeeded.
 * @example
 * CamelCase("#@$@#%@---")        // returns "#@$@#%@---" (not appropriate to be converted)
 * CamelCase("PascalCaseString")  // returns "pascalCaseString"
 * CamelCase("kebab-case-string") // returns "kebabCaseString"
 * CamelCase("dot.case.string")   // returns "dotCaseString"
 * CamelCase("$Var_1")            // returns "$var1"
 * CamelCase("__FOO_BAR__-")      // returns "fooBar"
 * CamelCase("Thirty4auto5Var")   // returns "thirty4Auto5Var"
 * CamelCase("special_characters!@#$%^&*\(")  // returns "specialCharacters"
 *
 * // returns "$done45AndGoIng"
 * // (notice the character `i` being uppercased as the previous special characters are treated as a single whitespace character)
 * CamelCase("$Done_45_and_go#$&^*^&*@#$@#$@#$&*^&(&*ing")
 */
export function CamelCase(Str: string): string {
  let SDSign = "";
  const Sanitized = Str.replace(/^[\W\s_\uFEFF\xA0]+|^[\W\s_\uFEFF\xA0]+$/gu, "").replace(
    /[^\w]+|[\s_]+/g,
    " "
  );

  if (!Sanitized) return Str;
  if (Str.match(/\$[\da-z]/i)) SDSign = "$";
  if (Sanitized.match(/^[\da-z]+$/)) return SDSign + Sanitized;
  if (Sanitized.match(/^[A-Z\d\s]+$/)) {
    return (
      SDSign +
      Sanitized.split(" ")
        .map((Capture, Index) => {
          const FChar = Index === 0 ? Capture.at(0)?.toLowerCase() : Capture.at(0)?.toUpperCase();
          return FChar + Capture.slice(1).toLowerCase();
        })
        .join("")
    );
  }

  return (
    SDSign +
    Sanitized.replace(/(?:^\w|[A-Z]|\b\w|\d[a-z])/g, (Word, Index) => {
      return Index === 0 ? Word.toLowerCase() : Word.toUpperCase();
    }).replace(/\s+/g, "")
  );
}

/**
 * Uppers the first character of a string and lowers the rest of its length by default.
 * @notice This does not behave the same as lodash's upperFirst function implementation and converts the rest of the string to lowercase.
 * @param Str - The string to process
 * @param [LowerRest=true] - Whether to lower the rest of the string or not.
 * @returns
 * @example
 * UpperFirst("heLLo!")  // returns "Hello!"
 * UpperFirst("1. item")  // returns "1. item"
 */
export function UpperFirst(Str: string, LowerRest: boolean = true): string {
  return Str.charAt(0)?.toUpperCase() + (LowerRest ? Str.slice(1).toLowerCase() : Str.slice(1));
}

/**
 * Converts a PascalCase string to normal sentence case.
 * @param Str - The PascalCase string to be converted.
 * @return The normal sentence case string.
 * @notice
 * - The input string will be trimmed.
 * - Numbers won't be treated as words but will be combined with the previous ones.
 *
 * @example
 * const PascalCase = "PascalCaseString";
 * console.log(PascalToNormal(PascalCase));  // returns "Pascal Case String"
 */
export function PascalToNormal(Str: string): string {
  return Str.replace(/(?<!\s+)[A-Z]/g, " $&")
    .replace(/\s+/, " ")
    .trim();
}

/**
 * Attempts converting an input string into snake case format.
 * @see {@link https://stackoverflow.com/a/69878219 Stack Overflow Reference}
 * @param Str - The input string to convert.
 * @returns The input string in snake case format if succeeded.
 */
export function SnakeCase(Str: string): string {
  return SplitCaps(Str)
    .replace(/\W+/g, " ")
    .split(/ |\B(?=[A-Z])/)
    .map((Word) => Word.toLowerCase())
    .join("_");
}

/**
 * Converts a given object property names into a snake case representation.
 * @param Obj
 * @returns
 */
export function ObjKeysToSnakeCase(Obj: object): object {
  if (Array.isArray(Obj)) {
    return Obj.map((v) => ObjKeysToSnakeCase(v));
  } else if (Obj != null && Obj.constructor === Object) {
    return Object.keys(Obj).reduce(
      (result, key) => ({
        ...result,
        [SnakeCase(key)]: ObjKeysToSnakeCase(Obj[key]),
      }),
      {}
    );
  }
  return Obj;
}

/**
 * Converts a given number into its word representation.
 * @param Num - The number to convert. If it is a string, remove any characters that aren't numbers to avoid unwanted results.
 * @returns The word representation of the given number.
 * @author This function was taken and modified from: https://stackoverflow.com/a/71276286, thanks to the author.
 */
export function NumberToWords(Num: number | string): string {
  if (Num === 0) return "Zero";
  const NumString = String(Num);
  const NumMatchs = ("0".repeat((2 * NumString.length) % 3) + Num).match(/.{3}/g);

  if (!NumMatchs) return "[Unknown]";
  let Output = "";

  const ScaleT = ["", "Thousand", "Million", "Billion", "Trillion", "Quadrillion"];
  const T10s = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const T20s = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  return (
    NumMatchs.forEach((n, i) => {
      if (!+n) return;

      const hund = +n[0];
      const ten = +n.substring(1);
      const scl = ScaleT[NumMatchs.length - i - 1];

      Output +=
        (Output ? " " : "") +
        (hund ? `${T10s[hund]} Hundred` : "") +
        (hund && ten ? " " : "") +
        (ten < 20 ? T10s[ten] : T20s[+n[1]] + (+n[2] ? "-" : "") + T10s[+n[2]]);
      Output += (Output && scl ? " " : "") + scl;
    }),
    Output
  );
}

/**
 * Converts a police code string to words.
 * @param CodeStr - The police code string to convert. Must be prefixed with a word or something.
 * @returns The converted string.
 * @example
 * console.log(CodeToWords("Code 1-A")); // Output: "Code One-Adam"
 * console.log(CodeToWords("Code 30-V")); // Output: "Code Thirty-Victor"
 * console.log(CodeToWords("Code 30-R")); // Output: "Code Thirty-Ringer"
 * console.log(CodeToWords("Code 4")); // Output: "Code Four"
 * console.log(CodeToWords("Code 10-8")); // Output: "Code Ten-Eight"
 */
export function PoliceCodeToWords(CodeStr: string): string {
  /** A mapping of the phonetic alphabet to use for converting non-numeric codes. */
  const PhoneticAlphabet: { [key: string]: string } = {
    A: "Adam",
    B: "Boy",
    C: "Charles",
    D: "David",
    E: "Edward",
    F: "Frank",
    G: "George",
    H: "Henry",
    I: "Ida",
    J: "John",
    K: "King",
    L: "Lincoln",
    M: "Mary",
    N: "Nora",
    O: "Ocean",
    P: "Paul",
    Q: "Queen",
    R: "Ringer",
    S: "Sam",
    T: "Tom",
    U: "Union",
    V: "Victor",
    W: "William",
    X: "X-ray",
    Y: "Young",
    Z: "Zebra",
  };

  /** Split the code string into the prefix and number parts. */
  const [Prefix, NumberPart] = CodeStr.split(" ");
  /** Split the number part into individual segments. */
  const NumSegments = NumberPart.split("-");
  /** Convert each segment to words. */
  const WordSegments = NumSegments.map((Seg) => {
    if (isNaN(Number(Seg))) {
      /** If the segment is not a number, convert it using the phonetic alphabet. */
      return PhoneticAlphabet[Seg.toUpperCase()] || Seg;
    } else {
      /** If the segment is a number, convert it to words. */
      return NumberToWords(parseInt(Seg, 10));
    }
  });

  /** Join the converted segments and prefix with spaces and return the result. */
  return `${Prefix} ${WordSegments.join("-")}`;
}

function SplitCaps(Str: string): string {
  return Str.replace(/([a-z])([A-Z]+)/g, (_, s1, s2) => `${s1} ${s2}`)
    .replace(/([A-Z])([A-Z]+)([^a-zA-Z0-9]*)$/, (_, s1, s2, s3) => s1 + s2.toLowerCase() + s3)
    .replace(/([A-Z]+)([A-Z][a-z])/g, (_, s1, s2) => `${s1.toLowerCase()} ${s2}`);
}
