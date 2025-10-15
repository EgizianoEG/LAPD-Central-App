import {
  SlashCommandSubcommandBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuBuilder,
  InteractionReplyOptions,
  ModalSubmitInteraction,
  RepliableInteraction,
  InteractionResponse,
  time as FormatTime,
  TextDisplayBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  TextInputBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  TextInputStyle,
  MessagePayload,
  ButtonBuilder,
  ComponentType,
  ModalBuilder,
  MessageFlags,
  resolveColor,
  LabelBuilder,
  ButtonStyle,
  inlineCode,
  CacheType,
  Message,
} from "discord.js";

import {
  SuccessContainer,
  WarnContainer,
  InfoContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  LeaveOfAbsenceEventLogger,
  ReducedActivityEventLogger,
} from "@Utilities/Classes/UANEventLogger.js";

import { Dedent } from "@Utilities/Strings/Formatters.js";
import { Emojis } from "@Config/Shared.js";
import { isAfter } from "date-fns";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";
import { UserActivityNotice, Shifts } from "@Typings/Utilities/Database.js";

import UANModel from "@Models/UserActivityNotice.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import ShiftModel from "@Models/Shift.js";
import * as Chrono from "chrono-node";

import HumanizeDuration from "humanize-duration";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import HandleShiftRoleAssignment from "@Utilities/Discord/HandleShiftRoleAssignment.js";
import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleUserActivityNoticeUpdate from "@Utilities/Discord/HandleUANUpdate.js";
import HandleActionCollectorExceptions from "@Utilities/Discord/HandleCompCollectorExceptions.js";

// ---------------------------------------------------------------------------------------
// File Constants, Types, & Enums:
// -------------------------------
const FileLabel = "Commands:Utility:ServerDataManage";
const ListFormatter = new Intl.ListFormat("en");
const BaseAccentColor = resolveColor("#5F9EA0");
const RADataLogger = new ReducedActivityEventLogger();
const LeaveDataLogger = new LeaveOfAbsenceEventLogger();

const GetUANShortenedName = (IsLOA: boolean) => (IsLOA ? "Leave" : "RA");
const GetUANShortenedWEName = (IsLOA: boolean) => (IsLOA ? "Leave" : "Reduced Activity");
const GetUANDataActionPrefix = (IsLOA: boolean) => (IsLOA ? "ld" : "rad");
const GetUANNoticeTitle = (IsLOA: boolean, TitleCase?: boolean) =>
  IsLOA ? `Leave of ${TitleCase ? "A" : "a"}bsence` : `Reduced ${TitleCase ? "A" : "a"}ctivity`;

type DataDeletionWithDateType = "Before" | "After";
type CmdOrStringSelectInteract<Cached extends CacheType = CacheType> =
  | SlashCommandInteraction<Cached>
  | StringSelectMenuInteraction<Cached>;
type StringSelectOrButtonInteract<Cached extends CacheType = CacheType> =
  | StringSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

enum DataCategories {
  ShiftData = "sd",
  LeaveData = "ld",
  RAData = "rad",
}

enum ShiftDataActions {
  WipeAll = "sd-wa",
  DeletePast = "sd-dp",
  DeleteOfType = "sd-dot",
  DeleteBefore = "sd-db",
  DeleteAfter = "sd-da",
}

enum LeaveDataActions {
  WipeAll = `${DataCategories.LeaveData}-wa`,
  DeletePast = `${DataCategories.LeaveData}-dpast`,
  DeletePending = `${DataCategories.LeaveData}-dpen`,
  DeleteBefore = `${DataCategories.LeaveData}-db`,
  DeleteAfter = `${DataCategories.LeaveData}-da`,
}

enum RADataActions {
  WipeAll = `${DataCategories.RAData}-wa`,
  DeletePast = `${DataCategories.RAData}-dpast`,
  DeletePending = `${DataCategories.RAData}-dpen`,
  DeleteBefore = `${DataCategories.RAData}-db`,
  DeleteAfter = `${DataCategories.RAData}-da`,
}

// ---------------------------------------------------------------------------------------
// General Helpers:
// ----------------
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
          .setValue(DataCategories.RAData)
      )
  );
}

function GetShiftDataManagementComponents(Interaction: StringSelectOrButtonInteract<"cached">) {
  return [
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel("Wipe All Shift Records")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`sdm-${ShiftDataActions.WipeAll}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Records of Type")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`sdm-${ShiftDataActions.DeleteOfType}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Past Shifts")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`sdm-${ShiftDataActions.DeletePast}:${Interaction.user.id}`)
    ),
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel("Delete Records Before Date")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`sdm-${ShiftDataActions.DeleteBefore}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Records After Date")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`sdm-${ShiftDataActions.DeleteAfter}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Back")
        .setEmoji(Emojis.WhiteBack)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`sdm-back:${Interaction.user.id}`)
    ),
  ];
}

