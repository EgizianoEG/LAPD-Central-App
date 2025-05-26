/* eslint-disable sonarjs/no-duplicate-string */
// Dependencies:
// -------------

import {
  Message,
  inlineCode,
  ButtonStyle,
  EmbedBuilder,
  ButtonBuilder,
  MessagePayload,
  ActionRowBuilder,
  ButtonInteraction,
  time as FormatTime,
  InteractionReplyOptions,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Guilds, Shifts } from "@Typings/Utilities/Database.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { ErrorEmbed, UnauthorizedEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import GetMainShiftsData from "@Utilities/Database/GetShiftsData.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import GetShiftActive from "@Utilities/Database/GetShiftActive.js";
import UserHasPerms from "@Utilities/Database/UserHasPermissions.js";
import Dedent from "dedent";

export enum RecentShiftAction {
  End = "Shift Ended",
  Start = "Shift Started",
  BreakEnd = "Shift Break Ended",
  BreakStart = "Shift Break Started",
}

export enum ShiftMgmtActions {
  ShiftOn = "dm-start",
  ShiftOff = "dm-end",
  ShiftBreakToggle = "dm-break",
}

type ShiftMgmtButtonsActionRow = ActionRowBuilder<
  ButtonBuilder & { data: { custom_id: string } }
> & {
  /**
   * Updates the disabled state of the buttons within the shift management action row.
   * @param enabledStates - An object where:
   * - The keys represent the identifiers of the buttons to update (e.g., "start", "break", "end").
   * - The values are booleans indicating the desired disabled state for each button:
   *   - `true` to enable the button.
   *   - `false` to disable the button.
   *   - `undefined` to leave the button's state unchanged.
   *
   * @returns The updated ActionRow instance.
   */
  updateButtons(
    enabledStates: Record<"start" | "break" | "end", boolean | undefined>
  ): ShiftMgmtButtonsActionRow;
};

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Constructs a set of management buttons (start, break, end).
 * @param Interaction - A cached slash command interaction to get guild and user Ids from.
 * @param [ShiftType="Default"] - The type of shift to be managed. Defaults to "Default", the application's default shift type.
 * @param [ShiftActive] - The current active shift of the user, if any.
 * @notice
 * The pattern for management button IDs is as follows:
 *   `<ShiftAction>:<UserId>:<TargettedShiftType>[:ShiftId]`.
 *   - `<ShiftAction>`: The action to be performed (e.g., `shift-on`, `shift-off`, etc.)
 *   - `<UserId>`: The ID of the user who triggered the action.
 *   - `<TargettedShiftType>`: The type of shift being targeted (e.g., `day`, `night`, etc.)
 *   - `[TargettedShiftId]`: The ID of the shift being targeted, if applicable. Optional as sometimes there is no shift to take action on in the first place.
 *
 * @returns A row of buttons for managing shifts.
 */
export function GetShiftManagementButtons(
  Interaction: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  ShiftType: string | null = "Default",
  ShiftActive?: Shifts.HydratedShiftDocument | null
) {
  const ActionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ShiftMgmtActions.ShiftOn)
      .setLabel("On Duty")
      .setEmoji(Emojis.TimeClockIn)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(ShiftMgmtActions.ShiftBreakToggle)
      .setLabel("Toggle Break")
      .setEmoji(Emojis.TimeClockPause)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ShiftMgmtActions.ShiftOff)
      .setLabel("Off Duty")
      .setEmoji(Emojis.TimeClockOut)
      .setStyle(ButtonStyle.Danger)
  ) as ShiftMgmtButtonsActionRow;

  ActionRow.updateButtons = function UpdateNavigationButtons(
    ButtonsToEnable: Record<"start" | "break" | "end", boolean | undefined>
  ) {
    const ButtonMap = { start: 0, break: 1, end: 2 };
    for (const [Name, Enabled] of Object.entries(ButtonsToEnable)) {
      this.components[ButtonMap[Name]].setDisabled(!Enabled);
    }
    return this;
  };

  ActionRow.updateButtons({
    start: !ShiftActive || !!ShiftActive.end_timestamp,
    break: !!ShiftActive && !ShiftActive.end_timestamp,
    end: !!ShiftActive && !ShiftActive.end_timestamp && !ShiftActive.hasBreakActive(),
  });

  const ActiveShiftIdSuffix = ShiftActive?.id ? `:${ShiftActive.id}` : "";
  ActionRow.components.forEach((Comp) =>
    Comp.setCustomId(
      `${Comp.data.custom_id}:${Interaction.user.id}:${ShiftType}${ActiveShiftIdSuffix}`
    )
  );

  return ActionRow;
}

