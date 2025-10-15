/* eslint-disable sonarjs/no-duplicate-string */
import { Canvas, createCanvas, loadImage, SKRSContext2D } from "@napi-rs/canvas/index.js";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import { CitationTypes } from "@Models/Citation.js";

import Path from "node:path";
import JSBarcode from "jsbarcode";
import FileSystem from "node:fs/promises";
import UploadToImgBB from "../External/ImgBBUpload.js";
import GetPlaceholderImgURL from "../Helpers/GetPlaceholderImg.js";

const NTAFineTemplateImgBuffer = await FileSystem.readFile(
  Path.join(import.meta.dirname, "..", "..", "Resources", "Imgs", "NTA-TR130-F.png")
);

const NTAWarnTemplateImgBuffer = await FileSystem.readFile(
  Path.join(import.meta.dirname, "..", "..", "Resources", "Imgs", "NTA-TR130-W.png")
);

const FineTemplate = await loadImage(NTAFineTemplateImgBuffer);
const WarnTemplate = await loadImage(NTAWarnTemplateImgBuffer);
export const TemplateDimensions = {
  width: FineTemplate.width,
  height: FineTemplate.height,
} as const;

const RCoords = {
  nta_num: { x: 0.72, y: 0.045 },
  nta_type: {
    traffic: { x: 0.496, y: 0.0829 },
    nontraffic: { x: 0.635, y: 0.0829 },
    misdemeanor: { x: 0.635, y: 0.0651 },
  },

  dov: { x: 0.0265, y: 0.138 },
  tov: { x: 0.298, y: 0.138 },
  case_num: { x: 0.875, y: 0.1359 },

  violator: {
    name: { x: 0.0265, y: 0.182 },
    city: { x: 0.0265, y: 0.271 },
    address: { x: 0.0265, y: 0.2275 },
    lic_num: { x: 0.0265, y: 0.315 },
    lic_class: { x: 0.448, y: 0.315 },
    age: { x: 0.6935, y: 0.315 },
    gender: { x: 0.0265, y: 0.3605 },
    hair: { x: 0.1898, y: 0.3605 },
    eyes: { x: 0.285, y: 0.3605 },
    height: { x: 0.3915, y: 0.3605 },
    weight: { x: 0.5048, y: 0.3605 },
    zip_code: { x: 0.7802, y: 0.2695 },
    lic_is_comm: {
      yes: { x: 0.529, y: 0.3105 },
      no: { x: 0.6165, y: 0.3105 },
    },
  },

  vehicle: {
    body_style: { x: 0.608, y: 0.4945 },
    year: { x: 0.0285, y: 0.45 },
    make: { x: 0.202, y: 0.45 },
    model: { x: 0.026, y: 0.4945 },
    color: { x: 0.7065, y: 0.4945 },
    lic_num: { x: 0.0285, y: 0.405 },
    commercial: { x: 0.716, y: 0.3828 },
    hazardous_mat: { x: 0.716, y: 0.425 },

    type: {
      vehicle: { x: 0.8765, y: 0.338 },
      boat: { x: 0.745, y: 0.338 },
      aircraft: { x: 0.5865, y: 0.338 },
    },
  },

  ampm: {
    am: { x: 0.493, y: 0.114 },
    pm: { x: 0.493, y: 0.129 },
  },

  dow: [
    { x: 0.5705, y: 0.131, r: 0.016 },
    { x: 0.606, y: 0.131, r: 0.016 },
    { x: 0.6415, y: 0.131, r: 0.016 },
    { x: 0.6781, y: 0.131, r: 0.016 },
    { x: 0.7148, y: 0.131, r: 0.016 },
    { x: 0.7472, y: 0.131, r: 0.016 },
    { x: 0.7797, y: 0.131, r: 0.016 },
  ],

  violations: {
    booking_req: { x: 0.5675, y: 0.5138 },
    code_desc: {
      x: 0.1425,
      y: 0.5625,
    },

    misdemeanor: {
      x: 0.8615,
      y: 0.552,
      r: 0.0135,
    },

    infraction: {
      x: 0.9205,
      y: 0.552,
      r: 0.0135,
    },

    correctable: {
      yes: { x: 0.0475, y: 0.5608 },
      no: { x: 0.0986, y: 0.5608 },
    },
  },

  spd_appx: { x: 0.125, y: 0.722 },
  spd_limit: { x: 0.333, y: 0.722 },
  veh_spd_limit: { x: 0.54, y: 0.722 },
  fine_amount: { x: 0.755, y: 0.722 },

  weather: {
    clear: { x: 0.063, y: 0.807, stretch_x: 0.0375, stretch_y: 0.011 },
    fog: { x: 0.135, y: 0.807, stretch_x: 0.0375, stretch_y: 0.011 },
    rain: { x: 0.2065, y: 0.807, stretch_x: 0.0375, stretch_y: 0.011 },
  },

  surface: {
    dry: { x: 0.297, y: 0.807, stretch_x: 0.036, stretch_y: 0.011 },
    wet: { x: 0.369, y: 0.807, stretch_x: 0.036, stretch_y: 0.011 },
  },

  traffic: {
    light: { x: 0.47, y: 0.807, stretch_x: 0.0375, stretch_y: 0.011 },
    medium: { x: 0.542, y: 0.807, stretch_x: 0.035, stretch_y: 0.011 },
    heavy: { x: 0.613, y: 0.807, stretch_x: 0.041, stretch_y: 0.012 },
  },

  travel_dir: {
    n: { from_x: 0.9025, from_y: 0.7505, to_x: 0.9025, to_y: 0.72 },
    e: {
      from_x: 0.8825,
      from_y: 0.7505,
      to_x: 0.935,
      to_y: 0.7505,
    },
    w: { from_x: 0.9225, from_y: 0.7505, to_x: 0.872, to_y: 0.7505 },
    s: { from_x: 0.9025, from_y: 0.7505, to_x: 0.9025, to_y: 0.7835 },
  },

  lov: { x: 0.065, y: 0.7675 },
  accident: { x: 0.7395, y: 0.7875 },
  cit_officer: { x: 0.0265, y: 0.86 },
  signature: { x: 0.5, y: 0.903 },

  barcode: {
    x: 0.5,
    y: 0.9435,
  },
} as const;

