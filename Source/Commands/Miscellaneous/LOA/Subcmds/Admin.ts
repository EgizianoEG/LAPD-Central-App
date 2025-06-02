/* eslint-disable sonarjs/no-duplicate-string */
import {
  SlashCommandSubcommandBuilder,
  APIButtonComponentWithCustomId,
  ModalSubmitInteraction,
  time as FormatTime,
  ButtonInteraction,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  ButtonBuilder,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  userMention,
  ButtonStyle,
  Message,
  User,
} from "discord.js";

import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { addMilliseconds } from "date-fns";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";
import { HandleDurationValidation } from "./Request.js";
import { ValidateExtendedDuration } from "./Manage.js";
import { LeaveOfAbsenceEventLogger } from "@Utilities/Classes/UANEventLogger.js";

import HandleUserActivityNoticeRoleAssignment from "@Utilities/Other/HandleUANRoleAssignment.js";
import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import UserActivityNoticeModel from "@Models/UserActivityNotice.js";
import ParseDuration from "parse-duration";
import GetLOAsData from "@Utilities/Database/GetUANData.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Dedent from "dedent";

const PreviousLOAsLimit = 5;
const LOAEventLogger = new LeaveOfAbsenceEventLogger();
const FileLabel = "Commands:Miscellaneous:LOA:Subcmds:Admin";
type CmdOrButtonInteraction = SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">;
enum AdminActions {
  LeaveStart = "loa-admin-start",
  LeaveEnd = "loa-admin-end",
  LeaveDeny = "loa-admin-deny",
  LeaveExtend = "loa-admin-extend",
  LeaveApprove = "loa-admin-approve",
  ExtensionDeny = "loa-ext-admin-deny",
  ExtensionApprove = "loa-ext-admin-approve",
}

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * A wrapper function that returns a single promise that resolves to `true` if all promises in the array resolve to `true`.
 * This is used to know if a modification was successful or not to the initial administration prompt and if so, to dispose the previous component collector and stop it.
 * @param Values
 * @returns
 */
async function PromiseAllThenTrue<T>(Values: T[]): Promise<boolean> {
  await Promise.allSettled(Values);
  return true;
}

/**
 * Retrieves the target member from the interaction.
 * - If the interaction is a button, it retrieves the Id from the button custom Id.
 * - If the interaction is a command, it retrieves the user from the "member" option.
 * @param Interaction - The interaction to retrieve the target member/user from.
 * @returns The target user or `null` if not found.
 */
async function GetTargetUser(Interaction: CmdOrButtonInteraction): Promise<User | null> {
  if (Interaction.isButton()) {
    const TargetMemberId = Interaction.customId.split(":")[3];
    if (!TargetMemberId) return null;
    return Interaction.client.users.fetch(TargetMemberId).catch(() => null);
  } else if (Interaction.isCommand()) {
    // The target user is an available option in the command.
    return Interaction.options.getUser("member", true);
  } else {
    return null;
  }
}

/**
 * Generates the leave of absence administration panel embed.
 * @param Interaction - The interaction that triggered the panel.
 * @param TargetMember - The user who's leave of absence data should be displayed.
 * @param LOAData - The leave of absence data of the `TargetMember`.
 * @returns An embed that displays the leave of absence data of the `TargetMember`.
 */