/**
 * Handles the validation of shift type restrictions and checks whether the user has permission to use a specific shift type.
 * @param Interaction - The received command interaction.
 * @param GuildShiftTypes - The created shift types of the interaction's guild.
 * @param CmdShiftType - The user requested/received shift type.
 * @returns A boolean value. `true` if the user has permission to use the shift type, `false` otherwise.
 */
export async function CheckShiftTypeRestrictions(
  Interaction: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  GuildShiftTypes:
    | Guilds.ShiftType[]
    | NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>["shift_management"]["shift_types"],
  CmdShiftType?: string | null
) {
  const GuildDefaultType = GuildShiftTypes.find((ShiftType) => ShiftType.is_default);
  const DesiredShiftType = GuildShiftTypes.find((ShiftType) => ShiftType.name === CmdShiftType);

  if (CmdShiftType?.toLowerCase() === "default") return true;
  if (!CmdShiftType && !GuildDefaultType) return true;

  // Users with management permissions can use any shift type.
  const UserHasMgmtPerms = await UserHasPerms(Interaction, {
    management: { guild: true, app: true, $or: true },
  });

  if (UserHasMgmtPerms) return true;
  if (CmdShiftType && DesiredShiftType) {
    return Interaction.member.roles.cache.hasAny(...DesiredShiftType.access_roles);
  } else if (GuildDefaultType) {
    return Interaction.member.roles.cache.hasAny(...GuildDefaultType.access_roles);
  }

  return false;
}

/**
 * Verifies the usage of a specific shift type.
 * @param CmdInteract - The interaction object for the slash command.
 * @returns A promise that resolves to an object indicating whether the command was handled or not.
 *          If handled, it returns `{ handled: true }`.
 *          If not handled, it returns an object containing:
 *          - `shift_types`: The available shift types from the guild settings.
 *          - `guild_settings`: The guild settings object.
 *          - `target_shift_type`: The determined target shift type.
 *
 * The function performs the following steps:
 * 1. Retrieves the guild settings.
 * 2. Determines the target shift type based on the command interaction options.
 * 3. Checks if the specified shift type exists and if the user is authorized to use it.
 * 4. Returns appropriate responses based on the checks.
 */
async function HandleCommandUsageVerification(
  CmdInteract: SlashCommandInteraction<"cached">
): Promise<
  | { handled: true }
  | {
      handled: false;
      shift_types: NonNullable<
        Awaited<ReturnType<typeof GetGuildSettings>>
      >["shift_management"]["shift_types"];
      guild_settings: NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>;
      target_shift_type: string;
    }
