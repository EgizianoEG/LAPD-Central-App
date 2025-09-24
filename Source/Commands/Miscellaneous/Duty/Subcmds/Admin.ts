/* eslint-disable sonarjs/no-duplicate-string */
import {
  MessageActionRowComponentBuilder,
  SlashCommandSubcommandBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  MessageComponentInteraction,
  StringSelectMenuBuilder,
  ModalSubmitInteraction,
  RepliableInteraction,
  time as FormatTime,
  TextDisplayBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  ContainerBuilder,
  TextInputBuilder,
  SeparatorBuilder,
  DiscordAPIError,
  TextInputStyle,
  ButtonBuilder,
  ComponentType,
  ModalBuilder,
  MessageFlags,
  resolveColor,
  ButtonStyle,
  channelLink,
  inlineCode,
  Message,
  User,
} from "discord.js";

import {
  SuccessContainer,
  InfoContainer,
  WarnContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import { Shifts } from "@Typings/Utilities/Database.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { milliseconds } from "date-fns";
import { RandomString } from "@Utilities/Strings/Random.js";
import { IsValidShiftId } from "@Utilities/Helpers/Validators.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { RootFilterQuery } from "mongoose";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { HandleShiftTypeValidation } from "@Utilities/Database/ShiftTypeValidators.js";

import ShiftModel, { ShiftFlags } from "@Models/Shift.js";
import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleCollectorFiltering from "@Utilities/Discord/HandleCollectorFilter.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import QueryUserShiftRecords from "@Utilities/Database/QueryUserShiftRecords.js";
import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";
import HandleRoleAssignment from "@Utilities/Discord/HandleShiftRoleAssignment.js";
import GetMainShiftsData from "@Utilities/Database/GetShiftsData.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import GetShiftActive from "@Utilities/Database/GetShiftActive.js";
import ParseDuration from "parse-duration";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Chunks from "@Utilities/Helpers/SliceIntoChunks.js";
import Dedent from "dedent";

const FileLabel = "Commands:Miscellaneous:Duty:Admin";
const TimeModPlaceholders = [
  "E.g., 1 hour, and 34 minutes...",
  "E.g., 80 minutes and 30 seconds...",
  "E.g., 45 minutes",
  "E.g., 3hrs, 15m",
  "E.g., 2hrs",
];

enum ShiftModActions {
  TimeSet = "set",
  TimeAdd = "add",
  TimeSub = "sub",
  TimeReset = "reset",
}

// ---------------------------------------------------------------------------------------
// Component Generators:
// ---------------------
/**
 * Generates two rows of action buttons for shift administration.
 * @param ShiftActive - Indicates whether a shift is currently active. Can be a hydrated shift document, a boolean, or null.
 * @param Interaction - The interaction object, either a `SlashCommandInteraction` or `ButtonInteraction`.
 * @returns An array containing two `ActionRowBuilder` instances, each populated
 *          with `ButtonBuilder` components for various shift administration actions.
 */
function GetShiftAdminButtonsRows(
  ShiftActive: Shifts.HydratedShiftDocument | boolean | null,
  Interaction: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  TargetUser: User
) {
  const IsMemberInGuild = Interaction.guild.members.cache.has(TargetUser.id);
  const ActionRowOne = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("da-list")
      .setLabel("List")
      .setEmoji(Emojis.HamburgerList)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("da-modify")
      .setLabel("Modify")
      .setEmoji(Emojis.FileEdit)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("da-wipe")
      .setLabel("Wipe Shifts")
      .setDisabled(false)
      .setEmoji(Emojis.Trash)
      .setStyle(ButtonStyle.Danger)
  ) as ActionRowBuilder<ButtonBuilder & { data: { custom_id: string } }>;

  const ActionRowTwo = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("da-create")
      .setLabel("Create Shift")
      .setEmoji(Emojis.WhitePlus)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!IsMemberInGuild),
    new ButtonBuilder()
      .setCustomId("da-end")
      .setLabel("End")
      .setDisabled(!ShiftActive)
      .setEmoji(Emojis.TimeClockOut)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("da-delete")
      .setLabel("Delete")
      .setEmoji(Emojis.FileDelete)
      .setStyle(ButtonStyle.Danger)
  ) as ActionRowBuilder<ButtonBuilder & { data: { custom_id: string } }>;

  ActionRowOne.components.forEach((Comp) =>
    Comp.setCustomId(`${Comp.data.custom_id}:${Interaction.user.id}`)
  );

  ActionRowTwo.components.forEach((Comp) =>
    Comp.setCustomId(`${Comp.data.custom_id}:${Interaction.user.id}`)
  );

  return [ActionRowOne, ActionRowTwo];
}

/**
 * Generates a modal for modifying shift time with options to add, subtract, or set the time.
 * @param ActionType - The type of action to perform on the shift time. Can be "Add", "Subtract", or "Set".
 * @param AdminInteract - The interaction object representing the admin's selection menu interaction.
 * @param ShiftDocument - The document containing shift details, including the current on-duty duration.
 * @returns A `ModalBuilder` instance configured for shift time modification.
 */
function GetTimeModificationModal(
  ActionType: "Add" | "Subtract" | "Set",
  AdminInteract: StringSelectMenuInteraction<"cached">,
  ShiftDocument: Shifts.HydratedShiftDocument
) {
  const TimeModificationModal = new ModalBuilder()
    .setCustomId(`da-time-mod:${AdminInteract.user.id}:${RandomString(4)}`)
    .setTitle("Shift Time Modification")
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("da-st-mod-input")
          .setLabel(`Shift Time To ${ActionType}`)
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(50)
          .setPlaceholder(
            TimeModPlaceholders[Math.floor(Math.random() * TimeModPlaceholders.length)]
          )
      )
    );

  if (ActionType === "Set") {
    const PrefilledInput = ReadableDuration(ShiftDocument.durations.on_duty);
    if (PrefilledInput.length <= 50) {
      TimeModificationModal.components[0].components[0].setValue(
        ReadableDuration(ShiftDocument.durations.on_duty)
      );
    }
  }

  return TimeModificationModal;
}

