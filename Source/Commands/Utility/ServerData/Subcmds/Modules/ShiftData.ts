import {
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  time as FormatTime,
  ButtonInteraction,
  ActionRowBuilder,
  TextInputBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  TextInputStyle,
  ButtonBuilder,
  ComponentType,
  ModalBuilder,
  LabelBuilder,
  ButtonStyle,
  inlineCode,
} from "discord.js";

import {
  WarnContainer,
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  AwaitDeleteConfirmation,
  SendReplyAndFetchMessage,
  GetDeleteConfirmationComponents,
} from "../Manage.js";

import { Dedent } from "@Utilities/Strings/Formatters.js";
import { Emojis } from "@Config/Shared.js";
import { isAfter } from "date-fns";
import { Shifts } from "@Typings/Utilities/Database.js";
import { InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { FilterQuery } from "mongoose";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import ShiftModel from "@Models/Shift.js";
import * as Chrono from "chrono-node";

import HumanizeDuration from "humanize-duration";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import HandleShiftRoleAssignment from "@Utilities/Discord/HandleShiftRoleAssignment.js";
import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";

// ---------------------------------------------------------------------------------------
// #region - Module Constants, Types, & Enums:
// -------------------------------------------
const FileLabel = "Commands:Utility:ServerDataManage:ShiftData";
const ListFormatter = new Intl.ListFormat("en");
const BaseAccentColor = 0x5f9ea0;

type DataDeletionWithDateType = "Before" | "After";
type StringSelectOrButtonInteract<Cached extends "cached" = "cached"> =
  | StringSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

export enum ShiftDataActions {
  WipeAll = "sd-wa",
  DeletePast = "sd-dp",
  DeleteOfType = "sd-dot",
  DeleteBefore = "sd-db",
  DeleteAfter = "sd-da",
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Component Builders:
// -----------------------------
export function GetShiftDataManagementComponents(
  Interaction: StringSelectOrButtonInteract<"cached">
) {
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

export function GetShiftManagementContainer(): ContainerBuilder {
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

function GetComparisonDateInputModal(
  Interaction: ButtonInteraction<"cached">,
  CDType: DataDeletionWithDateType
) {
  return new ModalBuilder()
    .setTitle(`Delete Shift Records ${CDType} Date`)
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
              "e.g, '2 weeks ago', 'last month', '2023-01-15', 'March 3rd, 2022', 'yesterday', etc..."
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(32)
        ),
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
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Module Helpers:
// -------------------------
async function GetSummarizedShiftInfo(MatchQuery: FilterQuery<Shifts.ShiftDocument>) {
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

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Action Handlers:
// --------------------------
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
  const ComparisonDateModal = GetComparisonDateInputModal(BtnInteract, ComparisonType);
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
    return new ErrorContainer()
      .useErrTemplate("UnknownDateFormat")
      .replyToInteract(ModalSubmission, true, false);
  } else if (InputDate && ParsedDate && isAfter(ParsedDate, ModalSubmission.createdAt)) {
    return new ErrorContainer()
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

// #endregion
// ---------------------------------------------------------------------------------------
// Main Management Handler:
// ------------------------
export async function HandleShiftRecordsManagement(
  SMenuInteract: StringSelectMenuInteraction<"cached">,
  Callback: (Interaction: StringSelectMenuInteraction<"cached">) => Promise<any>
) {
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
        error: Err,
      });

      return new ErrorContainer()
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
