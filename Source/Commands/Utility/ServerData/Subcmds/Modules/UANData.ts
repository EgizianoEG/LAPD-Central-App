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
  MessageFlags,
  LabelBuilder,
  ButtonStyle,
} from "discord.js";

import {
  LeaveOfAbsenceEventLogger,
  ReducedActivityEventLogger,
} from "@Utilities/Classes/UANEventLogger.js";

import {
  WarnContainer,
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  GetDeleteConfirmationComponents,
  SendReplyAndFetchMessage,
  AwaitDeleteConfirmation,
} from "../Manage.js";

import { Dedent } from "@Utilities/Strings/Formatters.js";
import { Emojis } from "@Config/Shared.js";
import { isAfter } from "date-fns";
import { FilterQuery } from "mongoose";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";
import { GenericRequestStatuses as GRStatuses } from "@Source/Config/Constants.js";

import UANModel from "@Models/UserActivityNotice.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import * as Chrono from "chrono-node";

import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleUserActivityNoticeUpdate from "@Utilities/Discord/HandleUANUpdate.js";

// ---------------------------------------------------------------------------------------
// #region - Module Constants, Types, & Enums:
// -------------------------------------------
const FileLabel = "Commands:Utility:ServerDataManage:UANData";
const ListFormatter = new Intl.ListFormat("en");
const BaseAccentColor = 0x5f9ea0;
const LeaveDataLogger = new LeaveOfAbsenceEventLogger();
const RADataLogger = new ReducedActivityEventLogger();

type DataDeletionWithDateType = "Before" | "After";
type StringSelectOrButtonInteract<Cached extends "cached" = "cached"> =
  | StringSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

export enum LeaveDataActions {
  WipeAll = "ld-wa",
  DeletePast = "ld-dpast",
  DeletePending = "ld-dpen",
  DeleteBefore = "ld-db",
  DeleteAfter = "ld-da",
}

export enum RADataActions {
  WipeAll = "rad-wa",
  DeletePast = "rad-dpast",
  DeletePending = "rad-dpen",
  DeleteBefore = "rad-db",
  DeleteAfter = "rad-da",
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Fromatting Helpers:
// -----------------------------
const GetUANShortenedName = (IsLOA: boolean) => (IsLOA ? "Leave" : "RA");
const GetUANShortenedWEName = (IsLOA: boolean) => (IsLOA ? "Leave" : "Reduced Activity");
const GetUANDataActionPrefix = (IsLOA: boolean) => (IsLOA ? "ld" : "rad");
const GetUANNoticeTitle = (IsLOA: boolean, TitleCase?: boolean) =>
  IsLOA ? `Leave of ${TitleCase ? "A" : "a"}bsence` : `Reduced ${TitleCase ? "A" : "a"}ctivity`;
const GetUANNoticeType = (IsLOA: boolean): "LeaveOfAbsence" | "ReducedActivity" =>
  IsLOA ? "LeaveOfAbsence" : "ReducedActivity";
const GetUANLogger = (IsLOA: boolean) => (IsLOA ? LeaveDataLogger : RADataLogger);

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Component Builders:
// -----------------------------
export function GetUANManagementComponents(
  Interaction: StringSelectOrButtonInteract<"cached">,
  IsLOA: boolean
) {
  const ActionPrefix = `sdm-${GetUANDataActionPrefix(IsLOA)}`;
  return [
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel(`Wipe All ${GetUANShortenedName(IsLOA)} Records`)
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`${ActionPrefix}-wa:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Pending Requests")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`${ActionPrefix}-dpen:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Past Records")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`${ActionPrefix}-dpast:${Interaction.user.id}`)
    ),
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel("Delete Records Before Date")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false)
        .setCustomId(`${ActionPrefix}-db:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Delete Records After Date")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false)
        .setCustomId(`${ActionPrefix}-da:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Back")
        .setEmoji(Emojis.WhiteBack)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`sdm-back:${Interaction.user.id}`)
    ),
  ];
}