/**
 * Renders a filled Notice to Appear (NTA) or Citation form as an image, populated with the provided citation data.
 *
 * This function draws all relevant fields, checkboxes, and marks on a canvas based on the citation data,
 * including violator and vehicle information, violations, officer details, and additional case-specific data.
 * The rendered image can be returned as a Buffer (JPEG) or uploaded to ImgBB and returned as a URL, depending on the `ReturnAsURL` parameter.
 *
 * @template AsURL - Determines the return type. If `true`, returns a URL string. If `false` or `undefined`, returns a Buffer.
 * @param CitData - The citation data to render, omitting the `img_url` property; as it is not required for this function.
 * @param ReturnAsURL - Optional. If `true`, uploads the image to ImgBB and returns the URL. If `false` or omitted, returns the image as a Buffer.
 * @returns A Promise resolving to either a Buffer (JPEG image) or a URL string, depending on `ReturnAsURL`.
 *
 * @remarks
 * - Uses different templates for "Fine" and "Warn" citation types.
 * - Draws all fields, checkboxes, and marks according to the provided data and template coordinates.
 * - Handles up to 4 violations, with support for detailed violation objects.
 * - Draws a barcode and a stylized signature.
 *
 * @example
 * ```typescript
 * const Buffer = await RenderFilledNTAForm(CitationData);
 * const URL = await RenderFilledNTAForm(CitationData, true);
 * ```
 */
export async function RenderFilledNTAForm<AsURL extends boolean | undefined = undefined>(
  CitData: Omit<GuildCitations.AnyCitationData, "img_url">,
  ReturnAsURL?: AsURL
): Promise<
  AsURL extends true ? string : AsURL extends false | undefined ? Buffer : Buffer | string