function GetUANManagementComponents(
  Interaction: StringSelectOrButtonInteract<"cached">,
  IsLOA: boolean
) {
  const ActionPrefix = `sdm-${GetUANDataActionPrefix(IsLOA)}`;
  const Actions = IsLOA ? LeaveDataActions : RADataActions;

  return [
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel(`Wipe All ${GetUANShortenedName(IsLOA)} Records`)
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`${ActionPrefix}-${Actions.WipeAll.split("-").pop()}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Pending Requests")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(
          `${ActionPrefix}-${Actions.DeletePending.split("-").pop()}:${Interaction.user.id}`
        ),
      new ButtonBuilder()
        .setLabel("Delete Past Records")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(
          `${ActionPrefix}-${Actions.DeletePast.split("-").pop()}:${Interaction.user.id}`
        )
    ),
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel("Delete Records Before Date")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false)
        .setCustomId(
          `${ActionPrefix}-${Actions.DeleteBefore.split("-").pop()}:${Interaction.user.id}`
        ),
      new ButtonBuilder()
        .setLabel("Delete Records After Date")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false)
        .setCustomId(
          `${ActionPrefix}-${Actions.DeleteAfter.split("-").pop()}:${Interaction.user.id}`
        ),
      new ButtonBuilder()
        .setLabel("Back")
        .setEmoji(Emojis.WhiteBack)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`sdm-back:${Interaction.user.id}`)
    ),
  ];
}

function GetDeleteConfirmationComponents(
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

function GetShiftManagementContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(BaseAccentColor)
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: "### Shift Data Management",
    })
    .addSeparatorComponents({
      type: ComponentType.Separator,
      spacing: 2,
      divider: true,
    })
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: Dedent(`
        Shift data is the shift records that have been logged on the app's database to track staff members' duties and their time invested in working. \
        A new record is created when a staff member starts a new shift using the ${MentionCmdByName("duty manage")} slash command. Use the buttons below \
        to delete records by type, time frame, or status.

        **Options Described:**
        - **Wipe All Shift Records**
          This will delete and erase *all* records of shifts, including active and finished ones, under *any* shift type.
        - **Delete Records of Type**
          An option to delete only shift records under a specified shift type, disregarding whether there are any active shifts or not.
        - **Delete Past Shifts**
          As stated in the title, delete only past shifts that have ended or finished, of any shift type.
        - **Delete Records Before/Since Date**
          An option to delete a set of shifts based on a specific time frame. The start date of the shifts is used for this matter.

        -# This panel will automatically deactivate after 10 minutes of inactivity.
      `),
    });
}

function GetUANManagementContainer(NoticeIsLOA: boolean): ContainerBuilder {
  const LeaveOrRA = NoticeIsLOA ? "leave" : "reduced activity";
  return new ContainerBuilder()
    .setAccentColor(BaseAccentColor)
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: `### ${GetUANNoticeTitle(NoticeIsLOA, true)} Data Management`,
    })
    .addSeparatorComponents({
      type: ComponentType.Separator,
      spacing: 2,
      divider: true,
    })
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: Dedent(`
        ${GetUANNoticeTitle(NoticeIsLOA)} data consists of a set of records, each of which was created upon a staff member's request using the \
        ${MentionCmdByName(`${NoticeIsLOA ? "loa" : "ra"} request`)} slash command. This panel provides the ability to delete a set of records \
        based on status or time frame. Use the buttons below to take action on a specific set of records.

        **Options Described:**
        - **Wipe All Records**
          Delete *all* ${LeaveOrRA} records, including active, pending, finished, and cancelled ones.
        - **Delete Pending Notices**
          Delete pending requests that have not yet been reviewed, approved, or denied by management.
        - **Delete Past Records**
          This option will delete only ${LeaveOrRA} records that are no longer active and not in a pending state. Only finished and cancelled ones will be affected.
        - **Delete Records Before/Since Date**
          Delete past, finished, and cancelled ${LeaveOrRA} records based on a specific date, before or after it. The end date (first), review date, or request date \
          for pending requests is being utilized for this action. Please take into considration that these two options are not accurate at the moment and may result \
          into unexpected deletion of wanted records.
        
        -# This panel will automatically deactivate after 10 minutes of inactivity.
      `),
    });
}