/**
 * Generates a modal for creating an administrative shift.
 * @param AdminInteract - The button interaction initiated by the admin user.
 * @param ShiftType - The type of shift to prefill in the modal (optional).
 * @returns A configured `ModalBuilder` instance for the shift creation process.
 */
function GetShiftCreationModal(
  AdminInteract: ButtonInteraction<"cached">,
  ShiftType: Nullable<string>
) {
  return new ModalBuilder()
    .setCustomId(`da-create-shift:${AdminInteract.user.id}:${RandomString(4)}`)
    .setTitle("Create Administrative Shift")
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("shift-duration")
          .setLabel("Shift Duration")
          .setPlaceholder("The on-duty duration of the shift to set...")
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(50)
          .setRequired(true)
          .setPlaceholder(
            TimeModPlaceholders[Math.floor(Math.random() * TimeModPlaceholders.length)]
          )
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("shift-type")
          .setLabel("Shift Type")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("The shift type to use...")
          .setValue(ShiftType ?? "Default")
          .setMinLength(3)
          .setMaxLength(20)
          .setRequired(true)
      )
    );
}

/**
 * Generates a Discord ActionRow with a StringSelectMenu for shift modifications.
 * @param Interact - The button interaction that triggered this menu.
 * @param ShiftDocument - The shift document to be modified.
 * @returns A Discord ActionRow containing a StringSelectMenu with shift modification options
 */
function GetShiftModificationsPromptMenu(
  Interact: RepliableInteraction<"cached">,
  ShiftDocument: Shifts.ShiftDocument
) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`da-modify-actions:${Interact.user.id}:${ShiftDocument._id}`)
      .setPlaceholder("Select an action")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Add Time")
          .setEmoji(Emojis.ClockPlus)
          .setValue(ShiftModActions.TimeAdd)
          .setDescription("Add extra on duty time to the shift."),
        new StringSelectMenuOptionBuilder()
          .setValue("sub")
          .setLabel("Subtract Time")
          .setEmoji(Emojis.ClockMinus)
          .setValue(ShiftModActions.TimeSub)
          .setDescription("Subtract and remove on duty time from the shift."),
        new StringSelectMenuOptionBuilder()
          .setValue("set")
          .setLabel("Set Time")
          .setEmoji(Emojis.ClockSet)
          .setValue(ShiftModActions.TimeSet)
          .setDescription("Set the shift's on-duty time, disregarding the current time."),
        new StringSelectMenuOptionBuilder()
          .setValue("reset")
          .setLabel("Reset Time")
          .setEmoji(Emojis.ClockReset)
          .setValue(ShiftModActions.TimeReset)
          .setDescription("Reset the shift's on-duty time as if it had just begun.")
      )
  );
}

function GetCurrentLastSMButtonsActionRow(
  AdminInteract: RepliableInteraction<"cached">,
  CurrentOrLast: "Current" | "Last"
) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`da-modify-${CurrentOrLast.toLowerCase()}:${AdminInteract.user.id}`)
      .setLabel(`Select ${CurrentOrLast} Shift`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`da-modify-id:${AdminInteract.user.id}`)
      .setLabel("Select By Shift ID")
      .setStyle(ButtonStyle.Secondary)
  );
}

function GetShiftIdModInputModal(AdminInteract: RepliableInteraction<"cached">) {
  return new ModalBuilder()
    .setTitle("Shift Modification")
    .setCustomId(`da-modify-id-getter:${AdminInteract.user.id}:${RandomString(4)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setLabel("Shift ID")
          .setPlaceholder("Please fill in the 15-character numeric shift id.")
          .setCustomId("da-modify-id")
          .setRequired(true)
          .setMinLength(15)
          .setMaxLength(15)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function GetShiftIdDeletionInputModal(AdminInteract: RepliableInteraction<"cached">) {
  return new ModalBuilder()
    .setTitle("Shift Deletion")
    .setCustomId(`da-delete-shift:${AdminInteract.user.id}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Enter the desired shift's ID to delete here...")
          .setCustomId("da-shift-id")
          .setLabel("Shift ID")
          .setMaxLength(15)
          .setMinLength(15)
          .setRequired(true)
      )
    );
}

/**
 * Creates a predefined prompt container with a minimalistic design.
 * @param Title - The title to display in the prompt container.
 * @param Description - The description text to display in the prompt container.
 * @param PromptActionRow - An action row containing components to be added to the container.
 * @returns A `ContainerBuilder` instance configured with the provided content.
 */
