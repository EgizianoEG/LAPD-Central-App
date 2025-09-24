// Dependencies:
// -------------

import {
  inlineCode,
  MessageFlags,
  ComponentType,
  BaseInteraction,
  ButtonInteraction,
  time as FormatTime,
  TextDisplayBuilder,
} from "discord.js";

import {
  ShiftMgmtActions,
  RecentShiftAction,
  GetShiftManagementButtons,
  CheckShiftTypeRestrictions,
} from "@Cmds/Miscellaneous/Duty/Subcmds/Manage.js";

import { Shifts } from "@Typings/Utilities/Database.js";
import { GetErrorId } from "@Utilities/Strings/Random.js";
import { MongoDBCache } from "@Utilities/Helpers/Cache.js";
import { secondsInDay } from "date-fns/constants";
import { ErrorMessages } from "@Resources/AppMessages.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { BaseExtraContainer } from "@Utilities/Classes/ExtraContainers.js";
import { differenceInSeconds } from "date-fns";
import { ErrorEmbed, UnauthorizedEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { DutyManagementBtnCustomIdRegex } from "@Resources/RegularExpressions.js";
import { IsValidDiscordId, IsValidShiftTypeName } from "@Utilities/Helpers/Validators.js";

import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import HandleRoleAssignment from "@Utilities/Discord/HandleShiftRoleAssignment.js";
import GetMainShiftsData from "@Utilities/Database/GetShiftsData.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import GetActiveShift from "@Utilities/Database/GetShiftActive.js";
import ShiftModel from "@Models/Shift.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Dedent from "dedent";

type ShiftDocument = Shifts.HydratedShiftDocument;
const FileLabel = "Events:InteractionCreate:ShiftManagementHandler";
const SMActionFeedbackFailureErrMsg =
  "Encountered an error while performing shift action logging and role assignment.";
// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
/**
 * Handles all User Activity Notice management button interactions.
 * @param _ - Discord client instance (unused parameter).
 * @param Interaction - The button interaction to process.
 * @returns
 */
export default async function ShiftManagementHandlerWrapper(
  _: DiscordClient,
  Interaction: BaseInteraction
) {
  if (
    !Interaction.isButton() ||
    !Interaction.inCachedGuild() ||
    !DutyManagementBtnCustomIdRegex.test(Interaction.customId)
  ) {
    return;
  }

  try {
    const ValidationResult = await HandleUnauthorizedShiftManagement(Interaction);
    if (ValidationResult.handled || !ValidationResult.target_shift_type) return;

    await ShiftManagementHandler(Interaction, ValidationResult.target_shift_type);
    const ButtonResponded = Interaction.deferred || Interaction.replied;

    if (!ButtonResponded) {
      await Interaction.deferUpdate().catch(() => null);
    }
  } catch (Err: any) {
    if (Err instanceof AppError && Err.is_showable) {
      return new ErrorEmbed().useErrClass(Err).replyToInteract(Interaction, true);
    }

    const ErrorId = GetErrorId();
    AppLogger.error({
      message: "Failed to handle shift management button interaction;",
      error_id: ErrorId,
      label: FileLabel,
      stack: Err.stack,
    });

    return new ErrorEmbed()
      .useErrTemplate("AppError")
      .setErrorId(ErrorId)
      .replyToInteract(Interaction, true);
  }
}

// ---------------------------------------------------------------------------------------
// Action Handling:
// ----------------
async function ShiftManagementHandler(
  Interaction: ButtonInteraction<"cached">,
  TargetShiftType: string
) {
  const SplatDetails = Interaction.customId.split(":");
  const ShiftAction = SplatDetails[0] as ShiftMgmtActions;
  const TargetShiftId = SplatDetails[3];
  const PromptMessageId = Interaction.message.id;
  let TargetShift: Shifts.HydratedShiftDocument | null = null;

  if (
    MongoDBCache.StreamChangeConnected.ActiveShifts &&
    MongoDBCache.ActiveShifts.has(TargetShiftId)
  ) {
    TargetShift = MongoDBCache.ActiveShifts.getHydrated(TargetShiftId)!;
  } else if (TargetShiftId) {
    TargetShift = await ShiftModel.findById(TargetShiftId).exec();
  }

  const ActiveShift =
    TargetShift?.end_timestamp === null
      ? TargetShift
      : await GetActiveShift({
          UserOnly: true,
          Interaction,
        });

  if (await HandleInvalidShiftAction(Interaction, ShiftAction, TargetShift)) return;
  switch (ShiftAction) {
    case ShiftMgmtActions.ShiftOn:
      return HandleShiftOnAction(Interaction, TargetShiftType, PromptMessageId);
    case ShiftMgmtActions.ShiftOff:
      return HandleShiftOffAction(Interaction, ActiveShift!, PromptMessageId);
    case ShiftMgmtActions.ShiftBreakToggle:
      return HandleShiftBreakToggleAction(Interaction, ActiveShift!, PromptMessageId);
    default:
      throw new Error(`Unhandled ShiftAction: ${ShiftAction}`);
  }
}

async function HandleShiftOnAction(
  Interaction: ButtonInteraction<"cached">,
  TShiftType: string,
  PromptMsgId: string
) {
  if (!Interaction.customId.startsWith(ShiftMgmtActions.ShiftOn)) return;
  try {
    const StartedShift = await ShiftModel.startNewShift({
      type: TShiftType,
      user: Interaction.user.id,
      guild: Interaction.guildId,
      start_timestamp: Interaction.createdAt,
    });

    const ShiftActionFeedbacks = await Promise.allSettled([
      ShiftActionLogger.LogShiftStart(StartedShift, Interaction),
      HandleRoleAssignment("on-duty", Interaction.client, Interaction.guild, Interaction.user.id),
      UpdateManagementPrompt(
        Interaction,
        TShiftType,
        PromptMsgId,
        StartedShift,
        RecentShiftAction.Start
      ),
    ]);

    ShiftActionFeedbacks.forEach((Result) => {
      if (Result.status === "fulfilled") return;
      AppLogger.error({
        message: SMActionFeedbackFailureErrMsg,
        label: FileLabel,
        error: { ...Result.reason },
        stack: Result.reason instanceof Error ? Result.reason.stack : null,
      });
    });
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    if (Err instanceof AppError && Err.is_showable) {
      if (Err.title === ErrorMessages.ShiftAlreadyActive.Title) {
        const ActiveShift = await GetActiveShift({
          UserOnly: true,
          Interaction,
        });

        if (ActiveShift?.type === TShiftType) {
          await Interaction.deferUpdate().catch(() => null);
          return Promise.allSettled([
            new ErrorEmbed()
              .useErrTemplate("DSMStateChangedExternally")
              .replyToInteract(Interaction, true, true, "followUp"),
            UpdateManagementPrompt(
              Interaction,
              TShiftType,
              PromptMsgId,
              ActiveShift,
              RecentShiftAction.Start
            ),
          ]);
        } else {
          return new ErrorEmbed()
            .useErrClass(Err)
            .replyToInteract(Interaction, true, true, "reply");
        }
      }

      new ErrorEmbed()
        .useErrClass(Err)
        .setErrorId(ErrorId)
        .replyToInteract(Interaction, true, true, "reply");
    }

    AppLogger.error({
      message: "An error occurred while creating a new shift record;",
      label: FileLabel,
      user_id: Interaction.user.id,
      guild_id: Interaction.guildId,
      error_id: ErrorId,
      stack: Err.stack,
    });
  }
}

async function HandleShiftBreakToggleAction(
  Interaction: ButtonInteraction<"cached">,
  ActiveShift: ShiftDocument,
  PromptMsgId: string
) {
  if (!Interaction.customId.startsWith(ShiftMgmtActions.ShiftBreakToggle)) return;
  const BreakActionType = ActiveShift.hasBreakActive() ? "End" : "Start";
  let UpdatedShift: ShiftDocument | null = null;

  try {
    UpdatedShift = (await ActiveShift[`break${BreakActionType}`](
      Interaction.createdTimestamp
    )) as ShiftDocument;

    const ShiftActionFeedbacks = await Promise.allSettled([
      ShiftActionLogger[`LogShiftBreak${BreakActionType}`](UpdatedShift, Interaction),
      HandleRoleAssignment(
        BreakActionType === "End" ? "on-duty" : "on-break",
        Interaction.client,
        Interaction.guild,
        Interaction.user.id
      ),
      UpdateManagementPrompt(
        Interaction,
        UpdatedShift.type,
        PromptMsgId,
        UpdatedShift,
        RecentShiftAction[`Break${BreakActionType}`]
      ),
    ]);

    ShiftActionFeedbacks.forEach((Result) => {
      if (Result.status === "fulfilled") return;
      AppLogger.error({
        message: SMActionFeedbackFailureErrMsg,
        label: FileLabel,
        error: { ...Result.reason },
        stack: Result.reason instanceof Error ? Result.reason.stack : null,
      });
    });
  } catch (Err: any) {
    if (Err instanceof AppError && Err.is_showable) {
      const CurrentActiveShift = await GetActiveShift({
        UserOnly: true,
        Interaction,
      });

      if (CurrentActiveShift?._id === ActiveShift._id) {
        await Interaction.deferUpdate().catch(() => null);
        return Promise.allSettled([
          new ErrorEmbed()
            .useErrTemplate("DSMStateChangedExternally")
            .replyToInteract(Interaction, true, true, "followUp"),
          UpdateManagementPrompt(
            Interaction,
            CurrentActiveShift.type,
            PromptMsgId,
            CurrentActiveShift,
            CurrentActiveShift.hasBreakActive()
              ? RecentShiftAction.BreakStart
              : RecentShiftAction.BreakEnd
          ),
        ]);
      } else {
        return new ErrorEmbed().useErrClass(Err).replyToInteract(Interaction, true, true, "reply");
      }
    } else {
      throw Err;
    }
  }
}

async function HandleShiftOffAction(
  Interaction: ButtonInteraction<"cached">,
  ActiveShift: ShiftDocument,
  PromptMsgId: string
) {
  if (!Interaction.customId.startsWith(ShiftMgmtActions.ShiftOff)) return;
  let UpdatedShift: ShiftDocument | null = null;

  try {
    UpdatedShift = await ActiveShift.end(Interaction.createdTimestamp);
    const ShiftActionFeedbacks = await Promise.allSettled([
      ShiftActionLogger.LogShiftEnd(UpdatedShift, Interaction),
      HandleRoleAssignment("off-duty", Interaction.client, Interaction.guild, Interaction.user.id),
      UpdateManagementPrompt(
        Interaction,
        UpdatedShift.type,
        PromptMsgId,
        UpdatedShift,
        RecentShiftAction.End
      ),
    ]);

    ShiftActionFeedbacks.forEach((Result) => {
      if (Result.status === "fulfilled") return;
      AppLogger.error({
        message: SMActionFeedbackFailureErrMsg,
        label: FileLabel,
        error: { ...Result.reason },
        stack: Result.reason instanceof Error ? Result.reason.stack : null,
      });
    });
  } catch (Err: any) {
    if (Err instanceof AppError && Err.is_showable) {
      const ShiftExists = await ShiftModel.exists({ _id: ActiveShift._id });
      await Interaction.deferUpdate().catch(() => null);
      return Promise.allSettled([
        new ErrorEmbed().useErrClass(Err).replyToInteract(Interaction, true, true, "followUp"),
        UpdateManagementPrompt(
          Interaction,
          ActiveShift.type,
          PromptMsgId,
          ActiveShift,
          ShiftExists ? RecentShiftAction.End : undefined
        ),
      ]);
    } else {
      throw Err;
    }
  }
}

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Validates if the user has sufficient permissions to perform shift management actions.
 * @param Interaction - The button interaction to validate permissions for.
 * @returns An object indicating whether the interaction was handled and the target shift type.
 */
async function HandleUnauthorizedShiftManagement(
  Interaction: ButtonInteraction<"cached">
): Promise<{ handled: boolean; target_shift_type: string | null }> {
  const PredefinedResult: { handled: boolean; target_shift_type: string | null } = {
    handled: true,
    target_shift_type: null,
  };

  // 1. Check if the user who triggered the interaction is the same as the one who initiated it.
  const OriginUserId = Interaction.customId.split(":")[1] || "";
  if (IsValidDiscordId(OriginUserId) && Interaction.user.id !== OriginUserId) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UnauthorizedInteraction")
      .replyToInteract(Interaction, true)
      .then(() => PredefinedResult);
  }

  // 2. Check if guild document exist before proceeding. We're relying on its settings.
  const GuildSettings = await GetGuildSettings(Interaction.guildId);
  if (!GuildSettings) {
    return new ErrorEmbed()
      .useErrTemplate("GuildConfigNotFound")
      .replyToInteract(Interaction, true)
      .then(() => PredefinedResult);
  }

  // 3. Extract the target shift type from the initial/continueing interaction and proceed validation.
  const GShiftTypes = GuildSettings.shift_management.shift_types;
  const PromptShiftType = ExtractShiftTypeFromPrompt(Interaction);
  const TargettedShiftAction = Interaction.customId.split(":")[0] as ShiftMgmtActions;
  const PromptShiftTypeExists =
    PromptShiftType === "Default" || GShiftTypes.some((Type) => Type.name === PromptShiftType);

  if (!PromptShiftTypeExists && TargettedShiftAction === ShiftMgmtActions.ShiftOn) {
    return new ErrorEmbed()
      .useErrTemplate("DSMContinueNoShiftTypeFound")
      .replyToInteract(Interaction, true)
      .then(() => PredefinedResult);
  }

  // 4. Check if the user has the required permissions to perform the action on the target shift type.
  const IsUsageAllowed = await CheckShiftTypeRestrictions(
    Interaction,
    GShiftTypes,
    PromptShiftType
  );

  if (!IsUsageAllowed) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UnauthorizedShiftTypeUsage")
      .replyToInteract(Interaction, true)
      .then(() => PredefinedResult);
  }

  PredefinedResult.handled = false;
  PredefinedResult.target_shift_type = PromptShiftType;

  return PredefinedResult;
}