function GetPanelEmbed(
  Interaction: CmdOrButtonInteraction,
  TargetMember: User,
  LOAData: Awaited<ReturnType<typeof GetLOAsData>>
): EmbedBuilder {
  const ActiveOrPendingLOA = LOAData.active_notice ?? LOAData.pending_notice;
  const PanelEmbed = new EmbedBuilder()
    .setTitle("Leave of Absence Administration")
    .setColor(Colors.DarkBlue)
    .setAuthor({
      name: `@${TargetMember.username}`,
      iconURL: TargetMember.displayAvatarURL({ size: 128 }),
    });

  const PreviousLOAsFormatted = LOAData.completed_notices.map((LOA) => {
    return `${FormatTime(LOA.review_date!, "D")} — ${FormatTime(LOA.early_end_date ?? LOA.end_date, "D")}`;
  });

  if (
    ActiveOrPendingLOA?.reviewed_by &&
    ActiveOrPendingLOA.review_date &&
    ActiveOrPendingLOA.extension_request?.status !== "Pending"
  ) {
    PanelEmbed.setColor(Colors.LOARequestApproved);
    PanelEmbed.addFields({
      inline: true,
      name:
        "Active Leave" +
        (ActiveOrPendingLOA.extension_request?.status === "Approved" ? " *(Extended)*" : ""),
      value: Dedent(`
        **Started:** ${FormatTime(ActiveOrPendingLOA.review_date, "D")}
        **Ends On:** ${FormatTime(ActiveOrPendingLOA.end_date, "D")}
        **Duration:** ${ActiveOrPendingLOA.duration_hr}
        **Approved By:** ${userMention(ActiveOrPendingLOA.reviewed_by.id)}
        **Reason:** ${ActiveOrPendingLOA.reason}
      `),
    });
  } else if (ActiveOrPendingLOA?.status === "Pending") {
    PanelEmbed.setColor(Colors.LOARequestPending);
    PanelEmbed.addFields({
      inline: true,
      name: "Pending Leave",
      value: Dedent(`
        **Requested:** ${FormatTime(ActiveOrPendingLOA.request_date, "R")}
        **Starts On:** *once approved.*
        **Ends On:** around ${FormatTime(addMilliseconds(Interaction.createdAt, ActiveOrPendingLOA.duration), "d")}
        **Duration:** ${ActiveOrPendingLOA.duration_hr}
        **Reason:** ${ActiveOrPendingLOA.reason}
      `),
    });
  } else if (
    ActiveOrPendingLOA?.review_date &&
    ActiveOrPendingLOA?.extension_request?.status === "Pending"
  ) {
    PanelEmbed.setColor(Colors.LOARequestPending);
    PanelEmbed.addFields({
      inline: true,
      name: "Pending Extension",
      value: Dedent(`
        **Requested On:** ${FormatTime(ActiveOrPendingLOA.extension_request.date, "R")}
        **LOA Started:** ${FormatTime(ActiveOrPendingLOA.review_date, "D")}
        **LOA Ends:** after extension, ${FormatTime(addMilliseconds(ActiveOrPendingLOA.end_date, ActiveOrPendingLOA.extension_request.duration), "d")}
        **Duration:** ${ActiveOrPendingLOA.extended_duration_hr}
        **Reason:** ${ActiveOrPendingLOA.extension_request.reason ?? "`N/A`"}
      `),
    });
  } else {
    PanelEmbed.setDescription(
      `${userMention(TargetMember.id)} does not currently have an active or pending leave of absence.`
    );
  }

  if (PreviousLOAsFormatted.length > 0 && PreviousLOAsFormatted.length <= PreviousLOAsLimit) {
    PanelEmbed.addFields({
      inline: true,
      name: "Previously Taken LOAs",
      value: PreviousLOAsFormatted.join("\n"),
    });
  } else if (PreviousLOAsFormatted.length > PreviousLOAsLimit) {
    PanelEmbed.addFields({
      inline: true,
      name: "Previously Taken LOAs",
      value: `${PreviousLOAsFormatted.slice(0, PreviousLOAsLimit).join("\n")}\n-# *...and ${PreviousLOAsFormatted.length - PreviousLOAsLimit} more*`,
    });
  } else if (!(PanelEmbed.data.fields?.length && ActiveOrPendingLOA)) {
    PanelEmbed.addFields({
      inline: true,
      name: "Previously Taken LOAs",
      value: "-# There are no previously approved LOAs to display.",
    });
  }

  return PanelEmbed;
}

