/* eslint-disable sonarjs/no-duplicate-string */
import {
  SlashCommandSubcommandBuilder,
  ModalSubmitInteraction,
  InteractionResponse,
  TextDisplayBuilder,
  time as FormatTime,
  ButtonInteraction,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ComponentType,
  ButtonBuilder,
  MessageFlags,
  LabelBuilder,
  ModalBuilder,
  userMention,
  ButtonStyle,
  GuildMember,
  inlineCode,
  Message,
  User,
} from "discord.js";

import {
  GetCallsignAdminData,
  GetCallsignValidationData,
} from "@Utilities/Database/CallsignData.js";

import {
  BaseExtraContainer,
  SuccessContainer,
  ErrorContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  ParseExpiryDate,
  HandleUnauthorizedManagement,
} from "@Source/Events/InteractionCreate/CallsignManagementHandler.js";

import { RandomString } from "@Utilities/Strings/Random.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { UserHasPermsV2 } from "@Utilities/Database/UserHasPermissions.js";

import { GenericRequestStatuses } from "@Config/Constants.js";
import { ValidateCallsignFormat } from "./Request.js";
import { AggregationResults, Callsigns } from "@Typings/Utilities/Database.js";
import { ConcatenateLines, FormatCallsignDesignation } from "@Utilities/Strings/Formatters.js";

import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleCallsignStatusUpdates from "@Utilities/Discord/HandleCallsignStatusUpdates.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import CSEventLogger from "@Utilities/Classes/CallsignsEventLogger.js";
import CallsignModel from "@Models/Callsign.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

const FileLabel = "Cmds:Misc:Callsigns:Subcmds:Admin";
const CallsignsEventLogger = new CSEventLogger();
const PreviousCSRecordsLimit = 4;
const DesignationExamples = ["1-A-40", "12-K9-99", "7-SL-120", "3-G-78", "1-Air-05"];

type CmdOrButtonCachedInteraction = SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">;
interface ValidateAndParseCallsignDesignationReturn {
  validation_data: AggregationResults.CallsignsModel.GetCallsignValidationData;
  designation: {
    division: number;
    unit_type: string;
    beat_num: string;
  };
}