> {
  const NTATemplate = CitData.cit_type === "Fine" ? FineTemplate : WarnTemplate;
  const TWidth = NTATemplate.width; // Template width
  const THeight = NTATemplate.height; // Template height
  const CitCanvas = createCanvas(TWidth, THeight);
  const CTX = CitCanvas.getContext("2d");
  CTX.drawImage(NTATemplate, 0, 0);

  // ------------------------------------------------------------------------------------------------
  // First Third of The Citation/NTA
  // -------------------------------
  // NTA/Citation number in the format of YY NNNNN
  // where YY is the last two digits of the current year and NNNNN is the citation number from the database padded with leading zeros.
  const CurrYearSuffix = CitData.issued_on.getFullYear().toString().slice(-2);
  const FormattedCitNum = `${CurrYearSuffix} ${CitData.num.toString().padStart(5, "0")}`;

  CTX.font = "4em Bahnschrift";
  CTX.textAlign = "left";
  CTX.letterSpacing = "0.2em";
  CTX.fillStyle = "rgba(0, 0, 0, 0.7)";
  CTX.fillText(
    FormattedCitNum,
    RCoords.nta_num.x * TWidth,
    RCoords.nta_num.y * THeight,
    0.238 * TWidth
  );

  CTX.font = "26pt Bahnschrift";
  CTX.fillStyle = "black";
  CTX.letterSpacing = "0em";
  CTX.globalAlpha = 0.9;

  // Date of Violation
  CTX.fillText(CitData.dov, RCoords.dov.x * TWidth, RCoords.dov.y * THeight);

  // Case Number
  CTX.fillText("—", RCoords.case_num.x * TWidth, RCoords.case_num.y * THeight);

  // Time of Violation
  CTX.letterSpacing = "0.2em";
  CTX.fillText(CitData.tov, RCoords.tov.x * TWidth, RCoords.tov.y * THeight);
  CTX.letterSpacing = "0em";

  // Period of The Day (AM or PM) and NTA type
  CTX.font = "22pt Bahnschrift";
  CTX.textAlign = "center";
  MarkNTATypeSelection(CTX, TWidth, THeight, CitData.nta_type);

  CTX.font = "22pt Bahnschrift";
  CTX.textAlign = "center";
  CTX.textBaseline = "alphabetic";
  DrawDayOfWeekIndicator(CTX, TWidth, THeight, CitData.dow);

  if (CitData.ampm === "AM") {
    CTX.fillText("X", RCoords.ampm.am.x * TWidth, RCoords.ampm.am.y * THeight);
  } else {
    CTX.fillText("X", RCoords.ampm.pm.x * TWidth, RCoords.ampm.pm.y * THeight);
  }

  // ------------------------------------------------------------------------------------------------
  // Violator's Information
  // ----------------------
  // Violator's Name
  CTX.font = "26pt Bahnschrift";
  CTX.textAlign = "left";
  CTX.fillText(
    CitData.violator.name,
    RCoords.violator.name.x * TWidth,
    RCoords.violator.name.y * THeight,
    0.85 * TWidth
  );

  // Violator's Residence Address
  CTX.fillText(
    CitData.violator.address,
    RCoords.violator.address.x * TWidth,
    RCoords.violator.address.y * THeight
  );

  // Violator's Residence City
  CTX.fillText(
    CitData.violator.city,
    RCoords.violator.city.x * TWidth,
    RCoords.violator.city.y * THeight
  );

  // Violator's Zip Code
  CTX.fillText("—", RCoords.violator.zip_code.x * TWidth, RCoords.violator.zip_code.y * THeight);

  // Violator's Driver License Number
  CTX.letterSpacing = "0.35em";
  CTX.fillText(
    CitData.violator.lic_num,
    RCoords.violator.lic_num.x * TWidth,
    RCoords.violator.lic_num.y * THeight,
    0.279 * TWidth
  );

  // Violator's Driver License Class
  CTX.letterSpacing = "0em";
  CTX.fillText(
    CitData.violator.lic_class,
    RCoords.violator.lic_class.x * TWidth,
    RCoords.violator.lic_class.y * THeight
  );

  // Commercial Driver License Check
  CTX.textAlign = "center";
  CTX.textBaseline = "middle";
  CTX.font = "300 22pt Bahnschrift";
  if (CitData.violator.lic_is_comm) {
    CTX.fillText(
      "X",
      RCoords.violator.lic_is_comm.yes.x * TWidth,
      RCoords.violator.lic_is_comm.yes.y * THeight
    );
  } else {
    CTX.fillText(
      "X",
      RCoords.violator.lic_is_comm.no.x * TWidth,
      RCoords.violator.lic_is_comm.no.y * THeight
    );
  }

  CTX.textAlign = "left";
  CTX.textBaseline = "alphabetic";
  CTX.font = "300 26pt Bahnschrift";

  // Violator's Age Group
  CTX.fillText(
    CitData.violator.age,
    RCoords.violator.age.x * TWidth,
    RCoords.violator.age.y * THeight,
    0.275 * TWidth
  );

  // Violator's Gender
  CTX.fillText(
    CitData.violator.gender,
    RCoords.violator.gender.x * TWidth,
    RCoords.violator.gender.y * THeight,
    0.1085 * TWidth
  );

  CTX.textAlign = "center";
  CTX.fillText(
    CitData.violator.hair_color,
    RCoords.violator.hair.x * TWidth,
    RCoords.violator.hair.y * THeight,
    0.1065 * TWidth
  );

  CTX.fillText(
    CitData.violator.eye_color,
    RCoords.violator.eyes.x * TWidth,
    RCoords.violator.eyes.y * THeight,
    0.1065 * TWidth
  );

  CTX.fillText(
    CitData.violator.height,
    RCoords.violator.height.x * TWidth,
    RCoords.violator.height.y * THeight,
    0.1065 * TWidth
  );

  CTX.fillText(
    String(CitData.violator.weight),
    RCoords.violator.weight.x * TWidth,
    RCoords.violator.weight.y * THeight,
    0.1065 * TWidth
  );

  // ------------------------------------------------------------------------------------------------
  // Vehicle Information
  // -------------------
  MarkSelectedVehicleType(CTX, TWidth, THeight, CitData.vehicle);
  MarkCommercialOrAndHazardousVehicleCheckboxes(
    CTX,
    TWidth,
    THeight,
    CitData.vehicle.commercial,
    CitData.vehicle.hazardous_mat
  );

  // Vehicle License Number
  CTX.font = "300 26pt Bahnschrift";
  CTX.textAlign = "left";
  CTX.textBaseline = "alphabetic";
  CTX.letterSpacing = "0.2em";
  CTX.fillText(
    CitData.vehicle.lic_num,
    RCoords.vehicle.lic_num.x * TWidth,
    RCoords.vehicle.lic_num.y * THeight
  );

  // Vehicle Year of Manufacture
  CTX.letterSpacing = "0.1em";
  CTX.fillText(
    CitData.vehicle.year,
    RCoords.vehicle.year.x * TWidth,
    RCoords.vehicle.year.y * THeight
  );

  // Vehicle Make
  CTX.letterSpacing = "0em";
  CTX.fillText(
    CitData.vehicle.make,
    RCoords.vehicle.make.x * TWidth,
    RCoords.vehicle.make.y * THeight
  );

  // Vehicle Model
  CTX.fillText(
    CitData.vehicle.model,
    RCoords.vehicle.model.x * TWidth,
    RCoords.vehicle.model.y * THeight,
    0.4967 * TWidth
  );

  // Vehicle Body Style
  CTX.textAlign = "center";
  CTX.fillText(
    CitData.vehicle.body_style,
    RCoords.vehicle.body_style.x * TWidth,
    RCoords.vehicle.body_style.y * THeight,
    0.147 * TWidth
  );

  // Vehicle Color
  CTX.textAlign = "left";
  CTX.fillText(
    CitData.vehicle.color,
    RCoords.vehicle.color.x * TWidth,
    RCoords.vehicle.color.y * THeight,
    0.2667 * TWidth
  );

  // ------------------------------------------------------------------------------------------------
  // Violations Area
  // ---------------
  let BookingIsRequired = false;
  for (let i = 0; i < CitData.violations.length && i < 4; i++) {
    CTX.font = "300 24pt Bahnschrift";
    CTX.textAlign = "left";
    CTX.textBaseline = "alphabetic";

    const Violation = CitData.violations[i];
    const IsDetailed = typeof Violation === "object";
    const ViolationYAxis = RCoords.violations.code_desc.y * THeight;
    const ViolationXAxis = RCoords.violations.code_desc.x * TWidth;
    const CodeDescMaxWidth = 0.7 * TWidth;
    const YAxisFactor = 0.0334 * i;

    CTX.fillText(
      IsDetailed ? Violation.violation : Violation,
      ViolationXAxis,
      ViolationYAxis + YAxisFactor * THeight,
      CodeDescMaxWidth
    );

    if (IsDetailed) {
      if (typeof Violation.correctable === "boolean") {
        CTX.textAlign = "center";
        CTX.textBaseline = "middle";
        CTX.fillText(
          "X",
          Violation.correctable
            ? RCoords.violations.correctable.yes.x * TWidth
            : RCoords.violations.correctable.no.x * TWidth,
          Violation.correctable
            ? RCoords.violations.correctable.yes.y * THeight + YAxisFactor * THeight
            : RCoords.violations.correctable.no.y * THeight + YAxisFactor * THeight
        );
      }

      if (typeof Violation.type === "string") {
        if (Violation.type === "M") BookingIsRequired = true;
        CTX.beginPath();

        CTX.arc(
          Violation.type === "M"
            ? RCoords.violations.misdemeanor.x * TWidth
            : RCoords.violations.infraction.x * TWidth,
          Violation.type === "M"
            ? RCoords.violations.misdemeanor.y * THeight + YAxisFactor * THeight
            : RCoords.violations.infraction.y * THeight + YAxisFactor * THeight,
          Violation.type === "M"
            ? RCoords.violations.misdemeanor.r * TWidth
            : RCoords.violations.infraction.r * TWidth,
          0,
          2 * Math.PI
        );

        CTX.stroke();
      }
    }
  }

  // Booking Required Checkbox
  if (BookingIsRequired) {
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText(
      "X",
      RCoords.violations.booking_req.x * TWidth,
      RCoords.violations.booking_req.y * THeight
    );
  }

  // ------------------------------------------------------------------------------------------------
  // Last third of the citation
  // --------------------------
  CTX.font = "300 24pt Bahnschrift";
  CTX.textAlign = "left";
  CTX.textBaseline = "alphabetic";
  CTX.letterSpacing = "0em";
  CTX.fillStyle = "black";

  // Speed Approximation
  CTX.textAlign = "center";
  CTX.fillText(
    CitData.case_details.speed_approx ? `${CitData.case_details.speed_approx} MPH` : "—",
    RCoords.spd_appx.x * TWidth,
    RCoords.spd_appx.y * THeight,
    0.2 * TWidth
  );

  // Posted Speed Limit
  CTX.textAlign = "center";
  CTX.fillText(
    CitData.case_details.posted_speed ? `${CitData.case_details.posted_speed} MPH` : "—",
    RCoords.spd_limit.x * TWidth,
    RCoords.spd_limit.y * THeight,
    0.2 * TWidth
  );

  // Vehicle Speed Limit
  CTX.textAlign = "center";
  CTX.fillText(
    CitData.case_details.veh_speed_limit ? `${CitData.case_details.veh_speed_limit} MPH` : "—",
    RCoords.veh_spd_limit.x * TWidth,
    RCoords.veh_spd_limit.y * THeight,
    0.2 * TWidth
  );

  // Fine Amount (if any)
  if (CitData.cit_type === CitationTypes.Fine && CitData.fine_amount) {
    CTX.textAlign = "center";
    CTX.fillText(
      `$${CitData.fine_amount}`,
      RCoords.fine_amount.x * TWidth,
      RCoords.fine_amount.y * THeight,
      0.2 * TWidth
    );
  }

  // Weather, Road Surface, Traffic Conditions, and Direction of Travel
  DrawWeatherConditionEllipse(CTX, TWidth, THeight, CitData.comments.weather);
  DrawSurfaceConditionEllipse(CTX, TWidth, THeight, CitData.comments.road_surface);
  DrawTrafficConditionEllipse(CTX, TWidth, THeight, CitData.comments.traffic);
  IllustrateDirectionOfTravel(CTX, TWidth, THeight, CitData.comments.travel_dir);

  if (CitData.comments.accident) {
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText("X", RCoords.accident.x * TWidth, RCoords.accident.y * THeight);
  }

  // Location of Violation(s)
  CTX.textBaseline = "alphabetic";
  CTX.textAlign = "left";
  CTX.fillText(
    CitData.violation_loc,
    RCoords.lov.x * TWidth,
    RCoords.lov.y * THeight,
    0.743 * TWidth
  );

  // Citing Officer
  CTX.fillText(
    CitData.citing_officer.signature,
    RCoords.cit_officer.x * TWidth,
    RCoords.cit_officer.y * THeight,
    0.9067 * TWidth
  );

  // Defendant's Signature
  const DefendantName = CitData.violator.name.split(" ")[0];
  CTX.font = "italic 100 4em Mistral";
  CTX.textAlign = "center";
  CTX.fillStyle = "black";
  CTX.letterSpacing = "0.15em";
  CTX.fillText(
    DefendantName,
    RCoords.signature.x * TWidth,
    RCoords.signature.y * THeight,
    0.7435 * TWidth
  );

  // Draw the NTA barcode
  const BarcodeCanvas = GenerateNTABarcodeCanvas(TWidth, THeight, FormattedCitNum);
  CTX.drawImage(
    BarcodeCanvas,
    RCoords.barcode.x * TWidth - BarcodeCanvas.width / 2,
    RCoords.barcode.y * THeight - BarcodeCanvas.height / 2
  );

  const FilledNTAFormBuffer = CitCanvas.toBuffer("image/jpeg", 80);
  if (ReturnAsURL) {
    return ((await UploadToImgBB(
      FilledNTAFormBuffer,
      `nta_${CitData.nta_type.toLowerCase()}_#${CurrYearSuffix}-${CitData.num}`
    )) ?? GetPlaceholderImgURL(`${TWidth}x${THeight}`, "?")) as any;
  } else {
    return FilledNTAFormBuffer as any;
  }
}

