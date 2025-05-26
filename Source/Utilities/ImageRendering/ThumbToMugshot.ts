import { Canvas, Image, createCanvas, loadImage } from "@napi-rs/canvas/index.js";
import { Thumbs } from "@Config/Shared.js";
import { format } from "date-fns";
import UploadToImgBB from "../Other/ImgBBUpload.js";

let BgCanvas: Canvas | null = null;
const ImgWidth = 420;
const ImgHeight = 420;

export interface GetBookingMugshotOptions {
  /**
   * The thumbnail image to be used for generating the mugshot.
   * Can be provided as a string (URL or file path), a URL object, or a Buffer.
   */
  thumb_img: string | URL | Buffer;

  /**
   * The booking number associated with the mugshot.
   * Can be provided as a string or a number.
   */
  booking_num: string | number;

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

  /**
   * The booking date associated with the mugshot.
   * Defaults to the current date if not provided.
   */
  booking_date?: Date;

  /**
   * The height of the person in inches or as a string representation (e.g., "5'10").
   * For example, a height of 5 feet 10 inches can be provided as `70` (in inches) or `"5'10"`.
   */
  height?: number | string;

  /**
   * The percentage from the top of the image where the head should be positioned (0-100).
   * Defaults to 15%. This is used for height positioning, especially if the height
   * of a worn hat or similar accessory is known.
   */
  head_position?: number;

  /**
   * The division or department associated with the mugshot.
   * This is used for the text overlay on the mugshot.
   */
  division?: string;
}

/**
 * Returns a mugshot image (JPEG) with 180x180 dimensions.
 * @param Options - Just options for more accurate control.
 * @returns A JPEG Buffer or an ImgBB direct image URL.
 */
export default async function GetBookingMugshot<AsURL extends boolean | undefined = undefined>(
  Options: GetBookingMugshotOptions
): Promise<AsURL extends true ? string : AsURL extends false ? Buffer : Buffer | string> {
  const BkgNumPadded = Options.booking_num.toString().padStart(3, "0");
  const LAPDDivision = Options.division?.length ? Options.division.toUpperCase() : "WILSHIRE";
  const ImgCanvas = createCanvas(ImgWidth, ImgHeight);
  const ImgCTX = ImgCanvas.getContext("2d");
  const ThumbImage = await LoadThumbImageWithFallback(Options.thumb_img, Options.user_gender);

  // Calculate height positioning
  const HighestY = FindHighestNonTransparentPixelY(ThumbImage);
  const HeadHeightPercentage = HighestY !== null ? (HighestY / ImgHeight) * 100 : 0;
  const PersonHeight = Options.height ? ParseHeight(Options.height) : 70;
  const HeadPosition = Options.head_position ?? 15;
  const BoardOffset = CalculateBoardOffset(
    PersonHeight,
    Math.min(Math.max(HeadHeightPercentage + HeadPosition, 0), 100)
  );

  // Draw the background with calculated offset (draw a slice of the board)
  const BoardCanvas = CreateHeightBackgroundCanvas();
  ImgCTX.drawImage(BoardCanvas, 0, BoardOffset, ImgWidth, ImgHeight, 0, 0, ImgWidth, ImgHeight);

  // Create a separate canvas for the thumbnail with shadow
  const ThumbCanvas = createCanvas(ImgHeight, ImgHeight);
  const ThumbCTX = ThumbCanvas.getContext("2d");
  ThumbCTX.clearRect(0, 0, ImgHeight, ImgHeight);

  // Configure shadow
  ThumbCTX.shadowColor = "rgba(0, 0, 0, 0.5)";
  ThumbCTX.shadowBlur = RelSize(3);
  ThumbCTX.shadowOffsetX = RelSize(3);
  ThumbCTX.shadowOffsetY = RelSize(3);

  ThumbCTX.drawImage(ThumbImage, 0, 0, ImgHeight, ImgHeight);
  ImgCTX.drawImage(ThumbCanvas, 0, 0);

  // Create information box for department, date and booking number
  const InfoBoxX = RelX(2.5); // 2.5% from left
  const InfoBoxY = RelY(2.5); // 2.5% from top
  const InfoBoxWidth = RelX(60); // 60% of canvas width
  const InfoBoxHeight = RelY(10); // 10% of canvas height

  ImgCTX.fillStyle = "rgba(235, 235, 235, 0.85)";
  ImgCTX.fillRect(InfoBoxX, InfoBoxY, InfoBoxWidth, InfoBoxHeight);
  ImgCTX.lineWidth = RelSize(0.25);
  ImgCTX.strokeStyle = "#252525";
  ImgCTX.strokeRect(InfoBoxX, InfoBoxY, InfoBoxWidth, InfoBoxHeight);

  // Add LAPD Wilshire Division identifier
  ImgCTX.font = RelBoldFont(3.5);
  ImgCTX.fillStyle = "#000000";
  ImgCTX.textAlign = "left";
  ImgCTX.fillText(`LAPD ${LAPDDivision} DIV.`, InfoBoxX + RelX(1), InfoBoxY + RelY(4.5));

  // Add date and booking number on the same line
  const BookingDate = Options.booking_date || new Date();
  const DateStr = format(BookingDate, "MM/dd/yyyy");
  ImgCTX.font = RelFont(3);
  ImgCTX.fillText(`DATE: ${DateStr}`, InfoBoxX + RelX(1), InfoBoxY + RelY(8));

  // Add booking number on the same line as date, but right-aligned
  ImgCTX.font = RelFont(3);
  ImgCTX.textAlign = "right";
  ImgCTX.fillText(
    `BOOKING #${BkgNumPadded}`,
    InfoBoxX + InfoBoxWidth - RelX(1),
    InfoBoxY + RelY(8)
  );

  const ImgBuffer = ImgCanvas.toBuffer("image/jpeg", 100);
  if (Options.return_url) {
    const UploadedImgURL = await UploadToImgBB(ImgBuffer, `booking_mugshot_#${BkgNumPadded}`);
    return (UploadedImgURL ?? Thumbs.UnknownImage) as any;
  } else {
    return ImgBuffer as any;
  }
}