enum AdminActions {
  CallsignApprove = "cs-admin-approve",
  CallsignRelease = "cs-admin-release",
  CallsignAssign = "cs-admin-assign",
  CallsignDeny = "cs-admin-deny",
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Generates the callsign administration panel container.
 * @param TargetStaff - The user whose callsign data should be displayed.
 * @param CallsignData - The callsign data of the `TargetStaff`.
 * @param [PanelTarget="Admin"] - Specifies whether the panel is for "Admin" or "Management" purposes. Defaults to "Admin".
 * @param [IncludeCancelledHistory=false] - Whether to include cancelled callsign requests in the history. Defaults to `false`.
 * @returns A container that displays the callsign data of the `TargetStaff`.
 */
export function GetAdminOrMgmtPanelContainer(
  TargetStaff: User | GuildMember,
  CallsignData: AggregationResults.CallsignsModel.GetCallsignAdminData,
  PanelTarget: "Admin" | "Management" = "Admin",
  IncludeCancelledHistory: boolean = false
): BaseExtraContainer {
  const { pending_callsign, active_callsign, callsign_history } = CallsignData;
  let PanelAccentColor = Colors.DarkBlue;

  const TextDisplayContents: string[] = [];
  const PreviousCallsignsFormatted = callsign_history
    .filter((CS) => {
      if (IncludeCancelledHistory) return CS.request_status !== GenericRequestStatuses.Pending;
      return (
        CS.request_status !== GenericRequestStatuses.Cancelled &&
        CS.request_status !== GenericRequestStatuses.Pending
      );
    })
    .map((Callsign) => {
      const FormattedDesignation = FormatCallsignDesignation(Callsign.designation);
      const ReviewalDate = FormatTime(Callsign.reviewed_on as Date, "d");
      const ExpiryText = Callsign.expiry ? `:${FormatTime(Callsign.expiry, "d")}` : "";
      const StatusText = ExpiryText.length ? "Expired" : Callsign.request_status;
      return `${StatusText}: ${inlineCode(FormattedDesignation)} — ${ReviewalDate}${ExpiryText}`;
    });

  if (active_callsign) {
    const FormattedDesignation = FormatCallsignDesignation(active_callsign.designation);
    const ApprovedDate = FormatTime(active_callsign.reviewed_on!, "D");
    const ExpiryText = active_callsign.expiry
      ? `> **Expires:** ${FormatTime(active_callsign.expiry, "R")}`
      : "";

    PanelAccentColor = Colors.RequestApproved;
    TextDisplayContents.push(
      ConcatenateLines(
        "**Assigned Call Sign**",
        `> **Designation:** **${inlineCode(FormattedDesignation)}**`,
        `> **Approved:** ${ApprovedDate}`,
        `> **Approved By:** ${userMention(active_callsign.reviewer!)}`,
        ExpiryText
      )
    );
  }

  if (pending_callsign) {
    const FormattedDesignation = FormatCallsignDesignation(pending_callsign.designation);
    const RequestedDate = FormatTime(pending_callsign.requested_on, "D");
    const TransferStatus = active_callsign ? " Transfer" : "";

    PanelAccentColor = Colors.RequestPending;
    TextDisplayContents.push(
      ConcatenateLines(
        `**Pending${TransferStatus} Request**`,
        `> **Designation:** **${inlineCode(FormattedDesignation)}**`,
        `> **Requested:** ${RequestedDate}`,
        `> **Reason:** ${pending_callsign.request_reason}`
      )
    );
  }

  if (!active_callsign && !pending_callsign) {
    TextDisplayContents.push(
      ConcatenateLines(
        "**Call Sign Status**",
        PanelTarget === "Admin"
          ? "*Staff does not have an active or pending call sign request at the moment.*"
          : "You currently have no assigned or pending call sign request to manage.\n" +
              `You may request one using the ${MentionCmdByName("callsign request")} command.`
      )
    );
  }

  if (
    PreviousCallsignsFormatted.length > 0 &&
    PreviousCallsignsFormatted.length <= PreviousCSRecordsLimit
  ) {
    TextDisplayContents.push(
      ConcatenateLines("**Previous Records**", ...PreviousCallsignsFormatted.map((L) => `> ${L}`))
    );
  } else if (PreviousCallsignsFormatted.length > PreviousCSRecordsLimit) {
    TextDisplayContents.push(
      ConcatenateLines(
        "**Previous Records**",
        ...PreviousCallsignsFormatted.slice(0, PreviousCSRecordsLimit).map((L) => `> ${L}`),
        `> -# *... and ${PreviousCallsignsFormatted.length - PreviousCSRecordsLimit} more record(s)*`
      )
    );
  } else if (PreviousCallsignsFormatted.length === 0) {
    TextDisplayContents.push(
      ConcatenateLines("**Previous Records**", "> -# *There are no reviewed records to display.*")
    );
  }

  const PanelContainer = new BaseExtraContainer()
    .setColor(PanelAccentColor)
    .setDescription(TextDisplayContents.shift());

  if (PanelTarget === "Admin") {
    PanelContainer.setTitle(`Call Sign Administration for ${userMention(TargetStaff.id)}`, {
      no_sep: true,
    });
  } else {
    PanelContainer.setTitle("Call Sign Management", {
      no_sep: true,
    });
  }

  if (TextDisplayContents.length > 0) {
    PanelContainer.spliceComponents(
      3,
      0,
      ...TextDisplayContents.map((C) => {
        return new TextDisplayBuilder().setContent(C);
      })
    );
  }

  return PanelContainer;
}

/**
 * Creates the action buttons for the callsign administration panel.
 * @param Interaction - The interaction that triggered the panel.
 * @param TargetUserId - The Id of the target user.
 * @param PendingCallsign - The pending callsign document from the database, if any.
 * @param ActiveCallsign - The active callsign document from the database, if any.
 * @returns An array of action row components to be added to the panel.
 */
function GetPanelComponents(
  Interaction: CmdOrButtonCachedInteraction,
  TargetUserId: string,
  PendingCallsign?: Callsigns.CallsignDocument | null,
  ActiveCallsign?: Callsigns.CallsignDocument | null
): ActionRowBuilder<ButtonBuilder>[] {
  const ActionRows = [new ActionRowBuilder<ButtonBuilder>()];

  if (PendingCallsign?.request_status === GenericRequestStatuses.Pending) {
    ActionRows[0].addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${AdminActions.CallsignApprove}:${Interaction.user.id}:${PendingCallsign._id}:${TargetUserId}`
        )
        .setLabel("Approve Request")
        .setEmoji(Emojis.WhiteCheck)
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `${AdminActions.CallsignDeny}:${Interaction.user.id}:${PendingCallsign._id}:${TargetUserId}`
        )
        .setLabel("Deny Request")
        .setEmoji(Emojis.WhiteCross)
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (ActiveCallsign?.request_status === GenericRequestStatuses.Approved && PendingCallsign) {
    ActionRows.push(
      new ActionRowBuilder<ButtonBuilder>().setComponents(
        new ButtonBuilder()
          .setCustomId(
            `${AdminActions.CallsignRelease}:${Interaction.user.id}:${ActiveCallsign._id}:${TargetUserId}`
          )
          .setLabel("Release Currently Assigned Call Sign")
          .setEmoji(Emojis.TagMinus)
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  if (ActiveCallsign?.request_status === GenericRequestStatuses.Approved && !PendingCallsign) {
    ActionRows[0].addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${AdminActions.CallsignRelease}:${Interaction.user.id}:${ActiveCallsign._id}:${TargetUserId}`
        )
        .setLabel("Release Currently Assigned Call Sign")
        .setEmoji(Emojis.TagMinus)
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`${AdminActions.CallsignAssign}:${Interaction.user.id}:0:${TargetUserId}`)
        .setLabel("Transfer Call Sign")
        .setEmoji(Emojis.TagPlus)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (!ActiveCallsign && !PendingCallsign) {
    ActionRows[0].addComponents(
      new ButtonBuilder()
        .setCustomId(`${AdminActions.CallsignAssign}:${Interaction.user.id}:0:${TargetUserId}`)
        .setLabel("Assign a Call Sign")
        .setEmoji(Emojis.TagPlus)
        .setStyle(ButtonStyle.Primary)
    );
  }