/**
 * Creates the components for the leave of absence adminstration panel.
 * @param Interaction - The interaction that triggered the panel. Used to add the id of
 * who initiated the panel to the buttons for validation.
 * @param ActiveOrPendingLeave - The active or pending leave document from the database.
 * @returns An array of action row components to be added to the panel.
 */
function GetPanelComponents(
  Interaction: CmdOrButtonInteraction,
  TargetUserId: string,
  ActiveOrPendingLeave: Awaited<ReturnType<typeof GetLOAsData>>["active_notice"]
): ActionRowBuilder<ButtonBuilder>[] {
  const ActionRow = new ActionRowBuilder<ButtonBuilder>();
  if (ActiveOrPendingLeave?.status === "Pending") {
    // If the leave is pending, add the approve and deny buttons.
    ActionRow.addComponents(
      new ButtonBuilder()
        .setEmoji(Emojis.WhiteCheck)
        .setStyle(ButtonStyle.Success)
        .setCustomId(AdminActions.LeaveApprove)
        .setLabel("Approve Request"),
      new ButtonBuilder()
        .setEmoji(Emojis.WhiteCross)
        .setStyle(ButtonStyle.Danger)
        .setCustomId(AdminActions.LeaveDeny)
        .setLabel("Deny Request")
    );
  } else if (
    ActiveOrPendingLeave?.is_active &&
    ActiveOrPendingLeave.extension_request?.status === "Pending"
  ) {
    // If the leave is active and has a pending extension, add the approve and deny extension buttons.
    ActionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(AdminActions.ExtensionApprove)
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emojis.WhiteCheck)
        .setLabel("Approve Extension"),
      new ButtonBuilder()
        .setCustomId(AdminActions.ExtensionDeny)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emojis.WhiteCross)
        .setLabel("Deny Extension"),
      new ButtonBuilder()
        .setCustomId(AdminActions.LeaveEnd)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emojis.MediaStop)
        .setLabel("End Leave")
    );
  } else {
    // If the leave is not pending or active, add the start and end leave buttons.
    ActionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(AdminActions.LeaveExtend)
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emojis.WhitePlus)
        .setDisabled(Boolean(ActiveOrPendingLeave?.extension_request))
        .setLabel("Extend Leave"),
      new ButtonBuilder()
        .setCustomId(AdminActions.LeaveEnd)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emojis.MediaStop)
        .setLabel("End Leave")
    );
  }

  // Disable the buttons if there is no leave active.
  if (!ActiveOrPendingLeave || ActiveOrPendingLeave.is_over()) {
    ActionRow.setComponents(
      new ButtonBuilder()
        .setEmoji(Emojis.WhitePlus)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(AdminActions.LeaveStart)
        .setLabel("Start Leave of Absence")
    );
  }

  // Add the user id and leave id to the custom_id of each button.
  ActionRow.components.forEach((Button) =>
    Button.setCustomId(
      `${(Button.data as APIButtonComponentWithCustomId).custom_id}:${Interaction.user.id}:${ActiveOrPendingLeave?._id ?? "0"}:${TargetUserId}`
    )
  );

  return [ActionRow];
}

/**
 * Creates a modal for the user to input notes for a leave of absence request/review.
 * @param Interaction - The interaction object received when the slash command was invoked or the button was clicked.
 * @param Status - The type of action being performed.
 * @param [NotesRequired=false] - Whether the user is required to input notes.
 * @returns A modal builder with a single text input field for notes.
 */
