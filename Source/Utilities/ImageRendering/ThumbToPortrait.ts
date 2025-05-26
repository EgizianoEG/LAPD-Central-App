import { LoadThumbImageWithFallback, RelSize, RelY } from "./ThumbToMugshot.js";
import { createCanvas, loadImage } from "@napi-rs/canvas/index.js";
import { GetDirName } from "@Utilities/Other/Paths.js";
import { Thumbs } from "@Config/Shared.js";
import { format } from "date-fns";
import UploadToImgBB from "@Utilities/Other/ImgBBUpload.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Path from "node:path";

const FileLabel = "Utilities:ImageRendering:ThumbToPortrait";
const ImgsPath = Path.join(GetDirName(import.meta.url), "..", "..", "Resources", "Imgs");
const BackgroundPath = Path.join(ImgsPath, "OceanMistPortraitBackground.png");
const USFlagVerticalPath = Path.join(ImgsPath, "USFlagVertical.png");

let PortraitBackground = await loadImage(BackgroundPath).catch((Err) => {
  AppLogger.error({
    message: "Failed to load portrait background image; will attempt again later if needed.",
    label: FileLabel,
    stack: Err.stack,
  });

  return null;
});

let USFlagVertical = await loadImage(USFlagVerticalPath).catch((Err) => {
  AppLogger.error({
    message: "Failed to load US flag vertical image; will attempt again later if needed.",
    label: FileLabel,
    stack: Err.stack,
  });

  return null;
});

/**
 * Generates a portrait image from a given thumbnail, applying background, gradient, shadow, and a US flag overlay.
 * The output can be either a Buffer (JPEG image) or a URL string, depending on the provided options.
 *
 * @template AsURL - Determines the return type: `true` for URL string, `false` for Buffer, or both.
 * @param Options - Configuration options for generating the portrait, including the thumbnail image, user gender, and output preferences.
 * @returns A Promise that resolves to either a Buffer (JPEG image) or a URL string, based on the `return_url` option.
 *
 * @remarks
 * - If a portrait background is not available, the function returns the original thumbnail image or its URL.
 * - Applies a radial gradient and shadow effects to enhance the portrait.
 * - Optionally overlays a vertical US flag image if available.
 * - If `return_url` is true, the generated image is uploaded and its URL is returned.
 * - Otherwise, the function returns the image as a Buffer.
 *
 * @throws May throw if image loading, canvas operations, or uploading fails.
 */
export default async function GeneratePortrait<AsURL extends boolean | undefined = undefined>(
  Options: GeneratePortraitOptions
): Promise<AsURL extends true ? string : AsURL extends false ? Buffer : Buffer | string> {
  const [PortraitBackground, USFlagVertical] = await GetProtraitBackgroundAndFlag();
  const ThumbImg = await LoadThumbImageWithFallback(Options.thumb_img, Options.user_gender);
  const PortraitCanvas = createCanvas(ThumbImg.width, ThumbImg.height);
  const PortraitCTX = PortraitCanvas.getContext("2d");

  if (PortraitBackground) {
    PortraitCTX.drawImage(PortraitBackground, 0, 0, ThumbImg.width, ThumbImg.height);
  }

  if (!PortraitBackground) {
    if (
      (Options.return_url && Options.thumb_img instanceof URL) ||
      typeof Options.thumb_img === "string"
    ) {
      return (Options.thumb_img instanceof URL ? Options.thumb_img.href : Options.thumb_img) as any;
    }

    return PortraitCanvas.toBuffer("image/jpeg", 100) as any;
  }

  const RadialGradientCanvas = createCanvas(ThumbImg.width, ThumbImg.height);
  const RadialGradientCTX = RadialGradientCanvas.getContext("2d");
  const RadialGradient = RadialGradientCTX.createRadialGradient(
    ThumbImg.width / 2,
    ThumbImg.height / 2,
    ThumbImg.width / 2,
    ThumbImg.width / 2,
    ThumbImg.height / 2,
    ThumbImg.width * 2
  );

  RadialGradient.addColorStop(0, "transparent");
  RadialGradient.addColorStop(1, "black");

  RadialGradientCTX.fillStyle = RadialGradient;
  RadialGradientCTX.fillRect(0, 0, ThumbImg.width, ThumbImg.height);

  const ThumbCanvas = createCanvas(ThumbImg.width, ThumbImg.height);
  const ThumbCTX = ThumbCanvas.getContext("2d");
  ThumbCTX.clearRect(0, 0, ThumbImg.width, ThumbImg.height);

  ThumbCTX.shadowColor = "rgba(0, 0, 0, 0.5)";
  ThumbCTX.shadowBlur = RelSize(10);
  ThumbCTX.shadowOffsetX = RelSize(1);
  ThumbCTX.shadowOffsetY = RelSize(3);
  ThumbCTX.drawImage(ThumbImg, 0, RelY(12), ThumbImg.width, ThumbImg.height);

  if (USFlagVertical) {
    const FlagWidth = RelSize(80);
    const FlagHeight = RelSize(180);
    const FlagX = ThumbImg.width - FlagWidth - RelSize(32);
    const FlagY = ThumbImg.height - FlagHeight + RelSize(55);

    PortraitCTX.save();
    PortraitCTX.shadowColor = "rgba(0,0,0,0.4)";
    PortraitCTX.shadowBlur = RelSize(16);
    PortraitCTX.shadowOffsetX = RelSize(3);
    PortraitCTX.shadowOffsetY = RelSize(3);
    PortraitCTX.drawImage(USFlagVertical, FlagX, FlagY, FlagWidth, FlagHeight);
    PortraitCTX.restore();
  }

  PortraitCTX.drawImage(ThumbCanvas, 0, 0);
  PortraitCTX.drawImage(RadialGradientCanvas, 0, 0, ThumbImg.width, ThumbImg.height);

  const ImgBuffer = PortraitCanvas.toBuffer("image/jpeg", 100);
  if (Options.return_url) {
    const UploadedImgURL = await UploadToImgBB(
      ImgBuffer,
      `official-portrait-${format(new Date(), "YY-MM-dd-HH")}`
    );
    return (UploadedImgURL ?? Thumbs.UnknownImage) as any;
  } else {
    return ImgBuffer as any;
  }
}

async function GetProtraitBackgroundAndFlag() {
  if (!PortraitBackground) PortraitBackground = await loadImage(BackgroundPath);
  if (!USFlagVertical) USFlagVertical = await loadImage(USFlagVerticalPath);
  return [PortraitBackground, USFlagVertical];
}

interface GeneratePortraitOptions {
  /**
   * The thumbnail image to be used for generating the mugshot.
   * Can be provided as a string (URL or file path), a URL object, or a Buffer.
   */
  thumb_img: string | URL | Buffer;

  /**
   * Whether to upload the generated mugshot to ImgBB and return its direct URL.
   * Defaults to `false`.
   */
  return_url?: boolean;

  /**
   * The gender of the user, used to select an appropriate fallback thumbnail
   * if the provided thumbnail image cannot be retrieved.
   * Acceptable values are "Male", "Female", "M", or "F".
   */
  user_gender?: "Male" | "Female" | "M" | "F";
}