  return ActionRows;
}

/**
 * Creates a modal for collecting reviewer notes or assignment details during callsign management operations.
 * @param Interaction - The button interaction triggering the modal.
 * @param ModalType - The type of modal to create.
 * @param NotesRequired - Whether notes are required for this action. Defaults to `false`.
 * @returns A configured modal for data collection.
 */
function GetAdminModal(
  Interaction: ButtonInteraction<"cached">,
  ModalType: "Approval" | "Denial" | "Assignment" | "Release",
  NotesRequired: boolean = false
): ModalBuilder {
  const Modal = new ModalBuilder()
    .setTitle(`Call Sign ${ModalType}`)
    .setCustomId(`cs-admin-modal:${Interaction.user.id}:${RandomString(6)}`);

  if (ModalType === "Assignment") {
    Modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Call Sign Designation")
        .setDescription("The division-unit-beat format of the call sign to assign.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("designation")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(10)
            .setPlaceholder(
              DesignationExamples[Math.floor(Math.random() * DesignationExamples.length)]
            )
        ),
      new LabelBuilder()
        .setLabel("Expiry Date")
        .setDescription("Optional expiry date for the assigned call sign.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(2)
            .setMaxLength(50)
            .setCustomId("expiry")
            .setPlaceholder("In 3 weeks, 2025-12-31, etc.")
        )
    );
  }

  const NotesLabelPrefix = NotesRequired ? "Required" : "Optional";
  Modal.addLabelComponents(
    new LabelBuilder().setLabel(`${ModalType} Notes`).setTextInputComponent(
      new TextInputBuilder()
        .setStyle(TextInputStyle.Short)
        .setRequired(NotesRequired)
        .setMinLength(3)
        .setMaxLength(128)
        .setCustomId("notes")
        .setPlaceholder(
          ModalType === "Assignment"
            ? `${NotesLabelPrefix} assignment notes...`
            : `${NotesLabelPrefix} reviewal notes and/or comments...`
        )
    )
  );

  return Modal;
}