function GetComparisonDateInputModal(
  Interaction: ButtonInteraction<"cached">,
  TargetData: "Shift" | "Leave" | "RA",
  CDType: DataDeletionWithDateType
) {
  const Modal = new ModalBuilder()
    .setTitle(`Delete ${TargetData} Records ${CDType} Date`)
    .setCustomId(`sdm-dab-input:${Interaction.user.id}:${RandomString(4)}`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Comparison Date")
        .setDescription(
          `Enter a date or time expression to delete records ${CDType.toLowerCase()} it.`
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("comp_date")
            .setPlaceholder(
              "ex., '2 weeks ago', 'last month', '2023-01-15', 'March 3rd, 2022', 'yesterday', etc..."
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(32)
        )
    );

  if (TargetData === "Shift") {
    Modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Shift Type")
        .setDescription(
          "The specific shift type to delete records of. If left blank, all types are considered."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("shift_type")
            .setPlaceholder("e.g., 'Patrol'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(3)
            .setMaxLength(62)
        )
    );
  } else if (TargetData === "Leave" || TargetData === "RA") {
    Modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(`${TargetData} Status`)
        .setDescription(
          "The notice status to delete records of (optional). Can be 'Pending', 'Cancelled', 'Active', or 'Ended'."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(`${TargetData.toLowerCase()}_status`)
            .setPlaceholder("e.g. 'Pending' or 'Ended'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(4)
            .setMaxLength(32)
        )
    );
  }

  return Modal;
}

async function SendReplyAndFetchMessage(
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
    Flags = Flags & (Options.flags as number);
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

async function AwaitDeleteConfirmation(
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
      });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Shift Data Mgmt. Helpers:
// -------------------------
function GetSDConfirmationPromptContainer(Opts: {
  SShiftInfo: Awaited<ReturnType<typeof GetSummarizedShiftInfo>>;
  ShiftTypes?: string[];
  ShiftStatus?: string;
  AfterDate?: Date | null;
  BeforeDate?: Date | null;
}): WarnContainer {
  const { SShiftInfo, ShiftTypes, ShiftStatus, AfterDate, BeforeDate } = Opts;
  const ShiftStatusText = ShiftStatus || "all";
  const RecordedBeforeAfterText = BeforeDate
    ? ` recorded before ${FormatTime(BeforeDate, "D")}`
    : AfterDate
      ? ` recorded after ${FormatTime(AfterDate, "D")}`
      : "";

  let ShiftTypeText: string = "";
  if (Array.isArray(ShiftTypes) && ShiftTypes.length > 1) {
    ShiftTypeText = ` under ${ListFormatter.format(ShiftTypes.map((S) => inlineCode(S)))} shift types`;
  } else if (Array.isArray(ShiftTypes) && Boolean(ShiftTypes[0])) {
    ShiftTypeText = ` under the \`${ShiftTypes[0]}\` shift type`;
  } else if (typeof ShiftTypes === "string" && Boolean(ShiftTypes)) {
    ShiftTypeText = ` under the \`${ShiftTypes}\` shift type`;
  }

  return new WarnContainer().setTitle("Confirmation Required").setDescription(
    Dedent(`
      **Are you certain you want to delete ${ShiftStatusText} shifts${RecordedBeforeAfterText}${ShiftTypeText}?**
      This will permanently erase \`${SShiftInfo.shift_count}\` shifts totalling around ${HumanizeDuration(SShiftInfo.total_time, { round: true, conjunction: " and " })} of on duty time.

      -# **Note:** This action is ***irreversible***, and data deleted cannot be restored after confirmation. By confirming, you accept full responsibility for this action.
      -# This prompt will automatically cancel after five minutes of inactivity.
    `)
  );
}

function GetShiftTypeInputModal(Interaction: ButtonInteraction<"cached">) {
  return new ModalBuilder()
    .setTitle("Delete Records by Shift Type")
    .setCustomId(
      `sdm-${ShiftDataActions.DeleteOfType}-input:${Interaction.user.id}:${RandomString(4)}`
    )
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Shift Type")
        .setDescription("The shift type to delete records of.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("shift_type")
            .setPlaceholder("e.g., 'Default'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(62)
        )
    );
}

async function GetSummarizedShiftInfo(MatchQuery: Mongoose.FilterQuery<Shifts.ShiftDocument>) {
  return ShiftModel.aggregate<{ total_time: number; shift_count: number }>([
    { $match: MatchQuery },
    {
      $group: {
        _id: null,
        total_time: { $sum: "$durations.on_duty" },
        shift_count: { $sum: 1 },
      },
    },
    { $unset: ["_id"] },
  ])
    .exec()
    .then((Docs) => {
      if (Docs?.length) {
        return Docs[0];
      } else {
        return { total_time: 0, shift_count: 0 };
      }
    });
}

async function HandleNoShiftsToTakeActionOn(
  RecInteract: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  SSInfo: Awaited<ReturnType<typeof GetSummarizedShiftInfo>>
) {
  if (SSInfo.shift_count === 0) {
    return new InfoEmbed()
      .setThumbnail(null)
      .setTitle("No Shifts Found")
      .setDescription("There are no shifts found to delete or take action on.")
      .replyToInteract(RecInteract, true, false)
      .then(() => true);
  }

  return false;
}

async function HandleNoShiftsDeletedStatus(
  RecBtnInteract: ButtonInteraction<"cached">,
  SSInfo: Awaited<ReturnType<typeof GetSummarizedShiftInfo>>
) {
  if (SSInfo.shift_count === 0) {
    const ResponseEmbed = new InfoEmbed()
      .setThumbnail(null)
      .setTitle("No Shifts Deleted")
      .setDescription("There were no shifts found that needed to be deleted.");

    if (RecBtnInteract.deferred || RecBtnInteract.replied) {
      return RecBtnInteract.editReply({ embeds: [ResponseEmbed] }).then(() => true);
    } else {
      return RecBtnInteract.update({
        components: [],
        embeds: [ResponseEmbed],
      }).then(() => true);
    }
  }

  return false;
}

async function HandleShiftDataWipeAllConfirm(ConfirmInteract: ButtonInteraction<"cached">) {
  await ConfirmInteract.update({
    components: [new InfoContainer().useInfoTemplate("SRWipeAllInProgress")],
  });

  const QueryFilter = { guild: ConfirmInteract.guildId };
  const ShiftsToDelete = await ShiftModel.find(QueryFilter).exec();
  const OngoingShiftsUsers = ShiftsToDelete.filter((S) => S.end_timestamp === null).map(
    (S) => S.user
  );

  const TotalTimeToRemove = ShiftsToDelete.reduce(
    (TotalTime, Shift) => TotalTime + (Shift.durations.on_duty ?? 0),
    0
  );

  if (
    await HandleNoShiftsDeletedStatus(ConfirmInteract, {
      total_time: TotalTimeToRemove,
      shift_count: ShiftsToDelete.length,
    })
  ) {
    return;
  }

  const DeleteResponse = Object.assign(await ShiftModel.deleteMany(QueryFilter).exec(), {
    totalTime: TotalTimeToRemove,
  });

  return Promise.allSettled([
    ShiftActionLogger.LogShiftsWipe(ConfirmInteract, DeleteResponse),
    HandleShiftRoleAssignment(
      "off-duty",
      ConfirmInteract.client,
      ConfirmInteract.guild,
      OngoingShiftsUsers
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** shift records.",
          DeleteResponse.deletedCount
        ),
      ],
    }),
  ]);
}

async function HandleShiftDataWipeAll(BtnInteract: ButtonInteraction<"cached">) {
  const SummarizedShiftInfo = await GetSummarizedShiftInfo({ guild: BtnInteract.guildId });
  if (await HandleNoShiftsToTakeActionOn(BtnInteract, SummarizedShiftInfo)) return;

  const ConfirmationContainer = GetSDConfirmationPromptContainer({
    SShiftInfo: SummarizedShiftInfo,
  });

  const ConfirmationComponents = GetDeleteConfirmationComponents(
    BtnInteract,
    `sdm-${ShiftDataActions.WipeAll}`
  );

  const RespMessage = await SendReplyAndFetchMessage(BtnInteract, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(BtnInteract, RespMessage, HandleShiftDataWipeAllConfirm);
}

async function HandleShiftDataDeletePastConfirm(ConfirmInteract: ButtonInteraction<"cached">) {
  await ConfirmInteract.update({
    components: [new InfoContainer().useInfoTemplate("SRDeletionInProgress")],
  });

  const QueryFilter = {
    guild: ConfirmInteract.guildId,
    end_timestamp: { $ne: null },
  };

  const [UpdatedShifTData, DeleteResponse] = await Promise.all([
    GetSummarizedShiftInfo(QueryFilter),
    (await ShiftModel.deleteMany(QueryFilter).exec()) as any,
  ]);

  Object.assign(DeleteResponse, { totalTime: UpdatedShifTData.total_time });
  if (await HandleNoShiftsDeletedStatus(ConfirmInteract, UpdatedShifTData)) return;
  return Promise.all([
    ShiftActionLogger.LogShiftsWipe(ConfirmInteract, DeleteResponse),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** past shifts.",
          DeleteResponse.deletedCount
        ),
      ],
    }),
  ]);
}

