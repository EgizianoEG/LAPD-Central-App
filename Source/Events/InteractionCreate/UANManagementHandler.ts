/* eslint-disable sonarjs/no-duplicate-string */
import {
  ModalSubmitInteraction,
  time as FormatTime,
  ButtonInteraction,
  TextInputBuilder,
  BaseInteraction,
  TextInputStyle,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  LabelBuilder,
} from "discord.js";

import {
  LeaveOfAbsenceEventLogger,
  ReducedActivityEventLogger,
} from "#Utilities/Classes/UANEventLogger.js";

import { Colors } from "#Config/Shared.js";
import { UserHasPermsV2 } from "#Utilities/Database/UserHasPermissions.js";
import { UserActivityNotice } from "#Typings/Utilities/Database.js";
import { GetErrorId, RandomString } from "#Utilities/Strings/Random.js";
import { ErrorEmbed, UnauthorizedEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import { UserActivityNoticeMgmtCustomIdRegex } from "#Resources/RegularExpressions.js";

import HandleUserActivityNoticeUpdate from "#Utilities/Discord/HandleUANUpdate.js";
import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import LeaveOfAbsenceModel from "#Models/UserActivityNotice.js";
import GetMainShiftsData from "#Utilities/Database/GetShiftsData.js";
import GetUANsData from "#Utilities/Database/GetUANData.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import Dedent from "dedent";

type HNoticeDocument = UserActivityNotice.ActivityNoticeHydratedDocument;
const LOAEventLogger = new LeaveOfAbsenceEventLogger();
const RAEventLogger = new ReducedActivityEventLogger();

// Function maps for both LOA and RA handlers
const FunctionMap = {
  "loa-approve": HandleUANApproval,
  "loa-deny": HandleUANDenial,
  "loa-info": HandleNoticeAddInfo,
  "loa-ext-approve": HandleExtApproval,
  "loa-ext-deny": HandleExtDenial,

  "ra-approve": HandleUANApproval,
  "ra-deny": HandleUANDenial,
  "ra-info": HandleNoticeAddInfo,
};

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Handles all User Activity Notice management button interactions.
 * @param _ - Discord client instance (unused parameter).
 * @param Interaction - The Discord interaction to process.
 * @returns A Promise that resolves when the interaction handling is complete, or undefined if the interaction doesn't match criteria.
 */
export default async function UANManagementHandlerWrapper(
  _: DiscordClient,
  Interaction: BaseInteraction
) {
  if (
    !Interaction.isButton() ||
    !Interaction.inCachedGuild() ||
    !Interaction.customId.match(UserActivityNoticeMgmtCustomIdRegex)
  ) {
    return;
  }

  try {
    if (await HandleUnauthorizedManagement(Interaction)) return;
    await UANManagementHandler(Interaction);
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    AppLogger.error({
      label: "Events:InteractionCreate:UANManagementHandler.ts",
      message: "Failed to handle UAN management button interaction;",
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
 * Processes User Activity Notice management actions from button interactions.
 * Button custom id format: <type>-<action>:<requester_id>:<request_id/notice_id>
 * - Types: `loa` for Leave of Absence or `ra` for Reduced Activity
 * - Actions: `approve`, `deny`, `info`, `ext-approve`, `ext-deny` (ext actions only for LOA)
 * - The `request_id` is the unique ID of the UAN request stored in the database.
 *
 * @param Interaction - The button interaction to process.
 * @returns A Promise that resolves when the management action is completed.
 */
async function UANManagementHandler(Interaction: ButtonInteraction<"cached">) {
  const [Action, , NoticeId] = Interaction.customId.split(":");
  const RequestDocument = await LeaveOfAbsenceModel.findOne({
    guild: Interaction.guildId,
    _id: NoticeId,
  }).exec();

  if (await HandleNoticeReviewValidation(Interaction, RequestDocument)) return;
  return FunctionMap[Action](Interaction, RequestDocument);
}

/**
 * Validates if the user has management permissions to perform UAN management actions.
 * @param Interaction - The button interaction to validate permissions for.
 * @returns A Promise resolving to true if user is unauthorized (action blocked), false otherwise.
 */
async function HandleUnauthorizedManagement(Interaction: ButtonInteraction<"cached">) {
  const IsActionAuthorized = await UserHasPermsV2(Interaction.user.id, Interaction.guildId, {
    management: true,
  });

  if (!IsActionAuthorized) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UANUnauthorizedManagement")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

/**
 * Validates whether a notice can still be reviewed or has already been processed.
 * @param Interaction - The current interaction being processed.
 * @param RequestDocument - The notice document to validate.
 * @param InitialInteraction - The original button interaction that started the process.
 * @returns A Promise resolving to `true` if validation failed (action blocked), `false` if review can proceed.
 */
async function HandleNoticeReviewValidation(
  Interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  RequestDocument?: HNoticeDocument | null,
  InitialInteraction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached"> = Interaction
): Promise<boolean> {
  const IsLOA = RequestDocument?.type === "LeaveOfAbsence";
  const IsExtensionRequest =
    IsLOA && RequestDocument?.status !== "Pending" && RequestDocument.extension_request;
  const RequestHasToBeReviewed =
    (RequestDocument?.status === "Pending" && RequestDocument.review_date === null) ||
    (IsLOA && RequestDocument.is_active && RequestDocument.extension_request?.status === "Pending");

  if (!RequestHasToBeReviewed) {
    let UpdatedReqEmbed: EmbedBuilder | null = null;
    const ReplyEmbed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle("Request Modified")
      .setDescription(
        "The request you are taking action on either does not exist or has already been reviewed."
      );

    const EventLogger = IsLOA ? LOAEventLogger : RAEventLogger;
    if (RequestDocument && IsExtensionRequest) {
      UpdatedReqEmbed = await LOAEventLogger.GetLOAExtRequestMessageEmbedWithStatus(
        Interaction.guild,
        RequestDocument,
        RequestDocument.extension_request!.status
      );
    } else if (RequestDocument) {
      UpdatedReqEmbed = await EventLogger.GetRequestMessageEmbedWithStatus(
        Interaction.guild,
        RequestDocument,
        RequestDocument.status
      );
    }

    const Tasks: Promise<any>[] = [];
    const OriginalMessage = InitialInteraction.message;
    const DisabledComponents = OriginalMessage
      ? DisableMessageComponents(OriginalMessage.components.map((Comp) => Comp.toJSON()))
      : null;

    await Interaction.deferUpdate().catch(() => null);
    Tasks.push(Interaction.followUp({ embeds: [ReplyEmbed], flags: MessageFlags.Ephemeral }));

    if (OriginalMessage && DisabledComponents) {
      if (UpdatedReqEmbed) {
        Tasks.push(
          OriginalMessage.edit({
            content: null,
            embeds: [UpdatedReqEmbed],
            components: DisabledComponents,
          })
        );
      } else {
        Tasks.push(OriginalMessage.edit({ components: DisabledComponents }));
      }
    }

    return Promise.all(Tasks).then(() => true);
  } else if (RequestDocument) {
    const IsTargetPresentMember = await Interaction.guild.members
      .fetch(RequestDocument.user)
      .catch(() => null);

    if (!IsTargetPresentMember) {
      const ReplyEmbed = new ErrorEmbed().useErrTemplate("UANRequesterNoLongerAMember");
      await Interaction.deferUpdate().catch(() => null);
      return Interaction.followUp({
        embeds: [ReplyEmbed],
        flags: MessageFlags.Ephemeral,
      })
        .then(() => true)
        .catch(() => true);
    }
  }

  return false;
}

/**
 * Displays additional information about the requester, including their UAN history and shift statistics.
 * @param Interaction - The button interaction requesting additional information.
 * @param NoticeDocument - The notice document for which to display information.
 * @returns A Promise that resolves after sending the information response.
 */
async function HandleNoticeAddInfo(
  Interaction: ButtonInteraction<"cached">,
  NoticeDocument: HNoticeDocument
) {
  const IsLOA = NoticeDocument.type === "LeaveOfAbsence";
  const UANsData = await GetUANsData({
    guild_id: Interaction.guildId,
    user_id: NoticeDocument.user,
    type: NoticeDocument.type,
  });

  const ShiftsData = await GetMainShiftsData({
    user: NoticeDocument.user,
    guild: NoticeDocument.guild,
  });

  const NoticeType = IsLOA ? "LOA" : "RA";
  const NoticeTypeMid = IsLOA ? "Leave" : "Reduced Activity";
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle("Officer's Past Information");

  if (UANsData.recent_notice) {
    ReplyEmbed.addFields({
      name: `${NoticeType} Statistics`,
      value: Dedent(`
        >>> **Taken ${NoticeType}s:** \`${UANsData.completed_notices.length}\`
        **Recent ${NoticeTypeMid}:**
        - Ended: ${FormatTime(UANsData.recent_notice.early_end_date ?? UANsData.recent_notice.end_date, "D")}
        - Duration: ${UANsData.recent_notice.duration_hr}
      `),
    });
  } else {
    ReplyEmbed.addFields({
      name: `${NoticeType} Statistics`,
      value: Dedent(`
        >>> **Taken ${NoticeType}s:** \`${UANsData.completed_notices.length}\`
        **Recent ${NoticeTypeMid}:** None
      `),
    });
  }

  ReplyEmbed.addFields({
    name: "Shift Statistics",
    value: Dedent(`
      >>> **Shift Count:** \`${ShiftsData.shift_count}\`
      **Frequent S. Type:** \`${ShiftsData.frequent_shift_type}\`
      **Total Time:** ${ShiftsData.total_onduty}
      **Average Time:** ${ShiftsData.avg_onduty}
    `),
  });

  Interaction.reply({ embeds: [ReplyEmbed], flags: MessageFlags.Ephemeral });
}

/**
 * Processes the approval of a User Activity Notice (LOA or RA).
 * Shows a modal for reviewer notes, updates the document, and assigns appropriate roles.
 * @param Interaction - The button interaction for approval.
 * @param NoticeDocument - The notice document to be approved.
 * @returns A Promise resolving after the approval process is completed.
 */
async function HandleUANApproval(
  Interaction: ButtonInteraction<"cached">,
  NoticeDocument: HNoticeDocument
) {
  const IsLOA = NoticeDocument.type === "LeaveOfAbsence";
  const EventLogger = IsLOA ? LOAEventLogger : RAEventLogger;
  const NoticeType = IsLOA ? "Leave" : "Reduced Activity";

  const NotesModal = GetNotesModal(Interaction, "Approval", false, IsLOA);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await NoticeDocument.getUpToDate();
  if (
    (await HandleNoticeReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle(`${NoticeType} Approved`)
    .setDescription(`Successfully approved the ${NoticeType.toLowerCase()} request.`);

  UpdatedDocument.status = "Approved";
  UpdatedDocument.review_date = NotesSubmission.createdAt;
  UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
  UpdatedDocument.reviewed_by = {
    id: Interaction.user.id,
    username: Interaction.user.username,
  };

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    EventLogger.LogApproval(NotesSubmission, UpdatedDocument),
    HandleUserActivityNoticeUpdate(
      UpdatedDocument.user,
      NotesSubmission.guild,
      IsLOA ? "LeaveOfAbsence" : "ReducedActivity",
      true
    ),
  ]);
}

/**
 * Processes the denial of a User Activity Notice (LOA or RA).
 * Shows a modal for required rejection notes and updates the document status.
 * @param Interaction - The button interaction for denial.
 * @param NoticeDocument - The notice document to be denied.
 * @returns A Promise resolving after the denial process is completed.
 */
async function HandleUANDenial(
  Interaction: ButtonInteraction<"cached">,
  NoticeDocument: HNoticeDocument
) {
  const IsLOA = NoticeDocument.type === "LeaveOfAbsence";
  const EventLogger = IsLOA ? LOAEventLogger : RAEventLogger;
  const NoticeType = IsLOA ? "Leave" : "Reduced Activity";

  const NotesModal = GetNotesModal(Interaction, "Denial", true, IsLOA);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await NoticeDocument.getUpToDate();
  if (
    (await HandleNoticeReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle(`${NoticeType} Denied`)
    .setDescription(`Successfully denied the ${NoticeType.toLowerCase()} request.`);

  UpdatedDocument.status = "Denied";
  UpdatedDocument.review_date = NotesSubmission.createdAt;
  UpdatedDocument.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes");
  UpdatedDocument.reviewed_by = {
    id: Interaction.user.id,
    username: Interaction.user.username,
  };

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    EventLogger.LogDenial(NotesSubmission, UpdatedDocument),
  ]);
}

/**
 * Handles the approval of a Leave of Absence extension request.
 * Collects optional reviewer notes and updates the extension status.
 * @param Interaction - The button interaction for extension approval.
 * @param LeaveDocument - The LOA document with pending extension request.
 * @returns A Promise resolving after the extension approval process is completed.
 */
async function HandleExtApproval(
  Interaction: ButtonInteraction<"cached">,
  LeaveDocument: HNoticeDocument
) {
  if (LeaveDocument.type !== "LeaveOfAbsence") {
    return new ErrorEmbed()
      .useErrTemplate("OnlyLeaveExtensionsPossible")
      .replyToInteract(Interaction, true);
  }

  const NotesModal = GetNotesModal(Interaction, "Extension Approval", false, true);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await LeaveDocument.getUpToDate();
  if (
    (await HandleNoticeReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Leave Extension Approved")
    .setDescription("Successfully approved the extension request.");

  UpdatedDocument.extension_request!.status = "Approved";
  UpdatedDocument.extension_request!.review_date = NotesSubmission.createdAt;
  UpdatedDocument.extension_request!.reviewer_notes =
    NotesSubmission.fields.getTextInputValue("notes") || null;
  UpdatedDocument.extension_request!.reviewed_by = {
    id: Interaction.user.id,
    username: Interaction.user.username,
  };

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger.LogExtensionApproval(NotesSubmission, UpdatedDocument),
  ]);
}

/**
 * Handles the denial of a Leave of Absence extension request.
 * Collects mandatory rejection notes and updates the extension status.
 * @param Interaction - The button interaction for extension denial.
 * @param LeaveDocument - The LOA document with pending extension request.
 * @returns A Promise resolving after the extension denial process is completed.
 */
async function HandleExtDenial(
  Interaction: ButtonInteraction<"cached">,
  LeaveDocument: HNoticeDocument
) {
  if (LeaveDocument.type !== "LeaveOfAbsence") {
    return new ErrorEmbed()
      .useErrTemplate("OnlyLeaveExtensionsPossible")
      .replyToInteract(Interaction, true);
  }

  const NotesModal = GetNotesModal(Interaction, "Extension Denial", true, true);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return;

  const UpdatedDocument = await LeaveDocument.getUpToDate();
  if (
    (await HandleNoticeReviewValidation(NotesSubmission, UpdatedDocument, Interaction)) ||
    !UpdatedDocument
  ) {
    return;
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Leave Extension Denied")
    .setDescription("Successfully denied the extension request.");

  UpdatedDocument.extension_request!.status = "Denied";
  UpdatedDocument.extension_request!.review_date = NotesSubmission.createdAt;
  UpdatedDocument.extension_request!.reviewer_notes =
    NotesSubmission.fields.getTextInputValue("notes") || null;
  UpdatedDocument.extension_request!.reviewed_by = {
    id: Interaction.user.id,
    username: Interaction.user.username,
  };

  return Promise.all([
    UpdatedDocument.save(),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger.LogExtensionDenial(NotesSubmission, UpdatedDocument),
  ]);
}

/**
 * Creates a modal for collecting reviewer notes during the approval/denial process.
 * @param Interaction - The button interaction that triggered the review.
 * @param ReviewOutcome - The type of review being performed.
 * @param NotesRequired - Whether notes are mandatory. Defaults to false.
 * @param IsLOA - Whether this is for a Leave of Absence (true) or Reduced Activity (false).
 * @returns A configured modal for collecting reviewer notes.
 */
function GetNotesModal(
  Interaction: ButtonInteraction<"cached">,
  ReviewOutcome: "Approval" | "Denial" | "Extension Approval" | "Extension Denial",
  NotesRequired: boolean = false,
  IsLOA: boolean = true
) {
  const NoticeType = IsLOA ? "Leave of Absence" : "Reduced Activity";
  return new ModalBuilder()
    .setTitle(`${NoticeType} ${ReviewOutcome}`)
    .setCustomId(`uan-rev-notes:${Interaction.user.id}:${RandomString(6)}`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Reviewer Notes")
        .setDescription(
          ReviewOutcome.endsWith("Approval")
            ? "Optional notes or comments regarding the approval."
            : "Notes or comments explaining the denial."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Short)
            .setRequired(NotesRequired)
            .setMinLength(4)
            .setMaxLength(128)
            .setCustomId("notes")
        )
    );
}