/**
 * Validates and parses a callsign designation string.
 * @param RecInteract - The administration interaction.
 * @param TargetUserId - The Id of the user being targeted for validation data.
 * @param Designation - The callsign designation string to validate and parse.
 * @returns An object containing the parsed designation and validation data,
 *          or `false` if validation fails and an error response is sent.
 */
async function ValidateAndParseCallsignDesignation(
  RecInteract: ModalSubmitInteraction<"cached">,
  TargetUserId: string,
  Designation: string
): Promise<ValidateAndParseCallsignDesignationReturn | false> {
  const Parts = Designation.split(/\s*-\s*/);
  const DivBeat = Number.parseInt(Parts[0], 10);
  const BeatNum = Number.parseInt(Parts[2], 10);
  let UnitType = Parts[1];

  if (Parts.length !== 3 || Number.isNaN(DivBeat) || Number.isNaN(BeatNum) || !UnitType.length) {
    return new ErrorContainer()
      .useErrTemplate("CallsignInvalidFormat")
      .replyToInteract(RecInteract, true)
      .then(() => false);
  }

  UnitType = /^Air$/i.test(UnitType) ? "Air" : UnitType;
  const BeatNumStr = BeatNum.toString().padStart(2, "0");
  const ValidationData = await GetCallsignValidationData(
    RecInteract.guildId,
    TargetUserId,
    DivBeat,
    UnitType,
    BeatNumStr,
    RecInteract.createdAt
  );

  if (
    (await ValidateCallsignFormat(RecInteract, DivBeat, UnitType, BeatNum, ValidationData)) === true
  ) {
    return false;
  }

  return {
    validation_data: ValidationData,
    designation: {
      division: DivBeat,
      unit_type: UnitType,
      beat_num: BeatNumStr,
    },
  };
}

/**
 * Validates and parses an expiry date string.
 * @param RecInteract - The interaction context.
 * @param Expiry - The expiry date string to validate and parse.
 * @returns A `Date` object if the expiry date is valid, `null` if no expiry is set,
 *          or `false` if validation fails and an error response is sent.
 */
async function ValidateAndParseExpiryDate(
  RecInteract: ModalSubmitInteraction<"cached">,
  Expiry?: string | null
): Promise<Date | null | false> {
  if (!Expiry?.length) return null;
  const ParseResult = ParseExpiryDate(Expiry, RecInteract.createdAt);

  if (ParseResult.error_temp) {
    return new ErrorContainer()
      .useErrTemplate(ParseResult.error_temp)
      .replyToInteract(RecInteract, true)
      .then(() => false);
  }

  return ParseResult.date;
}

/**
 * Retrieves the target user from the interaction.
 * - If the interaction is a button, it retrieves the Id from the button custom Id.
 * - If the interaction is a command, it retrieves the user from the "staff" option.
 * @param Interaction - The interaction to retrieve the target user from.
 * @returns The target user or an error embed response if the user is a bot or not found.
 */