// ------------------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Draws an elliptical arc on a canvas context by connecting the center to points along the ellipse's perimeter.
 * If `angleRange` is not a full circle (e.g., `[0, Math.PI]`), only the specified arc segment will be drawn.
 * @param params - The parameters for drawing the ellipse.
 * @param params.ctx - The canvas 2D rendering context.
 * @param params.color - The stroke color for the ellipse.
 * @param params.lineWidth - The width of the ellipse's stroke.
 * @param params.x - The x-coordinate of the ellipse's center.
 * @param params.y - The y-coordinate of the ellipse's center.
 * @param params.stretchX - The horizontal radius (width) of the ellipse.
 * @param params.stretchY - The vertical radius (height) of the ellipse.
 * @param params.angleRange - The start and end angles (in radians) for the arc to draw.
 * @returns {SKRSContext2D} The updated canvas context.
 */
function Ellipse({
  x,
  y,
  ctx: CTX,
  color: Color,
  lineWidth: LineWidth,
  stretchX: StretchX,
  stretchY: StretchY,
  angleRange: AngleRange, // [StartAngle, EndAngle]
}: {
  x: number;
  y: number;
  ctx: SKRSContext2D;
  color: string;
  lineWidth: number;
  stretchX: number;
  stretchY: number;
  angleRange: [number, number];
}): SKRSContext2D {
  const [StartAngle, EndAngle] = AngleRange;
  CTX.save();
  CTX.beginPath();
  for (let Angle = StartAngle; Angle <= EndAngle; Angle += Math.PI / 180) {
    const Px = x + Math.cos(Angle) * StretchX;
    const Py = y + Math.sin(Angle) * StretchY;
    if (Angle === StartAngle) {
      CTX.moveTo(Px, Py);
    } else {
      CTX.lineTo(Px, Py);
    }
  }

  CTX.lineWidth = LineWidth;
  CTX.strokeStyle = Color;
  CTX.stroke();
  CTX.restore();

  return CTX;
}