async function HandleShiftDataDeletePast(BtnInteract: ButtonInteraction<"cached">) {
  const SummarizedShiftInfo = await GetSummarizedShiftInfo({
    guild: BtnInteract.guildId,
    end_timestamp: { $ne: null },
  });

  if (await HandleNoShiftsToTakeActionOn(BtnInteract, SummarizedShiftInfo)) {
    return;
  }

  const ConfirmationContainer = GetSDConfirmationPromptContainer({
    SShiftInfo: SummarizedShiftInfo,
    ShiftStatus: "past",
  });

  const ConfirmationComponents = GetDeleteConfirmationComponents(
    BtnInteract,
    `sdm-${ShiftDataActions.DeletePast}`
  );

  const RespMessage = await SendReplyAndFetchMessage(BtnInteract, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(BtnInteract, RespMessage, HandleShiftDataDeletePastConfirm);
}

async function HandleShiftDataDeleteOfTypeConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  ShiftTypes: string[]
) {
  await ConfirmInteract.update({
    components: [new InfoContainer().useInfoTemplate("SRDeletionInProgress")],
  });

  const QueryFilter = {
    guild: ConfirmInteract.guildId,
    type: { $in: ShiftTypes },
  };

  const ShiftsToDelete = await ShiftModel.find(QueryFilter).exec();
  const OngoingShiftsUsers = ShiftsToDelete.filter((S) => S.end_timestamp === null).map(
    (S) => S.user
  );
  const TotalTimeToRemove = ShiftsToDelete.reduce(
    (TotalTime, Shift) => TotalTime + (Shift.durations.on_duty ?? 0),
    0
  );

  if (
    await HandleNoShiftsDeletedStatus(ConfirmInteract, {
      total_time: TotalTimeToRemove,
      shift_count: ShiftsToDelete.length,
    })
  ) {
    return;
  }

  const DeleteResponse = Object.assign(await ShiftModel.deleteMany(QueryFilter).exec(), {
    totalTime: TotalTimeToRemove,
  });

  return Promise.allSettled([
    ShiftActionLogger.LogShiftsWipe(ConfirmInteract, DeleteResponse, ShiftTypes),
    HandleShiftRoleAssignment(
      "off-duty",
      ConfirmInteract.client,
      ConfirmInteract.guild,
      OngoingShiftsUsers
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** recorded shifts of type(s): %s",
          DeleteResponse.deletedCount,
          ListFormatter.format(ShiftTypes.map((T) => inlineCode(T)))
        ),
      ],
    }),
  ]);
}

async function HandleShiftDataDeleteOfType(BtnInteract: ButtonInteraction<"cached">) {
  const ShiftTypeInputModal = GetShiftTypeInputModal(BtnInteract);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, ShiftTypeInputModal);
  const InputShiftType = ModalSubmission?.fields.getTextInputValue("shift_type").trim();
  const ShiftTypes: string[] = [];

  if (!ModalSubmission) return;
  if (InputShiftType?.includes(",")) {
    ShiftTypes.push(...InputShiftType.split(",").map((Type) => Type.trim()));
  } else if (InputShiftType) {
    ShiftTypes.push(InputShiftType);
  }

  const SummarizedShiftInfo = await GetSummarizedShiftInfo({
    guild: BtnInteract.guildId,
    type: { $in: ShiftTypes },
  });

  if (await HandleNoShiftsToTakeActionOn(ModalSubmission, SummarizedShiftInfo)) {
    return;
  }

  const ConfirmationContainer = GetSDConfirmationPromptContainer({
    SShiftInfo: SummarizedShiftInfo,
    ShiftTypes,
  });

  const ConfirmationComponents = GetDeleteConfirmationComponents(
    BtnInteract,
    `sdm-${ShiftDataActions.DeleteOfType}`
  );

  const RespMessage = await SendReplyAndFetchMessage(ModalSubmission, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    HandleShiftDataDeleteOfTypeConfirm,
    ShiftTypes
  );
}

async function HandleShiftDataDeleteWithDateConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  ComparisonDate: Date,
  ComparisonType: DataDeletionWithDateType,
  ShiftTypes?: string[]
) {
  await ConfirmInteract.update({
    components: [new InfoContainer().useInfoTemplate("SRDeletionInProgress")],
  });

  const QueryFilter = {
    guild: ConfirmInteract.guildId,
    type: ShiftTypes?.length ? { $in: ShiftTypes } : { $exists: true },
    start_timestamp:
      ComparisonType === "Before" ? { $lte: ComparisonDate } : { $gte: ComparisonDate },
  };

  const ShiftsToDelete = await ShiftModel.find(QueryFilter).exec();
  const OngoingShiftsUsers = ShiftsToDelete.filter((S) => S.end_timestamp === null).map(
    (S) => S.user
  );

  const TotalTimeToRemove = ShiftsToDelete.reduce(
    (TotalTime, Shift) => TotalTime + (Shift.durations.on_duty ?? 0),
    0
  );

  if (
    await HandleNoShiftsDeletedStatus(ConfirmInteract, {
      total_time: TotalTimeToRemove,
      shift_count: ShiftsToDelete.length,
    })
  ) {
    return;
  }

  const DeleteResponse = Object.assign(await ShiftModel.deleteMany(QueryFilter).exec(), {
    totalTime: TotalTimeToRemove,
    ...(ComparisonType === "Before"
      ? { shiftsBefore: ComparisonDate }
      : { shiftsAfter: ComparisonDate }),
  });

  return Promise.allSettled([
    ShiftActionLogger.LogShiftsWipe(ConfirmInteract, DeleteResponse, ShiftTypes),
    HandleShiftRoleAssignment(
      "off-duty",
      ConfirmInteract.client,
      ConfirmInteract.guild,
      OngoingShiftsUsers
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** shifts%s recorded %s.",
          DeleteResponse.deletedCount,
          ShiftTypes?.length
            ? ` of type(s): ${ListFormatter.format(ShiftTypes.map((T) => inlineCode(T)))}`
            : " of all types",
          ComparisonType === "Before"
            ? `before ${FormatTime(ComparisonDate, "D")}`
            : `after ${FormatTime(ComparisonDate, "D")}`
        ),
      ],
    }),
  ]);
}

