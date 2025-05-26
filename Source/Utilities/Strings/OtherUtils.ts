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