function GetMiniPredefinedPrompt(
  Title: string,
  Description: string,
  PromptActionRow: ActionRowBuilder<MessageActionRowComponentBuilder>
) {
  return new ContainerBuilder()
    .setAccentColor(resolveColor(Colors.Greyple))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${Title}\n${Description}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addActionRowComponents(PromptActionRow);
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Handles exceptions that occur during the modification of shift times.
 * @param Interact - The interaction object, which can be either a `StringSelectMenuInteraction` or `ModalSubmitInteraction` with a cached state.
 * @param ShiftDoc - The shift document associated with the operation, represented as a hydrated shift document.
 * @param Err - The error object that was thrown during the operation. Can be of any type.
 * @remarks
 * - If the error is an instance of `AppError` and is marked as showable, it will be displayed to the user via an error embed.
 * - For other errors, a generic error embed will be sent to the user, and the error details will be logged for future reference.
 *
 * @throws This function does not throw errors but logs them and replies to the interaction with an appropriate error message.
 */
async function HandleShiftTimeModExceptions(
  Interact: StringSelectMenuInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  ShiftDoc: Shifts.HydratedShiftDocument,
  Err: any
) {
  if (Err instanceof AppError && Err.is_showable) {
    return new ErrorEmbed().useErrClass(Err).replyToInteract(Interact, true);
  }

  await new ErrorEmbed().useErrTemplate("AppError").replyToInteract(Interact, true);
  AppLogger.error({
    label: FileLabel,
    message: "Failed to modify shift time;",
    shift: ShiftDoc.toObject({ getters: true }),
    stack: Err.stack,
  });
}

/**
 * Handles the reset of a shift's on-duty time for administrative purposes.
 * @param AdminInteract - The interaction object representing the admin's selection menu interaction.
 * @param ShiftDocument - The document representing the shift to be modified.
 * @returns A promise that resolves when all operations (logging and user feedback) are settled.
 *          If an error occurs, it delegates to the exception handler for shift time modifications.
 */
async function HandleShiftTimeReset(
  AdminInteract: StringSelectMenuInteraction<"cached">,
  ShiftDocument: Shifts.HydratedShiftDocument
) {
  try {
    const UpdatedDoc = await ShiftDocument.resetOnDutyTime(AdminInteract.createdTimestamp);
    return Promise.allSettled([
      ShiftActionLogger.LogShiftTimeReset(AdminInteract, ShiftDocument, UpdatedDoc),
      new SuccessContainer()
        .setDescription("Successfully reset the shift's on-duty time.")
        .replyToInteract(AdminInteract, true),
    ]);
  } catch (Err: any) {
    return HandleShiftTimeModExceptions(AdminInteract, ShiftDocument, Err);
  }
}

/**
 * Handles the process of setting the on-duty time for a shift.
 * @param AdminInteract - The interaction object from the admin's selection menu.
 * @param ShiftDocument - The shift document representing the current shift data.
 * @returns A promise that resolves when the operation is complete, or logs errors if any occur.
 */
async function HandleShiftTimeSet(
  AdminInteract: StringSelectMenuInteraction<"cached">,
  ShiftDocument: Shifts.HydratedShiftDocument
) {
  const TMModal = GetTimeModificationModal("Set", AdminInteract, ShiftDocument);
  const ModalSubmission = await ShowModalAndAwaitSubmission(AdminInteract, TMModal);
  if (!ModalSubmission) return;

  const InputDuration = ModalSubmission.fields.getTextInputValue("da-st-mod-input");
  const ParsedDuration = ParseDuration(InputDuration, "millisecond");
  const RoundedDuration = Math.round(Math.abs(ParsedDuration ?? 0));

  if (!ParsedDuration) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(ModalSubmission, true);
  } else if (RoundedDuration < milliseconds({ seconds: 30 })) {
    return new ErrorEmbed()
      .useErrTemplate("ShortTypedDuration")
      .replyToInteract(ModalSubmission, true);
  } else if (RoundedDuration > milliseconds({ days: 14 })) {
    return new ErrorEmbed()
      .useErrTemplate("ShiftCreationDurationTooLong")
      .replyToInteract(ModalSubmission, true);
  }

  try {
    const UpdatedDoc = await ShiftDocument.setOnDutyTime(
      RoundedDuration,
      ModalSubmission.createdTimestamp
    );

    return Promise.allSettled([
      ShiftActionLogger.LogShiftTimeSet(ModalSubmission, ShiftDocument, UpdatedDoc),
      new SuccessContainer()
        .setDescription(
          `Successfully set the shift's on-duty time to ${ReadableDuration(UpdatedDoc.durations.on_duty)}.`
        )
        .replyToInteract(ModalSubmission, true),
    ]);
  } catch (Err: any) {
    return HandleShiftTimeModExceptions(ModalSubmission, ShiftDocument, Err);
  }
}

/**
 * Handles the addition or subtraction of on-duty time for a shift document.
 * @param ActionType - Specifies whether to "Add" or "Subtract" on-duty time.
 * @param AdminInteract - The interaction object from the admin user, specifically a string select menu interaction.
 * @param ShiftDocument - The shift document to be modified, containing the current shift data.
 *
 * @returns A promise that resolves when the operation is completed, including sending a success or error message
 *          to the user and logging the action. If an error occurs, it handles the exception appropriately.
 * @throws If the duration input is invalid or too short, an error embed is sent as a reply to the interaction.
 *         Other exceptions are handled by `HandleShiftTimeModExceptions`.
 */
async function HandleShiftTimeAddSub(
  ActionType: "Add" | "Subtract",
  AdminInteract: StringSelectMenuInteraction<"cached">,
  ShiftDocument: Shifts.HydratedShiftDocument
) {
  const TMModal = GetTimeModificationModal(ActionType, AdminInteract, ShiftDocument);
  const ModalSubmission = await ShowModalAndAwaitSubmission(AdminInteract, TMModal);
  if (!ModalSubmission) return;

  const InputDuration = ModalSubmission.fields.getTextInputValue("da-st-mod-input");
  const ParsedDuration = ParseDuration(InputDuration, "millisecond");
  const RoundedDuration = Math.round(Math.abs(ParsedDuration ?? 0));
  const SuccessMsg =
    ActionType === "Add"
      ? `Successfully added an extra \`${ReadableDuration(RoundedDuration)}\` of on-duty time to the shift.`
      : `Successfully subtracted \`${ReadableDuration(RoundedDuration)}\` of on-duty time from the shift.`;

  if (ParsedDuration == null) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(ModalSubmission, true);
  } else if (RoundedDuration < milliseconds({ seconds: 30 })) {
    return new ErrorEmbed()
      .useErrTemplate("ShortTypedDuration")
      .replyToInteract(ModalSubmission, true);
  }

  try {
    const UpdatedDoc = await ShiftDocument.addSubOnDutyTime(ActionType, RoundedDuration);
    return Promise.allSettled([
      new SuccessContainer().setDescription(SuccessMsg).replyToInteract(ModalSubmission, true),
      ShiftActionLogger.LogShiftTimeAddSub(
        ModalSubmission,
        UpdatedDoc,
        RoundedDuration,
        ActionType
      ),
    ]);
  } catch (Err: any) {
    return HandleShiftTimeModExceptions(ModalSubmission, ShiftDocument, Err);
  }
}

/**
 * Prompts the user to modify a shift by selecting an action from a menu.
 * @param Interact - The interaction object, either a modal submit or button interaction.
 * @param ShiftDocument - The shift document to be modified.
 * @remarks This function handles user interaction for modifying shift details, including adding, subtracting, setting, or resetting on-duty time.
 */
