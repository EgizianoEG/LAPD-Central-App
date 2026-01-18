import {
  SlashCommandSubcommandBuilder,
  InteractionResponse,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  ButtonStyle,
  Message,
} from "discord.js";

import {
  WarnContainer,
  ErrorContainer,
  SuccessContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import { GetAdminOrMgmtPanelContainer, PromiseAllSettledThenTrue } from "./Admin.js";
import { FormatCallsignDesignation as FormatDesignation } from "#Utilities/Strings/Formatters.js";
import { AggregationResults, Callsigns } from "#Typings/Utilities/Database.js";
import { GenericRequestStatuses } from "#Config/Constants.js";
import { GetCallsignAdminData } from "#Utilities/Database/CallsignData.js";
import { Emojis } from "#Config/Shared.js";

import AppLogger from "#Utilities/Classes/AppLogger.js";
import CallsignModel from "#Models/Callsign.js";
import CallsignsEventLogger from "#Utilities/Classes/CallsignsEventLogger.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";

type CmdOrButtonCachedInteraction = SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">;
const CallsignEventLogger = new CallsignsEventLogger();
const FileLabel = "Cmds:Misc:Callsigns:Subcmds:Manage";

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
function GetPanelComponents(
  ManagedUserId: string,
  PendingCallsign: Callsigns.CallsignDocument | null
) {
  const Components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (PendingCallsign?.request_status === GenericRequestStatuses.Pending) {
    Components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cs-mgmt-cancel:${ManagedUserId}:${PendingCallsign._id}`)
          .setLabel("Cancel Pending Request")
          .setEmoji(Emojis.WhiteCross)
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  return Components;
}

function GetCancelConfirmationComponents() {
  const ConfirmationBtns = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId("cs-cancel-confirm")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Yes, Cancel Request"),
    new ButtonBuilder()
      .setCustomId("cs-cancel-keep")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("No, Await Approval")
  );

  return [ConfirmationBtns];
}

// ---------------------------------------------------------------------------------------
// Action Handlers:
// ----------------
async function HandlePendingRequestCancellation(
  BtnInteract: ButtonInteraction<"cached">,
  CSAdminData: AggregationResults.CallsignsModel.GetCallsignAdminData | null = null
): Promise<boolean> {
  const PendingCSId = BtnInteract.customId.split(":")[2];
  const ConfirmationContainer = new WarnContainer()
    .setTitle("Pending Request Cancellation")
    .setDescription(
      "**Are you sure you want to cancel your pending call sign request?**\n" +
        "You will not be able to request another one for the next 30 minutes if you proceed."
    );

  ConfirmationContainer.attachPromptActionRows(GetCancelConfirmationComponents());
  const ConfirmationMsg = await BtnInteract.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [ConfirmationContainer],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message!);

  const ConfirmationResp = await ConfirmationMsg.awaitMessageComponent({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === BtnInteract.user.id,
    time: 10 * 60_000,
  }).catch(() => null);

  if (!ConfirmationResp || ConfirmationResp.customId.includes("keep")) {
    if (ConfirmationResp) {
      return ConfirmationResp.deferUpdate()
        .then(() => ConfirmationResp.deleteReply(ConfirmationMsg.id))
        .then(() => false)
        .catch(() => false);
    } else {
      return BtnInteract.deleteReply(ConfirmationMsg.id)
        .then(() => false)
        .catch(() => false);
    }
  } else {
    await ConfirmationResp.deferUpdate();
  }

  const PendingCSDocument = await CallsignModel.findById(PendingCSId).exec();
  if (!PendingCSDocument || PendingCSDocument.request_status !== GenericRequestStatuses.Pending) {
    return PromiseAllSettledThenTrue([
      CmdCallback(ConfirmationResp, BtnInteract.message.id),
      new ErrorContainer()
        .useErrTemplate("NoPendingCallsignToCancel")
        .replyToInteract(ConfirmationResp, true),
    ]);
  }

  PendingCSDocument.request_status = GenericRequestStatuses.Cancelled;
  PendingCSDocument.reviewed_on = ConfirmationResp.createdAt;
  PendingCSDocument.reviewer = BtnInteract.user.id;
  await PendingCSDocument.save();

  return PromiseAllSettledThenTrue([
    CmdCallback(ConfirmationResp, BtnInteract.message.id),
    CallsignEventLogger.LogCancellation(
      ConfirmationResp,
      PendingCSDocument,
      CSAdminData?.active_callsign
    ),
    new SuccessContainer()
      .setTitle("Call Sign Request Cancelled")
      .setDescription(
        "Your pending call sign request for **`%s`** has been successfully cancelled.\n" +
          "You may request a new call sign if wanted after 30 minutes.",
        FormatDesignation(PendingCSDocument.designation)
      )
      .replyToInteract(ConfirmationResp, true),
  ]);
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function CmdCallback(Interaction: CmdOrButtonCachedInteraction, PanelMsgId?: string) {
  if (!Interaction.deferred && !Interaction.replied) {
    if (Interaction.isButton()) await Interaction.deferUpdate().catch(() => null);
    else {
      await Interaction.deferReply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  }

  const StaffMember = Interaction.member;
  const CallsignData = await GetCallsignAdminData(Interaction.guildId, StaffMember.id, new Date());
  const PanelComponents = GetPanelComponents(StaffMember.id, CallsignData.pending_callsign);
  const PanelContainer = GetAdminOrMgmtPanelContainer(
    StaffMember,
    CallsignData,
    "Management",
    true
  );

  PanelContainer.attachPromptActionRows(PanelComponents);
  const MgmtPanelMessage = await Interaction.editReply({
    message: PanelMsgId ?? (Interaction.isButton() ? Interaction.message.id : undefined),
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [PanelContainer],
  });

  if (!PanelComponents.length) return;
  const CompActionCollector = MgmtPanelMessage.createMessageComponentCollector({
    time: 12.5 * 60 * 1000,
    filter: (I) => I.user.id === Interaction.user.id,
    componentType: ComponentType.Button,
  });

  CompActionCollector.on("collect", async function OnCSAdminAction(BtnInteract) {
    try {
      const PanelReinstated: boolean | InteractionResponse<boolean> | Message<boolean> =
        BtnInteract.customId.includes("cancel")
          ? await HandlePendingRequestCancellation(BtnInteract, CallsignData)
          : false;

      if (PanelReinstated === true) {
        CompActionCollector.stop("PromptReinstated");
      }
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while handling management interaction.",
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
    await LastInteract.editReply({
      components: DisableMessageComponents(MgmtPanelMessage.components.map((C) => C.toJSON())),
      message: MgmtPanelMessage.id,
    }).catch(() => null);
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage your currently assigned call sign or pending approval one."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
