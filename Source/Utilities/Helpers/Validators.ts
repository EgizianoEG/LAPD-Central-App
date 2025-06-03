import { ContextMenuCommandBuilder, SlashCommandBuilder, SnowflakeUtil } from "discord.js";
import { isAfter, isBefore } from "date-fns";
import { FormatHeight } from "@Utilities/Strings/Formatters.js";
import { createSign } from "node:crypto";
const MinDiscordTimestamp = 1420070400000;

/**
 * Checks wether a given string can be valid as a Roblox username.
 * @see {@link https://stackoverflow.com/q/54391861 Stack Overflow Reference}
 * @param Str
 * @returns
 */
export function IsValidRobloxUsername(Str: string): boolean {
  return !!(!Str.startsWith("_") && !Str.endsWith("_") && Str.match(/^\w{3,20}$/i));
}

/**
 * Checks wether a given input can be a valid Discord ID (guild Id, user Id, ...).
 * @param Input
 * @returns
 */
export function IsValidDiscordId(Input: any): boolean {
  if (typeof Input !== "string") return false;
  if (!Input.match(/^\d{15,22}$/)) return false;
  const SnowflakeTS = SnowflakeUtil.timestampFrom(Input);
  return isBefore(SnowflakeTS, new Date()) && isAfter(SnowflakeTS, MinDiscordTimestamp);
}

/**
 * Checks wether a given string can be a valid shift type name.
 * Valid names consist of letters, numerals, spaces, underscores, dashes, and periods
 * with a minimum length of `3` characters and a maximum length of `20` characters.
 * @param Str
 * @returns
 */
export function IsValidShiftTypeName(Str: string): boolean {
  return !!(Str.trim().match(/^[\w\-. ]{3,20}$/) && !Str.trim().match(/^[-.]+$/));
}

/**
 * Checks wether a given string can be a valid shift id.
 * Validation consists of:
 * 1. Checking if the string is 15 characters long.
 *    The shift id must be include the start timestamp in milliseconds and additional two tailing random numbers.
 * 2. Checking if the start timestamp is in the past and not in the future.
 * @param Str - The string to be validated as a shift id.
 * @returns
 */
export function IsValidShiftId(Str: string): boolean {
  return !!Str.match(/^\d{15}$/) && isBefore(Number(Str.slice(0, 13)), new Date());
}

/**
 * Checks if a given string is a valid license plate by ensuring it does not start or end with
 * a hyphen and consists of 3 to 7 characters that are either letters, digits, or one hyphen between.
 * This function won't check for all uppercase letters which means it is case-insensitive.
 * @param {string} Str - A string that represents a license plate.
 * @returns
 */
export function IsValidLicensePlate(Str: string): boolean {
  return !!(!Str.startsWith("-") && !Str.endsWith("-") && Str.match(/^[A-Z\d-]{3,7}$/i));
}

/**
 * Checks if a given string represents a valid height in feet and inches format (5'11") after also using `FormatHeight` function.
 * @param {string} Str - A string that represents a person's height in feet and inches.
 * @returns
 */
