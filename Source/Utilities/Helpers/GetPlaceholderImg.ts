/**
 * Returns a basic placeholder image URL based on the input parameters.
 * @param Size - The size of the placeholder image.
 * @param Text - The text to be displayed in the placeholder image.
 * @param Format - Placeholder image format; defaults to "png".
 * @returns
 */
export default function GetPlaceholderImgURL(
  Size: number | `${number}x${number}` | `${number}`,
  Text: string,
  Format: "png" | "jpeg" = "png"
) {
  let URL = `https://placehold.co/${Size}/F7F8F9/202428/${Format}`;
  if (Text) {
    URL += `?text=${encodeURIComponent(Text)}`;
  }

  return URL;
}
