import { createHash } from "node:crypto";

/**
 * Sanitizes a given attachment URL by removing any query parameters that are not related to authentication params.
 * @param Link - The URL string to be sanitized. Must be a valid link.
 * @returns The sanitized URL string with only the allowed query parameters.
 */
export function SanitizeDiscordAttachmentLink(Link: string): string {
  const URLInst = new URL(Link);
  const AllowedParams = new Set(["ex", "is", "hm"]);

  for (const Param of URLInst.searchParams.keys()) {
    if (!AllowedParams.has(Param)) {
      URLInst.searchParams.delete(Param);
    }
  }

  return URLInst.href;
}

/**
 * Extracts the file extension from a Discord attachment URL.
 * @param AttachmentURL - The URL of the Discord attachment.
 * @returns The file extension of the attachment if it matches a supported format
 * (e.g., jpg, jpeg, png, gif, webp, bmp, tiff, svg, mp4, mov, mp3). Defaults to "png" if no match is found.
 */
export function GetDiscordAttachmentExtension(AttachmentURL: string): string {
  return (
    /(\w+)\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg|mp4|mov|mp3)$/.exec(AttachmentURL)?.[1] ?? "png"
  );
}

/**
 * Generates a collision-free "Ghost Id" by hashing the user Id and timestamp
 * and forcing the MSB (Most Significant Bit) to 1.
 *
 * @remarks
 * This is intentionally irreversible. The same user will generate
 * *different* Ghost Ids if anonymized multiple times.
 *
 * @param OrgUserId The Discord Snowflake of the user being anonymized.
 * @param Timestamp The timestamp of the deletion event (or a fixed epoch, anyway). Defaults to the current time.
 * @returns A string representation of the 64-bit Ghost Id.
 */
export function GenerateGhostDiscordId(OrgUserId: string, Timestamp: number = Date.now()): string {
  const Input = `${Timestamp}:${OrgUserId}`;
  const HashBuffer = createHash("sha256").update(Input).digest();
  const HashBigInt = HashBuffer.readBigUInt64BE(0);

  const MSBMask = 1n << 63n;
  const LowerBitsMask = MSBMask - 1n;
  const GhostId = (HashBigInt & LowerBitsMask) | MSBMask;

  return GhostId.toString();
}

/**
 * Generates a "ghost" username based on the original username and a timestamp.
 * This function creates a unique, anonymized identifier by hashing the combination
 * of the provided username and timestamp, and then truncating the hash to a short length.
 *
 * @param OriginalUsername - The original username to be anonymized.
 * @param Timestamp - An optional timestamp to include in the hash. Defaults to the current time if not provided.
 * @returns A lowercase anonymized username in the format `anon_<short_hash>`.
 */
export function GenerateGhostUsername(
  OriginalUsername: string,
  Timestamp: number = Date.now()
): string {
  const Input = `${Timestamp}:${OriginalUsername}`;
  const Hash = createHash("sha256").update(Input).digest("hex");
  const ShortHash = Hash.substring(0, 5);

  return `anon_${ShortHash}`.toLowerCase();
}
