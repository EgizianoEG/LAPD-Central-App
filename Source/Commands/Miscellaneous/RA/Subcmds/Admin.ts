/* eslint-disable sonarjs/no-duplicate-string */
import {
  SlashCommandSubcommandBuilder,
  time as FormatTime,
  ButtonInteraction,
  ActionRowBuilder,
  TextInputBuilder,
  BaseInteraction,
  TextInputStyle,
  ButtonBuilder,
  ComponentType,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  ButtonStyle,
  userMention,
  User,
} from "discord.js";

import { HandleLeaveReviewValidation } from "@Cmds/Miscellaneous/LOA/Subcmds/Admin.js";
import { ReducedActivityEventLogger } from "@Utilities/Classes/UANEventLogger.js";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { addMilliseconds } from "date-fns";
import { Colors, Emojis } from "@Config/Shared.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import HandleUserActivityNoticeRoleAssignment from "@Utilities/Other/HandleUANRoleAssignment.js";
import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import GetUANData from "@Utilities/Database/GetUANData.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Dedent from "dedent";

const PreviousRALimit = 5;
const RAEventLogger = new ReducedActivityEventLogger();
type RADocument = UserActivityNotice.ActivityNoticeHydratedDocument;
enum AdminActions {
  RAEnd = "ra-admin-end",
  RADeny = "ra-admin-deny",
  RAApprove = "ra-admin-approve",
}

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
function GetAdminComponents(
  RecInteract: BaseInteraction<"cached">,
  ActiveOrPendingRA?: RADocument | null
) {
  const ActionRow = new ActionRowBuilder<ButtonBuilder>();
  if (ActiveOrPendingRA?.status === "Pending") {
    ActionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(AdminActions.RAApprove)
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emojis.WhiteCheck)
        .setLabel("Approve Request"),
      new ButtonBuilder()
        .setCustomId(AdminActions.RADeny)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emojis.WhiteCross)
        .setLabel("Deny Request")
    );
  } else if (ActiveOrPendingRA?.status === "Approved") {
    ActionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(AdminActions.RAEnd)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emojis.MediaStop)
        .setLabel("End Reduced Activity")
    );
  }

  ActionRow.components.forEach((Btn) => {
    Btn.setCustomId(
      `${Btn.data["custom_id"]}:${RecInteract.user.id}:${ActiveOrPendingRA?._id || 0}`
    );
  });

  return ActiveOrPendingRA ? [ActionRow] : [];
}

function GetAdminPromptEmbed(
  Interaction: SlashCommandInteraction<"cached">,
  TargetMember: User,
  NoticesData: Awaited<ReturnType<typeof GetUANData>>
) {
  const ActiveOrPendingRA = NoticesData.active_notice || NoticesData.pending_notice;
  const PreviousRAsFormatted = NoticesData.completed_notices.map((RA) => {
    return `${FormatTime(RA.review_date!, "D")} — ${FormatTime(RA.early_end_date ?? RA.end_date, "D")}`;
  });

  const PromptEmbed = new EmbedBuilder()
    .setTitle("Reduced Activity Administration")
    .setColor(Colors.Info);

  if (ActiveOrPendingRA?.status === "Approved") {
    PromptEmbed.setColor(Colors.LOARequestApproved).addFields({
      inline: true,
      name: "Active Notice",
      value: Dedent(`
        **Started:** ${FormatTime(ActiveOrPendingRA.review_date!, "D")}
        **Ends On:** ${FormatTime(ActiveOrPendingRA.end_date, "D")}
        **Quota Reduction:** ~${ActiveOrPendingRA.quota_reduction}
        **Reason:** ${ActiveOrPendingRA.reason}
      `),
    });
  } else if (ActiveOrPendingRA?.status === "Pending") {
    PromptEmbed.setColor(Colors.LOARequestPending).addFields({
      inline: true,
      name: "Pending Notice",
      value: Dedent(`
        **Requested:** ${FormatTime(ActiveOrPendingRA.request_date, "R")}
        **Starts On:** *once approved.*
        **Ends On:** around ${FormatTime(addMilliseconds(Interaction.createdAt, ActiveOrPendingRA.duration), "D")}
        **Quota Reduction:** ~${ActiveOrPendingRA.quota_reduction}
        **Reason:** ${ActiveOrPendingRA.reason}
      `),
    });
  } else {
    PromptEmbed.setDescription(
      `${userMention(TargetMember.id)} does not currently have an active or pending reduced activity notice to act upon.`
    );
  }

  if (PreviousRAsFormatted.length > 0 && PreviousRAsFormatted.length <= PreviousRALimit) {
    PromptEmbed.addFields({
      inline: true,
      name: "Previously Approved RAs",
      value: PreviousRAsFormatted.join("\n"),
    });
  } else if (PreviousRAsFormatted.length > PreviousRALimit) {
    PromptEmbed.addFields({
      inline: true,
      name: "Previously Approved RAs",
      value: `${PreviousRAsFormatted.slice(0, PreviousRALimit).join("\n")}\n-# *...and ${
        PreviousRAsFormatted.length - PreviousRALimit
      } more*`,
    });
  } else if (!PromptEmbed.data.fields?.length) {
    PromptEmbed.addFields({
      inline: true,
      name: "Previously Approved RAs",
      value: "-# There are no previously approved reduced activity notices to display.",
    });
  }

  return PromptEmbed;
}

