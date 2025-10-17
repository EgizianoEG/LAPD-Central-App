import {
  SlashCommandSubcommandBuilder,
  time as FormatTime,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  EmbedBuilder,
  ButtonStyle,
} from "discord.js";

import {
  WarnContainer,
  ErrorContainer,
  SuccessContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import { ReducedActivityEventLogger } from "@Utilities/Classes/UANEventLogger.js";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { compareDesc } from "date-fns";

import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import GetUANData from "@Utilities/Database/GetUANData.js";
import Dedent from "dedent";

type RADocument = UserActivityNotice.ActivityNoticeHydratedDocument;
const RAEventLogger = new ReducedActivityEventLogger();
const PreviousRALimit = 5;

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
function GetManagementComponents(RADocument?: RADocument | null) {
  const ActionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId("ra-mng-cancel")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(Emojis.WhiteCross)
      .setLabel("Cancel Pending Request")
  );

  return RADocument?.status === "Pending" ? [ActionRow] : [];
}

function GetManagementPromptEmbed(ActiveOrPendingRA?: RADocument | null) {
  const PromptEmbed = new EmbedBuilder()
    .setTitle("Reduced Activity Management")
    .setColor(Colors.Info);

  if (ActiveOrPendingRA?.status === "Approved") {
    PromptEmbed.setColor(Colors.RequestApproved).addFields({
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
    PromptEmbed.setColor(Colors.RequestPending).addFields({
      inline: true,
      name: "Pending Notice",
      value: Dedent(`
        **Requested:** ${FormatTime(ActiveOrPendingRA.request_date, "R")}
        **Starts On:** *once approved.*
        **Ends On:** around ${FormatTime(new Date(ActiveOrPendingRA.request_date.getTime() + ActiveOrPendingRA.duration), "D")}
        **Quota Reduction:** ~${ActiveOrPendingRA.quota_reduction}
        **Reason:** ${ActiveOrPendingRA.reason}
      `),
    });
  } else {
    PromptEmbed.setDescription(
      `You currently do not have an active or pending reduced activity notice to manage.\nYou may request one using the ${MentionCmdByName(
        "ra request"
      )} command.`
    );
  }

  return PromptEmbed;
}

async function GetManagementEmbedAndRA(
  Interaction: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">
) {
  const NoticesData = await GetUANData({
    guild_id: Interaction.guildId,
    user_id: Interaction.user.id,
    type: "ReducedActivity",
  });

  const ActiveOrPendingRA = NoticesData.active_notice ?? NoticesData.pending_notice;
  const PromptEmbed = GetManagementPromptEmbed(ActiveOrPendingRA);
  const PreviousRAsFormatted = NoticesData.notice_history
    .filter((RA) => {
      return (
        RA.status === "Approved" && (RA.early_end_date ?? RA.end_date) <= Interaction.createdAt
      );
    })
    .sort((a, b) => compareDesc(a.early_end_date ?? a.end_date, b.early_end_date ?? b.end_date))
    .map((RA) => {
      return `${FormatTime(RA.review_date!, "D")} — ${FormatTime(RA.early_end_date ?? RA.end_date, "D")}`;
    });

  if (PreviousRAsFormatted.length > 0 && PreviousRAsFormatted.length <= PreviousRALimit) {
    PromptEmbed.addFields({
      inline: true,
      name: "Previously Taken RAs",
      value: PreviousRAsFormatted.join("\n"),
    });
  } else if (PreviousRAsFormatted.length > PreviousRALimit) {
    PromptEmbed.addFields({
      inline: true,
      name: "Previously Taken RAs",
      value: `${PreviousRAsFormatted.slice(0, PreviousRALimit).join("\n")}\n-# *...and ${PreviousRAsFormatted.length - PreviousRALimit} more*`,
    });
  } else if (!(PromptEmbed.data.fields?.length && ActiveOrPendingRA)) {
    PromptEmbed.setDescription(
      `${PromptEmbed.data.description}\n-# There are no previously approved RAs to display.`
    );
  }

  return [PromptEmbed, ActiveOrPendingRA] as const;
}

async function HandlePendingCancellation(
  Interaction: ButtonInteraction<"cached">,
  ActiveOrPendingRA: RADocument,
  PromptMsgId: string
) {
  const ConfirmationContainer = new WarnContainer()
    .setTitle("Reduced Activity Cancellation")
    .setDescription(
      Dedent(`
        **Are you sure you want to cancel your reduced activity request?**
        You will not be able to request another reduced activity for the next hour if you proceed.
      `)
    );

  const ConfirmationBtns = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId("ra-cancel-confirm")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Yes, Cancel Request"),
    new ButtonBuilder()
      .setCustomId("ra-cancel-keep")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("No, Keep It")
  );

  const ConfirmationMsg = await Interaction.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationBtns)],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message!);

  const ButtonInteract = await ConfirmationMsg.awaitMessageComponent({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === Interaction.user.id,
    time: 10 * 60_000,
  }).catch(() => null);

  if (!ButtonInteract || ButtonInteract.customId.includes("keep")) {
    if (ButtonInteract) {
      return ButtonInteract.deferUpdate()
        .then(() => ButtonInteract.deleteReply())
        .then(() => false)
        .catch(() => false);
    } else {
      return Interaction.deleteReply(ConfirmationMsg.id)
        .then(() => false)
        .catch(() => false);
    }
  } else {
    await ButtonInteract.deferUpdate();
  }

  const ExistingRA = await ActiveOrPendingRA.getUpToDate();
  if (!ExistingRA || ExistingRA.status !== "Pending") {
    return Promise.all([
      ButtonInteract.editReply({
        components: [],
        message: PromptMsgId,
        embeds: [GetManagementPromptEmbed(ExistingRA)],
      }),
      new ErrorContainer()
        .useErrTemplate("NoPendingRAToCancel")
        .replyToInteract(ButtonInteract, true, true, "editReply"),
    ]).then(() => true);
  }

  ExistingRA.status = "Cancelled";
  ExistingRA.review_date = ButtonInteract.createdAt;
  await ExistingRA.save();

  const UpdatedPromptEmbed = GetManagementPromptEmbed(ExistingRA);
  const RespContainer = new SuccessContainer()
    .setTitle("Request Cancelled")
    .setDescription("Your reduced activity request was successfully cancelled.");

  return Promise.all([
    RAEventLogger.LogCancellation(ButtonInteract, ExistingRA),
    ButtonInteract.editReply({ components: [RespContainer] }),
    ButtonInteract.editReply({
      components: [],
      message: PromptMsgId,
      embeds: [UpdatedPromptEmbed],
    }),
  ]).then(() => true);
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [ReplyEmbed, ActiveOrPendingRA] = await GetManagementEmbedAndRA(Interaction);
  const ManagementComps = GetManagementComponents(ActiveOrPendingRA);
  const ReplyMsg = await Interaction.editReply({
    embeds: [ReplyEmbed],
    components: ManagementComps,
  });

  if (!ActiveOrPendingRA || ActiveOrPendingRA.status !== "Pending") return;
  const CompCollector = ReplyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 14 * 60_000,
    filter: (i) => i.user.id === Interaction.user.id,
  });

  CompCollector.on("collect", async (ButtonInteract) => {
    if (ButtonInteract.customId.includes("cancel")) {
      const RequestCancelled = await HandlePendingCancellation(
        ButtonInteract,
        ActiveOrPendingRA,
        ReplyMsg.id
      );

      if (RequestCancelled) {
        CompCollector.stop("Cancelled");
        return;
      }
    }
  });

  CompCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.match(/^\w+Delete/) || EndReason === "Cancelled") return;
    for (const Btn of ManagementComps[0].components) Btn.setDisabled(true);

    const LastInteract = (Collected.last() as ButtonInteraction<"cached">) || Interaction;
    await LastInteract.editReply({ message: ReplyMsg.id, components: ManagementComps }).catch(
      () => null
    );
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage and view details of your active or pending reduced activity notice."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
