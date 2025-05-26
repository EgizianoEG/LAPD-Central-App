import {
  SlashCommandSubcommandBuilder,
  APIEmbedField,
  EmbedBuilder,
  userMention,
  inlineCode,
} from "discord.js";

import { Shifts } from "@Typings/Utilities/Database.js";
import { compareAsc } from "date-fns";
import { Colors, Emojis } from "@Config/Shared.js";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { ListFormatter, ReadableDuration } from "@Utilities/Strings/Formatters.js";

import GetValidTargetShiftTypes from "@Utilities/Other/GetTargetShiftType.js";
import HandlePagePagination from "@Utilities/Other/HandlePagePagination.js";
import ShiftModel from "@Models/Shift.js";
import Chunks from "@Utilities/Other/SliceIntoChunks.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
const ShiftsPerPage = 10;
const BreakAnnotation = "***⁽ᶦ⁾***";
const ActiveBreakNotification = "(𝒊): Currently on break";
const PageTitle = `${Emojis.StopWatch}   Currently Active Shifts`;

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
  return "**The server's current active shifts, categorized by type.**";
}

/**
 * Returns a tuple containing a list of shifts and a boolean indicating whether anyone is on break.
 * @param ActiveShifts - An array of active shifts to be listed.
 * @param StartIndex - Optional start index for correct numbering across pages.
 * @returns A tuple containing the list of personnels on duty and a boolean indicating break notification need.
 */
function ListShifts(ActiveShifts: Array<Shifts.HydratedShiftDocument>, StartIndex: number = 0) {
  let BreakAnnotationNeeded = false;
  const Listed: string[] = [];

  for (let I = 0; I < ActiveShifts.length; I++) {
    const Shift = ActiveShifts[I];
    const BAnnotaion = Shift.hasBreakActive() ? BreakAnnotation : "";
    const TOnDutyDuration = Shift.durations.on_duty;
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
 * @param Timestamp - Timestamp for the embed.
 * @returns Configured embed.
 */
function CreateActiveShiftEmbed(
  Description: string,
  Fields: APIEmbedField[],
  HasBreakAnnotation: boolean,
  Timestamp: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(PageTitle)
    .setColor(Colors.Info)
    .setFields(Fields)
    .setTimestamp(Timestamp)
    .setDescription(Description)
    .setFooter(HasBreakAnnotation ? { text: ActiveBreakNotification } : null);
}

/**
 * Creates a paginated set of embeds for a single shift type.
 * @param ShiftData - The shift data for a single type.
 * @param ShiftType - The type name.
 * @param Timestamp - Timestamp for the embeds.
 * @returns Array of embeds.
 */
function CreateSingleTypeEmbeds(
  ShiftData: Array<Shifts.HydratedShiftDocument>,
  ShiftType: string,
  Timestamp: number
): [EmbedBuilder[], boolean] {
  const Pages: EmbedBuilder[] = [];
  let HasBreakAnnotation = false;
  const Description = `**The server's current active shifts of type \`${ShiftType}\`.**`;
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
        CreateActiveShiftEmbed(
          Description,
          [{ name: FieldName, value: ListedShifts.join("\n") }],
          HasBreakAnnotation,
          Timestamp
        )
      );
    }
  } else {
    const [ListedShifts, AnnotationsIncluded] = ListShifts(ShiftData);
    HasBreakAnnotation = AnnotationsIncluded;
    Pages.push(
      CreateActiveShiftEmbed(
        Description,
        [{ name: `Shifts - ${TotalShifts}`, value: ListedShifts.join("\n") }],
        HasBreakAnnotation,
        Timestamp
      )
    );
  }

  return [Pages, HasBreakAnnotation];
}

/**
 * Processes shifts for multiple types pagination.
 * @param GroupedShifts - Shifts grouped by type.
 * @param Description - Description text for the embeds.
 * @param Timestamp - Timestamp for the embeds.
 * @returns Array of embeds.
 */