async function GetTargetUser(
  Interaction: CmdOrButtonCachedInteraction
): Promise<User | InteractionResponse<boolean> | Message<boolean> | null> {
  let Target: User | null = null;

  if (Interaction.isButton()) {
    const UserId = Interaction.customId.split(":")[3];
    Target = await Interaction.client.users.fetch(UserId).catch(() => null);
  } else if (Interaction.isCommand()) {
    Target = Interaction.options.getUser("staff", true);
  }

  if (Target?.bot) {
    return new ErrorContainer()
      .useErrTemplate("BotMemberSelected")
      .replyToInteract(Interaction, true, true);
  } else if (!Target) {
    return new ErrorContainer().useErrTemplate("UnknownError").replyToInteract(Interaction, true);
  }

  return Target;
}

/**
 * A wrapper function that returns a single promise that eventually resolves to `true` after
 * executing all promises in the array, regardless of their individual outcomes.
 * @remarks This function also logs any errors encountered during the execution of the promises.
 * @param Values
 * @returns
 */
export async function PromiseAllSettledThenTrue<T>(Values: T[]): Promise<true> {
  const Results = await Promise.allSettled(Values);

  for (const Res of Results) {
    if (Res.status === "rejected") {
      AppLogger.error({
        label: FileLabel,
        message: "A promise in 'PromiseAllSettledThenTrue' was rejected.",
        stack: Res.reason?.stack,
        error: Res.reason,
      });
    }
  }

  return true;
}

// ---------------------------------------------------------------------------------------
// Handlers:
// ---------
/**
 * Handles administrative interactions from button clicks.
 * @param ButtonInteract - The button interaction to handle.
 * @param TargetUserId - The ID of the target user.
 * @returns A promise that resolves to true if the interaction was handled and the prompt should be reinstated, or false otherwise.
 */
async function HandleAdministrativeInteraction(
  ButtonInteract: ButtonInteraction<"cached">
): Promise<boolean> {
  const CustomId = ButtonInteract.customId;

  if (CustomId.startsWith(AdminActions.CallsignApprove)) {
    return HandleCallsignApprovalOrDenial(ButtonInteract, "Approval");
  } else if (CustomId.startsWith(AdminActions.CallsignDeny)) {
    return HandleCallsignApprovalOrDenial(ButtonInteract, "Denial");
  } else if (CustomId.startsWith(AdminActions.CallsignRelease)) {
    return HandleCallsignRelease(ButtonInteract);
  } else if (CustomId.startsWith(AdminActions.CallsignAssign)) {
    return HandleCallsignAssignment(ButtonInteract);
  }

  return ButtonInteract.deferUpdate().then(() => false);
}

/**
 * Handles the review (approve/deny) of a pending callsign request.
 * @param BtnInteract - The button interaction.
 * @param ActionType - The type of action to perform ("Approval" or "Denial").
 * @returns A promise that resolves to `true` if the action was handled and the prompt should be reinstated, or `false` otherwise.
 */