async function HandleShiftDataDeleteBeforeOrAfterDate(
  BtnInteract: ButtonInteraction<"cached">,
  ComparisonType: DataDeletionWithDateType
) {
  const ComparisonDateModal = GetComparisonDateInputModal(BtnInteract, "Shift", ComparisonType);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, ComparisonDateModal);
  const InputDate = ModalSubmission?.fields.getTextInputValue("comp_date").trim();
  const ParsedDate = InputDate ? Chrono.parseDate(InputDate, ModalSubmission?.createdAt) : null;
  const InputShiftType = ModalSubmission?.fields.getTextInputValue("shift_type").trim();
  const ShiftTypes: string[] = [];

  if (!ModalSubmission) return;
  if (InputShiftType?.includes(",")) {
    ShiftTypes.push(...InputShiftType.split(",").map((Type) => Type.trim()));
  } else if (InputShiftType) {
    ShiftTypes.push(InputShiftType);
  }

  if (InputDate && !ParsedDate) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDateFormat")
      .replyToInteract(ModalSubmission, true, false);
  } else if (InputDate && ParsedDate && isAfter(ParsedDate, ModalSubmission.createdAt)) {
    return new ErrorEmbed()
      .useErrTemplate("DateInFuture")
      .replyToInteract(ModalSubmission, true, false);
  }

  const MatchFilter = {
    guild: BtnInteract.guildId,
    type: ShiftTypes.length ? { $in: ShiftTypes } : { $exists: true },
    start_timestamp: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
  };

  const SummarizedShiftInfo = await GetSummarizedShiftInfo(MatchFilter);
  if (await HandleNoShiftsToTakeActionOn(ModalSubmission, SummarizedShiftInfo)) return;

  const ConfirmationContainer = GetSDConfirmationPromptContainer({
    ShiftTypes,
    SShiftInfo: SummarizedShiftInfo,
    AfterDate: ComparisonType === "After" ? ParsedDate : null,
    BeforeDate: ComparisonType === "Before" ? ParsedDate : null,
  });

  const ConfirmationComponents = GetDeleteConfirmationComponents(
    BtnInteract,
    `sdm-${ShiftDataActions["Delete" + ComparisonType]}`
  );

  const RespMessage = await SendReplyAndFetchMessage(ModalSubmission, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    HandleShiftDataDeleteWithDateConfirm,
    ParsedDate,
    ComparisonType,
    ShiftTypes
  );
}

async function HandleShiftRecordsManagement(SMenuInteract: StringSelectMenuInteraction<"cached">) {
  const PanelContainer = GetShiftManagementContainer();
  const ManagementComps = GetShiftDataManagementComponents(SMenuInteract);
  const ResponeseMessage = await SendReplyAndFetchMessage(SMenuInteract, {
    replyMethod: "update",
    components: [
      PanelContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider()
      ).addActionRowComponents(ManagementComps),
    ],
  });

  const CompActionCollector = ResponeseMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (Interact) => Interact.user.id === SMenuInteract.user.id,
    time: 10 * 60 * 1000,
  });

  CompActionCollector.on("collect", async function OnSDMBtnInteract(BtnInteract) {
    try {
      if (BtnInteract.customId.startsWith("sdm-back")) {
        CompActionCollector.stop("BackToMain");
      } else if (BtnInteract.customId.includes(ShiftDataActions.WipeAll)) {
        await HandleShiftDataWipeAll(BtnInteract);
      } else if (BtnInteract.customId.includes(ShiftDataActions.DeletePast)) {
        await HandleShiftDataDeletePast(BtnInteract);
      } else if (BtnInteract.customId.includes(ShiftDataActions.DeleteOfType)) {
        await HandleShiftDataDeleteOfType(BtnInteract);
      } else if (BtnInteract.customId.includes(ShiftDataActions.DeleteBefore)) {
        await HandleShiftDataDeleteBeforeOrAfterDate(BtnInteract, "Before");
      } else if (BtnInteract.customId.includes(ShiftDataActions.DeleteAfter)) {
        await HandleShiftDataDeleteBeforeOrAfterDate(BtnInteract, "After");
      }

      if (!BtnInteract.deferred && !BtnInteract.replied) {
        return BtnInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        label: FileLabel,
        message: "Failed to handle shift data management button interaction;",
        error_id: ErrorId,
        stack: Err.stack,
      });

      return new ErrorEmbed()
        .useErrTemplate("UnknownError")
        .setDescription("Something went wrong while handling your request.")
        .setErrorId(ErrorId)
        .replyToInteract(BtnInteract, true, true, "reply");
    }
  });

  CompActionCollector.on("end", async function OnSDMEnd(Collected, EndReason) {
    if (EndReason.match(/^\w+Delete/)) return;
    if (EndReason === "BackToMain") {
      return Callback(SMenuInteract);
    } else if (EndReason.includes("time")) {
      const LastInteract = Collected.last() ?? SMenuInteract;
      const APICompatibleComps = ResponeseMessage.components.map((Comp) => Comp.toJSON());
      const DisabledComponents = DisableMessageComponents(APICompatibleComps);
      return LastInteract.editReply({
        message: SMenuInteract.message.id,
        components: DisabledComponents,
      });
    }
  });
}