/**
 * Invalidates the shift action if some conditions are not met.
 * @param Interaction - The button interaction to process.
 * @param ShiftAction - The action to be performed.
 * @param TargetShift - The target shift document, if any.
 * @returns
 */
async function HandleInvalidShiftAction(
  Interaction: ButtonInteraction<"cached">,
  ShiftAction: ShiftMgmtActions,
  TargetShift?: ShiftDocument | null
) {
  const IsUsingComponentsV2 = Interaction.message.flags.has(MessageFlags.IsComponentsV2);
  const PromptMessageLastEditedTimestamp =
    Interaction.message.editedTimestamp || Interaction.message.createdTimestamp;

  if (
    !IsUsingComponentsV2 ||
    differenceInSeconds(Interaction.createdAt, PromptMessageLastEditedTimestamp) >= secondsInDay
  ) {
    await DisablePromptComponents(Interaction);
    return new ErrorEmbed()
      .useErrTemplate("DSMContinueExpired")
      .replyToInteract(Interaction, true, true, "followUp")
      .then(() => true);
  }

  if (
    [ShiftMgmtActions.ShiftOff, ShiftMgmtActions.ShiftBreakToggle].includes(ShiftAction) &&
    (!TargetShift || TargetShift.end_timestamp !== null)
  ) {
    if (TargetShift) {
      await UpdateManagementPrompt(
        Interaction,
        TargetShift.type,
        Interaction.message.id,
        TargetShift,
        RecentShiftAction.End
      );

      return new ErrorEmbed()
        .useErrTemplate("DSMStateChangedExternally")
        .replyToInteract(Interaction, true, true, "followUp")
        .then(() => true);
    } else {
      await DisablePromptComponents(Interaction);
      return new ErrorEmbed()
        .useErrTemplate("DSMInconsistentShiftActionShiftEnded")
        .replyToInteract(Interaction, true, true, "followUp")
        .then(() => true);
    }
  }

  return false;
}