export function IsValidPersonHeight(Str: string): boolean {
  return !!FormatHeight(Str).match(/^[1-7]'(?:\d|1[01]?)"$/);
}

/**
 * Checks if an object has either a "management" or "staff" property so that it can be valid user permissions object.
 * @param Obj - Any object to check.
 * @returns
 */
export function IsValidUserPermsObj(Obj: any): boolean {
  return !!(Obj.management || Obj.staff);
}

/**
 * Validates the format and integrity of a service account private key.
 * It attempts to use the key to sign a test string to ensure the key is valid and not corrupted.
 * @param Key - The private key string to validate.
 * @throws {Error} If the private key is missing the required BEGIN/END markers.
 * @throws {Error} If the private key is malformed, corrupted, or invalid.
 */
export function ValidatePrivateKey(Key: string): void {
  if (
    !Key.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !Key.endsWith("-----END PRIVATE KEY-----\n")
  ) {
    throw new Error(
      "Malformed service account private key: Missing BEGIN/END markers at the start/end."
    );
  }

  try {
    const Sign = createSign("RSA-SHA256");
    Sign.update("key-check");
    Sign.sign(Key);
  } catch (Err: any) {
    throw new Error(
      `Invalid private key (malformed/corrupted). Verify that the key is valid, intact, and not corrupted. Details: ${Err.message}`
    );
  }
}

/**
 * Validates a given Command Object.
 * Used for validating retrieved local commands.
 * @param CmdObject
 * @param Exceptions
 * @returns
 */
export function IsValidCmdObject(
  CmdObject: SlashCommandObject | ContextMenuCommandObject,
  Exceptions: Array<string> = []
): boolean {
  if (CmdObject?.data instanceof ContextMenuCommandBuilder) {
    return !!(
      CmdObject.data.name &&
      CmdObject.data.type &&
      !Exceptions.includes(CmdObject.data.name)
    );
  }

  if (CmdObject?.data instanceof SlashCommandBuilder) {
    return !!(
      CmdObject.data.name &&
      CmdObject.data.description &&
      !Exceptions.includes(CmdObject.data.name)
    );
  }

  return false;
}

/**
 * Checks if a given value is a plain object (excluding arrays and `null`s)
 * @param Value
 * @returns
 */
export function IsPlainObject(Value: any): boolean {
  return !!Value && Value.constructor === Object;
}

/**
 * Checks if a given object is empty and has no properties in it
 * @param Obj
 * @returns
 */
export function IsEmptyObject(Obj: any): boolean {
  for (const Prop in Obj) {
    if (Object.hasOwn(Obj, Prop)) {
      return false;
    }
  }
  return true;
}

/**
 * Validates whether a given string is a valid Discord channel or message link.
 * A valid link matches the following pattern:
 * - Starts with "http://" or "https://".
 * - Optionally includes "www.".
 * - Contains "discord.com" or "discordapp.com".
 * - Includes "/channels/" followed by either "@me" or a server Id (15 to 22 digits).
 * - Optionally followed by one or two message Ids (15 to 22 digits each).
 *
 * @param Str - The string to validate as a Discord channel or message link.
 * @returns `true` if the string is a valid link, otherwise `false`.
 */
export function IsValidChannelOrMessageLink(Str: string): boolean {
  return /^https?:\/\/(?:www\.)?discord(?:app)?\.com\/channels\/(?:@me|\d{15,22})(?:\/\d{15,22}){1,2}$/i.test(
    Str
  );
}

/**
 *
 * @param URLString - The string to be validated as a Discord attachment link.
 * @param ValidateExpired - Whether to check if the attachment link is expired (return `false` if so).
 * @param AttachmentType - Whether to check if the attachment link is an image or video.
 * @returns
 */
export function IsValidDiscordAttachmentLink(
  URLString: string,
  ValidateExpired?: boolean,
  AttachmentType?: "image" | "video" | "any"
): boolean {
  let FileExtensionRegex: string = "(?:png|jpg|jpeg|mp4|mov|mp3|webp|gif)";

  if (AttachmentType === "image") {
    FileExtensionRegex = "(?:png|jpg|jpeg|gif|webp)";
  } else if (AttachmentType === "video") {
    FileExtensionRegex = "(?:mp4|mov)";
  }

  const AttachmentUrlRegex = new RegExp(
    `^https?://(?:media|cdn)\\.discordapp\\.(?:com|net)/(?:ephemeral-)?attachments/(\\d{15,22})/(\\d{15,22})/(.+)\\.${FileExtensionRegex}`
  );

  const Matches = URLString.match(AttachmentUrlRegex);
  if (!Matches?.length) return false;
  if (ValidateExpired) {
    if (!URLString.includes("ex=") || !URLString.includes("hm=") || !URLString.includes("is=")) {
      return false;
    }

    const URLInst = new URL(URLString);
    const ExpirationHex = URLInst.searchParams.get("ex");
    const IssueingHex = URLInst.searchParams.get("is");
    const SignatureHex = URLInst.searchParams.get("hm");
    if (!ExpirationHex || !IssueingHex || !SignatureHex) return false;

    const ExpirationDate = new Date(parseInt(ExpirationHex, 16) * 1000);
    return ExpirationDate > new Date();
  }

  return true;
}