async function PromptShiftModification(
  Interact: ModalSubmitInteraction<"cached"> | ButtonInteraction<"cached">,
  ShiftDocument: Shifts.HydratedShiftDocument
) {
  if (Interact.isModalSubmit() && !Interact.deferred) await Interact.deferUpdate();
  const ShiftModificationMenu = GetShiftModificationsPromptMenu(Interact, ShiftDocument);
  const PromptContainer = GetMiniPredefinedPrompt(
    `Shift Modifier — \`${ShiftDocument._id}\``,
    "Kindly select an action to perform on the specified shift from the below options.",
    ShiftModificationMenu
  );

  const PromptMsg = await Interact.editReply({
    components: [PromptContainer],
  });

  const CompCollector = PromptMsg.createMessageComponentCollector({
    filter: (BInteract) => HandleCollectorFiltering(Interact, BInteract),
    componentType: ComponentType.StringSelect,
    time: 10 * 60_000,
  });

  CompCollector.on("collect", async (SMInteract: StringSelectMenuInteraction<"cached">) => {
    if (SMInteract.values[0] === ShiftModActions.TimeReset) {
      await HandleShiftTimeReset(SMInteract, ShiftDocument);
    } else if (SMInteract.values[0] === ShiftModActions.TimeSet) {
      await HandleShiftTimeSet(SMInteract, ShiftDocument);
    } else if (SMInteract.values[0] === ShiftModActions.TimeAdd) {
      await HandleShiftTimeAddSub("Add", SMInteract, ShiftDocument);
    } else if (SMInteract.values[0] === ShiftModActions.TimeSub) {
      await HandleShiftTimeAddSub("Subtract", SMInteract, ShiftDocument);
    }

    Interact.editReply({ components: [PromptContainer] }).catch(() => null);
    ShiftDocument = await ShiftDocument.getLatestVersion(true);
  });

  CompCollector.on("end", async (CollectedInteracts, EndReason) => {
    if (EndReason.match(/^\w+Delete/)) return;
    const LastInteract = CollectedInteracts.last() ?? Interact;
    await HandlePromptDisabling(LastInteract, PromptMsg);
  });
}

/**
 * Wipes all shifts for a specified user in a given guild, optionally filtered by shift type.
 * @param TargetUserId - The ID of the user whose shifts are to be wiped.
 * @param GuildId - The ID of the guild where the shifts are recorded.
 * @param ShiftType - (Optional) The type of shifts to delete. If not provided, all shift types are considered.
 * @returns A promise that resolves to an object containing the total time of the deleted shifts and the result of the delete operation.
 */
async function WipeUserShifts(
  TargetUserId: string,
  GuildId: string,
  ShiftType?: Nullable<string>
): Promise<Mongoose.mongo.DeleteResult & { totalTime: number }> {
  const QueryFilter: RootFilterQuery<Shifts.ShiftDocument> = {
    guild: GuildId,
    user: TargetUserId,
    type: ShiftType || { $exists: true },
  };

  const TData = await ShiftModel.aggregate<{ total_time: number; shift_count: number }>([
    { $match: QueryFilter },
    {
      $group: {
        _id: null,
        shift_count: { $sum: 1 },
        total_time: {
          $sum: {
            $add: ["$durations.on_duty", "$durations.on_duty_mod"],
          },
        },
      },
    },
  ]);

  if (!TData[0] || TData[0].shift_count === 0) {
    return {
      totalTime: 0,
      deletedCount: 0,
      acknowledged: true,
    };
  }

  return ShiftModel.deleteMany(QueryFilter).then((DResult: any) => {
    DResult.totalTime = TData[0]?.total_time ?? 0;
    return DResult as Mongoose.mongo.DeleteResult & { totalTime: number };
  });
}

/**
 * Returns a paginated and listed shifts of a target user.
 * Aggregation test: https://mongoplayground.net/p/PwnbTQVfPBy
 * @param TargetUser - The targetted user.
 * @param GuildId - The guild id that the user is in.
 * @param [ShiftType] - Shift type targetted.
 * @param [CurrentDate=new Date()] - The current date to use for calculating shift durations.
 * @returns
 */
async function RetrieveShiftRecordsAsContainers(
  TargetUser: string,
  GuildId: string,
  ShiftType: Nullable<string>,
  CurrentDate: Date = new Date()
) {
  const ShiftData = await QueryUserShiftRecords(TargetUser, GuildId, ShiftType, CurrentDate);
  return Chunks(ShiftData, 2).map((Chunk) => {
    const Descriptions = Chunk.map((Data) => {
      const Started = FormatTime(Math.round(Data.started / 1000), "f");
      const Ended =
        typeof Data.ended === "string"
          ? Data.ended
          : FormatTime(Math.round(Data.started / 1000), "T");

      const AdminFlag = Data.flag === ShiftFlags.Administrative ? " (Manually Added)" : "";
      const ShiftIdLine = `**Shift ID:** \`${Data._id}\`${AdminFlag}`;
      if (ShiftType) {
        return Dedent(`
          - ${ShiftIdLine}
            - **Duration:** ${ReadableDuration(Data.duration)}
            - **Started:** ${Started}
            - **Ended:** ${Ended}
        `);
      } else {
        return Dedent(`
          - ${ShiftIdLine}
            - **Type:** \`${Data.type}\`
            - **Duration:** ${ReadableDuration(Data.duration)}
            - **Started:** ${Started}
            - **Ended:** ${Ended}
        `);
      }
    });

    const ShiftTypeAppend = ShiftType ? `type: \`${ShiftType}\`` : "all types";
    const PageContainer = new ContainerBuilder()
      .setAccentColor(resolveColor(Colors.Info))
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: `### Recorded Shifts\n-# Displaying \`${ShiftData.length}\` total shifts of ${ShiftTypeAppend}; data as of ${FormatTime(CurrentDate, "f")}`,
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));

    Descriptions.forEach((Description, Index) => {
      PageContainer.addTextDisplayComponents(
        new TextDisplayBuilder({
          content: Description,
        })
      );

      if (Index !== Descriptions.length - 1) {
        PageContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true }));
      }
    });

    return PageContainer;
  });
}