> {
  const GuildSettings = await GetGuildSettings(CmdInteract.guildId);
  if (!GuildSettings) {
    return new ErrorEmbed()
      .useErrTemplate("GuildConfigNotFound")
      .replyToInteract(CmdInteract, true)
      .then(() => {
        return {
          handled: true,
        };
      });
  }

  const ShiftTypes = GuildSettings.shift_management.shift_types;
  const CmdShiftType = CmdInteract.options.getString("type")?.trim();
  const CmdShiftTypeMDef = CmdShiftType?.match(/^Default$/i);
  const GuildDefaultST = ShiftTypes.findIndex((ShiftType) => ShiftType.is_default);
  const CustomSTIndex = ShiftTypes.findIndex((ShiftType) => ShiftType.name === CmdShiftType);
  let TargetShiftType = "";

  if (CmdShiftTypeMDef) {
    TargetShiftType = "Default";
  } else if (CustomSTIndex !== -1) {
    TargetShiftType = ShiftTypes[CustomSTIndex].name;
  } else if (!CmdShiftType) {
    TargetShiftType = ShiftTypes[GuildDefaultST]?.name || "Default";
  }

  // Early return if the input shift type inputted is not found as a custom shift type;
  if (CmdShiftType && !CmdShiftTypeMDef && CustomSTIndex === -1) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentShiftTypeUsage")
      .replyToInteract(CmdInteract, true)
      .then(() => {
        return {
          handled: true,
        };
      });
  }

  // Or if the user is not allowed to use a specific shift type.
  const IsUsageAllowed = await CheckShiftTypeRestrictions(CmdInteract, ShiftTypes, TargetShiftType);
  if (!IsUsageAllowed) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UnauthorizedShiftTypeUsage")
      .replyToInteract(CmdInteract, true)
      .then(() => {
        return {
          handled: true,
        };
      });
  }

  return {
    handled: false,
    shift_types: ShiftTypes,
    guild_settings: GuildSettings,
    target_shift_type: TargetShiftType,
  };
}

/**
 * Replies to or edits a reply *safely* to a slash command interaction.
 * @notice The main point of this function is to handle repeated interactions after the webhook token expires.
 *         If the token expires, the function will then attempt to fetch the original command reply (the message)
 *         and edit it with message methods.
 *
 * @param CmdInteract - The slash command interaction object.
 * @param ReplyOpts - The options for the reply or edit.
 * @returns A promise that resolves to the reply or edited message or `null` if nothing were done or an error occurred.
 */
async function CmdInteractSafeReplyOrEditReply(
  CmdInteract: SlashCommandInteraction<"cached">,
  ReplyOpts: MessagePayload | InteractionReplyOptions
): Promise<Message<true>> {
  try {
    let CmdMessage: Message<true>;
    if (CmdInteract.deferred || CmdInteract.replied) {
      CmdMessage = await CmdInteract.editReply(ReplyOpts as MessagePayload);
    } else {
      CmdMessage = await CmdInteract.reply({
        ...(ReplyOpts as InteractionReplyOptions),
        withResponse: true,
      }).then((Resp) => Resp.resource!.message! as Message<true>);
    }
    return CmdMessage;
  } catch (Err) {
    const CmdReplyMsg = await CmdInteract.fetchReply().catch(() => null);
    if (!CmdReplyMsg?.editable) throw Err;
    return CmdReplyMsg.edit(ReplyOpts as MessagePayload);
  }
}

// ---------------------------------------------------------------------------------------
// State Handlers:
// ---------------

async function HandleNonActiveShift(
  CmdInteract: SlashCommandInteraction<"cached">,
  MgmtPromptEmbed: EmbedBuilder,
  MgmtShiftType: string
) {
  const MgmtComps = GetShiftManagementButtons(CmdInteract, MgmtShiftType);
  const PromptEmbed = MgmtPromptEmbed.setColor(MgmtPromptEmbed.data.color || Colors.ShiftNatural);

  return CmdInteractSafeReplyOrEditReply(CmdInteract, {
    embeds: [PromptEmbed],
    components: [MgmtComps],
  });
}

async function HandleOnBreakShift(
  CmdInteract: SlashCommandInteraction<"cached">,
  ShiftActive: Shifts.HydratedShiftDocument,
  BaseEmbedTitle: string
) {
  const BreakEpochs = ShiftActive.events.breaks.findLast(([, end]) => end === null);
  const MgmtComps = GetShiftManagementButtons(CmdInteract, ShiftActive.type, ShiftActive);
  const FieldDescription = Dedent(`
    >>> **Status:** (${Emojis.Idle}) On Break
    **Shift Started:** ${FormatTime(ShiftActive.start_timestamp, "R")}
    **Break Started:** ${FormatTime(Math.round(BreakEpochs![0] / 1000), "R")}
    **On-Duty Time:** ${ShiftActive.on_duty_time}
  `);

  const PromptEmbed = new EmbedBuilder()
    .setColor(Colors.ShiftBreak)
    .setTitle(BaseEmbedTitle)
    .setFields({ name: "Current Shift", value: FieldDescription });

  return CmdInteractSafeReplyOrEditReply(CmdInteract, {
    components: [MgmtComps],
    embeds: [PromptEmbed],
  });
}