async function HandleCallsignApprovalOrDenial(
  BtnInteract: ButtonInteraction<"cached">,
  ActionType: "Approval" | "Denial"
): Promise<boolean> {
  const TCallsignId = BtnInteract.customId.split(":")[2];
  let ReqCallsign = await CallsignModel.findById(TCallsignId).exec();

  if (!ReqCallsign || ReqCallsign.request_status !== GenericRequestStatuses.Pending) {
    await new ErrorContainer()
      .useErrTemplate("CallsignRequestModified")
      .replyToInteract(BtnInteract, true);

    return CmdCallback(BtnInteract).then(() => true);
  }

  const NotesModal = GetAdminModal(BtnInteract, ActionType, false);
  const SubRespMsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  const SubmissionResponse = await ShowModalAndAwaitSubmission(BtnInteract, NotesModal, 8 * 60_000);

  if (!SubmissionResponse) return false;
  await SubmissionResponse.deferReply({
    flags: SubRespMsgFlags,
  });

  ReqCallsign = await CallsignModel.findById(TCallsignId).exec();
  if (!ReqCallsign || ReqCallsign.request_status !== GenericRequestStatuses.Pending) {
    return PromiseAllSettledThenTrue([
      CmdCallback(BtnInteract),
      new ErrorContainer()
        .useErrTemplate("CallsignRequestModified")
        .replyToInteract(SubmissionResponse, true, true, "editReply"),
    ]);
  }

  const NotesInput = SubmissionResponse.fields.getTextInputValue("notes") || null;
  const FormattedDesignation = FormatCallsignDesignation(ReqCallsign.designation);
  const ActionPerformed =
    ActionType === "Approval" ? GenericRequestStatuses.Approved : GenericRequestStatuses.Denied;

  ReqCallsign.request_status = ActionPerformed;
  ReqCallsign.reviewer_notes = NotesInput;
  ReqCallsign.reviewed_on = new Date();
  ReqCallsign.reviewer = SubmissionResponse.user.id;

  const RespContainer = new SuccessContainer()
    .setTitle(`Call Sign ${ActionPerformed}`)
    .setDescription(
      `Successfully ${ActionPerformed.toLowerCase()} ${userMention(
        ReqCallsign.requester
      )}'s call sign request for ${inlineCode(FormattedDesignation)}.`
    );

  await ReqCallsign.save();
  return PromiseAllSettledThenTrue([
    CmdCallback(BtnInteract),
    CallsignsEventLogger[`Log${ActionType}`](SubmissionResponse, ReqCallsign),
    ActionType === "Approval" && HandleCallsignStatusUpdates(BtnInteract.client, ReqCallsign),
    SubmissionResponse.editReply({
      components: [RespContainer],
      flags: SubRespMsgFlags,
    }),
  ]);
}

/**
 * Handles the release of an active callsign.
 * @param BtnInteract - The button interaction.
 * @param TargetUserId - The Id of the target user.
 */
async function HandleCallsignRelease(BtnInteract: ButtonInteraction<"cached">): Promise<boolean> {
  const ActiveCallsignId = BtnInteract.customId.split(":")[2];
  const TargetCallsign = await CallsignModel.findById(ActiveCallsignId).exec();

  if (!TargetCallsign || !TargetCallsign.is_active(BtnInteract.createdAt)) {
    await new ErrorContainer()
      .useErrTemplate("CallsignNotAssignedToRelease")
      .replyToInteract(BtnInteract, true);

    return CmdCallback(BtnInteract).then(() => true);
  }

  const NotesModal = GetAdminModal(BtnInteract, "Release", false);
  const SubRespMsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  const SubmissionResponse = await ShowModalAndAwaitSubmission(BtnInteract, NotesModal, 8 * 60_000);

  if (!SubmissionResponse) return false;
  await SubmissionResponse.deferReply({
    flags: SubRespMsgFlags,
  });

  const ReleasedCallsign = await CallsignModel.findOneAndUpdate(
    {
      _id: TargetCallsign._id,
      request_status: GenericRequestStatuses.Approved,
      $or: [{ expiry: null }, { expiry: { $gt: SubmissionResponse.createdAt } }],
    },
    {
      expiry: SubmissionResponse.createdAt,
      expiry_notified: true,
    },
    {
      new: true,
    }
  );

  if (!ReleasedCallsign) {
    await new ErrorContainer()
      .useErrTemplate("CallsignNotAssignedToRelease")
      .replyToInteract(BtnInteract, true);

    return CmdCallback(BtnInteract).then(() => true);
  }

  const NotesInput = SubmissionResponse.fields.getTextInputValue("notes") || null;
  const FormattedDesignation = FormatCallsignDesignation(TargetCallsign.designation);
  const RespContainer = new SuccessContainer()
    .setTitle("Call Sign Released")
    .setDescription(
      `Successfully released ${userMention(TargetCallsign.requester)}'s call sign ${inlineCode(FormattedDesignation)}.`
    );

  return PromiseAllSettledThenTrue([
    CmdCallback(BtnInteract),
    CallsignsEventLogger.LogAdministrativeRelease(SubmissionResponse, TargetCallsign, NotesInput),
    HandleCallsignStatusUpdates(BtnInteract.client, ReleasedCallsign),
    SubmissionResponse.editReply({
      components: [RespContainer],
      flags: SubRespMsgFlags,
    }),
  ]);
}