/**
 * Retrieves the active shift and constructs a response container with shift data and statistics.
 * @param Interaction - The interaction object from the slash command, with a cached guild member.
 * @param Options - An object containing the following properties:
 * - `TargetUser`: The user whose active shift is to be retrieved.
 * - `CmdShiftType`: The shift type to be targeted.
 * - `RecentlyEndedShift`: The recently ended shift document for the target user (if any).
 *
 * @returns A promise resolving to an object containing:
 * - `ActiveShift`: The active shift document for the target user, or `null` if no active shift exists.
 * - `RespContainer`: A container builder instance with the response data for the interaction.
 *
 * The response container includes:
 * - A summary of the user's shift statistics.
 * - Details of the active/recently ended shift, if present.
 * - Footer information about the shift type and interaction timestamp.
 * - Action buttons for managing the active shift.
 */
async function GetActiveShiftAndShiftDataContainer(
  Interaction: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  {
    RecentlyEndedShift,
    CmdShiftType,
    TargetUser,
  }: {
    RecentlyEndedShift?: Shifts.HydratedShiftDocument;
    CmdShiftType?: string | null;
    TargetUser: User;
  }
): Promise<{
  ActiveShift: Shifts.HydratedShiftDocument | null;
  RespContainer: ContainerBuilder;
}> {
  const ActiveShift = RecentlyEndedShift
    ? null
    : await ShiftModel.findOne({
        end_timestamp: null,
        user: TargetUser.id,
        guild: Interaction.guildId,
        type: CmdShiftType || { $exists: true },
      });

  const UserShiftsData = await GetMainShiftsData(
    {
      guild: Interaction.guildId,
      user: TargetUser.id,
      type: CmdShiftType,
    },
    !!ActiveShift
  );

  const ContainerAccentColor = ActiveShift?.hasBreakActive()
    ? Colors.ShiftBreak
    : ActiveShift
      ? Colors.ShiftOn
      : RecentlyEndedShift
        ? Colors.ShiftOff
        : Colors.DarkBlue;

  const FreqShiftTypeLine = CmdShiftType
    ? ""
    : `**Frequent Shift:** \`${UserShiftsData.frequent_shift_type}\`\n`;

  const StatisticsTextSummary =
    `>>> **Shift Count:** \`${UserShiftsData.shift_count}\`\n` +
    FreqShiftTypeLine +
    `**Total Time:** ${UserShiftsData.total_onduty}\n` +
    `**Average Time:** ${UserShiftsData.avg_onduty}`;

  const FooterShiftType = CmdShiftType ? inlineCode(CmdShiftType) : "all types";
  const ButtonActionRows = GetShiftAdminButtonsRows(ActiveShift, Interaction, TargetUser);
  const RespContainer = new ContainerBuilder()
    .setAccentColor(resolveColor(ContainerAccentColor))
    .addTextDisplayComponents(
      {
        type: ComponentType.TextDisplay,
        content: `### Shift Administration for <@${TargetUser.id}>`,
      },
      {
        type: ComponentType.TextDisplay,
        content: `**Statistics Summary:**\n${StatisticsTextSummary}`,
      }
    );

  if (ActiveShift) {
    const StatusText = ActiveShift.hasBreakActive()
      ? `(${Emojis.Idle}) On-Break`
      : `(${Emojis.Online}) On-Duty`;

    const TotalBreakTime = ActiveShift.hasBreaks()
      ? `**Break Time:** ${ReadableDuration(ActiveShift.durations.on_break)}`
      : null;

    const ActiveShiftTextSummary = Dedent(`
      >>> **ID:** \`${ActiveShift._id}\`\
      ${CmdShiftType ? "" : `\n**Type:** \`${ActiveShift.type}\``}
      **Status:** ${StatusText}
      **Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
      ${!ActiveShift.end_timestamp ? "" : `**On-Duty Time:** ${ReadableDuration(ActiveShift.durations.on_duty)}`}
      ${TotalBreakTime ?? ""}
    `).replace(/\n+/g, "\n");

    RespContainer.addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: `**Active Shift:**\n${ActiveShiftTextSummary}`,
    });
  } else if (RecentlyEndedShift) {
    const TotalBreakTime = RecentlyEndedShift.hasBreaks()
      ? `**Break Time:** ${ReadableDuration(RecentlyEndedShift.durations.on_break, { largest: 3 })}`
      : "";

    const EndedShiftTextSummary = Dedent(`
      >>> **ID:** \`${RecentlyEndedShift._id}\`
      **On-Duty Time:** ${ReadableDuration(RecentlyEndedShift.durations.on_duty)}
      ${CmdShiftType ? "" : `\n**Type:** \`${RecentlyEndedShift.type}\``}
      **Started:** ${FormatTime(RecentlyEndedShift.start_timestamp, "R")}
      **Ended:** ${FormatTime(RecentlyEndedShift.end_timestamp ?? Interaction.createdAt, "R")}
      ${TotalBreakTime}
    `).replace(/\n+/g, "\n");

    RespContainer.addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: `**Previous Shift:**\n${EndedShiftTextSummary}`,
    });
  }

  RespContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true }))
    .addTextDisplayComponents({
      type: ComponentType.TextDisplay,
      content: `-# *Shift type: ${FooterShiftType}; on ${FormatTime(Interaction.createdAt, "f")}*`,
    })
    .addActionRowComponents(...ButtonActionRows);

  return { ActiveShift, RespContainer };
}

/**
 * Handles the disabling of message components in a prompt message and updates the message accordingly.
 * @param Interaction - The interaction object, which must be a cached `RepliableInteraction`.
 *                      This can be a command interaction or a component interaction.
 * @param PromptMsg - The message containing the components to be disabled.
 * @returns A promise that resolves to the result of the interaction update/editReply or `null` if an error occurs.
 */
async function HandlePromptDisabling(
  Interaction: RepliableInteraction<"cached">,
  PromptMsg: Message
) {
  const APICompatibleComps = PromptMsg.components.map((Comp) => Comp.toJSON());
  const DisabledComponents = DisableMessageComponents(APICompatibleComps);
  const EditMethod =
    Interaction.deferred || Interaction.replied
      ? "editReply"
      : Interaction instanceof MessageComponentInteraction
        ? "update"
        : "editReply";

  return Interaction[EditMethod]({
    message: PromptMsg.id,
    components: DisabledComponents,
  }).catch(() => null);
}

