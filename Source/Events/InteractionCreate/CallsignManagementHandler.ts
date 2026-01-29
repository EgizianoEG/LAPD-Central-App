import {
  userMention,
  MessageFlags,
  ModalBuilder,
  LabelBuilder,
  TextInputStyle,
  BaseInteraction,
  TextInputBuilder,
  ButtonInteraction,
  time as FormatTime,
  ModalSubmitInteraction,
} from "discord.js";

import {
  InfoContainer,
  WarnContainer,
  ErrorContainer,
  SuccessContainer,
  BaseExtraContainer,
  UnauthorizedContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import {
  Dedent,
  FormatCallsignDesignation as FormatCallsign,
} from "#Utilities/Strings/Formatters.js";

import { isAfter } from "date-fns";
import { Callsigns } from "#Typings/Utilities/Database.js";
import { ErrorMessages } from "#Resources/AppMessages.js";
import { UserHasPermsV2 } from "#Utilities/Database/UserHasPermissions.js";
import { GenericRequestStatuses } from "#Config/Constants.js";
import { RandomString, GetErrorId } from "#Utilities/Strings/Random.js";
import { GetCallsignValidationData } from "#Utilities/Database/CallsignData.js";
import { CallsignMgmtCustomIdRegex } from "#Resources/RegularExpressions.js";
import { DivisionBeats, ServiceUnitTypes } from "#Resources/LAPDCallsigns.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleCallsignStatusUpdates from "#Utilities/Discord/HandleCallsignStatusUpdates.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import CallsignsEventLogger from "#Utilities/Classes/CallsignsEventLogger.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import CallsignModel from "#Models/Callsign.js";
import * as Chrono from "chrono-node";
import AppLogger from "#Utilities/Classes/AppLogger.js";

type HCallsignDocument = Callsigns.HydratedCallsignDocument;
type CSReviewResponse = {
  pass: boolean;
  validation_data: Awaited<ReturnType<typeof GetCallsignValidationData>> | null;
};

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
      stack: Err?.stack,
      error: Err,
    });

    return new ErrorContainer()
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

  const HandlerFunction = FunctionMap[Action as keyof typeof FunctionMap];
  if (!HandlerFunction) {
    return new ErrorContainer().useErrTemplate("UnknownError").replyToInteract(Interaction, true);
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
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const FormattedCallsign = FormatCallsign(CallsignDocument.designation);
  const CallsignHistory = await CallsignModel.find({
    guild: Interaction.guildId,
    request_status: { $in: [GenericRequestStatuses.Approved, GenericRequestStatuses.Denied] },
    designation: CallsignDocument.designation,
  })
    .sort({ requested_on: -1 })
    .limit(8)
    .exec();

  const CallsignHistoryStr: string[] = [];
  const UnitTypeDetail =
    ServiceUnitTypes.find((U) => U.unit === CallsignDocument.designation.unit_type)?.desc ??
    "*Unknown*";

  const DivisionName =
    DivisionBeats.find((D) => D.num === CallsignDocument.designation.division)?.name ?? "*Unknown*";

  for (const Record of CallsignHistory) {
    const ReviewedText = FormatTime(Record.reviewed_on!, "d");
    const ExpiryText = Record.expiry ? `:${FormatTime(Record.expiry, "d")}` : "";
    const StatusText =
      Record.request_status === GenericRequestStatuses.Approved ? "Approved" : "Denied";

    const CurrentHolderSignal =
      Record.request_status === GenericRequestStatuses.Approved &&
      (!Record.expiry || Record.expiry > Interaction.createdAt)
        ? " *(Current Holder)*"
        : "";

    CallsignHistoryStr.push(
      `${userMention(Record.requester)} - ${StatusText} (${ReviewedText}${ExpiryText})${CurrentHolderSignal}`
    );
  }

  const CallsignInfoContainer = new InfoContainer()
    .setTitle(`Call Sign Information: \`${FormattedCallsign}\``)
    .setDescription(
      Dedent(`        
        **Designation**
        > - **Division:** ${DivisionName} (${CallsignDocument.designation.division})
        > - **Unit Type:** ${UnitTypeDetail} (${CallsignDocument.designation.unit_type})
        > - **Beat Number:** ${CallsignDocument.designation.beat_num}

        **Requested Call Sign's Recent History**
        > ${CallsignHistoryStr.length ? CallsignHistoryStr.join("\n> ") : "*There is no history available to view.*"}
      `)
    );

  return CallsignInfoContainer.replyToInteract(Interaction, true);
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
  const FormattedCallsign = FormatCallsign(CallsignDocument.designation);
  const NotesModal = GetNotesModal(Interaction, "Approval", false);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await CallsignModel.findById(CallsignDocument._id).exec();
  const CallsignValidationResult = await HandleCallsignReviewValidation(
    NotesSubmission,
    UpdatedDocument,
    Interaction
  );

  if (!CallsignValidationResult.pass || !UpdatedDocument) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const VacancyValidation = await ValidateCallsignVacancy(
    UpdatedDocument,
    Interaction,
    NotesSubmission
  );

  if (VacancyValidation !== null) {
    return VacancyValidation;
  }

  const ExpiryInput = NotesSubmission.fields.getTextInputValue("expiry");
  const ParsedExpiry = ParseExpiryDate(ExpiryInput, Interaction.createdAt);

  if (ParsedExpiry.error_temp) {
    return new ErrorContainer()
      .useErrTemplate(ParsedExpiry.error_temp as any)
      .replyToInteract(NotesSubmission, true);
  }

  const SuccessMessageContainer = new SuccessContainer()
    .setTitle("Call Sign Request Approved")
    .setDescription(
      `Successfully approved the call sign request for \`${FormattedCallsign}\`.` +
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
      UpdatedDocument.request_status = GenericRequestStatuses.Approved;
      UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
      UpdatedDocument.expiry = ParsedExpiry.date;

      await UpdatedDocument.save({ session: DBSession });
    });
  } catch {
    // Intentionally left blank.
  } finally {
    await DBSession.endSession();
  }

  return Promise.all([
    HandleCallsignStatusUpdates(NotesSubmission.client, UpdatedDocument),
    CallsignEventLogger.LogApproval(NotesSubmission, UpdatedDocument, PreviousCallsign),
    NotesSubmission.editReply({
      components: [SuccessMessageContainer],
      flags: MessageFlags.IsComponentsV2,
    }),
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
  const FormattedCallsign = FormatCallsign(CallsignDocument.designation);
  const NotesModal = GetNotesModal(Interaction, "Denial", true);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await CallsignModel.findById(CallsignDocument._id).exec();
  const CallsignValidationResult = await HandleCallsignReviewValidation(
    NotesSubmission,
    UpdatedDocument,
    Interaction
  );

  if (!CallsignValidationResult.pass || !UpdatedDocument) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const DeniedCallSignResponse = new SuccessContainer()
    .setTitle("Call Sign Request Denied")
    .setDescription(`Successfully denied the call sign request for \`${FormattedCallsign}\`.`);

  UpdatedDocument.request_status = GenericRequestStatuses.Denied;
  UpdatedDocument.reviewer = Interaction.user.id;
  UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
  UpdatedDocument.reviewed_on = Interaction.createdAt;

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({
      components: [DeniedCallSignResponse],
      flags: MessageFlags.IsComponentsV2,
    }),
    CallsignEventLogger.LogDenial(
      NotesSubmission,
      UpdatedDocument,
      CallsignValidationResult.validation_data?.active_callsign
    ),
  ]);
}
// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Validates if the user has management permissions to perform callsign management actions.
 * @param Interaction - The button interaction to validate permissions for.
 * @returns A Promise resolving to `true` if user is unauthorized (action blocked), `false` otherwise.
 */