async function HandleActiveShift(
  CmdInteract: SlashCommandInteraction<"cached">,
  ShiftActive: Shifts.HydratedShiftDocument,
  MgmtPromptEmbed: EmbedBuilder
) {
  const PromptEmbed = MgmtPromptEmbed.setColor(Colors.ShiftOn);
  const MgmtButtonComponents = GetShiftManagementButtons(
    CmdInteract,
    ShiftActive.type,
    ShiftActive
  );

  if (!PromptEmbed.data.fields?.find((Field) => Field.name === "Current Shift")) {
    if (ShiftActive.durations.on_break > 500) {
      PromptEmbed.addFields({
        name: "Current Shift",
        value: Dedent(`
          >>> **Status:** (${Emojis.Online}) On Duty
          **Shift Started:** ${FormatTime(ShiftActive.start_timestamp, "R")}
          **Break Count:** ${inlineCode(ShiftActive.events.breaks.length.toString())}
          **Total Break Time:** ${ShiftActive.durations.on_break_time}
        `),
      });
    } else {
      PromptEmbed.addFields({
        name: "Current Shift",
        value: Dedent(`
          >>> **Status:** (${Emojis.Online}) On Duty
          **Shift Started:** ${FormatTime(ShiftActive.start_timestamp, "R")}
        `),
      });
    }
  }

  return CmdInteractSafeReplyOrEditReply(CmdInteract, {
    components: [MgmtButtonComponents],
    embeds: [PromptEmbed],
  });
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  const VerificationDetails = await HandleCommandUsageVerification(CmdInteract);
  if (VerificationDetails.handled === true) return;
  if (!CmdInteract.deferred && !CmdInteract.replied) await CmdInteract.deferReply();

  const TargetShiftType = VerificationDetails.target_shift_type;
  const CmdShiftType = CmdInteract.options.getString("type", false);
  const ShiftActive = await GetShiftActive({
    ShiftType: CmdShiftType ? TargetShiftType : undefined,
    Interaction: CmdInteract,
    UserOnly: true,
  });

  const MemberShiftsData = await GetMainShiftsData(
    {
      user: CmdInteract.user.id,
      guild: CmdInteract.guildId,
      type: ShiftActive ? ShiftActive.type : TargetShiftType,
    },
    !!ShiftActive
  );

  const MgmtEmbedTitle = `Shift Management: \`${TargetShiftType}\` Type`;
  const MgmtPromptMainDesc = Dedent(`
    >>> **Shift Count:** \`${MemberShiftsData.shift_count}\`
    **Total On-Duty Time:** ${MemberShiftsData.total_onduty}
    **Average On-Duty Time:** ${MemberShiftsData.avg_onduty}
  `);

  const BasePromptEmbed = new EmbedBuilder()
    .setColor(Colors.ShiftNatural)
    .setTitle(ShiftActive ? `Shift Management: \`${ShiftActive.type}\` Type` : MgmtEmbedTitle)
    .setFields({
      inline: true,
      name: "Statistics Summary",
      value: MgmtPromptMainDesc,
    });

  if (!ShiftActive) {
    return HandleNonActiveShift(CmdInteract, BasePromptEmbed, TargetShiftType);
  } else if (ShiftActive.hasBreakActive()) {
    return HandleOnBreakShift(CmdInteract, ShiftActive, BasePromptEmbed.data.title!);
  }

  return HandleActiveShift(CmdInteract, ShiftActive, BasePromptEmbed);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage and control your own duty shift.")
    .addStringOption((Option) =>
      Option.setName("type")
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(false)
        .setAutocomplete(true)
        .setDescription(
          "The type of duty shift to be managed; defaults to this server's default shift type."
        )
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
