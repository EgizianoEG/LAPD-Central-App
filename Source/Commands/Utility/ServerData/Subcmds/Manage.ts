import {
  SlashCommandSubcommandBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuBuilder,
  InteractionReplyOptions,
  RepliableInteraction,
  InteractionResponse,
  TextDisplayBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessagePayload,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  resolveColor,
  ButtonStyle,
  CacheType,
  Message,
} from "discord.js";

import * as ShiftDataModule from "./Modules/ShiftData.js";
import * as UANDataModule from "./Modules/UANData.js";

import HandleActionCollectorExceptions from "@Utilities/Discord/HandleCompCollectorExceptions.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

// ---------------------------------------------------------------------------------------
// File Constants, Types, & Enums:
// -------------------------------
const FileLabel = "Commands:Utility:ServerDataManage";
const BaseAccentColor = resolveColor("#5F9EA0");

type CmdOrStringSelectInteract<Cached extends CacheType = CacheType> =
  | SlashCommandInteraction<Cached>
  | StringSelectMenuInteraction<Cached>;

export enum DataCategories {
  CallsignsData = "cd",
  ShiftData = "sd",
  LeaveData = "ld",
  RAData = "rad",
}

// ---------------------------------------------------------------------------------------
// Common Utilities:
// -----------------
function GetDataCategoriesDropdownMenu(Interaction: CmdOrStringSelectInteract<"cached">) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`server-data-manage:${Interaction.user.id}`)
      .setPlaceholder("Select a category...")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Shift Data Management")
          .setDescription("Manage the logged shift records and related data.")
          .setValue(DataCategories.ShiftData),
        new StringSelectMenuOptionBuilder()
          .setLabel("Leave of Absence Data Management")
          .setDescription("Manage the logged leave of absence records and related data.")
          .setValue(DataCategories.LeaveData),
        new StringSelectMenuOptionBuilder()
          .setLabel("Reduced Activity Data Management")
          .setDescription("Manage the logged reduced activity records and related data.")
          .setValue(DataCategories.RAData),
        new StringSelectMenuOptionBuilder()
          .setLabel("Call Signs Data Management")
          .setDescription("Manage the call signs assigned to members in the server.")
          .setValue(DataCategories.CallsignsData)
      )
  );
}

export function GetDeleteConfirmationComponents(
  Interaction: ButtonInteraction<"cached">,
  TopicID: string
) {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Confirm and Delete")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${TopicID}-confirm:${Interaction.user.id}`),
    new ButtonBuilder()
      .setLabel("Cancel Deletion")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${TopicID}-cancel:${Interaction.user.id}`)
  );
}

export async function SendReplyAndFetchMessage(
  Interaction: RepliableInteraction<"cached">,
  Options: (MessagePayload | InteractionReplyOptions) & {
    replyMethod?: "reply" | "editReply" | "update" | "followUp";
  }
): Promise<Message<true>> {
  const ReplyMethod = Options.replyMethod ?? "reply";
  let Flags =
    "components" in Options && Options.components?.length
      ? Options.components[0] instanceof ContainerBuilder
        ? MessageFlags.IsComponentsV2
        : undefined
      : undefined;

  if ("flags" in Options && Options.flags && Flags) {
    Flags &= Options.flags as number;
  }

  delete Options.replyMethod;
  const Response = await Interaction[ReplyMethod]({
    ...Options,
    flags: Flags,
    withResponse: true,
  } as InteractionReplyOptions & {
    withResponse: true;
  });

  return Response.resource!.message! as Message<true>;
}

export async function AwaitDeleteConfirmation(
  RecBtnInteract: ButtonInteraction<"cached">,
  ConfirmationMsg: Message<true>,
  ConfirmationFunc: (ConfirmInteract: ButtonInteraction<"cached">, ...args: any[]) => Promise<any>,
  ...AdditionalCFArgs: any[]
) {
  let ConfirmationInteract: ButtonInteraction<"cached"> | null = null;
  try {
    ConfirmationInteract = await ConfirmationMsg.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (Interact) => Interact.user.id === RecBtnInteract.user.id,
      time: 5 * 60 * 1000,
    });

    if (ConfirmationInteract?.customId.includes("confirm")) {
      return ConfirmationFunc(ConfirmationInteract, ...AdditionalCFArgs);
    } else if (ConfirmationInteract) {
      return ConfirmationInteract.deferUpdate()
        .then(() => ConfirmationInteract?.deleteReply())
        .catch(() => null);
    }
  } catch (Err: any) {
    if (Err?.message.match(/reason: time/)) {
      return RecBtnInteract.deleteReply()
        .catch(() => ConfirmationMsg.delete())
        .catch(() => null);
    } else if (Err?.message.match(/reason: \w+Delete/)) {
      /* Ignore message/channel/guild deletion */
      return null;
    } else {
      AppLogger.error({
        label: FileLabel,
        message: "Failed to await confirmation for deletion of records;",
        stack: Err.stack,
        error: Err,
      });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Initial Handlers:
// -----------------
async function HandleInitialRespActions(
  CmdInteract: CmdOrStringSelectInteract<"cached">,
  CmdRespMsg: Message<true> | InteractionResponse<true>,
  SMenuDisabler: () => Promise<any>
) {
  return CmdRespMsg.awaitMessageComponent({
    componentType: ComponentType.StringSelect,
    filter: (Interact) => Interact.user.id === CmdInteract.user.id,
    time: 10 * 60 * 1000,
  })
    .then(async function OnDataCategorySelection(TopicSelectInteract) {
      const SelectedDataTopic = TopicSelectInteract.values[0];

      if (SelectedDataTopic === DataCategories.ShiftData) {
        return ShiftDataModule.HandleShiftRecordsManagement(TopicSelectInteract, Callback);
      } else if (SelectedDataTopic === DataCategories.LeaveData) {
        return UANDataModule.HandleUserActivityNoticeRecordsManagement(
          TopicSelectInteract,
          Callback,
          true
        );
      } else if (SelectedDataTopic === DataCategories.RAData) {
        return UANDataModule.HandleUserActivityNoticeRecordsManagement(
          TopicSelectInteract,
          Callback,
          false
        );
      }
    })
    .catch((Err) => HandleActionCollectorExceptions(Err, SMenuDisabler));
}

async function Callback(CmdInteraction: CmdOrStringSelectInteract<"cached">) {
  const DataCategoriesMenu = GetDataCategoriesDropdownMenu(CmdInteraction);
  const CmdRespContainer = new ContainerBuilder()
    .setAccentColor(BaseAccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "### Server Data Management\n**Please select a data category from the drop-down list below to continue.**"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addActionRowComponents(DataCategoriesMenu);

  const CmdRespMsg =
    CmdInteraction.replied || CmdInteraction.deferred
      ? await CmdInteraction.editReply({
          components: [CmdRespContainer],
          flags: MessageFlags.IsComponentsV2,
        })
      : await CmdInteraction.reply({
          components: [CmdRespContainer],
          flags: MessageFlags.IsComponentsV2,
          withResponse: true,
        }).then((Resp) => Resp.resource!.message!);

  const PromptDisabler = () => {
    const APICompatibleComps = CmdRespMsg.components.map((Comp) => Comp.toJSON());
    const DisabledComponents = DisableMessageComponents(APICompatibleComps);
    return CmdInteraction.editReply({
      components: DisabledComponents,
    });
  };

  return HandleInitialRespActions(CmdInteraction, CmdRespMsg, PromptDisabler);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage logged server data, including shift and activity notice records."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;

