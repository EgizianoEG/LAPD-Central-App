import { EscapeRegExp } from "@Utilities/Strings/Formatter.js";
import DummyTexts from "@Resources/SampleTexts.js";

const Cache: Record<string, string[]> = { ".": [] };
for (let CharCode = 32; CharCode <= 127; CharCode++) {
  Cache["."].push(String.fromCharCode(CharCode));
}

/**
 * Generates an array of characters that match the given character set.
 * @param CharSet - The character set to match against.
 * @return An array of characters that match the character set.
 */
function CharactersFromSet(CharSet: string | RegExp): string[] {
  const Characters: string[] = [];
  const CacheKey = String(CharSet);
  CharSet = typeof CharSet === "string" ? new RegExp(`[${EscapeRegExp(CharSet)}]`) : CharSet;

  if (Cache[CacheKey]) return Cache[CacheKey];
  for (const Character of Cache["."]) {
    if (CharSet.test(Character)) {
      Characters.push(Character);
    }
  }

  Cache[CacheKey] = Characters;
  return Characters;
}

/**
 * Generates a random string of a specified length using a given character set.
 * @requires {@link CharactersFromSet `Random.CharactersFromSet()`}
 * @param Length - The desired length of the generated string; defaults to `10`.
 * @param CharSet - The desired range of generated characters; defaults to alphanumeric characters.
 * @return The generated string
 */
export function RandomString(Length: number = 10, CharSet: string | RegExp = /\w/): string {
  if (!Length || !CharSet) return "";
  const AvailableChars = Cache[String(CharSet)] ?? CharactersFromSet(CharSet);
  const Randomized: string[] = [];
  const MaxRange = AvailableChars.length;

  for (let CharIndex = 0; CharIndex < Length; CharIndex++) {
    Randomized[CharIndex] = AvailableChars[Math.floor(Math.random() * MaxRange)];
  }

  return Randomized.join("");
}

/**
 * Returns a randomly chosen and Roblox filtered dummy/sample text between 7-12 words
 * @requires {@link DummyTexts Sample Texts Array}
 * @returns
 */
export function DummyText(): string {
  return DummyTexts[Math.floor(Math.random() * DummyTexts.length)];
}
