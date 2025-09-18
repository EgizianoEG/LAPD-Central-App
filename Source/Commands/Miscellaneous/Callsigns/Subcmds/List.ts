import {
  time,
  Colors,
  inlineCode,
  userMention,
  channelLink,
  ButtonStyle,
  MessageFlags,
  ButtonBuilder,
  SectionBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MessageComponentInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  ConcatenateLines,
  FormatCallsignDesignation as FormatDesignation,
} from "@Utilities/Strings/Formatters.js";

import {
  BaseExtraContainer,
  ErrorContainer,
  InfoContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import { Emojis } from "@Config/Shared.js";
import { Callsigns } from "@Typings/Utilities/Database.js";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { HandleUnauthorizedManagement } from "Source/Events/InteractionCreate/CallsignManagementHandler.js";
import { isValidObjectId, RootFilterQuery } from "mongoose";

import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";
import CallsignModel from "@Models/Callsign.js";
import Chunks from "@Utilities/Helpers/SliceIntoChunks.js";
const CallsignRecordsPerPage = 4;

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Builds paginated container components for displaying callsign records in a Discord embed format.
 * Creates multiple pages with a specified number of records per page, each with interactive buttons
 * for viewing detailed information.
 * @param CallsignRecords - Array of callsign documents to display.
 * @param CmdInteraction - The Discord slash command interaction for context.
 * @param DesiredStatus - Filter status for records ("Active" or "Pending").
 * @param TotalRecords - Total number of records being displayed (for header display).
 * @returns Array of `ContainerBuilder` objects representing each page.
 */
function BuildCallsignListPages(
  CallsignRecords: Callsigns.CallsignDocument[],
  CmdInteraction: SlashCommandInteraction<"cached">,
  DesiredStatus: "Active" | "Pending",
  TotalRecords: number
): ContainerBuilder[] {
  const Pages: ContainerBuilder[] = [];
  const ChunksOfRecords = Chunks(CallsignRecords, CallsignRecordsPerPage);

  for (const Chunk of ChunksOfRecords) {
    const TextData: [string, string][] = [];
    const ContainingContainer = new ContainerBuilder()
      .setAccentColor(Colors.Greyple)
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: `### ${DesiredStatus} Call Sign Records\n-# Displaying \`${TotalRecords}\` ${DesiredStatus.toLowerCase()} call sign record(s) in an ascending order of ${
            DesiredStatus === "Active" ? "approval" : "request"
          } dates.\n-# Data as of ${time(Date.now(), "f")}.`,
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));

    Chunk.forEach((Record) => {
      const RequesterText = DesiredStatus === "Active" ? "Assignee" : "Requester";
      const DateFieldLabel = DesiredStatus === "Active" ? "Approved On" : "Requested On";
      const ExpiryText = Record.expiry
        ? `> **Expiry:** ${time(Record.expiry, "D")} (${time(Record.expiry, "R")})`
        : null;

      TextData.push([
        Record._id.toString(),
        ConcatenateLines(
          `- **Ref. ID:** ${inlineCode(Record._id.toString())}`,
          `> **Status:** ${DesiredStatus}`,
          `> **Designation:** **${inlineCode(FormatDesignation(Record.designation))}**`,
          `> **${RequesterText}:** ${userMention(Record.requester)}`,
          `> **${DateFieldLabel}:** ${time(Record[DateFieldLabel], "D")}`,
          ExpiryText
        ),
      ]);

      TextData.forEach((CallsignEntry, Index) => {
        ContainingContainer.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder({ content: CallsignEntry[1] }))
            .setButtonAccessory(
              new ButtonBuilder()
                .setLabel(" ")
                .setEmoji(Emojis.WhiteInfo)
                .setCustomId(`csd-view:${CmdInteraction.user.id}:${CallsignEntry[0]}`)
                .setStyle(ButtonStyle.Secondary)
            )
        );

        if (Index !== TextData.length - 1) {
          ContainingContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true }));
        }
      });

      Pages.push(ContainingContainer);
    });
  }

  return Pages;
}

/**
 * Creates a detailed view container for a specific callsign document.
 * Displays comprehensive information including status, designation, requester/assignee,
 * dates, expiry information, and request reason.
 * @param CallsignDoc - The callsign document to display details for.
 * @param WithinChannelId - The Id of the channel where the interaction occurred (for styling purposes).
 * @returns `ContainerBuilder` configured with the callsign's detailed information.
 */