// ---------------------------------------------------------------------------------------
// UAN Data Mgmt. Helpers:
// ------------------------
function GetUANConfirmationPromptContainer(Opts: {
  NoticeRecordsCount: number;
  RecordsStatus?: string;
  AfterDate?: Date | null;
  BeforeDate?: Date | null;
  IsLOA: boolean;
}): WarnContainer {
  const { NoticeRecordsCount, RecordsStatus, AfterDate, BeforeDate, IsLOA } = Opts;
  const NoticeStatusText = RecordsStatus || "all";
  const NoticeType = GetUANNoticeTitle(IsLOA).toLowerCase();
  const RecordedBeforeAfterText = BeforeDate
    ? ` recorded before ${FormatTime(BeforeDate, "D")}`
    : AfterDate
      ? ` recorded after ${FormatTime(AfterDate, "D")}`
      : "";

  return new WarnContainer().setTitle("Confirmation Required").setDescription(
    Dedent(`
      **Are you certain you want to delete '${NoticeStatusText.toLowerCase()}' ${NoticeType} records${RecordedBeforeAfterText}?**
      This will permanently erase \`${NoticeRecordsCount}\` ${GetUANNoticeTitle(IsLOA).toLowerCase()} records.

      -# **Note:** This action is ***irreversible***, and data deleted cannot be restored after confirmation. By confirming, you accept full responsibility for this action.
      -# This prompt will automatically cancel after five minutes of inactivity.
    `)
  );
}

async function HandleNoNoticesToTakeActionOn(
  RecInteract: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  RecordsCount: number,
  InPastForm: boolean = true,
  IsLOA: boolean = true,
  RecReplyMethod?: "reply" | "editReply" | "update" | "followUp"
) {
  if (RecordsCount === 0) {
    return new InfoEmbed()
      .setThumbnail(null)
      .setTitle(`No ${GetUANShortenedName(IsLOA)} Records Found`)
      .setDescription(
        `There ${InPastForm ? "were" : "are"} no records of ${GetUANShortenedWEName(IsLOA).toLowerCase()} notices to delete or take action on.`
      )
      .replyToInteract(RecInteract, true, false, RecReplyMethod)
      .then(() => true);
  }

  return false;
}

async function HandleUANDataWipeAllConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  IsLOA: boolean
) {
  const Logger = IsLOA ? LeaveDataLogger : RADataLogger;
  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANWipeAllInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const FoundNotices = await UANModel.find({
    guild: ConfirmInteract.guildId,
    type: NoticeType,
  }).exec();

  const DeleteResponse = await UANModel.deleteMany({
    _id: { $in: FoundNotices.map((N) => N._id) },
    guild: ConfirmInteract.guildId,
    type: NoticeType,
  }).exec();

  if (
    await HandleNoNoticesToTakeActionOn(ConfirmInteract, DeleteResponse.deletedCount, true, IsLOA)
  ) {
    return;
  }

  return Promise.allSettled([
    Logger.LogUserActivityNoticesWipe(ConfirmInteract, DeleteResponse),
    HandleUserActivityNoticeUpdate(
      FoundNotices.filter((N) => N.is_active).map((N) => N.user),
      ConfirmInteract.guild,
      NoticeType,
      false
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** %s notices.",
          DeleteResponse.deletedCount,
          GetUANShortenedWEName(IsLOA).toLowerCase()
        ),
      ],
    }),
  ]);
}

async function HandleUANDataWipeAll(BtnInteract: ButtonInteraction<"cached">, IsLOA: boolean) {
  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const NoticeRecordsCount = await UANModel.countDocuments({
    guild: BtnInteract.guildId,
    type: NoticeType,
  }).exec();

  if ((await HandleNoNoticesToTakeActionOn(BtnInteract, NoticeRecordsCount, false, IsLOA)) === true)
    return;

  const ConfirmationContainer = GetUANConfirmationPromptContainer({
    NoticeRecordsCount,
    IsLOA,
  });

  const ActionType = IsLOA ? LeaveDataActions.WipeAll : RADataActions.WipeAll;
  const ConfirmationComponents = GetDeleteConfirmationComponents(BtnInteract, `sdm-${ActionType}`);

  const RespMessage = await SendReplyAndFetchMessage(BtnInteract, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(BtnInteract, RespMessage, HandleUANDataWipeAllConfirm, IsLOA);
}

async function HandleUANDataDeletePastConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  IsLOA: boolean
) {
  const Logger = IsLOA ? LeaveDataLogger : RADataLogger;
  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANDeletionInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const DeleteResponse = await UANModel.deleteMany({
    guild: ConfirmInteract.guildId,
    type: NoticeType,
    $or: [
      { status: { $in: ["Cancelled", "Denied"] } },
      { status: "Approved", early_end_date: { $lte: ConfirmInteract.createdAt } },
      { status: "Approved", end_date: { $lte: ConfirmInteract.createdAt } },
    ],
  }).exec();

  if (
    await HandleNoNoticesToTakeActionOn(ConfirmInteract, DeleteResponse.deletedCount, true, IsLOA)
  ) {
    return;
  }

  return Promise.all([
    Logger.LogUserActivityNoticesWipe(
      ConfirmInteract,
      DeleteResponse,
      `Past ${GetUANNoticeTitle(IsLOA, true)} Notices (Finished, Cancelled, Denied)`
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** past records.",
          DeleteResponse.deletedCount
        ),
      ],
    }),
  ]);
}