export function GetUANManagementContainer(IsLOA: boolean): ContainerBuilder {
  const LeaveOrRA = IsLOA ? "leave" : "reduced activity";
  const CmdName = IsLOA ? "loa" : "ra";

  return new ContainerBuilder()
    .setAccentColor(BaseAccentColor)
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: `### ${GetUANNoticeTitle(IsLOA, true)} Data Management`,
    })
    .addSeparatorComponents({
      type: ComponentType.Separator,
      spacing: 2,
      divider: true,
    })
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: Dedent(`
        ${GetUANNoticeTitle(IsLOA)} data consists of a set of records, each of which was created upon a staff member's request using the \
        ${MentionCmdByName(`${CmdName} request`)} or the administrative slash command. This panel provides the ability to delete a set of records \
        based on status or time frame. Use the buttons below to take action on a specific set of records.

        **Options Described:**
        - **Wipe All Records**
          Delete *all* ${LeaveOrRA} records, including active, pending, finished, and cancelled ones.
        - **Delete Pending Notices**
          Delete pending requests that have not yet been reviewed, approved, or denied by management.
        - **Delete Past Records**
          This option will delete only ${LeaveOrRA} records that are no longer active and not in a pending state. Only finished and cancelled ones will be affected.
        - **Delete Records Before/Since Date**
          Delete ${LeaveOrRA} records based on a specific date, before or after it. The end date is used for approved notices, while the request date is used \
          for pending, cancelled, or denied records. You can optionally specify which status(es) to target.
        
        -# This panel will automatically deactivate after 10 minutes of inactivity.
      `),
    });
}

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
      **Are you certain you want to delete ___${NoticeStatusText.toLowerCase()}___ ${NoticeType} records${RecordedBeforeAfterText}?** This \
      will permanently erase \`${NoticeRecordsCount}\` ${NoticeType} records.

      -# **Note:** This action is ***irreversible***, and data deleted cannot be restored after confirmation. \
      By confirming, you accept full responsibility for this action. \
      This prompt will automatically cancel after five minutes of inactivity.
    `)
  );
}