// ---------------------------------------------------------------------------------------
// Action Handlers:
// ----------------
/**
 * Handles modification logic to selected shifts.
 * @param AdminInteract - The button interaction that triggered the function.
 * @param TargetUser - The user whose shift is being modified.
 */
async function HandleShiftModifications(
  AdminInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  ShiftType?: string | null
) {
  if (
    (await ShiftModel.countDocuments({
      guild: AdminInteract.guildId,
      user: TargetUser.id,
      type: ShiftType || { $exists: true },
    })) === 0
  ) {
    return new ErrorEmbed()
      .useErrTemplate(ShiftType ? "SANoShiftsToModifyWithType" : "SANoShiftsToModify")
      .replyToInteract(AdminInteract, true);
  }

  const ShiftSelectEndReason = "ShiftSelected";
  const IsShiftActive = !!(await GetShiftActive({
    ShiftType,
    UserOnly: true,
    Interaction: {
      guildId: AdminInteract.guildId,
      user: { id: TargetUser.id },
    },
  }));

  const ButtonsActionRow = GetCurrentLastSMButtonsActionRow(
    AdminInteract,
    IsShiftActive ? "Current" : "Last"
  );

  const RespContainer = GetMiniPredefinedPrompt(
    "Shift Modifier",
    "Please select a shift to modify its durations.",
    ButtonsActionRow
  );

  const PromptMessage = await AdminInteract.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [RespContainer],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message! as Message<true>);

  const CompCollector = PromptMessage.createMessageComponentCollector({
    filter: (BInteract) => HandleCollectorFiltering(AdminInteract, BInteract),
    componentType: ComponentType.Button,
    time: 8 * 60_000,
  });

  CompCollector.on("collect", async (ButtonInteract) => {
    if (ButtonInteract.customId.includes("current")) {
      await ButtonInteract.deferUpdate();
      const ActiveShift = await GetShiftActive({
        ShiftType,
        UserOnly: true,
        Interaction: {
          guildId: AdminInteract.guildId,
          user: { id: TargetUser.id },
        },
      });

      if (!ActiveShift) {
        return new ErrorEmbed()
          .useErrTemplate("NoActiveShiftFM")
          .replyToInteract(ButtonInteract, true, false, "reply");
      }

      CompCollector.stop(ShiftSelectEndReason);
      return PromptShiftModification(ButtonInteract, ActiveShift);
    }

    if (ButtonInteract.customId.includes("last")) {
      await ButtonInteract.deferUpdate();
      const LastShift = await ShiftModel.findOne({
        guild: AdminInteract.guildId,
        user: TargetUser.id,
        type: ShiftType || { $exists: true },
      })
        .sort({ start_timestamp: -1 })
        .exec();

      if (!LastShift) {
        return new ErrorEmbed()
          .useErrTemplate("NoRecentShifts")
          .replyToInteract(ButtonInteract, true, false, "reply");
      }

      CompCollector.stop(ShiftSelectEndReason);
      return PromptShiftModification(ButtonInteract, LastShift);
    }

    const ShiftIdModal = GetShiftIdModInputModal(ButtonInteract);
    const ModalSubmission = await ShowModalAndAwaitSubmission(ButtonInteract, ShiftIdModal);
    const ShiftId = ModalSubmission?.fields.getTextInputValue("da-modify-id");
    if (!ModalSubmission) return;
    if (!ShiftId || !IsValidShiftId(ShiftId)) {
      return new ErrorEmbed()
        .useErrTemplate("InvalidShiftId")
        .replyToInteract(ModalSubmission, true, false);
    }

    const ShiftFound = await ShiftModel.findOne({
      guild: AdminInteract.guildId,
      _id: ShiftId,
    });

    if (!ShiftFound) {
      return new ErrorEmbed()
        .useErrTemplate("NoShiftFoundWithId", ShiftId)
        .replyToInteract(ModalSubmission, true, false);
    }

    CompCollector.stop(ShiftSelectEndReason);
    return PromptShiftModification(ModalSubmission, ShiftFound);
  });

  CompCollector.on("end", async (CollectedInteracts, EndReason) => {
    if (EndReason === ShiftSelectEndReason || EndReason.match(/^\w+Delete/)) return;
    const LastInteract = CollectedInteracts.last() ?? AdminInteract;
    return HandlePromptDisabling(LastInteract, PromptMessage);
  });
}

/**
 * Handles the creation of an administrative shift for a target user.
 * @param BInteract - The button interaction that triggered this handler.
 * @param TargetUser - The user to create a shift for.
 * @param ShiftType - Optional shift type to pre-fill in the modal.
 */
async function HandleShiftCreation(
  BInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  ShiftType: Nullable<string>
) {
  const IsMemberInGuild = BInteract.guild.members.cache.has(TargetUser.id);
  if (!IsMemberInGuild) {
    return new ErrorEmbed()
      .useErrTemplate("ActionRequiresMemberPresence", TargetUser.id)
      .replyToInteract(BInteract, true);
  }

  const ShiftCreationModal = GetShiftCreationModal(BInteract, ShiftType);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BInteract, ShiftCreationModal);
  if (!ModalSubmission) return;

  const InputDuration = ModalSubmission.fields.getTextInputValue("shift-duration");
  const InputShiftType = ModalSubmission.fields.getTextInputValue("shift-type");
  const ParsedDuration = ParseDuration(InputDuration, "millisecond");
  const RoundedDuration = Math.round(Math.abs(ParsedDuration ?? 0));

  if (!ParsedDuration) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(ModalSubmission, true);
  }

  if ((await HandleShiftTypeValidation(ModalSubmission, InputShiftType, true)) === true) {
    return;
  }

  if (RoundedDuration < milliseconds({ seconds: 30 })) {
    return new ErrorEmbed()
      .useErrTemplate("ShortTypedDuration")
      .replyToInteract(ModalSubmission, true);
  }

  if (RoundedDuration > milliseconds({ days: 14 })) {
    return new ErrorEmbed()
      .useErrTemplate("ShiftCreationDurationTooLong")
      .replyToInteract(ModalSubmission, true);
  }

  const NewShiftRecord = await ShiftModel.create({
    user: TargetUser.id,
    type: InputShiftType,
    flag: ShiftFlags.Administrative,
    guild: ModalSubmission.guildId,
    durations: { on_duty: 0, on_duty_mod: RoundedDuration },
    start_timestamp: ModalSubmission.createdTimestamp,
    end_timestamp: ModalSubmission.createdTimestamp,
  });

  return Promise.allSettled([
    ShiftActionLogger.LogShiftTimeAddSub(ModalSubmission, NewShiftRecord, RoundedDuration, "Add"),
    GetActiveShiftAndShiftDataContainer(BInteract, {
      TargetUser,
      CmdShiftType: ShiftType,
    }).then(({ RespContainer }) => BInteract.editReply({ components: [RespContainer] })),
    new SuccessContainer()
      .setTitle("Shift Created")
      .setDescription(
        Dedent(`
        Successfully created an administrative shift for <@${TargetUser.id}>:
        - Shift ID: \`${NewShiftRecord._id}\`
        - Duration: ${ReadableDuration(RoundedDuration)}
        - Of Type: \`${InputShiftType}\`
      `)
      )
      .replyToInteract(ModalSubmission, true),
  ]);
}