export async function HandleUnauthorizedManagement(
  Interaction: ButtonInteraction<"cached"> | SlashCommandInteraction<"cached">
) {
  const GuildSettings = await GetGuildSettings(Interaction.guildId);
  if (!GuildSettings?.callsigns_module.enabled) {
    return new ErrorContainer()
      .useErrTemplate("CallsignsModuleDisabled")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  const UserRoles = new Set(Interaction.member.roles.cache.map((Role) => Role.id));
  const HasManagementPermission =
    (await UserHasPermsV2(Interaction.user.id, Interaction.guildId, { management: true })) ||
    GuildSettings.callsigns_module.manager_roles.some((RoleId) => UserRoles.has(RoleId));

  if (!HasManagementPermission) {
    return new UnauthorizedContainer()
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
): Promise<CSReviewResponse> {
  const RequestHasToBeReviewed = RequestDocument?.request_status === GenericRequestStatuses.Pending;
  const ValidationResponse: CSReviewResponse = { pass: false, validation_data: null };

  if (!RequestHasToBeReviewed) {
    let UpdatedReqContainer: BaseExtraContainer | null = null;
    const RespContainer = new ErrorContainer().useErrTemplate("CallsignRequestModified");

    if (RequestDocument) {
      ValidationResponse.validation_data = await GetCallsignValidationData(
        Interaction.guildId,
        RequestDocument.requester,
        RequestDocument.designation.division,
        RequestDocument.designation.unit_type,
        RequestDocument.designation.beat_num,
        Interaction.createdAt
      );

      UpdatedReqContainer = await CallsignEventLogger.GetRequestMessageContainerWithStatus(
        Interaction.guild,
        RequestDocument,
        RequestDocument.request_status,
        ValidationResponse.validation_data.active_callsign
      );
    }

    const Tasks: Promise<any>[] = [];
    if (UpdatedReqContainer) {
      await Interaction.deferUpdate().catch(() => null);
      Tasks.push(
        Interaction.followUp({
          components: [RespContainer],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }),
        InitialInteraction.editReply({
          flags: MessageFlags.IsComponentsV2,
          message: RequestDocument?.request_message?.split(":")[1],
          components: [UpdatedReqContainer],
        })
      );
    } else {
      await Interaction.deferUpdate().catch(() => null);
      Tasks.push(
        Interaction.followUp({
          components: [RespContainer],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }),
        InitialInteraction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: DisableMessageComponents(
            InitialInteraction.message!.components.map((Comp) => Comp.toJSON())
          ),
        })
      );
    }

    return Promise.all(Tasks).then(() => ValidationResponse);
  } else if (RequestDocument) {
    ValidationResponse.validation_data = await GetCallsignValidationData(
      Interaction.guildId,
      RequestDocument.requester,
      RequestDocument.designation.division,
      RequestDocument.designation.unit_type,
      RequestDocument.designation.beat_num,
      Interaction.createdAt
    );

    const IsRequesterPresentMember = await Interaction.guild.members
      .fetch(RequestDocument.requester)
      .catch(() => null);

    if (!IsRequesterPresentMember) {
      await Interaction.deferUpdate().catch(() => null);

      RequestDocument.request_status = GenericRequestStatuses.Cancelled;
      RequestDocument.reviewer_notes = "Requester is no longer a member of this server.";
      RequestDocument.reviewed_on = Interaction.createdAt;
      RequestDocument.reviewer = Interaction.client.user.id;

      const RespContainer = new WarnContainer()
        .setTitle("Request Cancelled")
        .setDescription(
          "This call sign request has been automatically cancelled because the requester is no longer a member of this server."
        );

      const Tasks: Promise<any>[] = [
        RequestDocument.save(),
        Interaction.followUp({
          components: [RespContainer],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }),
        CallsignEventLogger.LogCancellation(
          Interaction,
          RequestDocument,
          ValidationResponse.validation_data?.active_callsign
        ),
      ];

      return Promise.all(Tasks).then(() => ValidationResponse);
    }
  }

  ValidationResponse.pass = true;
  return ValidationResponse;
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
  const FormattedCallsign = FormatCallsign(RequestDocument.designation);
  const CurrentDate = Interaction.createdAt;

  // Check for any approved callsign with same designation that is still active
  // This includes: 1) No expiry (permanent), 2) Expiry date in the future (not yet expired)
  const CurrentHolder = await CallsignModel.findOne({
    designation: RequestDocument.designation,
    request_status: GenericRequestStatuses.Approved,
    $or: [{ expiry: null }, { expiry: { $gt: CurrentDate } }],
  }).exec();

  // Auto-deny if callsign is already taken:
  if (CurrentHolder && CurrentHolder.requester !== RequestDocument.requester) {
    const ExpiryInfo = CurrentHolder.expiry
      ? ` (expires ${FormatTime(CurrentHolder.expiry, "D")})`
      : "";

    const ResolvedUsername = (await Interaction.guild.members.fetch(CurrentHolder.requester)).user
      .username;

    const ResolvedUsernameText = ResolvedUsername ? `to @${ResolvedUsername}` : "";
    const AutoDenialReason = `Call sign is already assigned ${ResolvedUsernameText}${ExpiryInfo}.`;
    const ReplyEmbed = new ErrorContainer()
      .setTitle("Call sign Request Auto-Denied")
      .setDescription(
        `Cannot approve the call sign request for \`${FormattedCallsign}\` as it is already assigned to ${userMention(CurrentHolder.requester)}${ExpiryInfo}.\n` +
          "The request has been automatically denied."
      );

    RequestDocument.reviewer = Interaction.client.user.id;
    RequestDocument.request_status = GenericRequestStatuses.Denied;
    RequestDocument.reviewer_notes = AutoDenialReason;
    RequestDocument.reviewed_on = Interaction.createdAt;

    return Promise.all([
      RequestDocument.save(),
      CallsignEventLogger.LogDenial(NotesSubmission, RequestDocument),
      NotesSubmission.editReply({
        components: [ReplyEmbed],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      }),
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
export function ParseExpiryDate(
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
    .setTitle(`Call sign ${ReviewOutcome}`)
    .setCustomId(`callsign-rev-notes:${Interaction.user.id}:${RandomString(6)}`);

  const NotesInput = new TextInputBuilder()
    .setStyle(TextInputStyle.Short)
    .setRequired(NotesRequired)
    .setMinLength(4)
    .setMaxLength(128)
    .setCustomId("notes");

  if (ReviewOutcome === "Approval") {
    const ExpiryInput = new TextInputBuilder()
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMinLength(2)
      .setMaxLength(40)
      .setCustomId("expiry")
      .setPlaceholder("e.g., 'in 2 weeks'");

    Modal.setLabelComponents(
      new LabelBuilder()
        .setLabel(`${ReviewOutcome} Notes`)
        .setDescription("Any notes or comments to add.")
        .setTextInputComponent(NotesInput),
      new LabelBuilder()
        .setLabel("Expiry Date")
        .setDescription("Optional expiry date for this call sign.")
        .setTextInputComponent(ExpiryInput)
    );
  } else {
    NotesInput.setPlaceholder("Any notes or comments to explain the disapproval.");
    Modal.setLabelComponents(
      new LabelBuilder()
        .setTextInputComponent(NotesInput)
        .setLabel(`${ReviewOutcome} Notes`)
        .setDescription(
          NotesRequired
            ? "Required notes to explain the disapproval."
            : "Any notes or comments explaining the disapproval."
        )
    );
  }

  return Modal;
}