async function HandleUANDataDeletePast(BtnInteract: ButtonInteraction<"cached">, IsLOA: boolean) {
  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const NoticeRecordsCount = await UANModel.countDocuments({
    guild: BtnInteract.guildId,
    type: NoticeType,
    $or: [
      { status: { $in: ["Cancelled", "Denied"] } },
      { status: "Approved", early_end_date: { $lte: BtnInteract.createdAt } },
      { status: "Approved", end_date: { $lte: BtnInteract.createdAt } },
    ],
  }).exec();

  if ((await HandleNoNoticesToTakeActionOn(BtnInteract, NoticeRecordsCount, false, IsLOA)) === true)
    return;

  const ConfirmationContainer = GetUANConfirmationPromptContainer({
    NoticeRecordsCount,
    RecordsStatus: "past",
    IsLOA,
  });

  const actionType = IsLOA ? LeaveDataActions.DeletePast : RADataActions.DeletePast;
  const ConfirmationComponents = GetDeleteConfirmationComponents(BtnInteract, `sdm-${actionType}`);

  const RespMessage = await SendReplyAndFetchMessage(BtnInteract, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(BtnInteract, RespMessage, HandleUANDataDeletePastConfirm, IsLOA);
}

async function HandleUANDataDeletePendingConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  IsLOA: boolean
) {
  const Logger = IsLOA ? LeaveDataLogger : RADataLogger;
  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANDeletionInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const DeleteResponse = await UANModel.deleteMany({
    guild: ConfirmInteract.guildId,
    type: NoticeType,
    status: "Pending",
    review_date: null,
  }).exec();

  if (
    await HandleNoNoticesToTakeActionOn(ConfirmInteract, DeleteResponse.deletedCount, true, IsLOA)
  ) {
    return;
  }

  return Promise.all([
    Logger.LogUserActivityNoticesWipe(
      ConfirmInteract,
      DeleteResponse,
      `Pending ${GetUANNoticeTitle(IsLOA, true)} Requests`
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** pending notices.",
          DeleteResponse.deletedCount
        ),
      ],
    }),
  ]);
}

async function HandleUANDataDeletePending(
  BtnInteract: ButtonInteraction<"cached">,
  IsLOA: boolean
) {
  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const NoticeRecordsCount = await UANModel.countDocuments({
    guild: BtnInteract.guildId,
    type: NoticeType,
    status: "Pending",
    review_date: null,
  }).exec();

  if ((await HandleNoNoticesToTakeActionOn(BtnInteract, NoticeRecordsCount, false, IsLOA)) === true)
    return;

  const ConfirmationContainer = GetUANConfirmationPromptContainer({
    NoticeRecordsCount,
    RecordsStatus: "pending",
    IsLOA,
  });

  const ActionType = IsLOA ? LeaveDataActions.DeletePending : RADataActions.DeletePending;
  const ConfirmationComponents = GetDeleteConfirmationComponents(BtnInteract, `sdm-${ActionType}`);

  const RespMessage = await SendReplyAndFetchMessage(BtnInteract, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    HandleUANDataDeletePendingConfirm,
    IsLOA
  );
}

async function HandleUANDataDeleteWithDateConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  ComparisonDate: Date,
  ComparisonType: DataDeletionWithDateType,
  QueryFilter: Mongoose.FilterQuery<UserActivityNotice.UserActivityNoticeDocument>,
  IsLOA: boolean,
  NoticeStatuses: string[] = []
) {
  const Logger = IsLOA ? LeaveDataLogger : RADataLogger;
  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANDeletionInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const DeleteResponse = await UANModel.deleteMany(QueryFilter).exec();
  if (
    await HandleNoNoticesToTakeActionOn(ConfirmInteract, DeleteResponse.deletedCount, true, IsLOA)
  ) {
    return;
  }

  Object.assign(DeleteResponse, {
    ...(ComparisonType === "Before"
      ? { recordsBefore: ComparisonDate }
      : { recordsAfter: ComparisonDate }),
  });

  return Promise.all([
    Logger.LogUserActivityNoticesWipe(
      ConfirmInteract,
      DeleteResponse,
      NoticeStatuses.length ? ListFormatter.format(NoticeStatuses) : "N/A"
    ),
    ConfirmInteract.editReply({
      components: [
        new SuccessContainer().setDescription(
          "Successfully deleted **`%d`** %s records.",
          DeleteResponse.deletedCount,
          GetUANShortenedWEName(IsLOA).toLowerCase()
        ),
      ],
    }),
  ]);
}