function GetNotesModal(
  Interaction: CmdOrButtonInteraction,
  Status: "Approval" | "Denial" | "Extension Approval" | "Extension Denial",
  NotesRequired: boolean = false
): ModalBuilder {
  const Modal = new ModalBuilder()
    .setTitle(`Leave of Absence ${Status}`)
    .setCustomId(`loa-rev-notes:${Interaction.user.id}:${RandomString(6)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(NotesRequired)
          .setMinLength(4)
          .setMaxLength(128)
          .setLabel("Notes")
          .setCustomId("notes")
      )
    );

  // Set the placeholder text based on the action being performed.
  if (Status.endsWith("Approval")) {
    Modal.components[0].components[0].setPlaceholder("Any notes or comments to add (optional).");
  } else {
    Modal.components[0].components[0].setPlaceholder(
      "Any notes or comments to explain the disapproval."
    );
  }

  return Modal;
}

async function HandleAdministrativeInteraction(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  Interaction: CmdOrButtonInteraction
) {
  if (ButtonInteract.customId.startsWith(AdminActions.LeaveStart)) {
    return HandleLeaveStart(ButtonInteract, TargetMemberId, Interaction);
  } else if (ButtonInteract.customId.startsWith(AdminActions.LeaveEnd)) {
    return HandleLeaveEnd(ButtonInteract, TargetMemberId, Interaction);
  } else if (ButtonInteract.customId.startsWith(AdminActions.LeaveExtend)) {
    return HandleLeaveExtend(ButtonInteract, TargetMemberId, Interaction);
  } else if (ButtonInteract.customId.startsWith(AdminActions.LeaveApprove)) {
    return HandleLeaveApprovalOrDenial(ButtonInteract, TargetMemberId, Interaction, "Approval");
  } else if (ButtonInteract.customId.startsWith(AdminActions.LeaveDeny)) {
    return HandleLeaveApprovalOrDenial(ButtonInteract, TargetMemberId, Interaction, "Denial");
  } else if (ButtonInteract.customId.startsWith(AdminActions.ExtensionApprove)) {
    return HandleExtensionApprovalOrDenial(
      ButtonInteract,
      TargetMemberId,
      Interaction,
      "Extension Approval"
    );
  } else if (ButtonInteract.customId.startsWith(AdminActions.ExtensionDeny)) {
    return HandleExtensionApprovalOrDenial(
      ButtonInteract,
      TargetMemberId,
      Interaction,
      "Extension Denial"
    );
  } else {
    return ButtonInteract.deferUpdate();
  }
}

async function GetActiveOrPendingLOA(
  TargetUser: string,
  TargetGuild: string,
  ComparisonDate: Date = new Date()
) {
  return UserActivityNoticeModel.findOne(
    {
      user: TargetUser,
      guild: TargetGuild,
      type: "LeaveOfAbsence",
      $or: [
        { status: "Pending", review_date: null },
        {
          status: "Approved",
          early_end_date: null,
          end_date: { $gt: ComparisonDate },
        },
      ],
    },
    { status: 1 }
  ).exec();
}

export async function HandleLeaveReviewValidation(
  Interaction: CmdOrButtonInteraction | ModalSubmitInteraction<"cached">,
  RequestDocument?: UserActivityNotice.ActivityNoticeHydratedDocument | null
): Promise<boolean> {
  const RequestHasToBeReviewed =
    (RequestDocument?.status === "Pending" && RequestDocument?.review_date === null) ||
    (RequestDocument?.is_active && RequestDocument?.extension_request?.status === "Pending");

  if (!RequestHasToBeReviewed) {
    const ReplyEmbed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle("Request Modified")
      .setDescription(
        "The request you are taking action on either does not exist or has already been reviewed."
      );

    return Interaction.editReply({ embeds: [ReplyEmbed] })
      .catch(() => Interaction.reply({ embeds: [ReplyEmbed], flags: MessageFlags.Ephemeral }))
      .then(() => true);
  }

  return false;
}

async function HandleLeaveStart(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  InitialCmdInteract: CmdOrButtonInteraction
) {
  let ActiveOrPendingLOA = await GetActiveOrPendingLOA(
    TargetMemberId,
    ButtonInteract.guildId,
    ButtonInteract.createdAt
  );

  if (ActiveOrPendingLOA) {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed()
        .useErrTemplate("LOAAlreadyExistsManagement")
        .replyToInteract(ButtonInteract, true),
    ]);
  }

  const MemberInGuild = await ButtonInteract.guild.members.fetch(TargetMemberId).catch(() => null);

  if (!MemberInGuild) {
    return new ErrorEmbed()
      .useErrTemplate("ActionRequiresMemberPresence")
      .replyToInteract(ButtonInteract, true);
  }

  const LeaveOptsModal = new ModalBuilder()
    .setTitle("Administrative Leave of Absence")
    .setCustomId(`loa-admin-start:${ButtonInteract.user.id}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(32)
          .setCustomId("duration")
          .setLabel("Leave Duration")
          .setPlaceholder("e.g., 1 week and 2 days...")
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(232)
          .setCustomId("notes")
          .setLabel("Leave Notes")
          .setPlaceholder("e.g., requested on behalf of...")
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMinLength(2)
          .setMaxLength(3)
          .setCustomId("manageable")
          .setValue("Yes")
          .setLabel("Leave Manageable By Target")
          .setPlaceholder("Please type either 'Yes' or 'No'")
      )
    );

  const ModalSubmission = await ShowModalAndAwaitSubmission(
    ButtonInteract,
    LeaveOptsModal,
    8 * 60_000
  );

  if (!ModalSubmission) return;
  await ModalSubmission.deferReply({ flags: MessageFlags.Ephemeral });

  const LeaveReason = ModalSubmission.fields.getTextInputValue("notes");
  const LeaveDuration = ModalSubmission.fields.getTextInputValue("duration");
  const DurationParsed = Math.round(ParseDuration(LeaveDuration, "millisecond") ?? 0);
  const IsManageableInput = ModalSubmission.fields.getTextInputValue("manageable");
  if (await HandleDurationValidation(ModalSubmission, "LeaveOfAbsence", DurationParsed)) return;

  ActiveOrPendingLOA = await GetActiveOrPendingLOA(
    TargetMemberId,
    ButtonInteract.guildId,
    ButtonInteract.createdAt
  );

  if (ActiveOrPendingLOA) {
    return new ErrorEmbed()
      .useErrTemplate("LOAAlreadyExistsManagement")
      .replyToInteract(ModalSubmission, true, true);
  }

  const CreatedLeave = await UserActivityNoticeModel.create({
    guild: ModalSubmission.guildId,
    user: TargetMemberId,
    type: "LeaveOfAbsence",
    status: "Approved",
    reason: "[Administrative]",
    duration: DurationParsed,
    is_manageable: IsManageableInput ? IsManageableInput.toLowerCase() === "yes" : false,
    request_date: ModalSubmission.createdAt,
    review_date: ModalSubmission.createdAt,
    reviewer_notes: LeaveReason,
    reviewed_by: {
      id: ModalSubmission.user.id,
      username: ModalSubmission.user.username,
    },
  });

  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Leave of Absence Started")
    .setDescription(
      `Successfully started a new leave of absence for ${userMention(TargetMemberId)}. It is scheduled to end on ${FormatTime(CreatedLeave.end_date, "D")}.`
    );

  return PromiseAllThenTrue([
    Callback(InitialCmdInteract),
    ModalSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger.LogManualLeave(ModalSubmission, CreatedLeave),
    HandleUserActivityNoticeRoleAssignment(
      CreatedLeave.user,
      ModalSubmission.guild,
      "LeaveOfAbsence",
      true
    ),
  ]);
}