/**
 * Draws a weather condition ellipse on the provided canvas context.
 * @param CTX - The canvas 2D rendering context.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param Condition - The weather condition to draw (e.g., "Clear").
 * @param CircleWidth - The width of the circle to draw.
 * @returns {SKRSContext2D} The updated canvas context.
 */
function DrawWeatherConditionEllipse(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  Condition?: Nullable<GuildCitations.WeatherCondition>
): SKRSContext2D {
  CTX.beginPath();

  switch (Condition) {
    case "Clear":
      Ellipse({
        ctx: CTX,
        x: RCoords.weather.clear.x * TWidth,
        y: RCoords.weather.clear.y * THeight,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        stretchX: RCoords.weather.clear.stretch_x * TWidth,
        stretchY: RCoords.weather.clear.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    case "Fog":
      Ellipse({
        ctx: CTX,
        x: RCoords.weather.fog.x * TWidth,
        y: RCoords.weather.fog.y * THeight,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        stretchX: RCoords.weather.fog.stretch_x * TWidth,
        stretchY: RCoords.weather.fog.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    case "Rain":
      Ellipse({
        ctx: CTX,
        x: RCoords.weather.rain.x * TWidth,
        y: RCoords.weather.rain.y * THeight,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        stretchX: RCoords.weather.rain.stretch_x * TWidth,
        stretchY: RCoords.weather.rain.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    default:
      break;
  }

  if (Condition) {
    CTX.stroke();
  }

  return CTX;
}

/**
 * Draws a road surface condition ellipse at the specified coordinates on the provided canvas context.
 * @param CTX - The canvas 2D rendering context.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param Condition - The road surface condition to draw an ellipse for (e.g., "Dry").
 * @returns {SKRSContext2D} The updated canvas context.
 */
function DrawSurfaceConditionEllipse(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  Condition?: Nullable<GuildCitations.RoadSurfaceCondition>
): SKRSContext2D {
  CTX.beginPath();

  switch (Condition) {
    case "Dry":
      Ellipse({
        ctx: CTX,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        x: RCoords.surface.dry.x * TWidth,
        y: RCoords.surface.dry.y * THeight,
        stretchX: RCoords.surface.dry.stretch_x * TWidth,
        stretchY: RCoords.surface.dry.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    case "Wet":
      Ellipse({
        ctx: CTX,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        x: RCoords.surface.wet.x * TWidth,
        y: RCoords.surface.wet.y * THeight,
        stretchX: RCoords.surface.wet.stretch_x * TWidth,
        stretchY: RCoords.surface.wet.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    default:
      break;
  }

  if (Condition) {
    CTX.stroke();
  }

  return CTX;
}

/**
 * Draws a traffic condition circle on the provided canvas context.
 * @param CTX - The canvas 2D rendering context.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param Condition - The traffic condition to draw (e.g., "Light").
 * @returns {SKRSContext2D} Returns the context.
 */
function DrawTrafficConditionEllipse(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  Condition?: Nullable<GuildCitations.TrafficCondition>
): SKRSContext2D {
  CTX.beginPath();

  switch (Condition) {
    case "Light":
      Ellipse({
        ctx: CTX,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        x: RCoords.traffic.light.x * TWidth,
        y: RCoords.traffic.light.y * THeight,
        stretchX: RCoords.traffic.light.stretch_x * TWidth,
        stretchY: RCoords.traffic.light.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    case "Medium":
      Ellipse({
        ctx: CTX,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        x: RCoords.traffic.medium.x * TWidth,
        y: RCoords.traffic.medium.y * THeight,
        stretchX: RCoords.traffic.medium.stretch_x * TWidth,
        stretchY: RCoords.traffic.medium.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    case "Heavy":
      Ellipse({
        ctx: CTX,
        color: "rgba(0, 0, 0, 1)",
        lineWidth: 1.5,
        x: RCoords.traffic.heavy.x * TWidth,
        y: RCoords.traffic.heavy.y * THeight,
        stretchX: RCoords.traffic.heavy.stretch_x * TWidth,
        stretchY: RCoords.traffic.heavy.stretch_y * THeight,
        angleRange: [0, 2 * Math.PI],
      });
      break;
    default:
      break;
  }

  if (Condition) {
    CTX.stroke();
  }

  return CTX;
}

/**
 * Draws a circle representing the day of the week on the provided canvas context.
 * @param CTX - The canvas 2D rendering context.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param DOW - The day of the week (1 = Sunday, 2 = Monday, ..., 7 = Saturday).
 * @returns {SKRSContext2D} The updated canvas context.
 */
function DrawDayOfWeekIndicator(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  DOW?: number | null
): SKRSContext2D {
  if (DOW == null) return CTX;
  const DOWCoords = RCoords.dow[DOW - 1];

  CTX.beginPath();
  CTX.arc(DOWCoords.x * TWidth, DOWCoords.y * THeight, DOWCoords.r * TWidth, 0, 2 * Math.PI);

  CTX.stroke();
  return CTX;
}

/**
 * Draws an "X" on a canvas context at the position corresponding to the specified vehicle type.
 * @param CTX - The canvas 2D rendering context to draw on.
 * @param TWidth - The width scaling factor for positioning.
 * @param THeight - The height scaling factor for positioning.
 * @param VehicleDetails - The type of vehicle to determine the checkbox position.
 * @returns {SKRSContext2D} The updated canvas context.
 */
function MarkSelectedVehicleType(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  VehicleDetails?: Nullable<GuildCitations.VehicleInfo>
): SKRSContext2D {
  if (!VehicleDetails) return CTX;
  CTX.textBaseline = "middle";
  CTX.textAlign = "center";
  CTX.font = "300 24pt Bahnschrift";

  if (VehicleDetails.is_vehicle) {
    CTX.fillText(
      "X",
      RCoords.vehicle.type.vehicle.x * TWidth,
      RCoords.vehicle.type.vehicle.y * THeight
    );
  } else if (VehicleDetails.is_aircraft) {
    CTX.fillText(
      "X",
      RCoords.vehicle.type.aircraft.x * TWidth,
      RCoords.vehicle.type.aircraft.y * THeight
    );
  } else if (VehicleDetails.is_boat) {
    CTX.fillText("X", RCoords.vehicle.type.boat.x * TWidth, RCoords.vehicle.type.boat.y * THeight);
  }

  return CTX;
}

/**
 * Draws checkboxes for "Commercial" and "Hazardous Material" vehicle options on a canvas context.
 * @param CTX - The canvas 2D rendering context.
 * @param TWidth - The width scaling factor for the canvas.
 * @param THeight - The height scaling factor for the canvas.
 * @param Commercial - Whether the "Commercial" checkbox should be checked.
 * @param HazardousMat - Whether the "Hazardous Material" checkbox should be checked.
 * @returns {SKRSContext2D} The updated canvas context.
 */
function MarkCommercialOrAndHazardousVehicleCheckboxes(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  Commercial?: boolean | null,
  HazardousMat?: boolean | null
): SKRSContext2D {
  if (!Commercial && !HazardousMat) return CTX;

  CTX.font = "300 24pt Bahnschrift";
  CTX.textAlign = "center";
  CTX.textBaseline = "middle";

  if (Commercial) {
    CTX.fillText(
      "X",
      RCoords.vehicle.commercial.x * TWidth,
      RCoords.vehicle.commercial.y * THeight
    );
  }

  if (HazardousMat) {
    CTX.fillText(
      "X",
      RCoords.vehicle.hazardous_mat.x * TWidth,
      RCoords.vehicle.hazardous_mat.y * THeight
    );
  }

  return CTX;
}

/**
 * Draws an indicator showing the direction of travel on a canvas.
 * @param CTX - The canvas rendering context to draw on.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param Direction - The direction of travel.
 * @returns {SKRSContext2D} The updated canvas context.
 */
function IllustrateDirectionOfTravel(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  Direction?: Nullable<GuildCitations.TravelDirection>
): SKRSContext2D {
  if (!Direction || !(Direction.toLowerCase() in RCoords.travel_dir)) return CTX;
  const DirKey = Direction.toLowerCase() as `${Lowercase<keyof typeof RCoords.travel_dir>}`;
  const DirCoords = RCoords.travel_dir[DirKey];
  if (!DirCoords) return CTX;

  const FromX = DirCoords.from_x * TWidth;
  const FromY = DirCoords.from_y * THeight;
  const ToX = DirCoords.to_x * TWidth;
  const ToY = DirCoords.to_y * THeight;

  CTX.save();
  CTX.beginPath();
  CTX.moveTo(FromX, FromY);
  CTX.lineTo(ToX, ToY);
  CTX.strokeStyle = "black";
  CTX.lineWidth = 3;
  CTX.stroke();

  const Angle = Math.atan2(ToY - FromY, ToX - FromX);
  const HeadLength = 18; // Pixels

  for (const side of [-1, 1]) {
    CTX.beginPath();
    CTX.moveTo(ToX, ToY);
    CTX.lineTo(
      ToX - HeadLength * Math.cos(Angle - (side * Math.PI) / 7),
      ToY - HeadLength * Math.sin(Angle - (side * Math.PI) / 7)
    );
    CTX.stroke();
  }

  CTX.restore();
  return CTX;
}

/**
 * Highlights NTA type checkbox.
 * @param CTX - The canvas rendering context to draw on.
 * @param TWidth - The width of the canvas.
 * @param THeight - The height of the canvas.
 * @param NTAType - The NTA type to highlight (e.g., "Traffic", "Nontraffic").
 * @returns {SKRSContext2D} The updated canvas context.
 */
function MarkNTATypeSelection(
  CTX: SKRSContext2D,
  TWidth: number,
  THeight: number,
  NTAType?: Nullable<GuildCitations.NTAType>
): SKRSContext2D {
  if (!NTAType || !(NTAType.toLowerCase() in RCoords.nta_type)) return CTX;
  const NTATypeKey = NTAType.toLowerCase() as `${Lowercase<keyof typeof RCoords.nta_type>}`;
  CTX.textAlign = "center";
  CTX.textBaseline = "middle";

  CTX.fillText(
    "X ",
    RCoords.nta_type[NTATypeKey].x * TWidth,
    RCoords.nta_type[NTATypeKey].y * THeight
  );

  return CTX;
}

/**
 * Generates a barcode canvas for a given NTA number using the CODE39 format.
 * @param TWidth - The total width of the target canvas area.
 * @param THeight - The total height of the target canvas area.
 * @param NTANumber - The NTA number to encode in the barcode.
 * @returns A Canvas object containing the rendered barcode.
 * @remarks The barcode width and height are proportional to the provided `TWidth` and `THeight`.
 */
function GenerateNTABarcodeCanvas(TWidth: number, THeight: number, NTANumber: string): Canvas {
  const BarcodeCanvas = createCanvas(0.167 * TWidth, 0.05 * THeight);
  JSBarcode(BarcodeCanvas, NTANumber, {
    background: "",
    height: 0.038 * THeight,
    width: 0.0025 * TWidth,
    format: "CODE39",
    font: "Optical A",
    fontOptions: "bold",
    textMargin: 5,
    text: `*   ${NTANumber}   *`,
  });

  return BarcodeCanvas;
}