/**
 * Handles the assignment of a new callsign to a user.
 * @param BtnInteract - The button interaction.
 * @param TargetUserId - The Id of the target user.
 */
async function HandleCallsignAssignment(
  BtnInteract: ButtonInteraction<"cached">
): Promise<boolean> {
  const TargetUserId = BtnInteract.customId.split(":")[3];
  const TargetMember = await BtnInteract.guild.members.fetch(TargetUserId).catch(() => null);
  const IsRecognizedStaff = TargetMember
    ? await UserHasPermsV2(TargetMember.user.id, BtnInteract.guildId, { staff: true })
    : false;

  if (!TargetMember || !IsRecognizedStaff) {
    await new ErrorContainer()
      .useErrTemplate("CallsignCannotAssignNonStaffMember")
      .replyToInteract(BtnInteract, true);

    return CmdCallback(BtnInteract).then(() => true);
  }

  const AssignmentModal = GetAdminModal(BtnInteract, "Assignment", false);
  const SubRespMsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  const SubmissionResponse = await ShowModalAndAwaitSubmission(
    BtnInteract,
    AssignmentModal,
    8 * 60_000
  );

  if (!SubmissionResponse) return false;
  await SubmissionResponse.deferReply({
    flags: SubRespMsgFlags,
  });

  const DesignationInput = SubmissionResponse.fields.getTextInputValue("designation");
  const ExpiryInput = SubmissionResponse.fields.getTextInputValue("expiry") || null;
  const NotesInput = SubmissionResponse.fields.getTextInputValue("notes") || null;

  const ParsedExpiryInput = await ValidateAndParseExpiryDate(SubmissionResponse, ExpiryInput);
  const CallsignValidationResult = await ValidateAndParseCallsignDesignation(
    SubmissionResponse,
    TargetUserId,
    DesignationInput
  );

  if (CallsignValidationResult === false || ParsedExpiryInput === false) {
    return false;
  }

  const FormattedDesignation = FormatCallsignDesignation(CallsignValidationResult.designation);
  const CallsignTransactionSession = await CallsignModel.startSession();
  let PreviousActiveCallsign: Callsigns.HydratedCallsignDocument | null = null;
  let AssignedCallsign: Callsigns.HydratedCallsignDocument | null = null;

  try {
    await CallsignTransactionSession.withTransaction(async () => {
      const ExistingActiveCallsign = CallsignValidationResult.validation_data.active_callsign;

      if (ExistingActiveCallsign) {
        PreviousActiveCallsign = await CallsignModel.findByIdAndUpdate(
          ExistingActiveCallsign._id,
          { expiry: SubmissionResponse.createdAt, expiry_notified: true },
          { session: CallsignTransactionSession }
        );
      }

      AssignedCallsign = new CallsignModel({
        guild: BtnInteract.guildId,
        requester: TargetUserId,
        designation: CallsignValidationResult.designation,
        request_message: null,

        request_reason: "[Administrative]",
        request_status: GenericRequestStatuses.Approved,
        requested_on: SubmissionResponse.createdAt,
        expiry: ParsedExpiryInput,

        reviewer: SubmissionResponse.user.id,
        reviewed_on: SubmissionResponse.createdAt,
        reviewer_notes: NotesInput,
      });

      await AssignedCallsign.save({ session: CallsignTransactionSession });
    });
  } catch (Err: any) {
    AppLogger.error({
      label: FileLabel,
      message: "An error occurred during callsign assignment transaction.",
      stack: Err?.stack,
      error: Err,
    });
  } finally {
    await CallsignTransactionSession.endSession();
  }

  if (!AssignedCallsign) {
    return PromiseAllSettledThenTrue([
      CmdCallback(BtnInteract),
      new ErrorContainer().useErrTemplate("AppError").replyToInteract(SubmissionResponse, true),
    ]);
  }

  const RespContainer = new SuccessContainer()
    .setTitle(`Call Sign ${PreviousActiveCallsign ? "Transferred" : "Assigned"}`)
    .setDescription(
      `Successfully assigned ${userMention(
        (AssignedCallsign as Callsigns.CallsignDocument).requester
      )} the call sign ${inlineCode(FormattedDesignation)}. ` +
        (ParsedExpiryInput
          ? `This call sign is set to expire ${FormatTime(ParsedExpiryInput, "R")}.`
          : "")
    );

  return PromiseAllSettledThenTrue([
    CmdCallback(BtnInteract),
    SubmissionResponse.editReply({ components: [RespContainer], flags: SubRespMsgFlags }),
    HandleCallsignStatusUpdates(BtnInteract.client, AssignedCallsign),
    CallsignsEventLogger.LogAdministrativeAssignmentOrTransfer(
      SubmissionResponse,
      AssignedCallsign as Callsigns.CallsignDocument,
      PreviousActiveCallsign as Callsigns.CallsignDocument | null
    ),
  ]);
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function CmdCallback(Interaction: CmdOrButtonCachedInteraction) {
  const IsUnauthorized = await HandleUnauthorizedManagement(Interaction);
  if (IsUnauthorized) return;

  const TargetUser = await GetTargetUser(Interaction);
  if (!(TargetUser instanceof User)) return;
  if (!Interaction.deferred && !Interaction.replied) {
    if (Interaction.isButton()) await Interaction.deferUpdate().catch(() => null);
    else await Interaction.deferReply();
  }

  const CallsignData = await GetCallsignAdminData(Interaction.guildId, TargetUser.id);
  const PanelContainer = GetAdminOrMgmtPanelContainer(TargetUser, CallsignData);
  const PanelComponents = GetPanelComponents(
    Interaction,
    TargetUser.id,
    CallsignData.pending_callsign,
    CallsignData.active_callsign
  );

  if (PanelComponents.length > 0) {
    PanelContainer.attachPromptActionRows(PanelComponents);
  }

  const AdminPanelMessage = await Interaction.editReply({
    message: Interaction.isButton() ? Interaction.message.id : undefined,
    components: [PanelContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  const CompActionCollector = AdminPanelMessage.createMessageComponentCollector({
    time: 12.5 * 60 * 1000,
    filter: (I) => I.user.id === Interaction.user.id,
    componentType: ComponentType.Button,
  });

  CompActionCollector.on("collect", async function OnCSAdminAction(BtnInteract) {
    try {
      const PanelReinstated = await HandleAdministrativeInteraction(BtnInteract);
      if (PanelReinstated === true) {
        CompActionCollector.stop("PromptReinstated");
      }
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while handling administrative interaction.",
        label: FileLabel,
        stack: Err?.stack,
        error: Err,
      });

      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(BtnInteract, true);
    }
  });

  CompActionCollector.on("end", async function OnCSAdminEnd(Collected, Reason) {
    if (/\w{1,10}Delete/.test(Reason) || Reason === "PromptReinstated") return;

    const LastInteract = Collected.last() ?? Interaction;
    const ReplyOptions = {
      components: DisableMessageComponents(AdminPanelMessage.components.map((C) => C.toJSON())),
      message: AdminPanelMessage.id,
    };

    if (LastInteract.replied || LastInteract.deferred) {
      await LastInteract.editReply(ReplyOptions).catch(() => null);
    } else {
      await LastInteract.reply(ReplyOptions).catch(() => null);
    }
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("admin")
    .setDescription("Manage and administer an individual officer's call sign.")
    .addUserOption((Option) =>
      Option.setName("staff")
        .setDescription("The staff to administrate their call sign.")
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