async function HandleLeaveExtend(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  InitialCmdInteract: CmdOrButtonInteraction
) {
  let ActiveLeave = await UserActivityNoticeModel.findOne({
    guild: ButtonInteract.guildId,
    user: TargetMemberId,
    status: "Approved",
    type: "LeaveOfAbsence",
    early_end_date: null,
    extension_request: null,
    end_date: { $gt: ButtonInteract.createdAt },
  });

  const HandleNonActiveLeave = async () => {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed()
        .useErrTemplate("NoActiveLOAOrExistingExtension")
        .replyToInteract(ButtonInteract, true),
    ]);
  };

  if (!ActiveLeave) return HandleNonActiveLeave();
  const MemberInGuild = await ButtonInteract.guild.members.fetch(TargetMemberId).catch(() => null);
  if (!MemberInGuild) {
    return new ErrorEmbed()
      .useErrTemplate("ActionRequiresMemberPresence")
      .replyToInteract(ButtonInteract, true);
  }

  const ExtensionOptsModal = new ModalBuilder()
    .setTitle("Leave of Absence Extension")
    .setCustomId(`loa-admin-ext:${ButtonInteract.user.id}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(32)
          .setCustomId("ext-duration")
          .setLabel("Extension Duration")
          .setPlaceholder("e.g., 3 days...")
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(232)
          .setCustomId("ext-notes")
          .setLabel("Extension Notes")
          .setPlaceholder("e.g., extended on behalf of...")
      )
    );

  const Submission = await ShowModalAndAwaitSubmission(
    ButtonInteract,
    ExtensionOptsModal,
    8 * 60_000
  );

  if (!Submission) return;
  const Duration = Submission.fields.getTextInputValue("ext-duration");
  const NotesInput = Submission.fields.getTextInputValue("ext-notes") || null;
  const ParsedDuration = Math.round(ParseDuration(Duration, "millisecond") ?? 0);
  const SubmissionHandled = ValidateExtendedDuration(Submission, ActiveLeave, ParsedDuration);
  if (SubmissionHandled) return;
  else await Submission.deferReply({ flags: MessageFlags.Ephemeral });

  ActiveLeave = await ActiveLeave.getUpToDate();
  if (!ActiveLeave?.is_active) return HandleNonActiveLeave();
  if (ActiveLeave.extension_request) {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed()
        .useErrTemplate("LOAAdminExistingExtension")
        .replyToInteract(ButtonInteract, true),
    ]);
  }

  ActiveLeave.extension_request = {
    status: "Approved",
    reason: "[Administrative]",
    date: Submission.createdAt,
    review_date: Submission.createdAt,
    duration: ParsedDuration,
    reviewer_notes: NotesInput,
    reviewed_by: {
      id: Submission.user.id,
      username: Submission.user.username,
    },
  };

  await ActiveLeave.save();
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Leave Extended")
    .setDescription(
      `Successfully extended the active leave of absence for ${userMention(TargetMemberId)}. This leave is now set to expire on ${FormatTime(ActiveLeave.end_date, "D")}.`
    );

  return PromiseAllThenTrue([
    Callback(InitialCmdInteract),
    Submission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger.LogManualExtension(Submission, ActiveLeave),
  ]);
}

async function HandleLeaveEnd(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  InitialCmdInteract: CmdOrButtonInteraction
) {
  let ActiveLeave = await UserActivityNoticeModel.findOne({
    guild: ButtonInteract.guildId,
    user: TargetMemberId,
    status: "Approved",
    type: "LeaveOfAbsence",
    early_end_date: null,
    end_date: { $gt: ButtonInteract.createdAt },
  });

  if (!ActiveLeave) {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed().useErrTemplate("LOANotActive").replyToInteract(ButtonInteract, true),
    ]);
  }

  const ReasonModal = new ModalBuilder()
    .setTitle("Leave of Absence Early Termination")
    .setCustomId(`loa-admin-end-reason:${ButtonInteract.user.id}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setLabel("Early Termination Reason")
          .setPlaceholder("The reason for early termination of this leave.")
          .setCustomId("reason")
          .setRequired(false)
          .setMinLength(4)
          .setMaxLength(128)
      )
    );

  const ModalSubmission = await ShowModalAndAwaitSubmission(
    ButtonInteract,
    ReasonModal,
    8 * 60_000
  );

  if (!ModalSubmission) return;
  ActiveLeave = await ActiveLeave.getUpToDate();
  if (!ActiveLeave?.is_active) {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed().useErrTemplate("LOANotActive").replyToInteract(ModalSubmission, true),
    ]);
  }

  await ModalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  ActiveLeave.end_processed = true;
  ActiveLeave.early_end_date = ModalSubmission.createdAt;
  ActiveLeave.early_end_reason = ModalSubmission.fields.getTextInputValue("reason") || null;
  await ActiveLeave.save();

  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Leave of Absence Terminated")
    .setDescription(
      `The active leave of absence for ${userMention(TargetMemberId)} has been successfully terminated.`
    );

  return PromiseAllThenTrue([
    Callback(ButtonInteract),
    ModalSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger.LogEarlyUANEnd(ModalSubmission, ActiveLeave, "Management"),
    HandleUserActivityNoticeRoleAssignment(
      ActiveLeave.user,
      ModalSubmission.guild,
      "LeaveOfAbsence",
      false
    ),
  ]);
}