function GetComparisonDateInputModal(
  Interaction: ButtonInteraction<"cached">,
  CDType: DataDeletionWithDateType,
  IsLOA: boolean
) {
  const NoticeShortName = GetUANShortenedName(IsLOA);
  const StatusFieldId = IsLOA ? "leave_status" : "ra_status";

  return new ModalBuilder()
    .setTitle(`Delete ${NoticeShortName} Records ${CDType} Date`)
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
              "e.g., '2 weeks ago', 'last month', '2023-01-15', 'March 3rd, 2022', 'yesterday', etc..."
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(32)
        ),
      new LabelBuilder()
        .setLabel(`${NoticeShortName} Status`)
        .setDescription(
          "Optional notice status to delete records of. Can be 'Pending', 'Cancelled', 'Active', or 'Ended'."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(StatusFieldId)
            .setPlaceholder("e.g., 'Cancelled'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(4)
            .setMaxLength(32)
        )
    );
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Module Helpers:
// -------------------------
async function HandleNoNoticesToTakeActionOn(
  RecInteract: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  RecordsCount: number,
  InPastForm: boolean = true,
  IsLOA: boolean = true,
  RecReplyMethod?: "reply" | "editReply" | "update" | "followUp"
) {
  if (RecordsCount === 0) {
    return new InfoContainer()
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

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Action Handlers:
// -------------------------
async function HandleUANDataWipeAllConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  IsLOA: boolean
) {
  const Logger = GetUANLogger(IsLOA);
  const NoticeType = GetUANNoticeType(IsLOA);

  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANWipeAllInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

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
  const NoticeType = GetUANNoticeType(IsLOA);
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
  const Logger = GetUANLogger(IsLOA);
  const NoticeType = GetUANNoticeType(IsLOA);

  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANDeletionInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const DeleteResponse = await UANModel.deleteMany({
    guild: ConfirmInteract.guildId,
    type: NoticeType,
    $or: [
      { status: { $in: [GRStatuses.Cancelled, GRStatuses.Denied] } },
      {
        status: GRStatuses.Approved,
        early_end_date: { $lte: ConfirmInteract.createdAt },
      },
      { status: GRStatuses.Approved, end_date: { $lte: ConfirmInteract.createdAt } },
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
  const NoticeType = GetUANNoticeType(IsLOA);
  const NoticeRecordsCount = await UANModel.countDocuments({
    guild: BtnInteract.guildId,
    type: NoticeType,
    $or: [
      { status: { $in: [GRStatuses.Cancelled, GRStatuses.Denied] } },
      { status: GRStatuses.Approved, early_end_date: { $lte: BtnInteract.createdAt } },
      { status: GRStatuses.Approved, end_date: { $lte: BtnInteract.createdAt } },
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
  const Logger = GetUANLogger(IsLOA);
  const NoticeType = GetUANNoticeType(IsLOA);

  await ConfirmInteract.update({
    components: [
      new InfoContainer().useInfoTemplate("UANDeletionInProgress", GetUANShortenedName(IsLOA)),
    ],
  });

  const DeleteResponse = await UANModel.deleteMany({
    guild: ConfirmInteract.guildId,
    type: NoticeType,
    status: GRStatuses.Pending,
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
  const NoticeType = GetUANNoticeType(IsLOA);
  const NoticeRecordsCount = await UANModel.countDocuments({
    guild: BtnInteract.guildId,
    type: NoticeType,
    status: GRStatuses.Pending,
    review_date: null,
  }).exec();

  if ((await HandleNoNoticesToTakeActionOn(BtnInteract, NoticeRecordsCount, false, IsLOA)) === true)
    return;

  const ConfirmationContainer = GetUANConfirmationPromptContainer({
    NoticeRecordsCount,
    RecordsStatus: GRStatuses.Pending,
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
  QueryFilter: FilterQuery<UserActivityNotice.UserActivityNoticeDocument>,
  IsLOA: boolean,
  NoticeStatuses: string[] = []
) {
  const Logger = GetUANLogger(IsLOA);

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
  const ComparisonDateModal = GetComparisonDateInputModal(BtnInteract, ComparisonType, IsLOA);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, ComparisonDateModal);
  const NoticeStatuses: string[] = [];
  const InputDate = ModalSubmission?.fields.getTextInputValue("comp_date").trim();
  const ParsedDate = InputDate ? Chrono.parseDate(InputDate, ModalSubmission?.createdAt) : null;
  const StatusFieldId = IsLOA ? "leave_status" : "ra_status";
  const InputNoticeStatus = ModalSubmission?.fields.getTextInputValue(StatusFieldId)?.trim();

  if (!ModalSubmission) return;
  if (InputNoticeStatus?.includes(",")) {
    NoticeStatuses.push(...InputNoticeStatus.split(",").map((Status) => Status.trim()));
  } else if (InputNoticeStatus) {
    NoticeStatuses.push(InputNoticeStatus.trim());
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

  const NoticeType = GetUANNoticeType(IsLOA);
  const MatchFilter: FilterQuery<UserActivityNotice.UserActivityNoticeDocument> = {
    guild: BtnInteract.guildId,
    type: NoticeType,
  };

  if (NoticeStatuses.length === 1) {
    if (/^(?:Finished|Ended|Over)$/i.exec(NoticeStatuses[0])) {
      Object.assign(MatchFilter, {
        status: GRStatuses.Approved,
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
        status:
          NoticeStatuses[0].toLowerCase() === GRStatuses.Pending
            ? GRStatuses.Pending
            : GRStatuses.Cancelled,
        request_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
      });
    }
  } else if (NoticeStatuses.length > 1) {
    const NormalizedStatuses = NoticeStatuses.map((Status) => {
      return Status.charAt(0).toUpperCase() + Status.slice(1).toLowerCase();
    }).map((Status) => (Status.match(/^(?:Finished|Ended|Over)$/i) ? GRStatuses.Approved : Status));

    const HasApproved = NormalizedStatuses.includes(GRStatuses.Approved);
    const OtherStatuses = NormalizedStatuses.filter((S) => S !== GRStatuses.Approved);

    const OrConditions: any[] = [];

    if (HasApproved) {
      OrConditions.push(
        {
          status: GRStatuses.Approved,
          early_end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        {
          status: GRStatuses.Approved,
          end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        }
      );
    }

    if (OtherStatuses.length > 0) {
      OrConditions.push({
        status: { $in: OtherStatuses },
        request_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
      });
    }

    Object.assign(MatchFilter, { $or: OrConditions });
  } else {
    Object.assign(MatchFilter, {
      $or: [
        {
          status: GRStatuses.Approved,
          early_end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        {
          status: GRStatuses.Approved,
          end_date: ComparisonType === "Before" ? { $lte: ParsedDate } : { $gte: ParsedDate },
        },
        {
          status: {
            $in: [GRStatuses.Pending, GRStatuses.Cancelled, GRStatuses.Denied],
          },
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

// #endregion
// ---------------------------------------------------------------------------------------
// Main Management Handler:
// ------------------------
export async function HandleUserActivityNoticeRecordsManagement(
  SMenuInteract: StringSelectMenuInteraction<"cached">,
  Callback: (Interaction: StringSelectMenuInteraction<"cached">) => Promise<any>,
  IsLOA: boolean
) {
  const PanelContainer = GetUANManagementContainer(IsLOA);
  const ManagementComps = GetUANManagementComponents(SMenuInteract, IsLOA);
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

  const ActionPrefix = GetUANDataActionPrefix(IsLOA);

  CompActionCollector.on("collect", async function OnUANBtnInteract(BtnInteract) {
    try {
      if (BtnInteract.customId.startsWith("sdm-back")) {
        CompActionCollector.stop("BackToMain");
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-wa`)) {
        await HandleUANDataWipeAll(BtnInteract, IsLOA);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-dpast`)) {
        await HandleUANDataDeletePast(BtnInteract, IsLOA);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-dpen`)) {
        await HandleUANDataDeletePending(BtnInteract, IsLOA);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-db`)) {
        await HandleUANDataDeleteBeforeOrAfterDate(BtnInteract, "Before", IsLOA);
      } else if (BtnInteract.customId.includes(`${ActionPrefix}-da`)) {
        await HandleUANDataDeleteBeforeOrAfterDate(BtnInteract, "After", IsLOA);
      }

      if (!BtnInteract.deferred && !BtnInteract.replied) {
        return BtnInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        label: FileLabel,
        message: `Failed to handle ${IsLOA ? "leave" : "reduced activity"} data management button interaction;`,
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