function ProcessMultiTypeShifts(
  GroupedShifts: Record<string, Array<Shifts.HydratedShiftDocument>>,
  Description: string,
  Timestamp: number
): EmbedBuilder[] {
  const Pages: EmbedBuilder[] = [];
  let HasBreakAnnotation = false;

  // Calculate total shifts
  const TotalShiftCount = Object.values(GroupedShifts).reduce(
    (Sum, Shifts) => Sum + Shifts.length,
    0
  );

  // Simple case: all shifts fit on one page
  if (TotalShiftCount <= ShiftsPerPage) {
    const Fields: Array<APIEmbedField> = [];

    for (const [ShiftType, ActiveShifts] of Object.entries(GroupedShifts)) {
      const [ListedShifts, AnnotationsIncluded] = ListShifts(ActiveShifts);
      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;

      Fields.push({
        name: `${ShiftType} - ${ActiveShifts.length}`,
        value: ListedShifts.join("\n"),
      });
    }

    Pages.push(CreateActiveShiftEmbed(Description, Fields, HasBreakAnnotation, Timestamp));
    return Pages;
  }

  // Complex case: pagination across types
  const ShiftTypes = Object.keys(GroupedShifts);
  const RemainingShifts = { ...GroupedShifts };
  let CurrentTypeIndex = 0;
  let ShiftsProcessed = 0;

  while (Object.values(RemainingShifts).some((shifts) => shifts.length > 0)) {
    const CurrentPageFields: APIEmbedField[] = [];
    let CurrentPageShiftCount = 0;
    let CurrentPageHasBreakAnnotation = false;

    // Process shifts type by type until page is full or all processed
    while (CurrentTypeIndex < ShiftTypes.length && CurrentPageShiftCount < ShiftsPerPage) {
      const CurrentType = ShiftTypes[CurrentTypeIndex];
      const RemainingTypeShifts = RemainingShifts[CurrentType] || [];

      if (RemainingTypeShifts.length === 0) {
        // Move to next type if current one has no shifts
        CurrentTypeIndex++;
        continue;
      }

      // Calculate how many shifts we can add
      const AvailableSpace = ShiftsPerPage - CurrentPageShiftCount;
      const ShiftsToTake = Math.min(RemainingTypeShifts.length, AvailableSpace);
      const ShiftsToProcess = RemainingTypeShifts.slice(0, ShiftsToTake);

      // Process this batch
      const [ListedShifts, AnnotationsIncluded] = ListShifts(ShiftsToProcess, ShiftsProcessed);
      CurrentPageHasBreakAnnotation = CurrentPageHasBreakAnnotation || AnnotationsIncluded;

      // Update total break annotation flag
      HasBreakAnnotation = HasBreakAnnotation || AnnotationsIncluded;

      // Create field name
      const FieldName =
        ShiftsToTake === RemainingShifts[CurrentType].length
          ? CurrentType
          : `${CurrentType} - ${ShiftsToTake} of ${GroupedShifts[CurrentType].length}`;

      // Add field to page
      CurrentPageFields.push({
        name: FieldName,
        value: ListedShifts.join("\n"),
      });

      // Update tracking
      ShiftsProcessed += ShiftsToTake;
      CurrentPageShiftCount += ShiftsToTake;

      // Remove processed shifts
      RemainingShifts[CurrentType] = RemainingTypeShifts.slice(ShiftsToTake);

      // Move to next type if this one is done
      if (RemainingShifts[CurrentType].length === 0) {
        CurrentTypeIndex++;
      }
    }

    // Create page with current fields
    if (CurrentPageFields.length > 0) {
      Pages.push(
        CreateActiveShiftEmbed(
          Description,
          CurrentPageFields,
          CurrentPageHasBreakAnnotation,
          Timestamp
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
 * @param CurrentTimestamp - Timestamp of the data retrieval, to be stated in footer.
 * @returns Array of `EmbedBuilder` pages.
 */
function BuildActiveShiftEmbedPages(
  ActiveGroupedShifts: Record<string, Array<Shifts.HydratedShiftDocument>>,
  SelectedShiftTypes: string[],
  CurrentTimestamp: number = Date.now()
): EmbedBuilder[] {
  let Pages: EmbedBuilder[] = [];

  if (SelectedShiftTypes.length === 1) {
    const [TypePages] = CreateSingleTypeEmbeds(
      ActiveGroupedShifts[SelectedShiftTypes[0]],
      SelectedShiftTypes[0],
      CurrentTimestamp
    );

    Pages = TypePages;
  } else {
    const Description = GetDescriptionText(SelectedShiftTypes);
    Pages = ProcessMultiTypeShifts(ActiveGroupedShifts, Description, CurrentTimestamp);
  }

  return Pages;
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

  const ActiveShifts = await ShiftModel.find({
    type: TargetShiftTypes.length ? { $in: ValidShiftTypes } : { $type: "string" },
    guild: Interaction.guildId,
    end_timestamp: null,
  });

  const GAShifts = Object.groupBy(ActiveShifts, ({ type }) => type);
  const ASOrdered = Object.entries(GAShifts as unknown as UnPartial<typeof GAShifts>)
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
      pages: BuildActiveShiftEmbedPages(ASOrdered, ValidShiftTypes, Interaction.createdTimestamp),
    });
  } else {
    const PluralSTT = ValidShiftTypes.length > 1 ? "types" : "type";
    const RespEmbedDesc = ValidShiftTypes.length
      ? `There are no active shifts at this moment for the specified shift ${PluralSTT}.`
      : "There are no active shifts at this moment.";

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
      "Displays all personnel whose shifts are presently active, including their current duration on-duty."
    )
    .addStringOption((Option) =>
      Option.setName("type")
        .setDescription("The type(s) of duty shift to display.")
        .setMinLength(3)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