/**
 * Handles the logic of listing recorded and logged shifts for a specific user.
 * @param BInteract - The received button interaction from the collector.
 * @param TargetUser - Target user to list their recorded and logged shifts.
 * @param ShiftType - The type of shifts to list.
 * @returns
 */
async function HandleShiftListing(
  BInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  ShiftType?: Nullable<string>
) {
  const Pages = await RetrieveShiftRecordsAsContainers(
    TargetUser.id,
    BInteract.guildId,
    ShiftType,
    BInteract.createdAt
  );

  if (Pages.length) {
    return HandlePagePagination({
      context: "Commands:Miscellaneous:Duty:Admin",
      interact: BInteract,
      ephemeral: true,
      pages: Pages,
    });
  } else {
    return new InfoContainer()
      .setTitle("No Recorded Shifts")
      .setDescription(
        `There are no recorded shifts for this member${
          ShiftType ? ` under the \`${ShiftType}\` type` : ""
        } to list.`
      )
      .replyToInteract(BInteract, true);
  }
}

/**
 * Handles shift data reset/wipe/erase for a specific user with a specific/all type(s).
 * @param BInteract - The received button interaction from the collector.
 * @param TargetUser - Target user to wipe/delete their shifts.
 * @param ShiftType - The type of shifts to consider.
 * @returns
 */
async function HandleUserShiftsWipe(
  BInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  ShiftType?: Nullable<string>
) {
  const EDSType = ShiftType ? `the ${inlineCode(ShiftType)}` : "all";
  const Plural = ShiftType ? "" : "s";
  const ButtonsAR = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`da-wipe-confirm:${BInteract.user.id}:${TargetUser.id}`)
      .setLabel("Confirm and Wipe")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`da-wipe-cancel:${BInteract.user.id}:${TargetUser.id}`)
      .setLabel("Cancel Shift Wipe")
      .setStyle(ButtonStyle.Secondary)
  );

  const PromptContainer = new WarnContainer()
    .setTitle("Shift Data Reset")
    .setDescription(
      `Are you certain you want to delete and wipe all active and recorded shifts of ${EDSType} type${Plural} for <@${TargetUser.id}>?`
    )
    .setFooter(
      "**Note:** This is an ***irrevocable*** action, and erased data cannot be recovered. This prompt will time out in 5 minutes."
    )
    .attachPromptActionRows(ButtonsAR);

  const ConfirmationPrompt = await BInteract.reply({
    flags: MessageFlags.IsComponentsV2,
    components: [PromptContainer],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message! as Message<true>);

  try {
    const ConfirmationInteract = await ConfirmationPrompt.awaitMessageComponent({
      filter: (BI) => HandleCollectorFiltering(BInteract, BI),
      componentType: ComponentType.Button,
      time: 5 * 60_000,
    });

    if (!ConfirmationInteract.customId.includes("confirm")) {
      return new InfoContainer()
        .setTitle("Shift Wipe Cancelled")
        .setDescription("Shift wipe was cancelled, and no modifications were made.")
        .replyToInteract(ConfirmationInteract ?? BInteract, true, false, "editReply");
    }

    await ConfirmationInteract.deferUpdate();
    const WipeResult = await WipeUserShifts(TargetUser.id, BInteract.guildId, ShiftType);
    const WipeResultContainer = new SuccessContainer()
      .setTitle("Member Shifts Wiped")
      .setDescription(
        Dedent(`
          **Wipe Details:**
          >>> **Member:** <@${TargetUser.id}>
          **Wiped Shifts:** [${WipeResult.deletedCount}](${channelLink(ConfirmationInteract.channelId)})
          **Shifts of Type:** ${ShiftType ? inlineCode(ShiftType) : "*all types*"}  
          **On-Duty Time Erased:** ${ReadableDuration(WipeResult.totalTime)}
        `)
      );

    if (WipeResult.deletedCount === 0) {
      return ConfirmationInteract.editReply({
        components: [new InfoContainer().useInfoTemplate("NoShiftsWipedFU")],
      });
    }

    return Promise.allSettled([
      ShiftActionLogger.LogShiftsWipe(ConfirmationInteract, WipeResult, ShiftType, TargetUser),
      ConfirmationInteract.editReply({ components: [WipeResultContainer] }),
      GetActiveShiftAndShiftDataContainer(ConfirmationInteract, {
        TargetUser,
        CmdShiftType: ShiftType,
      }).then(({ RespContainer }) =>
        ConfirmationInteract.editReply({
          components: [RespContainer],
          message: BInteract.message.id,
        })
      ),
    ]);
  } catch (Err: any) {
    if (Err.message.match(/reason: time/)) {
      return HandlePromptDisabling(BInteract, ConfirmationPrompt);
    } else if (Err.message.match(/reason: \w+Delete/)) {
      /* Ignore message/channel/guild deletion errors */
    } else {
      throw Err;
    }
  }
}

/**
 * Handles the termination of an active shift for a `TargetUser`.
 * @param BInteract - The received button interaction from the collector.
 * @param RespMessage - The original administration prompt message that was sent. Required to alter its information.
 * @param TargetUser - Target user to end their currently active shift.
 * @param ActiveShift - The currently active shift to end.
 * @param CmdShiftType - The type of shift received from the command options. Could be different from `ActiveShift.type`.
 * @returns
 */
async function HandleUserShiftEnd(
  BInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  ActiveShift: Shifts.HydratedShiftDocument,
  CmdShiftType?: Nullable<string>
) {
  await BInteract.deferUpdate();
  const EndedShift = await ActiveShift.end(BInteract.createdTimestamp).catch((Err: AppError) => {
    return Err;
  });

  const { RespContainer } = await GetActiveShiftAndShiftDataContainer(BInteract, {
    TargetUser,
    CmdShiftType,
    RecentlyEndedShift:
      EndedShift instanceof Error ? await ActiveShift.getLatestVersion(true) : EndedShift,
  });

  if (EndedShift instanceof Error) {
    throw EndedShift;
  }

  return Promise.allSettled([
    ShiftActionLogger.LogShiftEnd(EndedShift, BInteract, BInteract.user, TargetUser),
    HandleRoleAssignment("off-duty", BInteract.client, BInteract.guild, TargetUser.id),
    BInteract.editReply({
      components: [RespContainer],
    }),
  ]);
}

/**
 * Handles the deletion logic for a `TargetUser`'s shift.
 * @param BInteract - The received button interaction from the collector.
 * @param TargetUser - Target user to delete a shift for.
 * @param CmdShiftType - The type of shift received from the command options.
 * @returns
 */
async function HandleUserShiftDelete(
  BInteract: ButtonInteraction<"cached">,
  TargetUser: User,
  CmdShiftType: Nullable<string>
) {
  const ShiftIdInputModal = GetShiftIdDeletionInputModal(BInteract);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BInteract, ShiftIdInputModal);
  if (!ModalSubmission) return;
  const ShiftId = ModalSubmission.fields.getTextInputValue("da-shift-id");
  const ShiftDeleted = await ShiftModel.findOneAndDelete({
    guild: BInteract.guildId,
    _id: ShiftId,
  });

  if (!ShiftDeleted) {
    return new ErrorEmbed()
      .useErrTemplate("NoShiftFoundWithId", ShiftId)
      .replyToInteract(ModalSubmission, true);
  }

  if (!ShiftDeleted.end_timestamp) {
    HandleRoleAssignment("off-duty", BInteract.client, BInteract.guild, TargetUser.id).catch(
      () => null
    );
  }

  return Promise.allSettled([
    ShiftActionLogger.LogShiftDelete(BInteract, ShiftDeleted),
    GetActiveShiftAndShiftDataContainer(BInteract, { TargetUser, CmdShiftType }).then(
      ({ RespContainer }) => BInteract.editReply({ components: [RespContainer] })
    ),
    new SuccessContainer()
      .setTitle("Shift Deleted")
      .setDescription(`The shift with the identifier \`${ShiftId}\` was successfully deleted.`)
      .replyToInteract(ModalSubmission),
  ]);
}