/**
 * Updates the management prompt message with the latest shift information.
 * @param Interaction - The button interaction to process.
 * @param TShiftType - The target shift type to be used. First checks if there is a shift type; otherwise uses this shift type.
 * @param PromptMsgId - The ID of the prompt message to update. Just to be sure.
 * @param ActiveShift - The active shift document, if any.
 * @param PreviousAction - The previous action performed on the shift, if any.
 * @returns
 */
async function UpdateManagementPrompt(
  Interaction: ButtonInteraction<"cached">,
  TShiftType: string,
  PromptMsgId: string,
  ActiveShift?: ShiftDocument | null,
  PreviousAction?: RecentShiftAction | null
) {
  ActiveShift = ActiveShift || (await GetActiveShift({ UserOnly: true, Interaction }));
  if (ActiveShift?.end_timestamp !== null) ActiveShift = null;

  const ShiftType = ActiveShift?.type ?? TShiftType;
  const ManagementComponents = GetShiftManagementButtons(Interaction, ShiftType, ActiveShift);
  const MemberShiftsData = await GetMainShiftsData(
    {
      user: Interaction.user.id,
      guild: Interaction.guildId,
      type: ActiveShift ? ActiveShift.type : TShiftType,
    },
    !!ActiveShift
  );

  let ShiftOverviewDesc = "";
  const MgmtEmbedTitle = `Shift Management: \`${ShiftType}\` type`;
  const MgmtPromptMainDesc = Dedent(`
    > **Shift Count:** \`${MemberShiftsData.shift_count}\`
    > **Total On-Duty Time:** ${MemberShiftsData.total_onduty}
    > **Average On-Duty Time:** ${MemberShiftsData.avg_onduty}
  `);

  const PromptContainer = new BaseExtraContainer()
    .setColor(Colors.ShiftNatural)
    .setTitle(MgmtEmbedTitle, { no_sep: true });

  if (PreviousAction) {
    PromptContainer.setTitle(`${PreviousAction}`, {
      no_sep: true,
    });

    if (PreviousAction === RecentShiftAction.End) {
      PromptContainer.setColor(Colors.ShiftOff);
      const MostRecentFinishedShift = await ShiftModel.findOne({
        user: Interaction.user.id,
        guild: Interaction.guildId,
        end_timestamp: { $ne: null },
      }).sort({ end_timestamp: -1 });

      if (MostRecentFinishedShift) {
        const BreakTimeText =
          MostRecentFinishedShift.durations.on_break > 500
            ? `**Break Time:** ${MostRecentFinishedShift.on_break_time}`
            : "";

        ShiftOverviewDesc = Dedent(`
          **Shift Overview**
          >>> **Status:** (${Emojis.Offline}) Off-Duty
          **Shift Type:** \`${MostRecentFinishedShift.type}\`
          **Shift Started:** ${FormatTime(MostRecentFinishedShift.start_timestamp, "R")}${BreakTimeText ? `\n${BreakTimeText}` : ""}
        `);
      }
    } else if (PreviousAction === RecentShiftAction.BreakEnd && ActiveShift?.hasBreaks()) {
      PromptContainer.setColor(Colors.ShiftOn);
      const EndedBreak = ActiveShift.events.breaks.findLast((v) => v[0] && v[1])!;
      const BreaksTakenLine =
        ActiveShift.events.breaks.length > 1
          ? `**Breaks Taken:** ${ActiveShift.events.breaks.length}\n`
          : "";

      ShiftOverviewDesc =
        "**Current Shift**\n" +
        `>>> **Status:** (${Emojis.Online}) On Duty\n` +
        `**Shift Type:** \`${ActiveShift.type}\`\n` +
        `**Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}\n` +
        BreaksTakenLine +
        `**Ended Break Time:** ${EndedBreak[1] ? ReadableDuration(EndedBreak[1] - EndedBreak[0]) : "N/A"}\n` +
        `**Total Break Time:** ${ActiveShift.on_break_time}`;
    } else if (PreviousAction === RecentShiftAction.BreakStart && ActiveShift?.hasBreakActive()) {
      PromptContainer.setColor(Colors.ShiftBreak);
      const StartedBreak = ActiveShift.events.breaks.findLast((v) => !v[1])!;
      ShiftOverviewDesc = Dedent(`
        **Current Shift**
        >>> **Status:** (${Emojis.Idle}) On Break
        **Shift Type:** \`${ActiveShift.type}\`
        **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
        **Break Started:** ${FormatTime(Math.round(StartedBreak[0] / 1000), "R")}
        **On-Duty Time:** ${ActiveShift.on_duty_time}
        ${ActiveShift.events.breaks.length > 1 ? `**Total Break Time:** ${ActiveShift.on_break_time}` : ""}
      `);
    } else if (ActiveShift) {
      PromptContainer.setColor(Colors.ShiftOn);
      if (ActiveShift.durations.on_break > 500) {
        ShiftOverviewDesc = Dedent(`
          **Current Shift**
          >>> **Status:** (${Emojis.Online}) On Duty
          **Shift Type:** \`${ActiveShift.type}\`
          **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
          **Break Count:** ${inlineCode(ActiveShift.events.breaks.length.toString())}
          **T. Break Time:** ${ActiveShift.on_break_time}
        `);
      } else {
        ShiftOverviewDesc = Dedent(`
          **Current Shift**
          >>> **Status:** (${Emojis.Online}) On Duty
          **Shift Type:** \`${ActiveShift.type}\`
          **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
        `);
      }
    }
  }

  const DescTDIndex = PromptContainer.components.findIndex(
    (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
  );

  const ShouldUseSplice =
    DescTDIndex !== -1 &&
    ShiftOverviewDesc &&
    (!PreviousAction || PreviousAction === RecentShiftAction.End);

  if (ShouldUseSplice) {
    PromptContainer.components.splice(
      DescTDIndex,
      1,
      new TextDisplayBuilder().setContent(ShiftOverviewDesc),
      new TextDisplayBuilder().setContent(`**Statistics Summary**\n${MgmtPromptMainDesc}`)
    );
  } else if (ShiftOverviewDesc) {
    PromptContainer.setDescription(ShiftOverviewDesc);
  } else if (!PreviousAction) {
    PromptContainer.setDescription(`**Statistics Summary**\n${MgmtPromptMainDesc}`);
  }

  PromptContainer.attachPromptActionRows(ManagementComponents);
  if (Interaction.deferred || Interaction.replied) {
    return Interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      message: PromptMsgId,
      components: [PromptContainer],
    });
  }

  return Interaction.update({
    flags: MessageFlags.IsComponentsV2,
    components: [PromptContainer],
  });
}

