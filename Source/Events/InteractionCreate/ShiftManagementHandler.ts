/* eslint-disable sonarjs/no-duplicate-string */
// Dependencies:
// -------------

import {
  inlineCode,
  EmbedBuilder,
  BaseInteraction,
  ButtonInteraction,
  time as FormatTime,
} from "discord.js";

import {
  ShiftMgmtActions,
  RecentShiftAction,
  GetShiftManagementButtons,
  CheckShiftTypeRestrictions,
} from "@Cmds/Miscellaneous/Duty/Subcmds/Manage.js";

import { Shifts } from "@Typings/Utilities/Database.js";
import { GetErrorId } from "@Utilities/Strings/Random.js";
import { secondsInDay } from "date-fns/constants";
import { ErrorMessages } from "@Resources/AppMessages.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { differenceInSeconds } from "date-fns";
import { ErrorEmbed, UnauthorizedEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { DutyManagementBtnCustomIdRegex } from "@Resources/RegularExpressions.js";
import { IsValidDiscordId, IsValidShiftTypeName } from "@Utilities/Other/Validators.js";

import HandleRoleAssignment from "@Utilities/Other/HandleShiftRoleAssignment.js";
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

  const TargetShift = await ShiftModel.findById(TargetShiftId).exec();
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
      await Interaction.deferUpdate().catch(() => null);
      return Promise.allSettled([
        new ErrorEmbed().useErrClass(Err).replyToInteract(Interaction, true, false, "followUp"),
        UpdateManagementPrompt(
          Interaction,
          ActiveShift.type,
          PromptMsgId,
          ActiveShift,
          RecentShiftAction.BreakStart
        ),
      ]);
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
  const PromptMessageLastEditedTimestamp =
    Interaction.message.editedTimestamp || Interaction.message.createdTimestamp;

  if (
    differenceInSeconds(Interaction.createdAt, PromptMessageLastEditedTimestamp) >= secondsInDay
  ) {
    await DisablePromptComponents(Interaction, TargetShift?.type);
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

  const MgmtEmbedTitle = `Shift Management: \`${ShiftType}\` Type`;
  const MgmtPromptMainDesc = Dedent(`
    >>> **Shift Count:** \`${MemberShiftsData.shift_count}\`
    **Total On-Duty Time:** ${MemberShiftsData.total_onduty}
    **Average On-Duty Time:** ${MemberShiftsData.avg_onduty}
  `);

  const PromptEmbed = new EmbedBuilder().setColor(Colors.ShiftNatural).setTitle(MgmtEmbedTitle);

  if (PreviousAction) {
    if (PreviousAction === RecentShiftAction.End) {
      PromptEmbed.setColor(Colors.ShiftOff);
      PromptEmbed.setTitle(PreviousAction);
      PromptEmbed.setFooter({ text: `Shift Type: ${ShiftType}` });

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

        PromptEmbed.addFields(
          {
            inline: true,
            name: "Shift Overview",
            value: Dedent(`
              >>> **Status:** (${Emojis.Offline}) Off-Duty
              **Shift Time:** ${MostRecentFinishedShift.on_duty_time}
              ${BreakTimeText}
            `),
          },
          {
            inline: true,
            name: "Shift Activity",
            value: Dedent(`
              >>> **Arrests Made:** \`${MostRecentFinishedShift.events.arrests}\`
              **Citations Issued:** \`${MostRecentFinishedShift.events.citations}\`
              **Incidents Reported:** \`${MostRecentFinishedShift.events.incidents}\`
            `),
          },
          {
            inline: false,
            name: "Statistics Summary",
            value: MgmtPromptMainDesc,
          }
        );
      }
    } else if (PreviousAction === RecentShiftAction.BreakEnd && ActiveShift?.hasBreaks()) {
      const EndedBreak = ActiveShift.events.breaks.findLast((v) => v[0] && v[1])!;
      const BreaksTakenLine =
        ActiveShift.events.breaks.length > 1
          ? `**Breaks Taken:** ${ActiveShift.events.breaks.length}\n`
          : "";

      PromptEmbed.setColor(Colors.ShiftOn);
      PromptEmbed.setFooter({ text: `Shift Type: ${ShiftType}` });
      PromptEmbed.setTitle(PreviousAction);
      PromptEmbed.setFields({
        inline: true,
        name: "Current Shift",
        value:
          `>>> **Status:** (${Emojis.Online}) On Duty\n` +
          `**Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}\n` +
          BreaksTakenLine +
          `**Ended Break Time:** ${EndedBreak[1] ? ReadableDuration(EndedBreak[1] - EndedBreak[0]) : "N/A"}\n` +
          `**Total Break Time:** ${ActiveShift.on_break_time}`,
      });
    } else if (PreviousAction === RecentShiftAction.BreakStart && ActiveShift?.hasBreakActive()) {
      const StartedBreak = ActiveShift.events.breaks.findLast((v) => !v[1])!;
      PromptEmbed.setColor(Colors.ShiftBreak);
      PromptEmbed.setFooter({ text: `Shift Type: ${ShiftType}` });
      PromptEmbed.setTitle(PreviousAction);
      PromptEmbed.setFields({
        inline: true,
        name: "Current Shift",
        value: Dedent(`
          >>> **Status:** (${Emojis.Idle}) On Break
          **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
          **Break Started:** ${FormatTime(Math.round(StartedBreak[0] / 1000), "R")}
          **On-Duty Time:** ${ActiveShift.on_duty_time}
          ${ActiveShift.events.breaks.length > 1 ? `**Total Break Time:** ${ActiveShift.on_break_time}` : ""}
        `),
      });
    } else if (ActiveShift) {
      PromptEmbed.setColor(Colors.ShiftOn);
      if (!PromptEmbed.data.fields?.find((Field) => Field.name === "Current Shift")) {
        if (ActiveShift.durations.on_break > 500) {
          PromptEmbed.addFields({
            name: "Current Shift",
            value: Dedent(`
              >>> **Status:** (${Emojis.Online}) On Duty
              **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
              **Break Count:** ${inlineCode(ActiveShift.events.breaks.length.toString())}
              **Total Break Time:** ${ActiveShift.on_break_time}
            `),
          });
        } else {
          PromptEmbed.addFields({
            name: "Current Shift",
            value: Dedent(`
              >>> **Status:** (${Emojis.Online}) On Duty
              **Shift Started:** ${FormatTime(ActiveShift.start_timestamp, "R")}
            `),
          });
        }
      }
    }
  }

  if (!PreviousAction || PreviousAction === RecentShiftAction.Start) {
    PromptEmbed.addFields({
      inline: true,
      name: "Statistics Summary",
      value: MgmtPromptMainDesc,
    });
  }

  if (Interaction.deferred || Interaction.replied) {
    return Interaction.editReply({
      message: PromptMsgId,
      embeds: [PromptEmbed],
      components: [ManagementComponents],
    });
  }

  return Interaction.update({
    embeds: [PromptEmbed],
    components: [ManagementComponents],
  });
}