function GetCallsignDetailsContainer(
  CallsignDoc: Callsigns.CallsignDocument,
  WithinChannelId: string
): ContainerBuilder {
  const IsActive =
    CallsignDoc.request_status === GenericRequestStatuses.Approved && CallsignDoc.reviewer;

  const StatusValue = IsActive ? "Active" : "Pending Approval";
  const RequesterText = IsActive ? "Assignee" : "Requester";
  const ReviewerText = IsActive ? `> **Approved By:** ${userMention(CallsignDoc.reviewer!)}` : null;
  const DateFieldLabel = IsActive ? "Approved On" : "Requested On";

  const DesignationFormatted = `[${inlineCode(FormatDesignation(CallsignDoc.designation))}](${channelLink(WithinChannelId)})`;
  const RequestReasonText = `> **Request Reason:** ${inlineCode(CallsignDoc.request_reason)}`;
  const ExpiryText = CallsignDoc.expiry
    ? `> **Expiry:** ${time(CallsignDoc.expiry, "D")} (${time(CallsignDoc.expiry, "R")})`
    : null;

  return new BaseExtraContainer()
    .setColor(Colors.Greyple)
    .setTitle(`${DesignationFormatted}  |  Call Sign Details`)
    .setDescription(
      ConcatenateLines(
        `**Ref. ID:** ${inlineCode(CallsignDoc._id.toString())}`,
        `> **Status:** ${StatusValue}`,
        `> **${RequesterText}:** ${userMention(CallsignDoc.requester)}`,
        `> **${DateFieldLabel}:** ${time(CallsignDoc.requested_on, "D")}`,
        ReviewerText,
        ExpiryText,
        RequestReasonText
      )
    );
}

/**
 * Handles button interactions for viewing detailed callsign information.
 * Triggered when users click the info button on callsign list items.
 * Validates the interaction, retrieves the callsign document, and displays detailed view.
 * @param DetailsInteract - The Discord message component interaction from the button click.
 * @returns Promise that resolves when the interaction is handled (reply sent or error handled).
 *          Will reply with an error container if the callsign is not found.
 */
async function HandleCallsignDetailsView(DetailsInteract: MessageComponentInteraction) {
  if (!DetailsInteract.isButton() || !DetailsInteract.inCachedGuild()) return;
  const CallsignId = DetailsInteract.customId.split(":")[2];
  const CallsignDocument = isValidObjectId(CallsignId)
    ? await CallsignModel.findOne({
        guild: DetailsInteract.guildId,
        _id: CallsignId,
      }).exec()
    : null;

  if (!CallsignDocument) {
    return new ErrorContainer()
      .useErrTemplate("CallsignNotFound")
      .replyToInteract(DetailsInteract, true, false);
  }

  return DetailsInteract.reply({
    components: [GetCallsignDetailsContainer(CallsignDocument, DetailsInteract.channelId)],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

// ---------------------------------------------------------------------------------------
// Command Handling:
// -----------------
async function CmdCallback(Interaction: SlashCommandInteraction<"cached">) {
  const IsUnauthorized = await HandleUnauthorizedManagement(Interaction);
  if (IsUnauthorized) return;

  const IsPrivate = Interaction.options.getBoolean("private", false) ?? false;
  const QueryFilter: RootFilterQuery<Callsigns.CallsignDocument> = {
    guild: Interaction.guildId,
    request_status: GenericRequestStatuses.Pending,
  };

  const DesiredStatus = (Interaction.options.getString("status", false) ?? "Active") as
    | "Active"
    | "Pending";

  if (DesiredStatus === "Active") {
    QueryFilter.reviewer = { $ne: null };
    QueryFilter.request_status = GenericRequestStatuses.Approved;
    QueryFilter.$or = [{ expiry: { $gt: Interaction.createdAt } }, { expiry: { $exists: false } }];
  }

  const SortExpression: Record<string, 1 | -1> =
    DesiredStatus === "Active" ? { reviewed_on: 1 } : { requested_on: 1 };
  const CallsignRecords = await CallsignModel.find(QueryFilter).sort(SortExpression).lean().exec();

  if (CallsignRecords.length === 0) {
    if (DesiredStatus === "Active") {
      return new InfoContainer()
        .useInfoTemplate("CallsignsListNoRecordsWithActiveStatus")
        .replyToInteract(Interaction, true);
    }
    return new InfoContainer()
      .useInfoTemplate("CallsignsListNoRecordsWithPendingStatus")
      .replyToInteract(Interaction, true);
  }

  const Pages = BuildCallsignListPages(
    CallsignRecords,
    Interaction,
    DesiredStatus,
    CallsignRecords.length
  );

  return HandlePagePagination({
    pages: Pages,
    interact: Interaction,
    ephemeral: IsPrivate,
    context: "Cmds:Misc:Callsigns:Subcmds:List",
    cv2_comp_listener: HandleCallsignDetailsView,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("list")
    .setDescription("List currently assigned call signs and/or pending approval ones.")
    .addStringOption((Option) =>
      Option.setName("status")
        .setRequired(false)
        .setDescription(
          "Filter call signs by status, either active or pending approval ones; defaults to active."
        )
        .setChoices({ name: "Active", value: "Active" }, { name: "Pending", value: "Pending" })
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setDescription("Respond privately to only you. By default, this is set to false.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