/**
 * Creates and returns a canvas containing the full height measurement board.
 *
 * Key implementation details:
 * - Creates a height board with markings from 1'0" (12 inches) to 7'11" (95 inches)
 * - Extends the board with additional padding (24 inches) above and below the marked range
 *   to accommodate extremely short or tall subjects
 * - Draws alternating foot-high stripes for visual differentiation
 * - Adds inch markers at each inch, with special emphasis on feet and quarter-foot marks
 * - Labels feet and quarter-foot marks with appropriate height measurements
 *
 * @remarks The board is created once and cached for subsequent calls to prevent unnecessary work.
 * @returns A Canvas object with the complete height board
 */
function CreateHeightBackgroundCanvas() {
  if (BgCanvas) return BgCanvas;

  const BoardMinInches = 12; // 1'0"
  const BoardMaxInches = 95; // To 7'11"
  const TotalBoardInches = BoardMaxInches - BoardMinInches;

  const PaddingInches = 24; // 2 feet padding on each end
  const ExtendedHeight = ImgHeight * 4 + (2 * PaddingInches * (ImgHeight * 4)) / TotalBoardInches;

  BgCanvas = createCanvas(ImgWidth, ExtendedHeight);
  const BgCTX = BgCanvas.getContext("2d");

  // Base color for the entire canvas
  BgCTX.fillStyle = "#EBEBEB";
  BgCTX.fillRect(0, 0, ImgWidth, BgCanvas.height);

  // The positions where the marked board starts and ends
  const PixelsPerInch = (ImgHeight * 4) / TotalBoardInches;
  const PaddingPixels = PaddingInches * PixelsPerInch;
  const BoardEndY = PaddingPixels + ImgHeight * 4;

  // Draw stripes for each foot in the board range
  for (let Foot = Math.floor(BoardMinInches / 12); Foot <= Math.ceil(BoardMaxInches / 12); Foot++) {
    const FootStartInch = Foot * 12;
    const FootEndInch = (Foot + 1) * 12;

    // Ensure we only draw the visible part of this foot section that fits within our board range
    const VisibleStart = Math.max(FootStartInch, BoardMinInches);
    const VisibleEnd = Math.min(FootEndInch, BoardMaxInches);
    if (VisibleEnd <= VisibleStart) continue;

    // Convert from inches to pixel positions on the canvas (from bottom to top)
    const RelativeStartInch = VisibleStart - BoardMinInches;
    const RelativeEndInch = VisibleEnd - BoardMinInches;
    const VisibleStartPos = BoardEndY - RelativeStartInch * PixelsPerInch; // Lower Y coordinate (bottom of stripe)
    const VisibleEndPos = BoardEndY - RelativeEndInch * PixelsPerInch; // Upper Y coordinate (top of stripe)
    const Height = VisibleStartPos - VisibleEndPos; // Height of the stripe

    // Alternate stripe colors for visual distinction (light gray for even feet, off-white for odd)
    BgCTX.fillStyle = Foot % 2 === 0 ? "#DEDEDE" : "#EBEBEB";
    BgCTX.fillRect(0, VisibleEndPos, ImgWidth, Height);
  }

  // Draw inch and foot markers
  for (let AbsoluteInch = BoardMinInches; AbsoluteInch <= BoardMaxInches; AbsoluteInch++) {
    const RelativeInch = AbsoluteInch - BoardMinInches;
    const Y = BoardEndY - RelativeInch * PixelsPerInch;

    // Determine the type of marker: foot marker, quarter-foot marker, or regular inch marker
    const IsFoot = AbsoluteInch % 12 === 0; // Every 12 inches is a foot marker
    const IsQuarterFoot = AbsoluteInch % 3 === 0; // Every 3 inches is a quarter-foot marker
    const LineEndX = IsFoot ? RelX(95) : IsQuarterFoot ? RelX(92) : RelX(90); // Different marker lengths based on importance

    // Thicker lines for foot markers
    BgCTX.lineWidth = IsFoot ? RelSize(0.75) : RelSize(0.25);
    BgCTX.strokeStyle = "#252525";

    // Draw the horizontal line marker
    BgCTX.beginPath();
    BgCTX.moveTo(0, Y);
    BgCTX.lineTo(LineEndX, Y);
    BgCTX.stroke();

    const Feet = Math.floor(AbsoluteInch / 12);
    const Inches = AbsoluteInch % 12;

    if (IsFoot) {
      BgCTX.fillStyle = "#000000";
      BgCTX.font = RelBoldFont(3.5);
      BgCTX.textAlign = "right";
      BgCTX.fillText(`${Feet}'0"`, ImgWidth - RelX(2.5), Y - RelY(1));
    } else if (IsQuarterFoot) {
      BgCTX.fillStyle = "#000000";
      BgCTX.font = RelFont(3);
      BgCTX.textAlign = "right";
      BgCTX.fillText(`${Feet}'${Inches}"`, ImgWidth - RelX(2.5), Y - RelY(0.75));
    }
  }

  return BgCanvas;
}