/**
 * Disables the interactive components (buttons) of a shift management prompt.
 * This function updates the buttons to a disabled state and edits or updates the interaction reply accordingly.
 * @param Interaction - The button interaction object.
 * @param TargetShiftType - (Optional) The specific shift type to target when updating the buttons.
 * @param SafeDisable - (Optional) If true, the function will not throw an error if the prompt cannot be updated. Defaults to true.
 * @returns A promise that resolves when the interaction is updated or edited.
 */
async function DisablePromptComponents(
  Interaction: ButtonInteraction<"cached">,
  TargetShiftType?: string,
  SafeDisable: boolean = true
) {
  const DisabledMgmtComponents = GetShiftManagementButtons(
    Interaction,
    TargetShiftType
  ).updateButtons({ start: false, end: false, break: false });

  try {
    if (Interaction.deferred || Interaction.replied) {
      await Interaction.editReply({
        message: Interaction.message.id,
        components: [DisabledMgmtComponents],
      });
    } else {
      await Interaction.update({
        components: [DisabledMgmtComponents],
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

  const Embed = Interaction.message.embeds[0];
  if (!Embed) {
    if (!ThrowIfNotFound) return null as any;
    throw new AppError({ template: "DSMEmbedNotFound", showable: true });
  }

  const ShiftTypeTitle = Embed.title
    ?.match(/(?:Shift|Duty)\s+?Manage(?:ment)?: `?([\w\s]+)`?/i)?.[1]
    ?.trim();

  if (ShiftTypeTitle) return ShiftTypeTitle;
  const ShiftTypeFooter = Embed.footer?.text
    .match(/(?:Shift|Duty)\s+?Type: `?([\w\s]+)`?/i)?.[1]
    ?.trim();

  if (ShiftTypeFooter) return ShiftTypeFooter;
  if (!ThrowIfNotFound) return null as any;
  throw new AppError({ template: "DSMContinueNoShiftTypeFound", showable: true });
}