async function HandleUANDataDeleteBeforeOrAfterDate(
  BtnInteract: ButtonInteraction<"cached">,
  ComparisonType: DataDeletionWithDateType,
  IsLOA: boolean
) {
  const ComparisonDateModal = GetComparisonDateInputModal(
    BtnInteract,
    IsLOA ? "Leave" : "RA",
    ComparisonType
  );

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, ComparisonDateModal);
  const NoticeStatuses: string[] = [];
  const InputDate = ModalSubmission?.fields.getTextInputValue("comp_date").trim();
  const ParsedDate = InputDate ? Chrono.parseDate(InputDate, ModalSubmission?.createdAt) : null;
  const InputNoticeStatus = ModalSubmission?.fields
    .getTextInputValue(IsLOA ? "leave_status" : "ra_status")
    ?.trim();

  if (!ModalSubmission) return;
  if (InputNoticeStatus?.includes(",")) {
    NoticeStatuses.push(...InputNoticeStatus.split(",").map((Status) => Status.trim()));
  } else if (InputNoticeStatus) {
    NoticeStatuses.push(InputNoticeStatus.trim());
  }

  if (InputDate && !ParsedDate) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDateFormat")
      .replyToInteract(ModalSubmission, true, false);
  } else if (InputDate && ParsedDate && isAfter(ParsedDate, ModalSubmission.createdAt)) {
    return new ErrorEmbed()
      .useErrTemplate("DateInFuture")
      .replyToInteract(ModalSubmission, true, false);
  }

  const NoticeType = IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
  const MatchFilter: Mongoose.FilterQuery<UserActivityNotice.UserActivityNoticeDocument> = {
    guild: BtnInteract.guildId,
    type: NoticeType,
  };

  if (NoticeStatuses.length === 1) {
    if (/^(?:Finished|Ended|Over)$/i.exec(NoticeStatuses[0])) {
      Object.assign(MatchFilter, {
        status: "Approved",
        $or: [
          {
            early_end_date:
              ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
          },
          { end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate } },
        ],
      });
    } else if (/^(?:Pending|Cancell?ed)$/i.exec(NoticeStatuses[0])) {
      Object.assign(MatchFilter, {
        status: NoticeStatuses[0].toLowerCase() === "pending" ? "Pending" : "Cancelled",
        request_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
      });
    }
  } else if (NoticeStatuses.length > 1) {
    Object.assign(MatchFilter, {
      status: {
        $in: NoticeStatuses.map((Status) => {
          return Status.charAt(0).toUpperCase() + Status.slice(1).toLowerCase();
        }).map((Status) => (Status.match(/^(?:Finished|Ended|Over)$/i) ? "Approved" : Status)),
      },
      $or: [
        {
          early_end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        { end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate } },
      ],
    });
  } else {
    Object.assign(MatchFilter, {
      $or: [
        {
          status: "Approved",
          early_end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        {
          status: "Approved",
          end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        {
          status: ["Pending", "Cancelled", "Denied"],
          request_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
      ],
    });
  }

  const NoticeRecordsCount = await UANModel.countDocuments(MatchFilter);
  await ModalSubmission.deferUpdate();

  if (
    (await HandleNoNoticesToTakeActionOn(
      BtnInteract,
      NoticeRecordsCount,
      false,
      IsLOA,
      "followUp"
    )) === true
  ) {
    return;
  }

  const ActionType = IsLOA
    ? ComparisonType === "Before"
      ? LeaveDataActions.DeleteBefore
      : LeaveDataActions.DeleteAfter
    : ComparisonType === "Before"
      ? RADataActions.DeleteBefore
      : RADataActions.DeleteAfter;

  const ConfirmationComponents = GetDeleteConfirmationComponents(BtnInteract, `sdm-${ActionType}`);
  const ConfirmationContainer = GetUANConfirmationPromptContainer({
    NoticeRecordsCount,
    RecordsStatus: NoticeStatuses.length ? ListFormatter.format(NoticeStatuses) : undefined,
    AfterDate: ComparisonType === "After" ? ParsedDate : null,
    BeforeDate: ComparisonType === "Before" ? ParsedDate : null,
    IsLOA,
  });

  const RespMessage = await ModalSubmission.followUp({
    flags: MessageFlags.IsComponentsV2,
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    HandleUANDataDeleteWithDateConfirm,
    ParsedDate,
    ComparisonType,
    MatchFilter,
    IsLOA,
    NoticeStatuses
  );
}

async function HandleUserActivityNoticeRecordsManagement(
  SMenuInteract: StringSelectMenuInteraction<"cached">,
  IsLeaveManagement: boolean
) {
  const PanelContainer = GetUANManagementContainer(IsLeaveManagement);
  const ManagementComps = GetUANManagementComponents(SMenuInteract, IsLeaveManagement);
  const ResponeseMessage = await SendReplyAndFetchMessage(SMenuInteract, {
    replyMethod: "update",
    components: [
      PanelContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider()
      ).addActionRowComponents(ManagementComps),
    ],
  });

  const CompActionCollector = ResponeseMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (Interact) => Interact.user.id === SMenuInteract.user.id,
    time: 12 * 60 * 1000,
    idle: 10 * 60 * 1000,
  });

  CompActionCollector.on("collect", async function OnUANBtnInteract(BtnInteract) {
    try {
      const ActionPrefix = GetUANDataActionPrefix(IsLeaveManagement);
      if (BtnInteract.customId.startsWith("sdm-back")) {
        CompActionCollector.stop("BackToMain");
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-wa`)) {
        await HandleUANDataWipeAll(BtnInteract, IsLeaveManagement);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-dpast`)) {
        await HandleUANDataDeletePast(BtnInteract, IsLeaveManagement);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-dpen`)) {
        await HandleUANDataDeletePending(BtnInteract, IsLeaveManagement);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-db`)) {
        await HandleUANDataDeleteBeforeOrAfterDate(BtnInteract, "Before", IsLeaveManagement);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-da`)) {
        await HandleUANDataDeleteBeforeOrAfterDate(BtnInteract, "After", IsLeaveManagement);
      }

      if (!BtnInteract.deferred && !BtnInteract.replied) {
        return BtnInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        label: FileLabel,
        message: `Failed to handle ${IsLeaveManagement ? "leave" : "reduced activity"} data management button interaction;`,
        error_id: ErrorId,
        stack: Err.stack,
      });

      return new ErrorEmbed()
        .useErrTemplate("UnknownError")
        .setDescription("Something went wrong while handling your request.")
        .setErrorId(ErrorId)
        .replyToInteract(BtnInteract, true, true, "reply");
    }
  });

  CompActionCollector.on("end", async function OnUANEnd(Collected, EndReason) {
    if (EndReason.match(/^\w+Delete/)) return;
    if (EndReason === "BackToMain") {
      return Callback(SMenuInteract);
    } else if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SMenuInteract;
      const APICompatibleComps = ResponeseMessage.components.map((Comp) => Comp.toJSON());
      const DisabledComponents = DisableMessageComponents(APICompatibleComps);
      return LastInteract.editReply({
        message: SMenuInteract.message.id,
        components: DisabledComponents,
      });
    }
  });
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
        return HandleShiftRecordsManagement(TopicSelectInteract);
      } else if (SelectedDataTopic === DataCategories.LeaveData) {
        return HandleUserActivityNoticeRecordsManagement(TopicSelectInteract, true);
      } else if (SelectedDataTopic === DataCategories.RAData) {
        return HandleUserActivityNoticeRecordsManagement(TopicSelectInteract, false);
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
        }).then((Resp) => Resp.resource!.message! as Message<true>);

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
