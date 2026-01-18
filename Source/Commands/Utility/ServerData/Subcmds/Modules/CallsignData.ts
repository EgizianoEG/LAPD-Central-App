import {
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  TextDisplayBuilder,
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
} from "#Utilities/Classes/ExtraContainers.js";

import { Dedent } from "#Utilities/Strings/Formatters.js";
import { Emojis } from "#Config/Shared.js";
import { Callsigns } from "#Typings/Utilities/Database.js";
import { FilterQuery } from "mongoose";
import { GenericRequestStatuses } from "#Config/Constants.js";
import { GetErrorId, RandomString } from "#Utilities/Strings/Random.js";
import { AwaitDeleteConfirmation, SendReplyAndFetchMessage } from "../Manage.js";

import AppLogger from "#Utilities/Classes/AppLogger.js";
import CallsignModel from "#Models/Callsign.js";

import MentionCmdByName from "#Utilities/Discord/MentionCmd.js";
import CallsignsEventLogger from "#Source/Utilities/Classes/CallsignsEventLogger.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import HandleCallsignStatusUpdates from "#Source/Utilities/Discord/HandleCallsignStatusUpdates.js";
import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";

// ---------------------------------------------------------------------------------------
// #region - Module Constants, Types, & Enums:
// -------------------------------------------
const FileLabel = "Commands:Utility:ServerDataManage:CallsignData";
const ListFormatter = new Intl.ListFormat("en");
const CallsignsLogger = new CallsignsEventLogger();
const BaseAccentColor = 0x5f9ea0;

type StringSelectOrButtonInteract<Cached extends "cached" = "cached"> =
  | StringSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

export enum CallsignsDataActions {
  WipeAllRecords = "cd-wa",
  ReleaseCallSigns = "cd-rcs",
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Component Builders:
// -----------------------------
function GetConfirmationComponents(
  Interaction: ButtonInteraction<"cached">,
  IsDelete: boolean = true
) {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel(`Confirm and ${IsDelete ? "Delete" : "Release"}`)
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`cdm-confirm:${Interaction.user.id}`),
    new ButtonBuilder()
      .setLabel(`Cancel ${IsDelete ? "Deletion" : "Release"}`)
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`cdm-cancel:${Interaction.user.id}`)
  );
}