async function HandleLeaveApprovalOrDenial(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  InitialCmdInteract: CmdOrButtonInteraction,
  ActionType: "Approval" | "Denial"
) {
  const NotesModal = GetNotesModal(ButtonInteract, ActionType, false);
  const NotesSubmission = await ShowModalAndAwaitSubmission(ButtonInteract, NotesModal, 8 * 60_000);

  if (!NotesSubmission) return;
  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const PendingLeave = await UserActivityNoticeModel.findOne({
    guild: ButtonInteract.guildId,
    user: TargetMemberId,
    status: "Pending",
    type: "LeaveOfAbsence",
  });

  if ((await HandleLeaveReviewValidation(NotesSubmission, PendingLeave)) || !PendingLeave) {
    return Callback(InitialCmdInteract);
  }

  const ActionInPastForm = ActionType === "Approval" ? "Approved" : "Denied";
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle(`Leave of Absence ${ActionInPastForm}`)
    .setDescription(
      `Successfully ${ActionInPastForm.toLowerCase()} ${userMention(TargetMemberId)}'s pending leave request.`
    );

  PendingLeave.status = ActionInPastForm;
  PendingLeave.review_date = NotesSubmission.createdAt;
  PendingLeave.reviewer_notes = NotesSubmission.fields.getTextInputValue("notes") || null;
  PendingLeave.reviewed_by = {
    id: NotesSubmission.user.id,
    username: NotesSubmission.user.username,
  };

  await PendingLeave.save();
  return PromiseAllThenTrue([
    Callback(InitialCmdInteract),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger[`Log${ActionType}`](NotesSubmission, PendingLeave),
  ]);
}