/**
 * Disables the interactive components (buttons) of a shift management prompt.
 * This function updates the buttons to a disabled state and edits or updates the interaction reply accordingly.
 * @param Interaction - The button interaction object.
 * @param SafeDisable - (Optional) If true, the function will not throw an error if the prompt cannot be updated. Defaults to true.
 * @returns A promise that resolves when the interaction is updated or edited.
 */
async function DisablePromptComponents(
  Interaction: ButtonInteraction<"cached">,
  SafeDisable: boolean = true
) {
  const PromptComps = Interaction.message.components.map((Comp) => Comp.toJSON());
  const DisabledPrompt = DisableMessageComponents(PromptComps);

  try {
    if (Interaction.deferred || Interaction.replied) {
      await Interaction.editReply({
        message: Interaction.message.id,
        components: DisabledPrompt,
      });
    } else {
      await Interaction.update({
        components: DisabledPrompt,
      });
    }
  } catch (Err) {
    if (SafeDisable) return null;
    else throw Err;
  }
}

/**
 * Extracts the shift type from the embed of the shift management prompt message.
 * @param Interaction - The button interaction to process.
 * @param ThrowIfNotFound - Whether to throw an error if the shift type is not found in the embed. Defaults to true.
 * @returns
 */
function ExtractShiftTypeFromPrompt<TiNF extends boolean | undefined = true>(
  Interaction: ButtonInteraction<"cached">,
  ThrowIfNotFound?: TiNF
): TiNF extends true ? string : string | null {
  if (typeof ThrowIfNotFound !== "boolean") {
    ThrowIfNotFound = true as TiNF;
  }

  const ShiftTypeFromCustomId = Interaction.customId.split(":")[2]?.trim();
  if (ShiftTypeFromCustomId && IsValidShiftTypeName(ShiftTypeFromCustomId)) {
    return ShiftTypeFromCustomId.toLowerCase() === "default" ? "Default" : ShiftTypeFromCustomId;
  }

  if (!ThrowIfNotFound) return null as any;
  throw new AppError({ template: "DSMContinueNoShiftTypeFound", showable: true });
}
