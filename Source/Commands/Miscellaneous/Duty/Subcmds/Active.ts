import {
  SlashCommandSubcommandBuilder,
  APIEmbedField,
  EmbedBuilder,
  userMention,
  inlineCode,
} from "discord.js";

import { Shifts } from "#Typings/Utilities/Database.js";
import { compareAsc } from "date-fns";
import { Colors, Emojis } from "#Config/Shared.js";
import { ParseDateInputs } from "#Cmds/Informative/Activity/Subcmds/Officer.js";
import { ErrorEmbed, InfoEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import { ListFormatter, ReadableDuration } from "#Utilities/Strings/Formatters.js";

import GetValidTargetShiftTypes from "#Utilities/Helpers/GetTargetShiftType.js";
import HandlePagePagination from "#Utilities/Discord/HandlePagePagination.js";
import ShiftModel from "#Models/Shift.js";
import Chunks from "#Utilities/Helpers/SliceIntoChunks.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
const ShiftsPerPage = 10;
const PageTitle = `${Emojis.StopWatch}   Currently Active Shifts`;
const BreakAnnotation = " ***(𝑖 )***";
const ActiveBreakNotification = "(𝒊): Currently on break";
const LocalDateFormatterOpts = [
  "en-US",
  {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    year: "numeric",
    day: "numeric",
    hour12: true,
  },
] as const;

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Creates a description text based on shift type selection.
 * @param SelectedShiftTypes - Array of selected shift types.
 * @returns Formatted description text.
 */
function GetDescriptionText(SelectedShiftTypes: string[]): string {
  if (SelectedShiftTypes.length > 1) {
    return `**The server's current active shifts of types: ${ListFormatter.format(
      SelectedShiftTypes.map((t) => inlineCode(t))
    )}.**`;
  }
  return "The server's current active shifts, categorized by type.";
}

/**
 * Calculates the total on-duty time in milliseconds for a specific shift within a given time period.
 *
 * This function determines the effective overlap between the shift duration and the requested period,
 * then subtracts any break time that occurred during that overlap.
 *
 * @param Shift - The hydrated shift document containing timestamp and break event data.
 * @param PeriodStart - The start date of the period to calculate duration for.
 * @param PeriodEnd - The end date of the period to calculate duration for.
 * @returns The total number of milliseconds the user was on duty during the specified period.
 * @remarks
 * The on-duty time modifier from the shift document is added to account for any manual adjustments,
 * regardless of when it was applied.
 */
function CalculateOnDutyTimeForPeriod(
  Shift: Shifts.HydratedShiftDocument,
  PeriodStart: Date,
  PeriodEnd: Date
): number {
  const EffectiveStart = Math.max(Shift.start_timestamp.getTime(), PeriodStart.getTime());
  const EffectiveEnd = Math.min(Shift.end_timestamp?.getTime() || Date.now(), PeriodEnd.getTime());
  let TotalBreakTime = 0;

  for (const [BreakStart, BreakEnd] of Shift.events.breaks) {
    const BreakStartTime = Math.max(BreakStart, EffectiveStart);
    const BreakEndTime = Math.min(BreakEnd || EffectiveEnd, EffectiveEnd);

    if (BreakStartTime < BreakEndTime) {
      TotalBreakTime += BreakEndTime - BreakStartTime;
    }
  }

  return EffectiveEnd - EffectiveStart - TotalBreakTime + Shift.durations.on_duty_mod;
}

/**
 * Returns a tuple containing a list of shifts and a boolean indicating whether anyone is on break.
 * @param ActiveShifts - An array of active shifts to be listed.
 * @param StartIndex - Optional start index for correct numbering across pages.
 * @returns A tuple containing the list of personnels on duty and a boolean indicating break notification need.
 */
function ListShifts(
  ActiveShifts: Array<Shifts.HydratedShiftDocument>,
  StartIndex: number = 0,
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
) {
  let BreakAnnotationNeeded = false;
  const Listed: string[] = [];

  for (let I = 0; I < ActiveShifts.length; I++) {
    const Shift = ActiveShifts[I];
    const BAnnotaion = Shift.hasBreakActive() ? BreakAnnotation : "";
    const TOnDutyDuration =
      TimeframeStart && TimeframeEnd
        ? CalculateOnDutyTimeForPeriod(Shift, TimeframeStart, TimeframeEnd)
        : Shift.durations.on_duty;

    const Line = `${StartIndex + I + 1}. ${userMention(Shift.user)} \u{1680} ${ReadableDuration(TOnDutyDuration)} ${BAnnotaion}`;
    BreakAnnotationNeeded = BreakAnnotationNeeded || BAnnotaion.length > 0;
    Listed.push(Line);
  }

  return [Listed, BreakAnnotationNeeded] as const;
}

/**
 * Creates a standardized embed for active shift display.
 * @param Description - The description text for the embed.
 * @param Fields - Fields to be included in the embed.
 * @param HasBreakAnnotation - Whether to include break annotation in footer.
 * @param TimeframeStart - Optional start date of the timeframe.
 * @param TimeframeEnd - Optional end date of the timeframe.
 * @returns Configured embed.
 */
function CreateActiveShiftsEmbed(
  Description: string,
  Fields: APIEmbedField[],
  HasBreakAnnotation: boolean,
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
): EmbedBuilder {
  let FooterText = HasBreakAnnotation ? ActiveBreakNotification : "";

  if (TimeframeStart && TimeframeEnd) {
    const TimeframeText = `Timeframe: ${TimeframeStart.toLocaleDateString(...LocalDateFormatterOpts)} - ${TimeframeEnd.toLocaleDateString(...LocalDateFormatterOpts)}`;
    FooterText = FooterText ? `${FooterText}; ${TimeframeText}` : TimeframeText;
  }

  return new EmbedBuilder()
    .setTitle(PageTitle)
    .setColor(Colors.Info)
    .setFields(Fields)
    .setDescription(Description)
    .setFooter(FooterText.length ? { text: FooterText } : null);
}

/**
 * Creates a paginated set of embeds for a single shift type.
 * @param ShiftData - The shift data for a single type.
 * @param ShiftType - The type name.
 * @param TimeframeStart - Optional start date of the timeframe.
 * @param TimeframeEnd - Optional end date of the timeframe.
 * @returns Array of embeds.
 */
function CreateSingleTypeEmbeds(
  ShiftData: Array<Shifts.HydratedShiftDocument>,
  ShiftType: string,
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
): [EmbedBuilder[], boolean] {
  const Pages: EmbedBuilder[] = [];
  let HasBreakAnnotation = false;
  const Description = `The server's current active shifts of type \`${ShiftType}\`.`;
  const TotalShifts = ShiftData.length;

  if (TotalShifts > ShiftsPerPage) {
    const ShiftChunks = Chunks(ShiftData, ShiftsPerPage);

    for (let PageIndex = 0; PageIndex < ShiftChunks.length; PageIndex++) {
      const [ListedShifts, AnnotationsIncluded] = ListShifts(
        ShiftChunks[PageIndex],
        PageIndex * ShiftsPerPage
      );

      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;
      const StartRange = PageIndex * ShiftsPerPage + 1;
      const EndRange = Math.min(StartRange + ShiftChunks[PageIndex].length - 1, TotalShifts);
      const FieldName = `Shifts ${StartRange}-${EndRange} of ${TotalShifts}`;

      Pages.push(
        CreateActiveShiftsEmbed(
          Description,
          [{ name: FieldName, value: ListedShifts.join("\n") }],
          HasBreakAnnotation,
          TimeframeStart,
          TimeframeEnd
        )
      );
    }
  } else {
    const [ListedShifts, AnnotationsIncluded] = ListShifts(ShiftData);
    const ShiftCountText = ListedShifts.length > 1 ? ` - ${ListedShifts.length}` : "";
    HasBreakAnnotation = AnnotationsIncluded;
    Pages.push(
      CreateActiveShiftsEmbed(
        Description,
        [{ name: `Shifts${ShiftCountText}`, value: ListedShifts.join("\n") }],
        HasBreakAnnotation,
        TimeframeStart,
        TimeframeEnd
      )
    );
  }

  return [Pages, HasBreakAnnotation];
}

/**
 * Processes shifts for multiple types pagination.
 * @param GroupedShifts - Shifts grouped by type.
 * @param Description - Description text for the embeds.
 * @param TimeframeStart - Optional start date of the timeframe.
 * @param TimeframeEnd - Optional end date of the timeframe.
 * @returns Array of embeds.
 */
function ProcessMultiTypeShifts(
  GroupedShifts: Record<string, Array<Shifts.HydratedShiftDocument>>,
  Description: string,
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
): EmbedBuilder[] {
  const Pages: EmbedBuilder[] = [];
  let HasBreakAnnotation = false;

  const TotalShiftCount = Object.values(GroupedShifts).reduce(
    (Sum, Shifts) => Sum + Shifts.length,
    0
  );

  // Simple case: all shifts fit on one page:
  if (TotalShiftCount <= ShiftsPerPage) {
    const Fields: Array<APIEmbedField> = [];

    for (const [ShiftType, ActiveShifts] of Object.entries(GroupedShifts)) {
      const [ListedShifts, AnnotationsIncluded] = ListShifts(ActiveShifts);
      const ShiftsUnderTypeCountText = ActiveShifts.length > 1 ? ` - ${ActiveShifts.length}` : "";
      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;

      Fields.push({
        name: `${ShiftType}${ShiftsUnderTypeCountText}`,
        value: ListedShifts.join("\n"),
      });
    }

    Pages.push(
      CreateActiveShiftsEmbed(Description, Fields, HasBreakAnnotation, TimeframeStart, TimeframeEnd)
    );
    return Pages;
  }

  // Complex case: pagination across types:
  const ShiftTypes = Object.keys(GroupedShifts);
  const RemainingShifts = { ...GroupedShifts };
  let CurrentTypeIndex = 0;
  let ShiftsProcessed = 0;

  while (Object.values(RemainingShifts).some((shifts) => shifts.length > 0)) {
    const CurrentPageFields: APIEmbedField[] = [];
    let CurrentPageShiftCount = 0;
    let CurrentPageHasBreakAnnotation = false;

    // Process shifts type by type until page is full or all processed.
    while (CurrentTypeIndex < ShiftTypes.length && CurrentPageShiftCount < ShiftsPerPage) {
      const CurrentType = ShiftTypes[CurrentTypeIndex];
      const RemainingTypeShifts = RemainingShifts[CurrentType] || [];

      if (RemainingTypeShifts.length === 0) {
        // Move to next type if current one has no shifts.
        CurrentTypeIndex++;
        continue;
      }

      // Calculate how many shifts we can add
      const AvailableSpace = ShiftsPerPage - CurrentPageShiftCount;
      const ShiftsToTake = Math.min(RemainingTypeShifts.length, AvailableSpace);
      const ShiftsToProcess = RemainingTypeShifts.slice(0, ShiftsToTake);

      const [ListedShifts, AnnotationsIncluded] = ListShifts(ShiftsToProcess, ShiftsProcessed);
      CurrentPageHasBreakAnnotation = CurrentPageHasBreakAnnotation || AnnotationsIncluded;
      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;

      const FieldName =
        ShiftsToTake === RemainingShifts[CurrentType].length
          ? CurrentType
          : `${CurrentType} - ${ShiftsToTake} of ${GroupedShifts[CurrentType].length}`;

      CurrentPageFields.push({
        name: FieldName,
        value: ListedShifts.join("\n"),
      });

      ShiftsProcessed += ShiftsToTake;
      CurrentPageShiftCount += ShiftsToTake;
      RemainingShifts[CurrentType] = RemainingTypeShifts.slice(ShiftsToTake);

      if (RemainingShifts[CurrentType].length === 0) {
        CurrentTypeIndex++;
      }
    }

    if (CurrentPageFields.length > 0) {
      Pages.push(
        CreateActiveShiftsEmbed(
          Description,
          CurrentPageFields,
          CurrentPageHasBreakAnnotation,
          TimeframeStart,
          TimeframeEnd
        )
      );
    }
  }

  return Pages;
}

/**
 * Returns formatted informative embeds displaying the active shifts, paginated as needed.
 * @param ActiveGroupedShifts - Object containing shifts sorted and grouped by shift type.
 * @param SelectedShiftTypes - Array of selected shift types.
 * @param TimeframeStart - Optional start date of the timeframe.
 * @param TimeframeEnd - Optional end date of the timeframe.
 * @returns Array of `EmbedBuilder` pages.
 */
function BuildActiveShiftEmbedPages(
  ActiveGroupedShifts: Record<string, Array<Shifts.HydratedShiftDocument>>,
  SelectedShiftTypes: string[],
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
): EmbedBuilder[] {
  if (SelectedShiftTypes.length === 1) {
    const [TypePages] = CreateSingleTypeEmbeds(
      ActiveGroupedShifts[SelectedShiftTypes[0]],
      SelectedShiftTypes[0],
      TimeframeStart,
      TimeframeEnd
    );

    return TypePages;
  } else {
    const Description = GetDescriptionText(SelectedShiftTypes);
    return ProcessMultiTypeShifts(ActiveGroupedShifts, Description, TimeframeStart, TimeframeEnd);
  }
}

// ---------------------------------------------------------------------------------------
// Main Handler:
// -------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const [ValidShiftTypes, TargetShiftTypes] = await GetValidTargetShiftTypes(Interaction, false);
  if (TargetShiftTypes.length && !ValidShiftTypes.length) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(Interaction, true, false);
  }

  const ParsedTimeframe = await ParseDateInputs(Interaction, { from: "from", to: "until" });
  if (ParsedTimeframe === true) return;

  const TimeframeStart = ParsedTimeframe.since;
  const TimeframeEnd = ParsedTimeframe.until;
  const IsHistoricalView = !!(TimeframeStart && TimeframeEnd);

  let QueryFilter: any = {
    type: TargetShiftTypes.length ? { $in: ValidShiftTypes } : { $type: "string" },
    guild: Interaction.guildId,
  };

  if (IsHistoricalView) {
    QueryFilter = {
      ...QueryFilter,
      start_timestamp: { $lte: TimeframeStart },
      $or: [{ end_timestamp: null }, { end_timestamp: { $gte: TimeframeEnd } }],
    };
  } else {
    QueryFilter.end_timestamp = null;
  }

  const ActiveShifts = await ShiftModel.find(QueryFilter);
  const TGActiveShifts = Object.groupBy(ActiveShifts, ({ type }) => type);

  const ASOrdered = Object.entries(TGActiveShifts as unknown as UnPartial<typeof TGActiveShifts>)
    .sort((a, b) => b[1].length - a[1].length)
    .reduce((obj, [key, value]) => {
      obj[key] = value.toSorted((a, b) => {
        return compareAsc(a.start_timestamp, b.start_timestamp);
      });
      return obj;
    }, {});

  if (ActiveShifts.length) {
    return HandlePagePagination({
      interact: Interaction,
      context: "Commands:Miscellaneous:Duty:Active",
      pages: BuildActiveShiftEmbedPages(ASOrdered, ValidShiftTypes, TimeframeStart, TimeframeEnd),
    });
  } else {
    const PluralSTT = ValidShiftTypes.length > 1 ? "types" : "type";
    const TimeframeText = IsHistoricalView ? " during the specified timeframe" : " at this moment";
    const CurrentStateVerb = IsHistoricalView ? "were" : "are";

    const RespEmbedDesc = ValidShiftTypes.length
      ? `There ${CurrentStateVerb} no active shifts${TimeframeText} for the specified shift ${PluralSTT}.`
      : `There ${CurrentStateVerb} no active shifts${TimeframeText}.`;

    return new InfoEmbed()
      .setTitle("No Active Shifts")
      .setDescription(RespEmbedDesc)
      .replyToInteract(Interaction, true);
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("active")
    .setDescription(
      "Display all personnel whose shifts are presently active, including their current duration on-duty."
    )
    .addStringOption((Option) =>
      Option.setName("type")
        .setDescription(
          "Filter by shift type. Leave blank to show all active shifts regardless of type."
        )
        .setMinLength(3)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("from")
        .setAutocomplete(true)
        .setDescription("The start date of the timeframe. Leave blank for current active shifts.")
        .setMinLength(2)
        .setMaxLength(40)
        .setAutocomplete(true)
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("to")
        .setAutocomplete(true)
        .setDescription("The end date of the timeframe. Leave blank for current active shifts.")
        .setMinLength(2)
        .setMaxLength(40)
        .setAutocomplete(true)
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