async function HandleExtensionApprovalOrDenial(
  ButtonInteract: ButtonInteraction<"cached">,
  TargetMemberId: string,
  InitialCmdInteract: CmdOrButtonInteraction,
  ActionType: "Extension Approval" | "Extension Denial"
) {
  const NotesModal = GetNotesModal(ButtonInteract, ActionType, false);
  const NotesSubmission = await ShowModalAndAwaitSubmission(ButtonInteract, NotesModal, 8 * 60_000);

  if (!NotesSubmission) return;
  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ActiveLeave = await UserActivityNoticeModel.findOne({
    guild: ButtonInteract.guildId,
    user: TargetMemberId,
    status: "Approved",
    type: "LeaveOfAbsence",
    early_end_date: null,
    end_date: { $gt: NotesSubmission.createdAt },
    "extension_request.status": "Pending",
  });

  if (!ActiveLeave) {
    return PromiseAllThenTrue([
      Callback(InitialCmdInteract),
      new ErrorEmbed()
        .useErrTemplate("LOAExtensionNotFoundForReview")
        .replyToInteract(NotesSubmission, true),
    ]);
  }

  const ActionInPastForm =
    ActionType === "Extension Approval" ? "Extension Approved" : "Extension Denied";
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle(`Leave of Absence ${ActionInPastForm}`)
    .setDescription(
      `Successfully ${ActionType === "Extension Approval" ? "approved" : "denied"} ${userMention(TargetMemberId)}'s pending extension request.`
    );

  ActiveLeave.extension_request!.status =
    ActionType === "Extension Approval" ? "Approved" : "Denied";
  ActiveLeave.extension_request!.review_date = NotesSubmission.createdAt;
  ActiveLeave.extension_request!.reviewer_notes =
    NotesSubmission.fields.getTextInputValue("notes") || null;
  ActiveLeave.extension_request!.reviewed_by = {
    id: NotesSubmission.user.id,
    username: NotesSubmission.user.username,
  };

  await ActiveLeave.save();
  return PromiseAllThenTrue([
    Callback(InitialCmdInteract),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    LOAEventLogger[`Log${ActionType.replace(" ", "")}`](NotesSubmission, ActiveLeave),
  ]);
}