function GetCallsignDataManagementComponents(Interaction: StringSelectOrButtonInteract<"cached">) {
  return [
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel("Wipe Call Sign Records")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`cd-${CallsignsDataActions.WipeAllRecords}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Release Call Signs")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`cd-${CallsignsDataActions.ReleaseCallSigns}:${Interaction.user.id}`),
      new ButtonBuilder()
        .setLabel("Back to Categories")
        .setEmoji(Emojis.WhiteBack)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`cdm-back:${Interaction.user.id}`)
    ),
  ];
}

function GetCallsignDataManagementContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(BaseAccentColor)
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: "### Call Sign Data Management",
    })
    .addSeparatorComponents({
      type: ComponentType.Separator,
      spacing: 2,
      divider: true,
    })
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: Dedent(`
        Call sign data consists of records created through the ${MentionCmdByName("callsign request")} and ${MentionCmdByName("callsign admin")} slash commands. \
        These records track call sign requests, approvals, assignments, and their full history. Use the buttons below to manage these records through deletion or release actions.

        **Options Explained:**
        - **Wipe Call Sign Records**  
          Permanently delete call sign records from the database based on the selected filters. You can filter by designation range (division, unit type, beat number) \
          and record status (Pending, Approved, Active, Expired, or Cancelled).
        - **Release Call Signs**  
          Release currently assigned call signs while preserving their history in the database. Released call signs will become available for reassignment to other members. \
          You can also filter by designation range to target specific call signs for release.

        -# This panel will automatically deactivate after 10 minutes of inactivity.
      `),
    });
}

function GetDesignationFilterInputModal(
  Interaction: ButtonInteraction<"cached">,
  ActionType: "Wipe" | "Release"
) {
  const IncludeStatusField = ActionType === "Wipe";
  const ModalDescription = new TextDisplayBuilder().setContent(
    Dedent(`
      Use the fields below to filter which call sign records to ${ActionType === "Wipe" ? "delete" : "release"}. \
      Leaving all fields blank will ${ActionType === "Wipe" ? "delete" : "release"} *all* ${ActionType === "Wipe" ? "call sign records" : "active call signs"} in this server.
    `)
  );

  const ModalInstance = new ModalBuilder()
    .setTitle(`${ActionType} Call Sign Records`)
    .setCustomId(`cdm-${ActionType.toLowerCase()}-input:${Interaction.user.id}:${RandomString(4)}`)
    .addTextDisplayComponents(ModalDescription)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Division Beat Numbers (Optional)")
        .setDescription("Range or list of division beat numbers (e.g., '3-7', '1, 5, 12').")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("division_beats")
            .setPlaceholder("e.g., '1-10', '3, 7, 12'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(24)
        ),
      new LabelBuilder()
        .setLabel("Unit Types (Optional)")
        .setDescription("Comma-separated unit types (e.g., 'A, L, SL').")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("unit_types")
            .setPlaceholder("e.g., 'A, K9, SL, Air'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(42)
        ),
      new LabelBuilder()
        .setLabel("Beat Numbers (Optional)")
        .setDescription("Range(s) for beat numbers (e.g., '400-420', '10-50, 100-150').")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("beat_numbers")
            .setPlaceholder("e.g., '1-99', '400-420, 500-550'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(64)
        )
    );

  if (IncludeStatusField) {
    ModalInstance.addLabelComponents(
      new LabelBuilder()
        .setLabel("Record Status (Optional)")
        .setDescription(
          "Filter by status: Pending, Approved, Active, Assigned, Expired, Cancelled."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("status")
            .setPlaceholder("e.g., 'Expired', 'Pending, Cancelled'...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(32)
        )
    );
  }

  return ModalInstance;
}

function GetCSConfirmationPromptContainer(Opts: {
  RecordsCount: number;
  ActionType: "Wipe" | "Release";
  Statuses?: string[];
}): WarnContainer {
  const { RecordsCount, ActionType, Statuses } = Opts;
  const ActionVerb = ActionType === "Wipe" ? "delete" : "release";
  const StatusText = Statuses?.length
    ? ` with status(es): ${ListFormatter.format(Statuses.map((S) => inlineCode(S)))}`
    : "";

  return new WarnContainer().setTitle("Confirmation Required").setDescription(
    Dedent(`
      **Are you certain you want to ${ActionVerb} ${inlineCode(RecordsCount.toString())} call sign record(s)${StatusText}?**
      ${
        ActionType === "Wipe"
          ? "This will permanently erase these records from the database."
          : "This will release these call signs, making them available for reassignment while preserving their history."
      }

      -# **Note:** This action is ***irreversible***, and ${ActionType === "Wipe" ? "deleted data cannot be restored" : "released call signs cannot be automatically reassigned"} after confirmation. \
      By confirming, you accept full responsibility for this action. This prompt will automatically cancel after five minutes of inactivity.
    `)
  );
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Module Helpers:
// -------------------------
function ParseRangeInput(Input: string): number[] {
  const Numbers: number[] = [];
  const Parts = Input.split(",").map((P) => P.trim());

  for (const Part of Parts) {
    if (Part.includes("-")) {
      const [Start, End] = Part.split("-").map((N) => Number.parseInt(N.trim()));
      if (!Number.isNaN(Start) && !Number.isNaN(End) && Start <= End) {
        for (let i = Start; i <= End; i++) {
          if (!Numbers.includes(i)) Numbers.push(i);
        }
      }
    } else {
      const Num = Number.parseInt(Part);
      if (!Number.isNaN(Num) && !Numbers.includes(Num)) {
        Numbers.push(Num);
      }
    }
  }

  return Numbers.sort((a, b) => a - b);
}

function BuildDesignationFilter(FilterInputs: {
  DivisionBeats?: string;
  UnitTypes?: string;
  BeatNumbers?: string;
}): Record<string, any> {
  const DesignationFilter: Record<string, any> = {};

  if (FilterInputs.DivisionBeats) {
    const Divisions = ParseRangeInput(FilterInputs.DivisionBeats);
    if (Divisions.length) {
      DesignationFilter["designation.division"] = { $in: Divisions };
    }
  }

  if (FilterInputs.UnitTypes) {
    const Units = FilterInputs.UnitTypes.split(",")
      .map((U) => (/Air/i.test(U.trim()) ? "Air" : U.trim().toUpperCase()))
      .filter((U) => U.length > 0);

    if (Units.length) {
      DesignationFilter["designation.unit_type"] = { $in: Units };
    }
  }

  if (FilterInputs.BeatNumbers) {
    const BeatRanges = FilterInputs.BeatNumbers.split(",").map((R) => R.trim());
    const BeatConditions: any[] = [];

    for (const Range of BeatRanges) {
      if (Range.includes("-")) {
        const [Start, End] = Range.split("-").map((N) => N.trim().padStart(2, "0"));
        if (Start && End) {
          BeatConditions.push({
            "designation.beat_num": {
              $gte: Start,
              $lte: End.padStart(Start.length, "0"),
            },
          });
        }
      } else {
        const BeatNum = Range.padStart(2, "0");
        if (BeatNum) {
          BeatConditions.push({ "designation.beat_num": BeatNum });
        }
      }
    }

    if (BeatConditions.length > 1) {
      DesignationFilter.$or = BeatConditions;
    } else if (BeatConditions.length === 1) {
      Object.assign(DesignationFilter, BeatConditions[0]);
    }
  }

  return DesignationFilter;
}

function BuildStatusFilter(
  StatusInput: string,
  InteractionDate: Date
): { filter: Record<string, any>; normalized: string[] } {
  const Statuses = StatusInput.split(",")
    .map((S) => S.trim())
    .filter((S) => S.length > 0);

  const NormalizedStatuses: string[] = [];
  const StatusConditions: FilterQuery<Callsigns.CallsignDocument> = [];

  for (const Status of Statuses) {
    if (/^(?:active|assigned|approved)$/i.test(Status)) {
      NormalizedStatuses.push("Active/Assigned");
      StatusConditions.push({
        request_status: GenericRequestStatuses.Approved,
        $or: [{ expiry: null }, { expiry: { $gt: InteractionDate } }],
      });
    } else if (/^expired$/i.test(Status)) {
      NormalizedStatuses.push("Expired");
      StatusConditions.push({
        request_status: GenericRequestStatuses.Approved,
        expiry: { $lte: InteractionDate },
      });
    } else if (/^pending$/i.test(Status)) {
      NormalizedStatuses.push("Pending");
      StatusConditions.push({
        request_status: GenericRequestStatuses.Pending,
      });
    } else if (/^cancell?ed$/i.test(Status)) {
      NormalizedStatuses.push("Cancelled");
      StatusConditions.push({
        request_status: GenericRequestStatuses.Cancelled,
      });
    }
  }

  const FilterResult: Record<string, any> = {};
  if (StatusConditions.length > 1) {
    FilterResult.$or = StatusConditions;
  } else if (StatusConditions.length === 1) {
    Object.assign(FilterResult, StatusConditions[0]);
  }

  return {
    filter: FilterResult,
    normalized: [...new Set(NormalizedStatuses)],
  };
}

async function HandleNoRecordsToTakeActionOn(
  RecInteract: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  RecordsCount: number,
  ActionType: "Wipe" | "Release"
) {
  if (RecordsCount === 0) {
    const ActionVerb = ActionType === "Wipe" ? "delete" : "release";
    return new InfoContainer()
      .setTitle("No Call Signs Found")
      .setDescription(
        `There are no call sign records found matching the specified filters to ${ActionVerb}.`
      )
      .replyToInteract(RecInteract, true, false)
      .then(() => true);
  }

  return false;
}

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Action Handlers:
// --------------------------
async function HandleCallsignDataWipeConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  MatchFilter: FilterQuery<Callsigns.CallsignDocument>,
  FilterInputs: { div_beats?: string; unit_types?: string; beat_nums?: string },
  Statuses?: string[]
) {
  await new InfoContainer()
    .useInfoTemplate("CallsignRecordsDeletionInProgress")
    .replyToInteract(ConfirmInteract, true, true, "update");

  const DeleteResponse = await CallsignModel.deleteMany(MatchFilter).exec();
  if (DeleteResponse.deletedCount === 0) {
    return ConfirmInteract.editReply({
      components: [
        new InfoContainer()
          .setTitle("Call Sign Not Found")
          .setDescription("No call sign records were found that needed to be deleted."),
      ],
    });
  }

  await CallsignsLogger.LogBulkCallsignWipe(
    ConfirmInteract,
    DeleteResponse.deletedCount,
    FilterInputs,
    Statuses
  );

  return ConfirmInteract.editReply({
    components: [
      new SuccessContainer().setDescription(
        "Successfully deleted **`%d`** call sign record(s) from the database. The action has been logged.",
        DeleteResponse.deletedCount
      ),
    ],
  });
}

async function HandleCallsignDataWipe(BtnInteract: ButtonInteraction<"cached">) {
  const FilterModal = GetDesignationFilterInputModal(BtnInteract, "Wipe");
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, FilterModal);
  if (!ModalSubmission) return;

  const DivisionBeatsInput = ModalSubmission.fields.getTextInputValue("division_beats")?.trim();
  const UnitTypesInput = ModalSubmission.fields.getTextInputValue("unit_types")?.trim();
  const BeatNumbersInput = ModalSubmission.fields.getTextInputValue("beat_numbers")?.trim();
  const StatusInput = ModalSubmission.fields.getTextInputValue("status")?.trim();

  const MatchFilter: FilterQuery<Callsigns.CallsignDocument> = {
    guild: BtnInteract.guildId,
  };

  const DesignationFilter = BuildDesignationFilter({
    DivisionBeats: DivisionBeatsInput,
    BeatNumbers: BeatNumbersInput,
    UnitTypes: UnitTypesInput,
  });

  Object.assign(MatchFilter, DesignationFilter);
  let NormalizedStatuses: string[] = [];

  if (StatusInput) {
    const StatusFilter = BuildStatusFilter(StatusInput, ModalSubmission.createdAt);
    Object.assign(MatchFilter, StatusFilter.filter);
    NormalizedStatuses = StatusFilter.normalized;
  }

  const RecordsCount = await CallsignModel.countDocuments(MatchFilter).exec();
  if (await HandleNoRecordsToTakeActionOn(ModalSubmission, RecordsCount, "Wipe")) return;

  const FilterInputs = {
    div_beats: DivisionBeatsInput,
    unit_types: UnitTypesInput,
    beat_nums: BeatNumbersInput,
  };

  const ConfirmationContainer = GetCSConfirmationPromptContainer({
    RecordsCount,
    ActionType: "Wipe",
    Statuses: NormalizedStatuses.length ? NormalizedStatuses : undefined,
  });

  const ConfirmationComponents = GetConfirmationComponents(BtnInteract, true);
  const RespMessage = await SendReplyAndFetchMessage(ModalSubmission, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    (Interact, Filter) =>
      HandleCallsignDataWipeConfirm(
        Interact,
        Filter,
        FilterInputs,
        NormalizedStatuses.length ? NormalizedStatuses : undefined
      ),
    MatchFilter
  );
}

async function HandleCallsignDataReleaseConfirm(
  ConfirmInteract: ButtonInteraction<"cached">,
  MatchFilter: FilterQuery<Callsigns.CallsignDocument>,
  FilterInputs: { div_beats?: string; unit_types?: string; beat_nums?: string }
) {
  await new InfoContainer()
    .useInfoTemplate("CallsignRecordsReleaseInProgress")
    .replyToInteract(ConfirmInteract, true, true, "update");

  const CallsignsToRelease = await CallsignModel.find(MatchFilter).exec();
  const UpdatedCallsigns = await CallsignModel.updateMany(
    { _id: { $in: CallsignsToRelease.map((CS) => CS._id) } },
    {
      expiry: ConfirmInteract.createdAt,
      expiry_notified: true,
    }
  ).exec();

  if (UpdatedCallsigns.modifiedCount === 0) {
    return ConfirmInteract.editReply({
      components: [
        new InfoContainer()
          .setTitle("No Call Signs Found")
          .setDescription("No active call signs were found that needed to be released."),
      ],
    });
  }

  await Promise.allSettled([
    CallsignsLogger.LogBulkAdministrativeRelease(ConfirmInteract, CallsignsToRelease, FilterInputs),
    HandleCallsignStatusUpdates(
      ConfirmInteract.client,
      CallsignsToRelease.map((CS) => ({
        ...CS.toObject(),
        expiry: ConfirmInteract.createdAt,
        expiry_notified: true,
      }))
    ),
  ]);

  const AffectedMembers = new Set(CallsignsToRelease.map((CS) => CS.requester));
  return ConfirmInteract.editReply({
    components: [
      new SuccessContainer().setDescription(
        "Successfully released **`%d`** call sign(s) from **`%d`** member(s).\n%s %s",
        UpdatedCallsigns.modifiedCount,
        AffectedMembers.size,
        "The action has been logged and member nicknames will be updated shortly.",
        "Keep in mind that DM notifications were not sent for this operation and you may need to notify affected members manually."
      ),
    ],
  });
}

async function HandleCallsignDataRelease(BtnInteract: ButtonInteraction<"cached">) {
  const FilterModal = GetDesignationFilterInputModal(BtnInteract, "Release");
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, FilterModal);
  if (!ModalSubmission) return;

  const DivisionBeatsInput = ModalSubmission.fields.getTextInputValue("division_beats");
  const UnitTypesInput = ModalSubmission.fields.getTextInputValue("unit_types");
  const BeatNumbersInput = ModalSubmission.fields.getTextInputValue("beat_numbers");

  const MatchFilter: FilterQuery<Callsigns.CallsignDocument> = {
    guild: BtnInteract.guildId,
    request_status: GenericRequestStatuses.Approved,
    $or: [{ expiry: null }, { expiry: { $gt: ModalSubmission.createdAt } }],
  };

  const DesignationFilter = BuildDesignationFilter({
    DivisionBeats: DivisionBeatsInput,
    BeatNumbers: BeatNumbersInput,
    UnitTypes: UnitTypesInput,
  });

  const FilterInputs = {
    div_beats: DivisionBeatsInput,
    unit_types: UnitTypesInput,
    beat_nums: BeatNumbersInput,
  };

  Object.assign(MatchFilter, DesignationFilter);
  const RecordsCount = await CallsignModel.countDocuments(MatchFilter).exec();
  if (await HandleNoRecordsToTakeActionOn(ModalSubmission, RecordsCount, "Release")) return;

  const ConfirmationContainer = GetCSConfirmationPromptContainer({
    ActionType: "Release",
    RecordsCount,
  });

  const ConfirmationComponents = GetConfirmationComponents(BtnInteract, false);
  const RespMessage = await SendReplyAndFetchMessage(ModalSubmission, {
    components: [ConfirmationContainer.attachPromptActionRows(ConfirmationComponents)],
  });

  return AwaitDeleteConfirmation(
    BtnInteract,
    RespMessage,
    (Interact, Filter) => HandleCallsignDataReleaseConfirm(Interact, Filter, FilterInputs),
    MatchFilter
  );
}

// #endregion
// ---------------------------------------------------------------------------------------
// Main Management Handler:
// ------------------------
export async function HandleCallsignRecordsManagement(
  SMenuInteract: StringSelectMenuInteraction<"cached">,
  Callback: (Interaction: StringSelectMenuInteraction<"cached">) => Promise<any>
) {
  const PanelContainer = GetCallsignDataManagementContainer();
  const ManagementComps = GetCallsignDataManagementComponents(SMenuInteract);
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

  CompActionCollector.on("collect", async function OnCDMBtnInteract(BtnInteract) {
    try {
      if (BtnInteract.customId.startsWith("cdm-back")) {
        CompActionCollector.stop("BackToMain");
      } else if (BtnInteract.customId.includes(CallsignsDataActions.WipeAllRecords)) {
        await HandleCallsignDataWipe(BtnInteract);
      } else if (BtnInteract.customId.includes(CallsignsDataActions.ReleaseCallSigns)) {
        await HandleCallsignDataRelease(BtnInteract);
      }

      if (!BtnInteract.deferred && !BtnInteract.replied) {
        return BtnInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        label: FileLabel,
        message: "Failed to handle callsign data management button interaction;",
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

  CompActionCollector.on("end", async function OnCDMEnd(Collected, EndReason) {
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