/**
 * Calculates the optimal vertical offset for displaying the height board behind a subject.
 *
 * This function precisely aligns the subject's head with their actual height marker on the board.
 * A dynamic alignment that ensures subjects of any height (even extreme values like 1'2" or 7'9")
 * appear correctly positioned relative to their actual height marker.
 *
 * The approach:
 * 1. Locates where the person's height marker appears on the extended board
 * 2. Determines where the person's head should appear in the final image frame
 * 3. Calculates the offset needed to align these two points
 * 4. Ensures the calculated offset stays within the bounds of the board
 *
 * @param PersonHeight - Height of the person in inches (e.g., 70 for 5'10").
 * @param HeadPosition - Percentage from the top where the head is located (0-100).
 * @returns The Y-offset in pixels to use when drawing the slice of the height board.
 */
function CalculateBoardOffset(PersonHeight: number, HeadPosition: number): number {
  const BoardMinInches = 12; // 1'0"
  const BoardMaxInches = 95; // 7'11"
  const TotalBoardInches = BoardMaxInches - BoardMinInches;

  const PaddingInches = 24; // 2 feet padding on each end
  const PixelsPerInch = (ImgHeight * 4) / TotalBoardInches;
  const PaddingPixels = PaddingInches * PixelsPerInch;
  const BoardCanvasHeight = ImgHeight * 4 + 2 * PaddingPixels;

  const HeadHeightPosition =
    BoardCanvasHeight - PaddingPixels - (PersonHeight - BoardMinInches) * PixelsPerInch;

  const HeadPositionPixels = (HeadPosition / 100) * ImgHeight;
  let Offset = HeadHeightPosition - HeadPositionPixels;

  // Ensure we don't show below the extended board
  if (Offset < 0) {
    Offset = 0;
  }

  // Ensure we don't show above the extended board
  if (Offset > BoardCanvasHeight - ImgHeight) {
    return BoardCanvasHeight - ImgHeight;
  }

  return Offset;
}

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
export async function LoadThumbImageWithFallback(
  Img: string | URL | Buffer,
  Gender?: "Male" | "Female" | "M" | "F"
) {
  return loadImage(Img).catch(() => {
    if (Gender) {
      if (typeof Gender === "string") {
        Gender = Gender.match(/^M(?:ale)?$/) ? "Male" : "Female";
      } else if (typeof Gender === "number") {
        Gender = Gender === 1 ? "Male" : "Female";
      }
    } else {
      Gender = "Male";
    }

    const FallbackImg = Thumbs[`RobloxAvatar${Gender}`];
    return loadImage(FallbackImg);
  });
}

