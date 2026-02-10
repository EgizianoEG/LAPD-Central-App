import {
  SlashCommandSubcommandBuilder,
  time as FormatTime,
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

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Creates a description text based on shift type selection.
 * @param SelectedShiftTypes - Array of selected shift types.
 * @returns Formatted description text.
 */
function GetDescriptionText(
  SelectedShiftTypes: string[],
  TimeframeStart?: Date | null,
  TimeframeEnd?: Date | null
): string {
  const IsHistoricalView = !!(TimeframeStart && TimeframeEnd);
  const DescriptionSuffix = IsHistoricalView
    ? `\nTimeframe: ${FormatTime(TimeframeStart, "D")}   ${FormatTime(TimeframeEnd, "D")}`
    : "";

  if (SelectedShiftTypes.length > 0) {
    const Pl = SelectedShiftTypes.length > 1 ? "s: " : "";
    return `The server's ${IsHistoricalView ? "" : "currently "}active shifts of type${Pl} ${ListFormatter.format(
      SelectedShiftTypes.map((t) => inlineCode(t))
    )}.${DescriptionSuffix}`;
  }

  return DescriptionSuffix;
}

/**
 * Calculates the total on-duty time in milliseconds for a shift up to the end of a specified period.
 *
 * This function calculates the total elapsed time from the shift start until the period end,
 * then subtracts any break time that occurred during that duration (breaks that started before
 * the period end). Breaks that start after the period end are ignored.
 *
 * @param Shift - The hydrated shift document containing timestamp and break event data.
 * @param PeriodEnd - The end date of the period to calculate duration up to.
 * @returns The total number of milliseconds the user was on duty from shift start until period end.
 * @remarks
 * The on-duty time modifier from the shift document is added to account for any manual adjustments.
 * @example
 * // Shift: 10:30-10:50, Break: 10:35-10:40, Period: 10:37-10:40
 * // Calculation: (10:40 - 10:30) - (10:40 - 10:35) = 10min - 5min = 5min
 */
function CalculateOnDutyTimeForPeriod(
  Shift: Shifts.HydratedShiftDocument,
  PeriodEnd: Date
): number {
  const ShiftStart = Shift.start_timestamp.getTime();
  const EffectiveEnd = Math.min(Shift.end_timestamp?.getTime() || Date.now(), PeriodEnd.getTime());
  const GrossTime = EffectiveEnd - ShiftStart;
  let TotalBreakTime = 0;

  for (const [BreakStart, BreakEnd] of Shift.events.breaks) {
    if (BreakStart >= EffectiveEnd) continue;
    const BreakEndTime = Math.min(BreakEnd || EffectiveEnd, EffectiveEnd);
    const BreakDuration = BreakEndTime - BreakStart;

    if (BreakDuration > 0) {
      TotalBreakTime += BreakDuration;
    }
  }

  return GrossTime - TotalBreakTime + Shift.durations.on_duty_mod;
}

/**
 * Checks if a given shift had a break active at the end of a specified period.
 * - If no period is provided, checks if the shift currently has an active break.
 * - If a period is specified, returns `true` if any break was still active at `PeriodEnd`.
 *
 * @param Shift - The hydrated shift document to check.
 * @param [PeriodEnd] - The end date of the period to check for an active break.
 * @returns `true` if there is an active break at the end of the period (or currently); otherwise, `false`.
 * @example
 * // For a shift with a break from 10:00 to 11:00, and `PeriodEnd` at 10:30, returns `true`.
 * // For a shift with a break from 10:00 to 11:00, and `PeriodEnd` at 11:30, returns `false`.
 */
function ShiftHasActiveBreak(
  Shift: Shifts.HydratedShiftDocument,
  PeriodEnd?: Date | null
): boolean {
  if (!PeriodEnd) return Shift.hasBreakActive();
  const PeriodEndMs = PeriodEnd.getTime();

  for (const [BreakStart, BreakEnd] of Shift.events.breaks) {
    if ((BreakEnd === null || BreakEnd >= PeriodEndMs) && BreakStart <= PeriodEndMs) {
      return true;
    }
  }

  return false;
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
    const BAnnotaion = ShiftHasActiveBreak(Shift, TimeframeEnd) ? BreakAnnotation : "";
    const TOnDutyDuration =
      TimeframeStart && TimeframeEnd
        ? CalculateOnDutyTimeForPeriod(Shift, TimeframeEnd)
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
  HasBreakAnnotation: boolean
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(PageTitle)
    .setColor(Colors.Info)
    .setFields(Fields)
    .setDescription(Description)
    .setFooter(HasBreakAnnotation ? { text: ActiveBreakNotification } : null);
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
  const Description = GetDescriptionText([ShiftType], TimeframeStart, TimeframeEnd);
  const TotalShifts = ShiftData.length;

  if (TotalShifts > ShiftsPerPage) {
    const ShiftChunks = Chunks(ShiftData, ShiftsPerPage);

    for (let PageIndex = 0; PageIndex < ShiftChunks.length; PageIndex++) {
      const [ListedShifts, AnnotationsIncluded] = ListShifts(
        ShiftChunks[PageIndex],
        PageIndex * ShiftsPerPage,
        TimeframeStart,
        TimeframeEnd
      );

      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;
      const StartRange = PageIndex * ShiftsPerPage + 1;
      const EndRange = Math.min(StartRange + ShiftChunks[PageIndex].length - 1, TotalShifts);
      const FieldName = `Shifts ${StartRange}-${EndRange} of ${TotalShifts}`;

      Pages.push(
        CreateActiveShiftsEmbed(
          Description,
          [{ name: FieldName, value: ListedShifts.join("\n") }],
          HasBreakAnnotation
        )
      );
    }
  } else {
    const [ListedShifts, AnnotationsIncluded] = ListShifts(
      ShiftData,
      undefined,
      TimeframeStart,
      TimeframeEnd
    );

    const ShiftCountText = ListedShifts.length > 1 ? ` - ${ListedShifts.length}` : "";
    HasBreakAnnotation = AnnotationsIncluded;
    Pages.push(
      CreateActiveShiftsEmbed(
        Description,
        [{ name: `Shifts${ShiftCountText}`, value: ListedShifts.join("\n") }],
        HasBreakAnnotation
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
      const [ListedShifts, AnnotationsIncluded] = ListShifts(
        ActiveShifts,
        undefined,
        TimeframeStart,
        TimeframeEnd
      );

      const ShiftsUnderTypeCountText = ActiveShifts.length > 1 ? ` - ${ActiveShifts.length}` : "";
      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;

      Fields.push({
        name: `${ShiftType}${ShiftsUnderTypeCountText}`,
        value: ListedShifts.join("\n"),
      });
    }

    Pages.push(CreateActiveShiftsEmbed(Description, Fields, HasBreakAnnotation));
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
      const [ListedShifts, AnnotationsIncluded] = ListShifts(
        ShiftsToProcess,
        ShiftsProcessed,
        TimeframeStart,
        TimeframeEnd
      );

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
        CreateActiveShiftsEmbed(Description, CurrentPageFields, CurrentPageHasBreakAnnotation)
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
    const Description = GetDescriptionText(SelectedShiftTypes, TimeframeStart, TimeframeEnd);
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

  const ParsedTimeframe = await ParseDateInputs(Interaction, { from: "from", to: "to" });
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
        .setDescription("The start date of the timeframe. Leave blank for current active shifts.")
        .setMinLength(2)
        .setMaxLength(40)
        .setAutocomplete(true)
        .setAutocomplete(true)
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("to")
        .setDescription("The end date of the timeframe. Leave blank for current active shifts.")
        .setMinLength(2)
        .setMaxLength(40)
        .setAutocomplete(true)
        .setAutocomplete(true)
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
