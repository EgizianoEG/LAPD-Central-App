import {
  userMention,
  MessageFlags,
  ModalBuilder,
  EmbedBuilder,
  TextInputStyle,
  BaseInteraction,
  TextInputBuilder,
  ActionRowBuilder,
  ButtonInteraction,
  time as FormatTime,
  ModalSubmitInteraction,
} from "discord.js";

import { Colors } from "@Config/Shared.js";
import { isAfter } from "date-fns";
import { Callsigns } from "@Typings/Utilities/Database.js";
import { ErrorMessages } from "@Resources/AppMessages.js";
import { CallsignsEventLogger } from "@Utilities/Classes/CallsignsEventLogger.js";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { RandomString, GetErrorId } from "@Utilities/Strings/Random.js";
import { CallsignMgmtCustomIdRegex } from "@Resources/RegularExpressions.js";
import { ErrorEmbed, UnauthorizedEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import * as Chrono from "chrono-node";
import CallsignModel from "@Models/Callsign.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";

type HCallsignDocument = Callsigns.HydratedCallsignDocument;
const CallsignEventLogger = new CallsignsEventLogger();
const FunctionMap = {
  "callsign-approve": HandleCallsignApproval,
  "callsign-deny": HandleCallsignDenial,
  "callsign-info": HandleCallsignAddInfo,
};

// ---------------------------------------------------------------------------------------
// Handlers:
// ---------
/**
 * Handles all callsign management button interactions.
 * @param _ - Discord client instance (unused parameter).
 * @param Interaction - The Discord interaction to process.
 * @returns A Promise that resolves when the interaction handling is complete, or undefined if the interaction doesn't match criteria.
 */
export default async function CallsignManagementHandlerWrapper(
  _: DiscordClient,
  Interaction: BaseInteraction
) {
  if (!Interaction.isButton() || !Interaction.inCachedGuild()) return;
  if (!Interaction.customId.match(CallsignMgmtCustomIdRegex)) return;

  try {
    if (await HandleUnauthorizedManagement(Interaction)) return;
    await CallsignManagementHandler(Interaction);
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    AppLogger.error({
      label: "Events:InteractionCreate:CallsignManagementHandler.ts",
      message: "Failed to handle callsign management button interaction;",
      error_id: ErrorId,
      stack: Err.stack,
    });

    return new ErrorEmbed()
      .useErrTemplate("UnknownError")
      .setErrorId(ErrorId)
      .replyToInteract(Interaction, true);
  }
}

/**
 * Processes callsign management actions from button interactions.
 * Button custom id format: <action>:<requester_id>:<request_id>
 * - Actions: `callsign-approve`, `callsign-deny`, `callsign-info`
 * - The `request_id` is the unique ID of the callsign request stored in the database.
 *
 * @param Interaction - The button interaction to process.
 * @returns A Promise that resolves when the management action is completed.
 */
async function CallsignManagementHandler(Interaction: ButtonInteraction<"cached">) {
  const [Action, , CallsignId] = Interaction.customId.split(":");
  const CallsignDocument = await CallsignModel.findById(CallsignId).exec();
  if (await HandleCallsignReviewValidation(Interaction, CallsignDocument)) return;

  const HandlerFunction = FunctionMap[Action as keyof typeof FunctionMap];
  if (!HandlerFunction) {
    return new ErrorEmbed().useErrTemplate("UnknownError").replyToInteract(Interaction, true);
  }

  return HandlerFunction(Interaction, CallsignDocument!);
}

/**
 * Displays additional information about the requested callsign, including its history and previous holders.
 * @param Interaction - The button interaction requesting additional information.
 * @param CallsignDocument - The callsign document for which to display information.
 * @returns A Promise that resolves after sending the information response.
 */
async function HandleCallsignAddInfo(
  Interaction: ButtonInteraction<"cached">,
  CallsignDocument: HCallsignDocument
) {
  await Interaction.deferReply({ ephemeral: true });

  const FormattedCallsign = CallsignEventLogger.FormatCallsign(CallsignDocument.designation);
  const CallsignHistory = await CallsignEventLogger.GetCallsignHistory(
    Interaction.guild,
    CallsignDocument.designation
  );

  const CallsignInfoEmbed = new InfoEmbed()
    .setTitle(`Callsign Information: ${FormattedCallsign}`)
    .addFields({
      name: "Current Request",
      value:
        `**Requester:** ${userMention(CallsignDocument.requester)}\n` +
        `**Reason:** ${CallsignDocument.request_reason}\n` +
        `**Requested:** ${FormatTime(CallsignDocument.requested_on, "D")}`,
    });

  if (CallsignHistory.length > 0) {
    const HistoryText = CallsignHistory.map((Record, Index) => {
      const Status =
        Record.request_status === GenericRequestStatuses.Approved ? "✅ Approved" : "❌ Denied";
      const DateText = FormatTime(Record.requested_on, "d");
      return `${Index + 1}. ${userMention(Record.requester)} - ${Status} (${DateText})`;
    }).join("\n");

    CallsignInfoEmbed.addFields({
      name: "Callsign History",
      value: HistoryText.length > 1024 ? `${HistoryText.substring(0, 1021)}...` : HistoryText,
    });
  } else {
    CallsignInfoEmbed.addFields({
      name: "Callsign History",
      value: "This callsign has no previous history.",
    });
  }

  // Check for currently active holder
  const CurrentHolder = CallsignHistory.find(
    (Record) => Record.request_status === GenericRequestStatuses.Approved && !Record.expiry
  );

  if (CurrentHolder) {
    CallsignInfoEmbed.addFields({
      name: "Current Holder",
      value: `${userMention(CurrentHolder.requester)} (since ${FormatTime(CurrentHolder.reviewed_on || CurrentHolder.requested_on, "D")})`,
    });
  }

  return CallsignInfoEmbed.replyToInteract(Interaction, true);
}

/**
 * Processes the approval of a callsign request.
 * Shows a modal for reviewer notes, updates the document, and handles nickname updates if configured.
 * @param Interaction - The button interaction for approval.
 * @param CallsignDocument - The callsign document to be approved.
 * @returns A Promise resolving after the approval process is completed.
 */
async function HandleCallsignApproval(
  Interaction: ButtonInteraction<"cached">,
  CallsignDocument: HCallsignDocument
) {
  const FormattedCallsign = CallsignEventLogger.FormatCallsign(CallsignDocument.designation);
  const NotesModal = GetNotesModal(Interaction, "Approval", false);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await CallsignModel.findById(CallsignDocument._id).exec();
  if (
    (await HandleCallsignReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const VacancyValidation = await ValidateCallsignVacancy(
    UpdatedDocument,
    Interaction,
    NotesSubmission
  );

  if (VacancyValidation !== null) {
    // Auto-denial was processed due to vacancy check
    return VacancyValidation;
  }

  // Parse expiry date if provided
  const ExpiryInput = NotesSubmission.fields.getTextInputValue("expiry");
  const ParsedExpiry = ParseExpiryDate(ExpiryInput, Interaction.createdAt);

  if (ParsedExpiry.error_temp) {
    return new ErrorEmbed()
      .useErrTemplate(ParsedExpiry.error_temp as any)
      .replyToInteract(NotesSubmission, true);
  }

  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Callsign Request Approved")
    .setDescription(
      `Successfully approved the callsign request for \`${FormattedCallsign}\`.` +
        (ParsedExpiry.date ? `\n**Expires:** ${FormatTime(ParsedExpiry.date, "D")}` : "")
    );

  const DBSession = await CallsignModel.startSession();
  let PreviousCallsign: HCallsignDocument | null = null;

  try {
    await DBSession.withTransaction(async () => {
      PreviousCallsign = await ExpirePreviousCallsignsInTransaction(
        UpdatedDocument,
        Interaction.createdAt,
        DBSession
      );

      UpdatedDocument.reviewer = Interaction.user.id;
      UpdatedDocument.reviewed_on = Interaction.createdAt;
      UpdatedDocument.request_status = GenericRequestStatuses.Approved as any;
      UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
      UpdatedDocument.expiry = ParsedExpiry.date;

      await UpdatedDocument.save({ session: DBSession });
    });
  } finally {
    await DBSession.endSession();
  }

  return Promise.all([
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    CallsignEventLogger.LogApproval(NotesSubmission, UpdatedDocument, PreviousCallsign),
  ]);
}

/**
 * Processes the denial of a callsign request.
 * Shows a modal for required rejection notes and updates the document status.
 * @param Interaction - The button interaction for denial.
 * @param CallsignDocument - The callsign document to be denied.
 * @returns A Promise resolving after the denial process is completed.
 */
async function HandleCallsignDenial(
  Interaction: ButtonInteraction<"cached">,
  CallsignDocument: HCallsignDocument
) {
  const FormattedCallsign = CallsignEventLogger.FormatCallsign(CallsignDocument.designation);
  const NotesModal = GetNotesModal(Interaction, "Denial", true);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await CallsignModel.findById(CallsignDocument._id).exec();
  if (
    (await HandleCallsignReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Callsign Request Denied")
    .setDescription(`Successfully denied the callsign request for \`${FormattedCallsign}\`.`);

  UpdatedDocument.request_status = GenericRequestStatuses.Denied;
  UpdatedDocument.reviewer = Interaction.user.id;
  UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
  UpdatedDocument.reviewed_on = Interaction.createdAt;

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    CallsignEventLogger.LogDenial(NotesSubmission, UpdatedDocument),
  ]);
}
// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Validates if the user has management permissions to perform callsign management actions.
 * @param Interaction - The button interaction to validate permissions for.
 * @returns A Promise resolving to true if user is unauthorized (action blocked), false otherwise.
 */
async function HandleUnauthorizedManagement(Interaction: ButtonInteraction<"cached">) {
  const GuildSettings = await GetGuildSettings(Interaction.guildId);
  if (!GuildSettings?.callsigns_module.enabled) {
    return new ErrorEmbed()
      .useErrTemplate("CallsignsModuleDisabled")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  const UserRoles = Interaction.member.roles.cache.map((Role) => Role.id);
  const HasManagementPermission =
    GuildSettings.callsigns_module.manager_roles.length === 0 ||
    GuildSettings.callsigns_module.manager_roles.some((RoleId) => UserRoles.includes(RoleId));

  if (!HasManagementPermission) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UnauthorizedInteraction")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

/**
 * Validates whether a callsign request can still be reviewed or has already been processed.
 * @param Interaction - The current interaction being processed.
 * @param RequestDocument - The callsign document to validate.
 * @param InitialInteraction - The original button interaction that started the process.
 * @returns A Promise resolving to `true` if validation failed (action blocked), `false` if review can proceed.
 */
async function HandleCallsignReviewValidation(
  Interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  RequestDocument?: HCallsignDocument | null,
  InitialInteraction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached"> = Interaction
): Promise<boolean> {
  const RequestHasToBeReviewed = RequestDocument?.request_status === GenericRequestStatuses.Pending;

  if (!RequestHasToBeReviewed) {
    let UpdatedReqEmbed: EmbedBuilder | null = null;
    const ReplyEmbed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle("Request Modified")
      .setDescription(
        "The request you are taking action on either does not exist or has already been reviewed."
      );

    if (RequestDocument) {
      UpdatedReqEmbed = await CallsignEventLogger.GetRequestMessageEmbedWithStatus(
        Interaction.guild,
        RequestDocument,
        RequestDocument.request_status
      );
    }

    const Tasks: Promise<any>[] = [];
    if (UpdatedReqEmbed) {
      await Interaction.deferUpdate().catch(() => null);
      Tasks.push(
        Interaction.followUp({ embeds: [ReplyEmbed] }),
        InitialInteraction.editReply({
          content: null,
          embeds: [UpdatedReqEmbed],
          message: RequestDocument?.request_message?.split(":")[1],
          components: DisableMessageComponents(
            InitialInteraction.message!.components.map((Comp) => Comp.toJSON())
          ),
        })
      );
    } else {
      await Interaction.deferUpdate().catch(() => null);
      Tasks.push(
        Interaction.followUp({ embeds: [ReplyEmbed], flags: MessageFlags.Ephemeral }),
        InitialInteraction.editReply({
          components: DisableMessageComponents(
            InitialInteraction.message!.components.map((Comp) => Comp.toJSON())
          ),
        })
      );
    }

    return Promise.all(Tasks).then(() => true);
  } else if (RequestDocument) {
    const IsRequesterPresentMember = await Interaction.guild.members
      .fetch(RequestDocument.requester)
      .catch(() => null);

    if (!IsRequesterPresentMember) {
      await Interaction.deferUpdate().catch(() => null);

      RequestDocument.request_status = GenericRequestStatuses.Cancelled;
      RequestDocument.reviewer_notes = "Requester is no longer a member of this server.";
      RequestDocument.reviewed_on = Interaction.createdAt;
      RequestDocument.reviewer = Interaction.client.user.id;

      const ReplyEmbed = new EmbedBuilder()
        .setColor(Colors.Warning)
        .setTitle("Request Cancelled")
        .setDescription(
          "This callsign request has been automatically cancelled because the requester is no longer a member of this server."
        );

      const Tasks: Promise<any>[] = [
        RequestDocument.save(),
        Interaction.followUp({ embeds: [ReplyEmbed], flags: MessageFlags.Ephemeral }),
        CallsignEventLogger.LogCancellation(Interaction, RequestDocument),
      ];

      return Promise.all(Tasks).then(() => true);
    }
  }

  return false;
}

/**
 * Validates if a callsign is still vacant before approval.
 * A callsign is considered vacant if there's no document with the same designation
 * that has status "Approved" and expiry is null.
 * @param RequestDocument - The callsign document being approved.
 * @param Interaction - The button interaction for approval.
 * @param NotesSubmission - The modal submission with reviewer notes.
 * @returns A Promise resolving to null if vacant (can proceed), or a Promise if auto-denied.
 */
async function ValidateCallsignVacancy(
  RequestDocument: HCallsignDocument,
  Interaction: ButtonInteraction<"cached">,
  NotesSubmission: ModalSubmitInteraction<"cached">
): Promise<unknown[] | null> {
  const FormattedCallsign = CallsignEventLogger.FormatCallsign(RequestDocument.designation);
  const CurrentDate = Interaction.createdAt;

  // Check for any approved callsign with same designation that is still active
  // This includes: 1) No expiry (permanent), 2) Expiry date in the future (not yet expired)
  const CurrentHolder = await CallsignModel.findOne({
    designation: RequestDocument.designation,
    request_status: GenericRequestStatuses.Approved,
    $or: [{ expiry: null }, { expiry: { $gt: CurrentDate } }],
  }).exec();

  // Auto-deny if callsign is already taken by someone else:
  if (CurrentHolder && CurrentHolder.requester !== RequestDocument.requester) {
    const ExpiryInfo = CurrentHolder.expiry
      ? ` (expires ${FormatTime(CurrentHolder.expiry, "D")})`
      : "";

    const AutoDenialReason = `Callsign is already assigned to ${userMention(CurrentHolder.requester)}${ExpiryInfo}.`;
    const ReplyEmbed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle("Callsign Request Auto-Denied")
      .setDescription(
        `Cannot approve the callsign request for \`${FormattedCallsign}\` as it is already assigned to ${userMention(CurrentHolder.requester)}${ExpiryInfo}.\n` +
          "The request has been automatically denied."
      );

    RequestDocument.reviewer = Interaction.client.user.id;
    RequestDocument.request_status = GenericRequestStatuses.Denied;
    RequestDocument.reviewer_notes = AutoDenialReason;
    RequestDocument.reviewed_on = Interaction.createdAt;

    return Promise.all([
      RequestDocument.save(),
      NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
      CallsignEventLogger.LogDenial(NotesSubmission, RequestDocument),
    ]);
  }

  // If the requester already has this callsign or any other callsign,
  // let the approval process handle expiring the old assignment.
  // Return null to allow approval to proceed.
  return null;
}

/**
 * Expires any existing active callsigns for the requester before approving a new one.
 * This handles both callsign transfers (different callsign) and renewals (same callsign).
 * Uses MongoDB transactions to ensure atomicity.
 * @param RequestDocument - The callsign document being approved.
 * @param ApprovalDate - The date when the new callsign is being approved.
 * @param Session - The MongoDB session for transaction handling.
 * @returns A Promise resolving to the last expired callsign document, or `null` if none were expired.
 */
async function ExpirePreviousCallsignsInTransaction(
  RequestDocument: HCallsignDocument,
  ApprovalDate: Date,
  Session: Mongoose.ClientSession
): Promise<HCallsignDocument | null> {
  const ExistingCallsigns = await CallsignModel.find({
    guild: RequestDocument.guild,
    requester: RequestDocument.requester,
    request_status: GenericRequestStatuses.Approved,
    $or: [{ expiry: null }, { expiry: { $gt: ApprovalDate } }],
  })
    .session(Session)
    .exec();

  if (ExistingCallsigns.length > 0) {
    const ExpiryPromises = ExistingCallsigns.map((Callsign) => {
      Callsign.expiry = ApprovalDate;
      return Callsign.save({ session: Session });
    });

    await Promise.all(ExpiryPromises);
  }

  return ExistingCallsigns.pop() ?? null;
}

/**
 * Parses and validates an expiry date input from a modal submission.
 * @param ExpiryInput - The raw expiry date string from the modal.
 * @param ReferenceDate - The reference date to use for parsing (usually interaction creation time).
 * @returns An object with parsed date or error template name.
 */
function ParseExpiryDate(
  ExpiryInput: string | null,
  ReferenceDate: Date
): { date: Date | null; error_temp?: keyof typeof ErrorMessages } {
  if (!ExpiryInput || ExpiryInput.trim() === "") {
    return { date: null };
  }

  const TrimmedInput = ExpiryInput.trim();
  let ParsedDate = Chrono.parseDate(TrimmedInput, ReferenceDate);

  // Try parsing with "in" prefix if initial parsing failed and doesn't already have it
  if (!ParsedDate && !TrimmedInput.toLowerCase().startsWith("in ")) {
    ParsedDate = Chrono.parseDate(`in ${TrimmedInput}`, ReferenceDate);
  }

  if (!ParsedDate) {
    return {
      date: null,
      error_temp: "UnknownDateFormat",
    };
  }

  if (!isAfter(ParsedDate, ReferenceDate)) {
    return {
      date: null,
      error_temp: "DateInPast",
    };
  }

  return { date: ParsedDate };
}

/**
 * Creates a modal for collecting reviewer notes during callsign management operations.
 * @param Interaction - The button interaction triggering the modal.
 * @param ReviewOutcome - The type of review action being performed.
 * @param NotesRequired - Whether notes are required for this action.
 * @returns A configured modal for note collection.
 */
function GetNotesModal(
  Interaction: ButtonInteraction<"cached">,
  ReviewOutcome: "Approval" | "Denial",
  NotesRequired: boolean = false
) {
  const Modal = new ModalBuilder()
    .setTitle(`Callsign ${ReviewOutcome}`)
    .setCustomId(`callsign-rev-notes:${Interaction.user.id}:${RandomString(6)}`);

  const NotesInput = new TextInputBuilder()
    .setStyle(TextInputStyle.Short)
    .setRequired(NotesRequired)
    .setMinLength(4)
    .setMaxLength(128)
    .setLabel(`${ReviewOutcome} Notes`)
    .setCustomId("notes");

  if (ReviewOutcome === "Approval") {
    NotesInput.setPlaceholder("Any notes or comments to add.");

    // Add expiry date field for approvals
    const ExpiryInput = new TextInputBuilder()
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMinLength(2)
      .setMaxLength(40)
      .setLabel("Expiry Date (Optional)")
      .setCustomId("expiry")
      .setPlaceholder("e.g., 'in 6 months'");

    Modal.setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(NotesInput),
      new ActionRowBuilder<TextInputBuilder>().setComponents(ExpiryInput)
    );
  } else {
    NotesInput.setPlaceholder("Any notes or comments to explain the disapproval.");
    Modal.setComponents(new ActionRowBuilder<TextInputBuilder>().setComponents(NotesInput));
  }

  return Modal;
}