/**
 * Finds the highest (smallest Y-coordinate) non-transparent pixel in the given image.
 * @param Image - The image object to analyze. It should have `width` and `height` properties.
 * @returns The Y-coordinate of the highest non-transparent pixel (distance from top), or `null` if no such pixel exists.
 */
function FindHighestNonTransparentPixelY(Image: Image): number | null {
  const Canvas = createCanvas(Image.width, Image.height);
  const Ctx = Canvas.getContext("2d");

  Ctx.drawImage(Image, 0, 0);
  const ImgData = Ctx.getImageData(0, 0, Image.width, Image.height);
  const ImagePixelData = ImgData.data;

  // Iterate through the pixel data to find the highest non-transparent pixel
  // Start from the top of the image and scan downwards (y increases)
  for (let y = 0; y < Image.height; y += 3) {
    for (let x = 0; x < Image.width; x += 2) {
      const Index = (y * Image.width + x) * 4;
      const Alpha = ImagePixelData[Index + 3];

      if (Alpha >= 0.5) {
        return y;
      }
    }
  }

  return null;
}

/**
 * Convert a percentage of canvas width to actual pixels.
 * @param X Percentage value (0-100).
 * @returns Pixel value.
 */
export function RelX(X: number): number {
  return (X / 100) * ImgWidth;
}

/**
 * Convert a percentage of canvas height to actual pixels.
 * @param Y Percentage value (0-100).
 * @returns Pixel value.
 */
export function RelY(Y: number): number {
  return (Y / 100) * ImgHeight;
}

/**
 * Convert a percentage to a size value based on the smaller canvas dimension.
 * @param Size Percentage value (0-100).
 * @returns Size in pixels.
 */
export function RelSize(Size: number): number {
  return (Size / 100) * Math.min(ImgWidth, ImgHeight);
}

/**
 * Create a font string with the given relative size.
 * @param Size Percentage value (0-100).
 * @returns Font string.
 */
function RelFont(Size: number): string {
  const FontSize = Math.max(8, Math.floor(RelSize(Size)));
  return `${FontSize}px Arial`;
}

/**
 * Create a bold font string with the given relative size.
 * @param Size Percentage value (0-100).
 * @returns Bold font string.
 */
function RelBoldFont(Size: number): string {
  const FontSize = Math.max(8, Math.floor(RelSize(Size)));
  return `bold ${FontSize}px Arial`;
}

/**
 * Parse a height string like "5'10" or "5ft 10in" into inches number.
 * @param HeightStr Height string.
 * @returns Total height in inches. If the format is unrecognized, defaults to 70 inches (5'10").
 */
function ParseHeight(HeightStr: string | number): number {
  if (typeof HeightStr === "number") return HeightStr;

  // Extract feet and inches using regex:
  const FeetInchesMatch = HeightStr.match(/(\d+)'(\d+)/);
  if (FeetInchesMatch) {
    return parseInt(FeetInchesMatch[1]) * 12 + parseInt(FeetInchesMatch[2]);
  }

  // Try ft/in format:
  const FtInMatch = HeightStr.match(/(\d+)(?:\s*ft|\s*feet)(?:\s+|-)(\d+)(?:\s*in|\s*inches)?/i);
  if (FtInMatch) {
    return parseInt(FtInMatch[1]) * 12 + parseInt(FtInMatch[2]);
  }

  // Try cm format and convert to inches:
  const CmMatch = HeightStr.match(/(\d+)(?:\s*cm|\s*centimeters)/i);
  if (CmMatch) {
    return Math.round(parseInt(CmMatch[1]) / 2.54);
  }

  return 70;
}