function GetNotesModal(
  Interaction: ButtonInteraction<"cached">,
  ActionType: "Approval" | "Denial" | "Termination"
) {
  return new ModalBuilder()
    .setTitle(`Reduced Activity ${ActionType}`)
    .setCustomId(`ra-rev-notes:${Interaction.user.id}:${RandomString(6)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Paragraph)
          .setLabel("Reviewer Notes")
          .setCustomId("notes")
          .setPlaceholder("Add any comments or notes regarding this action (optional).")
          .setRequired(false)
          .setMaxLength(300)
      )
    );
}

async function HandleApprovalOrDenial(
  Interaction: ButtonInteraction<"cached">,
  ActiveOrPendingRA: RADocument,
  ActionType: "Approval" | "Denial"
): Promise<boolean> {
  const NotesModal = GetNotesModal(Interaction, ActionType);
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);

  if (!NotesSubmission) return false;
  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });

  const RefreshedRA = await ActiveOrPendingRA.getUpToDate();
  if (!RefreshedRA || (await HandleLeaveReviewValidation(NotesSubmission, RefreshedRA))) {
    return true;
  }

  const ReviewerNotes = NotesSubmission.fields.getTextInputValue("notes") || null;
  const ActionInPastForm = ActionType === "Approval" ? "Approved" : "Denied";
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle(`Reduced Activity ${ActionInPastForm}`)
    .setDescription(
      `Successfully ${ActionInPastForm.toLowerCase()} the pending reduced activity request for ${userMention(
        RefreshedRA.user
      )}.`
    );

  RefreshedRA.status = ActionInPastForm;
  RefreshedRA.review_date = NotesSubmission.createdAt;
  RefreshedRA.reviewer_notes = ReviewerNotes;
  RefreshedRA.reviewed_by = {
    id: NotesSubmission.user.id,
    username: NotesSubmission.user.username,
  };

  await Promise.all([
    RefreshedRA.save(),
    RAEventLogger[`Log${ActionType}`](NotesSubmission, RefreshedRA),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    HandleUserActivityNoticeRoleAssignment(
      RefreshedRA.user,
      NotesSubmission.guild,
      "ReducedActivity",
      ActionType === "Approval"
    ),
  ]);

  return true;
}

async function HandleEarlyTermination(
  Interaction: ButtonInteraction<"cached">,
  ActiveRA: RADocument
) {
  const NotesModal = GetNotesModal(Interaction, "Termination");
  const NotesSubmission = await ShowModalAndAwaitSubmission(Interaction, NotesModal, 8 * 60_000);
  if (!NotesSubmission) return false;

  const RefreshedActiveRA = await ActiveRA.getUpToDate();
  if (!RefreshedActiveRA || !RefreshedActiveRA.is_active) {
    return NotesSubmission.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [new ErrorEmbed().useErrTemplate("RANotActive")],
    })
      .then(() => true)
      .catch(() => true);
  }

  await NotesSubmission.deferReply({ flags: MessageFlags.Ephemeral });
  const ReplyEmbed = new EmbedBuilder()
    .setColor(Colors.Success)
    .setTitle("Reduced Activity Terminated")
    .setDescription(
      `The active reduced activity for ${userMention(
        ActiveRA.user
      )} has been successfully terminated.`
    );

  const ReviewerNotes = NotesSubmission.fields.getTextInputValue("notes") || null;
  RefreshedActiveRA.end_processed = true;
  RefreshedActiveRA.early_end_date = NotesSubmission.createdAt;
  RefreshedActiveRA.early_end_reason = ReviewerNotes;
  await RefreshedActiveRA.save();

  await Promise.all([
    RAEventLogger.LogEarlyUANEnd(NotesSubmission, RefreshedActiveRA, "Management"),
    NotesSubmission.editReply({ embeds: [ReplyEmbed] }),
    HandleUserActivityNoticeRoleAssignment(
      RefreshedActiveRA.user,
      NotesSubmission.guild,
      "ReducedActivity",
      false
    ),
  ]);

  return true;
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const TargetUser = Interaction.options.getUser("member", true);
  if (TargetUser.bot) {
    return new ErrorEmbed()
      .useErrTemplate("BotMemberSelected")
      .replyToInteract(Interaction, true, true);
  }

  if (!(Interaction.deferred || Interaction.replied)) {
    await Interaction.deferReply();
  }

  const NoticesData = await GetUANData({
    guild_id: Interaction.guildId,
    user_id: TargetUser.id,
    now: Date.now(),
    type: "ReducedActivity",
  });

  const ActiveOrPendingRA = NoticesData.active_notice || NoticesData.pending_notice;
  const PromptEmbed = GetAdminPromptEmbed(Interaction, TargetUser, NoticesData);
  const AdminComps = GetAdminComponents(Interaction, ActiveOrPendingRA);
  const ResponseMsg = await Interaction.editReply({
    embeds: [PromptEmbed],
    components: AdminComps,
  });

  if (!ActiveOrPendingRA) return;
  const CompCollector = ResponseMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === Interaction.user.id,
    time: 14.5 * 60_000,
  });

  CompCollector.on("collect", async (ButtonInteract) => {
    let UpdateActionCompleted: boolean = false;

    try {
      if (ButtonInteract.customId.includes(AdminActions.RAApprove)) {
        UpdateActionCompleted = await HandleApprovalOrDenial(
          ButtonInteract,
          ActiveOrPendingRA,
          "Approval"
        );
      } else if (ButtonInteract.customId.includes(AdminActions.RADeny)) {
        UpdateActionCompleted = await HandleApprovalOrDenial(
          ButtonInteract,
          ActiveOrPendingRA,
          "Denial"
        );
      } else if (ButtonInteract.customId.includes(AdminActions.RAEnd)) {
        UpdateActionCompleted = await HandleEarlyTermination(ButtonInteract, ActiveOrPendingRA);
      } else {
        ButtonInteract.deferUpdate().catch(() => null);
      }

      if (UpdateActionCompleted) {
        CompCollector.stop("CmdReinstated");
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        message: "An error occurred while handling LOA admin button interaction;",
        label: "Commands:Miscellaneous:RA:Subcmds:Admin",
        error_id: ErrorId,
        stack: Err.stack,
      });

      return new ErrorEmbed()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(ButtonInteract, true, true, "followUp");
    }
  });

  CompCollector.on("end", async (_, EndReason) => {
    if (/\w{1,10}Delete/.test(EndReason)) return;
    if (EndReason === "CmdReinstated") {
      return Callback(Interaction).catch(() => null);
    }

    AdminComps[0].components.forEach((Btn) => Btn.setDisabled(true));
    await Interaction.editReply({ components: AdminComps }).catch(() => null);
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("admin")
    .setDescription("Manage and administer someone else's reduced activity notice.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to administer their reduced activity notice.")
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