// ---------------------------------------------------------------------------------------
// Initial Logic:
// --------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply();
  const CmdShiftType = Interaction.options.getString("type", false);
  const TargetMember = Interaction.options.getUser("member", true);

  if (TargetMember.bot) {
    return new ErrorEmbed()
      .useErrTemplate("BotMemberSelected")
      .replyToInteract(Interaction, true, false);
  }

  const { ActiveShift, RespContainer } = await GetActiveShiftAndShiftDataContainer(Interaction, {
    TargetUser: TargetMember,
    CmdShiftType,
  });

  const RespMessage = await Interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [RespContainer],
  });

  const ActionCollector = RespMessage.createMessageComponentCollector({
    filter: (BI) => HandleCollectorFiltering(Interaction, BI),
    componentType: ComponentType.Button,
    time: 12.5 * 60_000,
  });

  ActionCollector.on("collect", async (ButtonInteract) => {
    const CustomId = ButtonInteract.customId.split(":")[0];
    try {
      switch (CustomId) {
        case "da-list":
          await HandleShiftListing(ButtonInteract, TargetMember, CmdShiftType);
          break;
        case "da-wipe":
          await HandleUserShiftsWipe(ButtonInteract, TargetMember, CmdShiftType);
          break;
        case "da-delete":
          await HandleUserShiftDelete(ButtonInteract, TargetMember, CmdShiftType);
          break;
        case "da-create":
          await HandleShiftCreation(ButtonInteract, TargetMember, CmdShiftType);
          break;
        case "da-end":
          if (ActiveShift) {
            await HandleUserShiftEnd(ButtonInteract, TargetMember, ActiveShift, CmdShiftType);
          } else {
            await ButtonInteract.deferUpdate();
          }
          break;
        case "da-modify":
          await HandleShiftModifications(ButtonInteract, TargetMember, CmdShiftType);
          break;
        default:
          break;
      }
    } catch (Err: any) {
      if (Err instanceof DiscordAPIError && Err.code === 50_001) {
        return;
      } else if (Err instanceof AppError && Err.is_showable) {
        return new ErrorEmbed().useErrClass(Err).replyToInteract(ButtonInteract, true);
      } else {
        AppLogger.error({
          message: "An unexpected error occurred while responding to a button interaction;",
          label: FileLabel,
          stack: Err.stack,
          details: {
            ...Err,
          },
        });

        return new ErrorEmbed().useErrTemplate("AppError").replyToInteract(ButtonInteract, true);
      }
    }
  });

  ActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.match(/^\w+Delete/) || EndReason === "ErrorOccurred") return;
    const LastInteract = Collected.last() ?? Interaction;
    return HandlePromptDisabling(LastInteract, RespMessage);
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("admin")
    .setDescription("Manage and administer the duty shift of somebody else.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to manage their duty shift.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("type")
        .setDescription("The type of duty shift to be managed.")
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(false)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