// ---------------------------------------------------------------------------------------
// Initial Logic:
// --------------
async function Callback(Interaction: CmdOrButtonInteraction) {
  const TargetMember = await GetTargetUser(Interaction);
  if (!TargetMember) return Interaction.isButton() && Interaction.deferUpdate().catch(() => null);
  if (TargetMember.bot) {
    return new ErrorEmbed()
      .useErrTemplate("BotMemberSelected")
      .replyToInteract(Interaction, true, true);
  }

  const LOAData = await GetLOAsData({
    guild_id: Interaction.guildId,
    user_id: TargetMember.id,
    now: Date.now(),
    type: "LeaveOfAbsence",
  });

  let PromptMessage: Message<true>;
  const ActiveOrPendingLOA = LOAData.active_notice ?? LOAData.pending_notice;
  const PanelEmbed = GetPanelEmbed(Interaction, TargetMember, LOAData);
  const PanelComps = GetPanelComponents(Interaction, TargetMember.id, ActiveOrPendingLOA);
  const ReplyOpts = {
    embeds: [PanelEmbed],
    components: PanelComps,
  };

  if (Interaction.replied || Interaction.deferred) {
    PromptMessage = await Interaction.editReply(ReplyOpts);
  } else {
    PromptMessage = await Interaction.reply({ ...ReplyOpts, withResponse: true }).then(
      (Resp) => Resp.resource!.message! as Message<true>
    );
  }

  const CompActionCollector = PromptMessage.createMessageComponentCollector({
    filter: (i) => i.user.id === Interaction.user.id,
    componentType: ComponentType.Button,
    time: 14.5 * 60_000,
  });

  CompActionCollector.on("collect", async (ButtonInteract) => {
    try {
      const ActionHandler = HandleAdministrativeInteraction(
        ButtonInteract,
        TargetMember.id,
        Interaction
      );

      if ((await ActionHandler) === true) {
        CompActionCollector.stop("CmdReinstated");
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        message: "An error occurred while handling LOA admin button interaction;",
        label: FileLabel,
        error_id: ErrorId,
        stack: Err.stack,
      });

      return new ErrorEmbed()
        .setTitle("Error")
        .setDescription("Something went wrong while handling your request.")
        .setErrorId(ErrorId)
        .replyToInteract(ButtonInteract, true, true, "followUp");
    }
  });

  CompActionCollector.on("end", async (Collected, EndReason) => {
    if (/\w{1,10}Delete/.test(EndReason) || EndReason === "CmdReinstated") return;
    PanelComps[0].components.forEach((Btn) => Btn.setDisabled(true));
    const LastInteract = Collected.last() || Interaction;
    await LastInteract.editReply({ components: PanelComps, message: PromptMessage.id }).catch(
      () => null
    );
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("admin")
    .setDescription("Manage and administer someone else's active leave of absence.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to administer their active leave.")
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
