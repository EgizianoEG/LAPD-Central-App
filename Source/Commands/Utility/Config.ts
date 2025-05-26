/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable sonarjs/use-type-alias */
import {
  Message,
  CacheType,
  ButtonStyle,
  ChannelType,
  roleMention,
  resolveColor,
  ModalBuilder,
  MessageFlags,
  ButtonBuilder,
  SectionBuilder,
  ComponentType,
  TextInputStyle,
  channelMention,
  ContainerBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  ButtonInteraction,
  GuildBasedChannel,
  TextDisplayBuilder,
  time as FormatTime,
  InteractionResponse,
  SlashCommandBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  InteractionContextType,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  InteractionUpdateOptions,
  RoleSelectMenuInteraction,
  ApplicationIntegrationType,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  ModalActionRowComponentBuilder,
} from "discord.js";

import {
  BaseExtraContainer,
  SuccessContainer,
  ErrorContainer,
  InfoContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import { Dedent } from "@Utilities/Strings/Formatters.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { milliseconds } from "date-fns/milliseconds";
import { ArraysAreEqual } from "@Utilities/Other/ArraysAreEqual.js";
import { Colors, Emojis } from "@Config/Shared.js";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";

import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import DisableMessageComponents from "@Utilities/Other/DisableMsgComps.js";
import AwaitMessageWithTimeout from "@Utilities/Other/MessageCreateListener.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import ParseDuration from "parse-duration";
import GuildModel from "@Models/Guild.js";
import DHumanize from "humanize-duration";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";

// ---------------------------------------------------------------------------------------
// Constants, Types, & Enums:
// --------------------------
const ListFormatter = new Intl.ListFormat("en");
const MillisInDay = milliseconds({ days: 1 });
const AccentColor = resolveColor("#5f9ea0");
const FileLabel = "Commands:Utility:Config";
const FormatDuration = DHumanize.humanizer({
  conjunction: " and ",
  largest: 3,
  round: true,
});

type ValueOf<T> = T[keyof T];
type GuildSettings = NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>;
type CmdSelectOrButtonInteract<Cached extends CacheType = CacheType> =
  | SlashCommandInteraction<Cached>
  | StringSelectMenuInteraction<Cached>
  | ChannelSelectMenuInteraction<Cached>
  | RoleSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

type ModulePromptUpdateSupportedInteraction =
  | ButtonInteraction<"cached">
  | RoleSelectMenuInteraction<"cached">
  | ChannelSelectMenuInteraction<"cached">
  | StringSelectMenuInteraction<"cached">;

type ContainerGetterFn<T> = (
  interaction: ModulePromptUpdateSupportedInteraction,
  config: T
) => ContainerBuilder;

type ConfigTopicsCompIds = ValueOf<{
  [K in keyof typeof CTAIds]: ValueOf<(typeof CTAIds)[K]>;
}>;

enum ConfigTopics {
  ShowConfigurations = "app-config-vc",
  BasicConfiguration = "app-config-bc",
  ShiftConfiguration = "app-config-sc",
  LeaveConfiguration = "app-config-loa",
  DutyActConfiguration = "app-config-da",
  AdditionalConfiguration = "app-config-ac",
  ReducedActivityConfiguration = "app-config-ra",
}

/**
 * Configuration topics action Ids mapping.
 */
const CTAIds = {
  [ConfigTopics.BasicConfiguration]: {
    RobloxAuthRequired: `${ConfigTopics.BasicConfiguration}-rar`,
    MgmtRoles: `${ConfigTopics.BasicConfiguration}-mr`,
    StaffRoles: `${ConfigTopics.BasicConfiguration}-sr`,
  },

  [ConfigTopics.ShiftConfiguration]: {
    ModuleEnabled: `${ConfigTopics.ShiftConfiguration}-me`,
    LogChannel: `${ConfigTopics.ShiftConfiguration}-lc`,
    OnDutyRoles: `${ConfigTopics.ShiftConfiguration}-odr`,
    OnBreakRoles: `${ConfigTopics.ShiftConfiguration}-obr`,
  },

  [ConfigTopics.LeaveConfiguration]: {
    ModuleEnabled: `${ConfigTopics.LeaveConfiguration}-me`,
    RequestsChannel: `${ConfigTopics.LeaveConfiguration}-rc`,
    LogChannel: `${ConfigTopics.LeaveConfiguration}-lc`,
    OnLeaveRole: `${ConfigTopics.LeaveConfiguration}-olr`,
  },

  [ConfigTopics.DutyActConfiguration]: {
    ModuleEnabled: `${ConfigTopics.DutyActConfiguration}-me`,
    ArrestLogLocalChannel: `${ConfigTopics.DutyActConfiguration}-alc`,
    CitationLogLocalChannel: `${ConfigTopics.DutyActConfiguration}-clc`,
    IncidentLogLocalChannel: `${ConfigTopics.DutyActConfiguration}-ilc`,

    OutsideArrestLogChannel: `${ConfigTopics.DutyActConfiguration}-oalc`,
    OutsideCitationLogChannel: `${ConfigTopics.DutyActConfiguration}-oclc`,
  },

  [ConfigTopics.AdditionalConfiguration]: {
    ServerDefaultShiftQuota: `${ConfigTopics.AdditionalConfiguration}-darq`,
    DActivitiesDeletionInterval: `${ConfigTopics.AdditionalConfiguration}-dadi`,
    UserTextInputFilteringEnabled: `${ConfigTopics.AdditionalConfiguration}-utfe`,
  },

  [ConfigTopics.ReducedActivityConfiguration]: {
    ModuleEnabled: `${ConfigTopics.ReducedActivityConfiguration}-me`,
    RequestsChannel: `${ConfigTopics.ReducedActivityConfiguration}-rc`,
    LogChannel: `${ConfigTopics.ReducedActivityConfiguration}-lc`,
    RARole: `${ConfigTopics.ReducedActivityConfiguration}-rar`,
  },
} as const;

/**
 * Configuration topics explanations mapping.
 */
const ConfigTopicsExplanations = {
  [ConfigTopics.BasicConfiguration]: {
    Title: "App Basic Configuration",
    Settings: [
      {
        Name: "Roblox Authorization Required",
        Description:
          "Enable or disable the app's Roblox authorization requirement. If enabled, the app requires users to have their Roblox account linked before " +
          "they can use specific staff commands, such as `log` and `duty` commands. This option is enabled and cannot be changed at the moment by default.",
      },
      {
        Name: "Staff Roles",
        Description:
          "The roles for which holders will be considered staff members and will be able to execute staff-specific commands.",
      },
      {
        Name: "Management Roles",
        Description:
          "The roles whose members can execute management-specific commands (e.g., `/duty admin`, `/loa admin`, etc.), in addition to staff-specific commands. " +
          "Members with administrator permissions will be able to execute management-specific commands regardless of whether they have staff or management roles.",
      },
    ],
  },
  [ConfigTopics.ShiftConfiguration]: {
    Title: "Shift Module Configuration",
    Settings: [
      {
        Name: "Module Enabled",
        Description:
          "Toggle whether to enable or disable shift management commands, with certain exceptions included.",
      },
      {
        Name: "Shift Role Assignment",
        Description:
          "**On-Duty:** The role(s) that will be assigned to staff members while being on duty.\n" +
          "**On-Break:** The role(s) that will be assigned to staff members while being on break.",
      },
      {
        Name: "Shift Log Destination",
        Description:
          "The channel or thread where notices will be sent when a shift starts, pauses, ends, is voided, or when a shift data wipe or modification occurs.",
      },
    ],
  },
  [ConfigTopics.LeaveConfiguration]: {
    Title: "Leave Module Configuration",
    Settings: [
      {
        Name: "Module Enabled",
        Description: "Whether to allow the usage of leave of absence commands or not.",
      },
      {
        Name: "Leave Status Role",
        Description:
          "The role that will be assigned to members when their leave of absence starts, and will be removed when their leave ends.",
      },
      {
        Name: "Leave Requests Destination",
        Description:
          "The channel or thread used to send leave requests submitted by members. Setting this channel is optional, but if not set, management " +
          "staff will need to use the `/loa admin` command to review members' pending requests.",
      },
      {
        Name: "Activity Log Destination",
        Description:
          "A separate channel or thread used to log various activities in the leave of absence module, including leave approvals, denials, cancellations, and terminations.",
      },
    ],
  },
  [ConfigTopics.DutyActConfiguration]: {
    Title: "Duty Activities Module Configuration",
    Settings: [
      {
        Name: "Module Enabled",
        Description:
          "Toggle whether this module is enabled. Disabling it will prevent the use of any related commands, certain exceptions may be included.",
      },
      {
        Name: "Citation Log Destination",
        Description:
          "The local channel or thread  within this server that will be used to log any citations issued by staff members.",
      },
      {
        Name: "Arrest Log Destination",
        Description:
          "The local channel or thread  within this server that will be used to log any arrests reported by staff members.",
      },
      {
        Name: "Incident Report Destination",
        Description:
          "Select the channel or thread where submitted incident reports will be sent. This channel should be accessible " +
          "to relevant staff members for reviewing and managing incident reports.",
      },
      {
        Name: "Cross-Server Log Sharing",
        Description:
          "Add channels from other servers to mirror your citation and arrest logs. " +
          "These will receive identical log messages alongside your primary local channels.",
      },
    ],
  },
  [ConfigTopics.AdditionalConfiguration]: {
    Title: "Additional App Configuration",
    Settings: [
      {
        Name: "Log Deletion Interval",
        Description:
          "Specify the interval, in days, at which citation, arrest, and incident logs will be automatically deleted. " +
          "The default setting is to never delete logs. Note: changing this setting will affect both existing and new logs.",
      },
      {
        Name: "Member Text Inputs Filtering",
        Description:
          "Enable or disable filtering of member text input in certain commands to help prevent abuse within the application. " +
          "This setting is enabled by default and uses the server's auto-moderation rules to attempt to redact profane words " +
          "and offensive language, in addition to the link filtering provided by the application.",
      },
      {
        Name: "Server Default Shift Quota",
        Description:
          "Set the default shift quota for all staff in here to a specific duration of time. This will be taken " +
          "into account, for example, when generating activity reports where a quota was not provided.",
      },
    ],
  },
  [ConfigTopics.ReducedActivityConfiguration]: {
    Title: "Reduced Activity Module Configuration",
    Settings: [
      {
        Name: "Module Status",
        Description: "Controls whether reduced activity features are available.",
      },
      {
        Name: "RA Status Role",
        Description:
          "This role will be automatically applied when reduced activity begins and removed when it concludes.",
      },
      {
        Name: "Request Submission Destination",
        Description:
          "Designated channel or thread for member reduced activity notices. If not configured, staff must process requests via the `ra admin` command.",
      },
      {
        Name: "Activity Log Destination",
        Description:
          "Holds all reduced activity events including approvals, rejections, cancellations, and early terminations.",
      },
    ],
  },
} as const;

// ---------------------------------------------------------------------------------------
// General Helpers:
// ----------------
/**
 * Converts a log deletion interval from milliseconds to a human-readable string.
 * @param Interval - The interval in milliseconds.
 * @returns A string representing the interval in days (e.g., "2 Days", "One Day", or "Never" if less than one day).
 */
function GetHumanReadableLogDeletionInterval(Interval: number) {
  const IntervalInDays = Interval / MillisInDay;
  if (IntervalInDays > 1) {
    return `${IntervalInDays} Days`;
  } else if (IntervalInDays === 1) {
    return "One Day";
  } else {
    return "Never";
  }
}

/**
 * Updates an interaction prompt and returns the updated message.
 * @param Interact - The cached message component interaction to update
 * @param Opts - The options to update the interaction with
 * @returns A promise that resolves to the updated message
 */
async function UpdatePromptReturnMessage(
  Interact: MessageComponentInteraction<"cached">,
  Opts: InteractionUpdateOptions
): Promise<Message<true>> {
  return Interact.update({ ...Opts, withResponse: true }).then(
    (resp) => resp.resource!.message! as Message<true>
  );
}

/**
 * Handles the update of a timeout prompt for a specific configuration module.
 * This function updates the interaction with a message indicating that the
 * configuration prompt has timed out.
 * @param Interact - Any prompt-related interaction which webhook hasn't expired yet.
 * @param CurrModule - The name of the current module for which the configuration prompt has timed out.
 * @param PromptMsg - The prompt message Id if available; to not edit an incorrect message.
 * @returns A promise that resolves to the result of the interaction update or edit operation,
 *          or `null` if the operation fails.
 */
async function HandleConfigTimeoutResponse(
  Interact: MessageComponentInteraction<"cached">,
  CurrModule: string,
  PromptMsg?: string
) {
  const MsgContainer = new InfoContainer()
    .useInfoTemplate("TimedOutConfigPrompt")
    .setTitle(`Timed Out - ${CurrModule} Configuration`);

  if (Interact.deferred || Interact.replied) {
    return Interact.editReply({
      message: PromptMsg,
      components: [MsgContainer],
    }).catch(() => null);
  }

  return Interact.update({
    components: [MsgContainer],
  }).catch(() => null);
}

/**
 * Updates a configuration prompt with new selected settings.
 * @param Interaction - The interaction that triggered the update.
 * @param ConfigPrompt - The message of the configuration prompt.
 * @param ModuleConfig - The current module configuration.
 * @param GetContainerFn - Function that generates the UI container for this module.
 * @returns Promise resolving to the update operation result.
 */
async function UpdateConfigPrompt<T>(
  Interaction: ModulePromptUpdateSupportedInteraction,
  ConfigPrompt: Message<true>,
  ModuleConfig: T,
  GetContainerFn: ContainerGetterFn<T>
) {
  const ConfigContainer = GetContainerFn(Interaction, ModuleConfig);
  if (!Interaction.deferred && !Interaction.replied) {
    return Interaction.update({
      components: [ConfigContainer],
    });
  } else {
    return Interaction.editReply({
      message: ConfigPrompt,
      components: [ConfigContainer],
    });
  }
}

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
function GetChannelSelectionPromptComponents(
  Interact: MessageComponentInteraction<"cached">,
  TargetConfig: ConfigTopicsCompIds,
  SelectedChannelId?: string | null
) {
  const ChannelSelectMenuAR = new ActionRowBuilder<ChannelSelectMenuBuilder>().setComponents(
    new ChannelSelectMenuBuilder()
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
      .setPlaceholder("Select a channel...")
      .setCustomId(`${TargetConfig}:${Interact.user.id}`)
  );

  const DeselectChannelAR = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Deselect Current Destination")
      .setEmoji(Emojis.WhiteCross)
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${TargetConfig}-desel:${Interact.user.id}`)
  );

  if (SelectedChannelId) {
    ChannelSelectMenuAR.components[0].setDefaultChannels(SelectedChannelId);
  }

  return [ChannelSelectMenuAR, DeselectChannelAR] as const;
}

function GetConfigTopicConfirmAndBackBtns(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  ConfigTopicId: ConfigTopics
) {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Confirm and Save")
      .setEmoji(Emojis.WhiteCheck)
      .setStyle(ButtonStyle.Success)
      .setCustomId(`${ConfigTopicId}-cfm:${Interaction.user.id}`),
    new ButtonBuilder()
      .setLabel("Back")
      .setEmoji(Emojis.WhiteBack)
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${ConfigTopicId}-bck:${Interaction.user.id}`)
  );
}

function GetConfigTopicsDropdownMenu(
  Interaction: CmdSelectOrButtonInteract<"cached"> | ButtonInteraction<"cached">
) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`app-config:${Interaction.user.id}`)
      .setPlaceholder("Select a topic...")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Basic Configuration")
          .setDescription("The app's basic settings such as staff and management roles.")
          .setValue(ConfigTopics.BasicConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Shift Module Configuration")
          .setDescription("Set on-duty and on-break roles, activities channel, and more")
          .setValue(ConfigTopics.ShiftConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Leave of Absence Module Configuration")
          .setDescription("Set on-leave role, requests channel, and more.")
          .setValue(ConfigTopics.LeaveConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Reduced Activity Module Configuration")
          .setDescription("Set reduced activity role, requests channel, and more.")
          .setValue(ConfigTopics.ReducedActivityConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Duty Activities Module Configuration")
          .setDescription("Set arrest, citation, and incident log channels and more.")
          .setValue(ConfigTopics.DutyActConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Additional Configurations")
          .setDescription("Other app settings.")
          .setValue(ConfigTopics.AdditionalConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Show All Configurations")
          .setDescription("Shows the app's current configuration for all listed above.")
          .setValue(ConfigTopics.ShowConfigurations)
      )
  );
}

function GetBasicConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  GuildConfig: NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>
) {
  const RobloxAuthorizationAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Roblox Authorization Required")
      .setDisabled(true)
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.BasicConfiguration].RobloxAuthRequired}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Enable the Roblox account linking requirement.")
          .setDefault(GuildConfig.require_authorization),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Disable the Roblox account linking requirement.")
          .setDefault(!GuildConfig.require_authorization)
      )
  );

  const StaffRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CTAIds[ConfigTopics.BasicConfiguration].StaffRoles}:${Interaction.user.id}`)
      .setDefaultRoles(GuildConfig.role_perms.staff)
      .setPlaceholder("Staff Roles")
      .setMinValues(0)
      .setMaxValues(10)
  );

  const ManagementRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CTAIds[ConfigTopics.BasicConfiguration].MgmtRoles}:${Interaction.user.id}`)
      .setDefaultRoles(GuildConfig.role_perms.management)
      .setPlaceholder("Management Roles")
      .setMinValues(0)
      .setMaxValues(10)
  );

  return [RobloxAuthorizationAR, StaffRolesAR, ManagementRolesAR] as const;
}

function GetShiftModuleConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  ShiftModuleConfig: GuildSettings["shift_management"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.ShiftConfiguration].ModuleEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Allow the usage of shift management commands.")
          .setDefault(ShiftModuleConfig.enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Prevent the usage of shift management commands.")
          .setDefault(!ShiftModuleConfig.enabled)
      )
  );

  const OnDutyRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setMinValues(0)
      .setMaxValues(3)
      .setPlaceholder("On-Duty Role(s)")
      .setDefaultRoles(ShiftModuleConfig.role_assignment.on_duty)
      .setCustomId(`${CTAIds[ConfigTopics.ShiftConfiguration].OnDutyRoles}:${Interaction.user.id}`)
  );

  const OnBreakRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setMinValues(0)
      .setMaxValues(3)
      .setPlaceholder("On-Break Role(s)")
      .setDefaultRoles(ShiftModuleConfig.role_assignment.on_break)
      .setCustomId(`${CTAIds[ConfigTopics.ShiftConfiguration].OnBreakRoles}:${Interaction.user.id}`)
  );

  const LogChannelButtonAccessory = new ButtonBuilder()
    .setCustomId(`${CTAIds[ConfigTopics.ShiftConfiguration].LogChannel}:${Interaction.user.id}`)
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary);

  return [ModuleEnabledAR, OnDutyRolesAR, OnBreakRolesAR, LogChannelButtonAccessory] as const;
}

function GetLeaveModuleConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  LeaveNoticesConfig: GuildSettings["leave_notices"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.LeaveConfiguration].ModuleEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Allow the usage of leave of absence commands.")
          .setDefault(LeaveNoticesConfig.enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Prevent the usage of leave of absence commands.")
          .setDefault(!LeaveNoticesConfig.enabled)
      )
  );

  const OnLeaveRoleAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CTAIds[ConfigTopics.LeaveConfiguration].OnLeaveRole}:${Interaction.user.id}`)
      .setDefaultRoles(LeaveNoticesConfig.leave_role ? [LeaveNoticesConfig.leave_role] : [])
      .setPlaceholder("On-Leave Role")
      .setMinValues(0)
      .setMaxValues(1)
  );

  if (LeaveNoticesConfig.leave_role) {
    OnLeaveRoleAR.components[0].setDefaultRoles(LeaveNoticesConfig.leave_role);
  }

  const RequestsDestAccessoryButton = new ButtonBuilder()
    .setLabel("Set Requests Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.LeaveConfiguration].RequestsChannel}:${Interaction.user.id}`
    );

  const LogDestAccessoryCAButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CTAIds[ConfigTopics.LeaveConfiguration].LogChannel}:${Interaction.user.id}`);

  return [
    ModuleEnabledAR,
    OnLeaveRoleAR,
    RequestsDestAccessoryButton,
    LogDestAccessoryCAButton,
  ] as const;
}

function GetDutyActModuleConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  DActivitiesConfig: GuildSettings["duty_activities"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActConfiguration].ModuleEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Allow the usage of 'log' commands.")
          .setDefault(DActivitiesConfig.enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Prevent the usage of 'log' commands.")
          .setDefault(!DActivitiesConfig.enabled)
      )
  );

  const LocalCitsLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Citation Log Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.DutyActConfiguration].CitationLogLocalChannel}:${Interaction.user.id}`
    );

  const LocalArrestsLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Arrest Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.DutyActConfiguration].ArrestLogLocalChannel}:${Interaction.user.id}`
    );

  const IncidentLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Incident Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.DutyActConfiguration].IncidentLogLocalChannel}:${Interaction.user.id}`
    );

  const SetOutsideLogChannelBtns = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Set Outside Citation Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActConfiguration].OutsideCitationLogChannel}:${Interaction.user}`
      ),
    new ButtonBuilder()
      .setLabel("Set Outside Arrest Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActConfiguration].OutsideArrestLogChannel}:${Interaction.user}`
      )
  );

  return [
    ModuleEnabledAR,
    LocalCitsLogChannelBtn,
    LocalArrestsLogChannelBtn,
    IncidentLogChannelBtn,
    SetOutsideLogChannelBtns,
  ] as const;
}

function GetAdditionalConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  GuildConfig: NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>
) {
  const SetIntervalInDays = GuildConfig.duty_activities.log_deletion_interval / MillisInDay;
  const LogDelIntervalSMAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Log Deletion Interval")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.AdditionalConfiguration].DActivitiesDeletionInterval}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Disable Log Deletion")
          .setValue("0d")
          .setDescription("Never delete logs."),
        new StringSelectMenuOptionBuilder()
          .setLabel("1 Day")
          .setValue("1d")
          .setDescription("Delete logs one day after they are made."),
        new StringSelectMenuOptionBuilder()
          .setLabel("3 Days")
          .setValue("3d")
          .setDescription("Delete logs three days after they are made."),
        new StringSelectMenuOptionBuilder()
          .setLabel("7 Days")
          .setValue("7d")
          .setDescription("Delete logs seven days after they are made."),
        new StringSelectMenuOptionBuilder()
          .setLabel("14 Days")
          .setValue("14d")
          .setDescription("Delete logs fourteen days after they are made."),
        new StringSelectMenuOptionBuilder()
          .setLabel("30 Days")
          .setValue("30d")
          .setDescription("Delete logs thirty days after they are made.")
      )
  );

  const UTIFilteringEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Input Filtering Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.AdditionalConfiguration].UserTextInputFilteringEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Enable filtering of member text input.")
          .setDefault(GuildConfig.utif_enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Disable filtering of member text input (not recommended).")
          .setDefault(!GuildConfig.utif_enabled)
      )
  );

  const SetDefaultShiftQuotaAR = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Set Default Shift Quota")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${CTAIds[ConfigTopics.AdditionalConfiguration].ServerDefaultShiftQuota}:${Interaction.user.id}`
      )
  );

  LogDelIntervalSMAR.components[0].options.forEach((Option) => {
    if (Option.data.value === `${SetIntervalInDays}d`) {
      Option.setDefault(true);
    }
  });

  return [LogDelIntervalSMAR, UTIFilteringEnabledAR, SetDefaultShiftQuotaAR] as const;
}

function GetReducedActivityModuleConfigComponents(
  Interaction: CmdSelectOrButtonInteract<"cached">,
  ReducedActivityConfig: GuildSettings["reduced_activity"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.ReducedActivityConfiguration].ModuleEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Allow the usage of reduced activity commands.")
          .setDefault(ReducedActivityConfig.enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Prevent the usage of reduced activity commands.")
          .setDefault(!ReducedActivityConfig.enabled)
      )
  );

  const RARoleAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(
        `${CTAIds[ConfigTopics.ReducedActivityConfiguration].RARole}:${Interaction.user.id}`
      )
      .setDefaultRoles(ReducedActivityConfig.ra_role ? [ReducedActivityConfig.ra_role] : [])
      .setPlaceholder("Reduced Activity Role")
      .setMinValues(0)
      .setMaxValues(1)
  );

  const RequestsDestButton = new ButtonBuilder()
    .setLabel("Set Requests Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.ReducedActivityConfiguration].RequestsChannel}:${Interaction.user.id}`
    );

  const LogDestAccessoryButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.ReducedActivityConfiguration].LogChannel}:${Interaction.user.id}`
    );

  return [ModuleEnabledAR, RARoleAR, RequestsDestButton, LogDestAccessoryButton] as const;
}

function GetShowConfigurationsPageComponents(
  Interaction: CmdSelectOrButtonInteract<"cached"> | ButtonInteraction<"cached">,
  SafePIndex: number,
  TotalPages: number
) {
  const PaginationRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`config-show-prev:${Interaction.user.id}:${SafePIndex - 1}`)
      .setLabel("Previous")
      .setEmoji(Emojis.NavPrev)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(SafePIndex <= 0),

    new ButtonBuilder()
      .setCustomId(`config-show-page:${Interaction.user.id}`)
      .setLabel(`Page ${SafePIndex + 1} of ${TotalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId(`config-show-next:${Interaction.user.id}:${SafePIndex + 1}`)
      .setLabel("Next")
      .setEmoji(Emojis.NavNext)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(SafePIndex >= TotalPages - 1)
  );

  const BackButtonRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Back to Configration Topics")
      .setCustomId(`app-config-bck:${Interaction.user.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(Emojis.WhiteBack)
  );

  return [PaginationRow, BackButtonRow] as const;
}

// ---------------------------------------------------------------------------------------
// Containers Getters:
// -------------------
function GetBasicConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  GuildSettings: GuildSettings
): ContainerBuilder {
  const BasicConfigInteractComponents = GetBasicConfigComponents(SelectInteract, GuildSettings);
  return new ContainerBuilder()
    .setId(1)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[2].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.BasicConfiguration].Settings[2].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[2])
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.BasicConfiguration)
    );
}

function GetShiftModuleConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  ShiftModuleConfig: GuildSettings["shift_management"]
): ContainerBuilder {
  const ShiftModuleInteractComponents = GetShiftModuleConfigComponents(
    SelectInteract,
    ShiftModuleConfig
  );

  const CurrentlyConfiguredLogChannel = ShiftModuleConfig.log_channel
    ? `<#${ShiftModuleConfig.log_channel}>`
    : "None";

  return new ContainerBuilder()
    .setId(2)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(ShiftModuleInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(ShiftModuleInteractComponents[1])
    .addActionRowComponents(ShiftModuleInteractComponents[2])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ShiftModuleInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              2. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLogChannel}
              ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[2].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.ShiftConfiguration)
    );
}

function GetDutyActivitiesModuleConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  RAModuleConfig: GuildSettings["duty_activities"]
) {
  const DutyActivitiesInteractComponents = GetDutyActModuleConfigComponents(
    SelectInteract,
    RAModuleConfig
  );

  const CurrConfiguredCitLogLocalChannel = RAModuleConfig.log_channels.citations.find(
    (LC) => !LC.includes(":")
  );

  const CurrConfiguredArrestLogLocalChannel = RAModuleConfig.log_channels.arrests.find(
    (LC) => !LC.includes(":")
  );

  const CurrentlyConfiguredLocalChannels = {
    ArrestLog: CurrConfiguredArrestLogLocalChannel
      ? `<#${CurrConfiguredArrestLogLocalChannel}>`
      : "None",
    CitationLog: CurrConfiguredCitLogLocalChannel
      ? `<#${CurrConfiguredCitLogLocalChannel}>`
      : "None",
    IncidentLog: RAModuleConfig.log_channels.incidents
      ? `<#${RAModuleConfig.log_channels.incidents}>`
      : "None",
  };

  return new ContainerBuilder()
    .setId(3)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(DutyActivitiesInteractComponents[1])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              2. **${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[1].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.CitationLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[1].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(DutyActivitiesInteractComponents[2])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              3. **${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.ArrestLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[2].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(DutyActivitiesInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              4. **${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[3].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.IncidentLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[3].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          5. **${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[4].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActConfiguration].Settings[4].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[4])
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.DutyActConfiguration)
    );
}

function GetLeaveModuleConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  LeaveModuleConfig: GuildSettings["leave_notices"]
) {
  const LeaveModuleInteractComponents = GetLeaveModuleConfigComponents(
    SelectInteract,
    LeaveModuleConfig
  );

  const CurrentlyConfiguredChannels = {
    Log: LeaveModuleConfig.log_channel ? `<#${LeaveModuleConfig.log_channel}>` : "None",
    Requests: LeaveModuleConfig.requests_channel
      ? `<#${LeaveModuleConfig.requests_channel}>`
      : "None",
  };

  return new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(LeaveModuleInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(LeaveModuleInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(LeaveModuleInteractComponents[2])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              3. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[2].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(LeaveModuleInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              4. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[3].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[3].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.LeaveConfiguration)
    );
}

function GetReducedActivityModuleConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  RAModuleConfig: GuildSettings["reduced_activity"]
) {
  const ReducedActivityInteractComponents = GetReducedActivityModuleConfigComponents(
    SelectInteract,
    RAModuleConfig
  );

  const CurrentlyConfiguredChannels = {
    Log: RAModuleConfig.log_channel ? `<#${RAModuleConfig.log_channel}>` : "None",
    Requests: RAModuleConfig.requests_channel ? `<#${RAModuleConfig.requests_channel}>` : "None",
  };

  return new ContainerBuilder()
    .setId(5)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(ReducedActivityInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(ReducedActivityInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ReducedActivityInteractComponents[2])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              3. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[2].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ReducedActivityInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              4. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[3].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[3].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.ReducedActivityConfiguration)
    );
}

function GetAdditionalConfigContainer(
  SelectInteract: CmdSelectOrButtonInteract<"cached">,
  GuildSettings: GuildSettings
): ContainerBuilder {
  const AdditionalConfigInteractComponents = GetAdditionalConfigComponents(
    SelectInteract,
    GuildSettings
  );

  return new ContainerBuilder()
    .setId(6)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Title}`
      ),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(AdditionalConfigInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(AdditionalConfigInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
            3. **${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[2].Name}**
            ${ConfigTopicsExplanations[ConfigTopics.AdditionalConfiguration].Settings[2].Description}
          `)
          )
        )
        .setButtonAccessory(AdditionalConfigInteractComponents[2].components[0])
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addActionRowComponents(
      GetConfigTopicConfirmAndBackBtns(SelectInteract, ConfigTopics.AdditionalConfiguration)
    );
}

function GetChannelOrThreadSelPromptContainer(
  RecInteract: MessageComponentInteraction<"cached">,
  TargettedConfig: ConfigTopicsCompIds,
  ContainerTitle: string,
  CSCopyFormat: string,
  CurrentDestination?: GuildBasedChannel | null
): BaseExtraContainer {
  const IsDestinationThread = CurrentDestination?.isThread() ?? false;
  const PromptComponents = GetChannelSelectionPromptComponents(
    RecInteract,
    TargettedConfig,
    IsDestinationThread ? null : CurrentDestination?.id
  );

  const CSThread =
    CurrentDestination && IsDestinationThread ? `<#${CurrentDestination.id}>` : "None";

  const CSThreadAnnotation =
    CurrentDestination && !IsDestinationThread ? "; a regular channel is selected." : "";

  return new BaseExtraContainer()
    .setTitle(ContainerTitle)
    .setColor(Colors.DarkGrey)
    .setDescription(
      Dedent(`
        Please select a text-based channel from the dropdown menu below **or** copy and paste the format into your desired channel or thread.

        -# **Notes:**
        -# - Only one channel or thread can be selected at a time.
        -# - To remove any current selection and clear the logging destination, use the **Deselect** button.
        -# - The selected channel or thread must be visible to the application to avoid issues with future logging.
        -# - When you paste the format into a channel or thread, the application will acknowledge it by reacting with an OK (👌).
        -# - Selecting a channel using any method will immediately update the logging destination and close this prompt. Keep in mind \
             that you still have to confirm and save the changes in the configuration menu afterwards to save the selection.

        **Currently Selected Thread:** ${CSThread}${CSThreadAnnotation}
        **Alternative Method:**
        Copy and paste the following format into your desired channel or thread to set it directly:
        \`\`\`dsconfig
        ${CSCopyFormat}
        \`\`\`
      `)
    )
    .setFooter("*This prompt will timeout in 5 minutes if no selection or action is made.*")
    .attachPromptActionRows([...PromptComponents]);
}

// ---------------------------------------------------------------------------------------
// Config Show Content Getters:
// ----------------------------
function GetCSBasicSettingsContent(GuildSettings: GuildSettings): string {
  const StaffRoles = GuildSettings.role_perms.staff.map((Role) => roleMention(Role));
  const ManagementRoles = GuildSettings.role_perms.management.map((Role) => roleMention(Role));

  return Dedent(`
    >>> **Roblox Auth Required:** ${GuildSettings.require_authorization ? "Yes" : "No"}
    **Staff Roles:**
    ${StaffRoles.length ? ListFormatter.format(StaffRoles) : "None"}
    **Management Roles:**
    ${ManagementRoles.length ? ListFormatter.format(ManagementRoles) : "None"}
  `);
}

function GetCSShiftModuleContent(GuildSettings: GuildSettings): string {
  const SMOnDutyRoles = GuildSettings.shift_management.role_assignment.on_duty.map((Role) =>
    roleMention(Role)
  );

  const SMOnBreakRoles = GuildSettings.shift_management.role_assignment.on_break.map((Role) =>
    roleMention(Role)
  );

  const ShiftLogChannel = GuildSettings.shift_management.log_channel
    ? channelMention(GuildSettings.shift_management.log_channel)
    : "None";

  return Dedent(`
    >>> **Module Enabled:** ${GuildSettings.shift_management.enabled ? "Yes" : "No"}
    **Shift Log Channel:** ${ShiftLogChannel}
    **Role Assignment:**
    - **On-Duty Role${SMOnDutyRoles.length > 1 ? "s" : ""}:** ${SMOnDutyRoles.length ? "\n" + ListFormatter.format(SMOnDutyRoles) : "None"}
    - **On-Break Role${SMOnBreakRoles.length > 1 ? "s" : ""}:** ${SMOnBreakRoles.length ? "\n" + ListFormatter.format(SMOnBreakRoles) : "None"}
  `);
}

function GetCSLeaveNoticesContent(GuildSettings: GuildSettings): string {
  return Dedent(`
    >>> **Module Enabled:** ${GuildSettings.leave_notices.enabled ? "Yes" : "No"}
    **On-Leave Role:** ${GuildSettings.leave_notices.leave_role ? roleMention(GuildSettings.leave_notices.leave_role) : "None"}
    **Requests Channel:** ${GuildSettings.leave_notices.requests_channel ? channelMention(GuildSettings.leave_notices.requests_channel) : "None"}
    **Leave Log Channel:** ${GuildSettings.leave_notices.log_channel ? channelMention(GuildSettings.leave_notices.log_channel) : "None"}
  `);
}

function GetCSReducedActivityContent(GuildSettings: GuildSettings): string {
  return Dedent(`
    >>> **Module Enabled:** ${GuildSettings.reduced_activity.enabled ? "Yes" : "No"}
    **Reduced Activity Role:** ${GuildSettings.reduced_activity.ra_role ? roleMention(GuildSettings.reduced_activity.ra_role) : "None"}
    **Requests Channel:** ${GuildSettings.reduced_activity.requests_channel ? channelMention(GuildSettings.reduced_activity.requests_channel) : "None"}
    **Log Channel:** ${GuildSettings.reduced_activity.log_channel ? channelMention(GuildSettings.reduced_activity.log_channel) : "None"}
  `);
}

function GetCSDutyActivitiesContent(GuildSettings: GuildSettings): string {
  const IncidentLogChannel = GuildSettings.duty_activities.log_channels.incidents
    ? channelMention(GuildSettings.duty_activities.log_channels.incidents)
    : "*None*";

  const CitationLogChannels = GuildSettings.duty_activities.log_channels.citations.map(
    (CI) => `<#${CI.match(/:?(\d+)$/)?.[1]}>`
  );

  const ArrestLogChannels = GuildSettings.duty_activities.log_channels.arrests.map(
    (CI) => `<#${CI.match(/:?(\d+)$/)?.[1]}>`
  );

  return Dedent(`
    >>> **Module Enabled:** ${GuildSettings.duty_activities.enabled ? "Yes" : "No"}
    **Incident Log Channel:** ${IncidentLogChannel}
    **Citation Log Channel${CitationLogChannels.length > 1 ? "s" : ""}:** 
    ${CitationLogChannels.length ? ListFormatter.format(CitationLogChannels) : "*None*"}
    **Arrest Log Channel${ArrestLogChannels.length > 1 ? "s" : ""}:** 
    ${ArrestLogChannels.length ? ListFormatter.format(ArrestLogChannels) : "*None*"}
  `);
}

function GetCSAdditionalConfigContent(GuildSettings: GuildSettings): string {
  return Dedent(`
    >>> **Log Deletion Interval:** ${GetHumanReadableLogDeletionInterval(GuildSettings.duty_activities.log_deletion_interval)}
    **User Text Input Filtering:** ${GuildSettings.utif_enabled ? "Enabled" : "Disabled"}
    **Default Shift Quota:** ${GuildSettings.shift_management.default_quota > 500 ? FormatDuration(GuildSettings.shift_management.default_quota) : "*None*"}
  `);
}

// ---------------------------------------------------------------------------------------
// Configuration Handlers:
// -----------------------
async function PromptChannelOrThreadSelection(
  RecInteract: MessageComponentInteraction<"cached">,
  TargetConfig: ConfigTopicsCompIds,
  DestinationFor: string,
  CurrentlyConfigured?: string | null
): Promise<string | null | undefined> {
  const PromptTitleCategory = `${DestinationFor} Destination Selection`;
  const CSUniqueText = `${DestinationFor.at(0)!.toLowerCase()}lc-${RandomString(6, /[a-z0-9]/)}`;
  const CSCopyFormat = `<@${RecInteract.client.user.id}>, ${CSUniqueText}`;
  const CurrConfigDestination = CurrentlyConfigured
    ? await RecInteract.guild.channels.fetch(CurrentlyConfigured).catch(() => null)
    : null;

  const PromptContainer = GetChannelOrThreadSelPromptContainer(
    RecInteract,
    TargetConfig,
    PromptTitleCategory,
    CSCopyFormat,
    CurrConfigDestination
  );

  const PromptMessage = await RecInteract.reply({
    withResponse: true,
    components: [PromptContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  }).then((IR) => IR.resource!.message! as Message<true>);

  const MsgFormatFilter = (Msg: Message) => {
    const Channel = Msg.channel;
    if (!Channel.isSendable()) return false;
    if (Channel.isDMBased() || !Msg.inGuild()) return false;
    if (Msg.guildId !== RecInteract.guild.id) return false;
    if (Msg.author.id !== RecInteract.user.id) return false;
    if (!Msg.mentions.users.has(RecInteract.client.user.id)) return false;
    if (![ChannelType.GuildText, ChannelType.PublicThread].includes(Channel.type)) return false;
    if (!Msg.content.includes(CSUniqueText)) return false;

    RecInteract.deleteReply(PromptMessage).catch(() => null);
    Msg.guild.members
      .fetchMe()
      .then((AppMember) => {
        if (AppMember.permissionsIn(Channel).has(PermissionFlagsBits.AddReactions)) {
          Msg.react("👌").catch(() => null);
        }
      })
      .catch(() => null);

    return true;
  };

  const TimeoutAwaitedSelectPromise = AwaitMessageWithTimeout(
    RecInteract.client,
    MsgFormatFilter,
    5 * 60 * 1000
  );

  const PromptInteractResponse = PromptMessage.awaitMessageComponent({
    filter: (I) => I.user.id === RecInteract.user.id,
    time: 5 * 60 * 1000,
  })
    .then((Interact) => {
      TimeoutAwaitedSelectPromise.cancel();
      Interact.deferUpdate()
        .catch(() => null)
        .then(() => Interact.deleteReply().catch(() => null));

      if (Interact.isButton()) {
        const ButtonId = Interact.customId.split(":")[0];
        if (ButtonId.includes("desel")) {
          return null;
        }
      } else if (Interact.isChannelSelectMenu()) {
        return Interact.values.length ? Interact.values[0] : null;
      }

      return undefined;
    })
    .catch(() => undefined);

  const PromptResponses = [
    PromptInteractResponse,
    TimeoutAwaitedSelectPromise.then((Msg) => (Msg ? Msg.channelId : undefined)).catch(
      () => undefined
    ),
  ];

  const DesiredChannelOrThread = await Promise.race(PromptResponses);
  return DesiredChannelOrThread !== undefined ? DesiredChannelOrThread : CurrentlyConfigured;
}

async function HandleOutsideLogChannelBtnInteracts(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentLogChannels: string[]
): Promise<null | undefined | string> {
  const CurrLogChannel = CurrentLogChannels.find((C) => C.includes(":"));
  const LogChannelTopic = BtnInteract.customId.startsWith(
    CTAIds[ConfigTopics.DutyActConfiguration].OutsideArrestLogChannel
  )
    ? "Arrest Reports"
    : "Citation Logs";

  const InputModal = new ModalBuilder()
    .setTitle(`Outside Log Channel - ${LogChannelTopic}`)
    .setCustomId(BtnInteract.customId)
    .setComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Channel in The Format: [ServerID:ServerID]")
          .setPlaceholder("ServerID:ChannelID")
          .setCustomId("channel_id")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMinLength(31)
          .setMaxLength(45)
      )
    );

  if (CurrLogChannel) InputModal.components[0].components[0].setValue(CurrLogChannel);
  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 5 * 60 * 1000);
  if (!ModalSubmission) return CurrLogChannel;

  const TypedChannel = ModalSubmission.fields.getTextInputValue("channel_id").trim();
  if (!TypedChannel) return null;

  if (TypedChannel.match(/^\d{15,22}:\d{15,22}$/)) {
    if (TypedChannel === CurrLogChannel) {
      ModalSubmission.deferUpdate().catch(() => null);
      return CurrLogChannel;
    }

    const [GuildId, ChannelId] = TypedChannel.split(":");
    const GuildFound = await ModalSubmission.client.guilds.fetch(GuildId).catch(() => null);
    const ChannelFound = await GuildFound?.channels.fetch(ChannelId).catch(() => null);

    if (!GuildFound) {
      new ErrorContainer()
        .useErrTemplate("DiscordGuildNotFound", GuildId)
        .replyToInteract(ModalSubmission, true);
      return CurrLogChannel;
    } else if (ChannelFound) {
      const GuildMember = await GuildFound.members.fetch(ModalSubmission.user).catch(() => null);
      if (!GuildMember) {
        new ErrorContainer()
          .useErrTemplate("NotJoinedInGuild")
          .replyToInteract(ModalSubmission, true);
        return CurrLogChannel;
      } else if (!GuildMember.permissions.has(PermissionFlagsBits.Administrator)) {
        new ErrorContainer()
          .useErrTemplate("InsufficientAdminPerms")
          .replyToInteract(ModalSubmission, true);
        return CurrLogChannel;
      }
    } else {
      new ErrorContainer()
        .useErrTemplate("DiscordChannelNotFound", ChannelId)
        .replyToInteract(ModalSubmission, true);
      return CurrLogChannel;
    }

    ModalSubmission.deferUpdate().catch(() => null);
    return TypedChannel;
  } else {
    new ErrorContainer()
      .useErrTemplate("InvalidGuildChannelFormat")
      .replyToInteract(ModalSubmission, true);

    return CurrLogChannel;
  }
}

async function HandleDefaultShiftQuotaBtnInteract(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentQuota: number
): Promise<number> {
  const InputModal = new ModalBuilder()
    .setTitle("Default Shift Quota Duration")
    .setCustomId(CTAIds[ConfigTopics.AdditionalConfiguration].ServerDefaultShiftQuota)
    .setComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Default Quota")
          .setPlaceholder("ex., 2h, 30m (Keep blank for none)")
          .setCustomId("default_quota")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMinLength(2)
          .setMaxLength(20)
      )
    );

  if (CurrentQuota) {
    const FormattedDuration = FormatDuration(CurrentQuota);
    InputModal.components[0].components[0].setValue(FormattedDuration);
  }

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 8 * 60 * 1000);
  if (!ModalSubmission) return CurrentQuota;

  const InputDuration = ModalSubmission.fields.getTextInputValue("default_quota").trim();
  const ParsedDuration = ParseDuration(InputDuration, "millisecond");

  if (ParsedDuration) {
    ModalSubmission.deferUpdate().catch(() => null);
    return Math.round(ParsedDuration);
  } else {
    new ErrorContainer()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(ModalSubmission, true, true);

    return CurrentQuota;
  }
}

async function HandleBasicConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  BasicConfigPrompt: Message<true> | InteractionResponse<true>,
  CurrConfiguration: GuildSettings
) {
  let StaffRoles: string[] = CurrConfiguration.role_perms.staff.slice();
  let ManagementRoles: string[] = CurrConfiguration.role_perms.management.slice();
  let RobloxAuthorizationRequired: boolean = CurrConfiguration.require_authorization;

  const BCCompActionCollector = BasicConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.RoleSelect | ComponentType.StringSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const UpdateBasicConfigPrompt = async (
    Interact: ButtonInteraction<"cached"> | RoleSelectMenuInteraction<"cached">
  ) => {
    const BasicConfig: GuildSettings = {
      ...CurrConfiguration,
      require_authorization: RobloxAuthorizationRequired,
      role_perms: {
        staff: StaffRoles,
        management: ManagementRoles,
      },
    };

    const ShiftConfigContainer = GetBasicConfigContainer(Interact, BasicConfig);
    return Interact.update({
      components: [ShiftConfigContainer],
    });
  };

  const HandleSettingsSave = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      CurrConfiguration.require_authorization === RobloxAuthorizationRequired &&
      ArraysAreEqual(CurrConfiguration.role_perms.staff, StaffRoles) &&
      ArraysAreEqual(CurrConfiguration.role_perms.management, ManagementRoles)
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "basic")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      ButtonInteract.guildId,
      {
        $set: {
          "settings.role_perms.staff": StaffRoles,
          "settings.role_perms.management": ManagementRoles,
          "settings.require_authorization": RobloxAuthorizationRequired,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings);

    if (UpdatedConfig) {
      CurrConfiguration = UpdatedConfig;
      const SetStaffRoles = CurrConfiguration.role_perms.staff.map((R) => roleMention(R));
      const SetMgmtRoles = CurrConfiguration.role_perms.management.map((R) => roleMention(R));
      const FormattedDesc = Dedent(`
        Successfully set/updated the app's basic configuration.
        
        **Current Configuration:**
        - **Roblox Auth Required:** ${RobloxAuthorizationRequired ? "Yes" : "No"}
        - **Staff Role(s):**
          > ${SetStaffRoles.length ? ListFormatter.format(SetStaffRoles) : "*None*"}
        - **Management Role(s):**
          > ${SetMgmtRoles.length ? ListFormatter.format(SetMgmtRoles) : "*None*"}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  BCCompActionCollector.on("collect", async (RecInteract) => {
    try {
      if (RecInteract.isButton()) {
        if (RecInteract.customId.startsWith(`${ConfigTopics.BasicConfiguration}-cfm`)) {
          await HandleSettingsSave(RecInteract);
        } else if (RecInteract.customId.startsWith(`${ConfigTopics.BasicConfiguration}-bck`)) {
          BCCompActionCollector.stop("Back");
          await RecInteract.deferUpdate();
          return Callback(RecInteract);
        }
      } else if (RecInteract.isRoleSelectMenu()) {
        if (RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].StaffRoles)) {
          StaffRoles = RecInteract.values.filter(
            (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
          );
        } else if (
          RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].MgmtRoles)
        ) {
          ManagementRoles = RecInteract.values.filter(
            (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
          );
        }
        return UpdateBasicConfigPrompt(RecInteract).catch(() => null);
      } else if (
        RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].RobloxAuthRequired)
      ) {
        RobloxAuthorizationRequired = RecInteract.values[0] === "true";
        return RecInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for basic app configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  BCCompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(LastInteract, "Basic", SelectInteract.message.id);
    }
  });
}

async function HandleAdditionalConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  AddConfigPrompt: Message<true> | InteractionResponse<true>,
  CurrConfiguration: GuildSettings
) {
  let LogDeletionInterval = CurrConfiguration.duty_activities.log_deletion_interval;
  let DefaultShiftQuota = CurrConfiguration.shift_management.default_quota;
  let UTIFEnabled = CurrConfiguration.utif_enabled;

  const BCCompActionCollector = AddConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.StringSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const HandleSettingsSave = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      CurrConfiguration.duty_activities.log_deletion_interval === LogDeletionInterval &&
      CurrConfiguration.shift_management.default_quota === DefaultShiftQuota &&
      CurrConfiguration.utif_enabled === UTIFEnabled
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "additional")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({ flags: MessageFlags.Ephemeral });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      SelectInteract.guildId,
      {
        $set: {
          "settings.duty_activities.log_deletion_interval": LogDeletionInterval,
          "settings.shift_management.default_quota": DefaultShiftQuota,
          "settings.utif_enabled": UTIFEnabled,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings);

    if (UpdatedConfig) {
      CurrConfiguration = UpdatedConfig;
      const DefaultQuota = CurrConfiguration.shift_management.default_quota;
      const LDIFormatted = GetHumanReadableLogDeletionInterval(
        CurrConfiguration.duty_activities.log_deletion_interval
      );

      const FormattedDesc = Dedent(`
        Successfully set/updated the app's additional configuration.
        
        **Current Configuration:**
        - **Log Deletion Interval:** ${LDIFormatted}
        - **Input Filtering Enabled:** ${CurrConfiguration.utif_enabled ? "Yes" : "No"}
        - **Server Default Shift Quota:** ${DefaultQuota ? FormatDuration(DefaultQuota) : "None"}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  BCCompActionCollector.on("collect", async (RecInteract) => {
    try {
      if (RecInteract.isButton()) {
        if (RecInteract.customId.startsWith(`${ConfigTopics.AdditionalConfiguration}-cfm`)) {
          await HandleSettingsSave(RecInteract);
        } else if (RecInteract.customId.startsWith(`${ConfigTopics.AdditionalConfiguration}-bck`)) {
          BCCompActionCollector.stop("Back");
          await RecInteract.deferUpdate();
          return Callback(RecInteract);
        } else if (
          RecInteract.customId.startsWith(
            CTAIds[ConfigTopics.AdditionalConfiguration].ServerDefaultShiftQuota
          )
        ) {
          DefaultShiftQuota = await HandleDefaultShiftQuotaBtnInteract(
            RecInteract,
            DefaultShiftQuota
          );
        }
      } else {
        if (
          RecInteract.isStringSelectMenu() &&
          RecInteract.customId.startsWith(
            CTAIds[ConfigTopics.AdditionalConfiguration].DActivitiesDeletionInterval
          )
        ) {
          LogDeletionInterval = (parseInt(RecInteract.values[0]) || 0) * MillisInDay;
        }

        if (
          RecInteract.isStringSelectMenu() &&
          RecInteract.customId.startsWith(
            CTAIds[ConfigTopics.AdditionalConfiguration].UserTextInputFilteringEnabled
          )
        ) {
          UTIFEnabled = RecInteract.values[0] === "true";
        }

        await RecInteract.deferUpdate();
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for additional app configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  BCCompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(LastInteract, "Additional", SelectInteract.message.id);
    }
  });
}

async function HandleShiftConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  SMCurrConfiguration: GuildSettings["shift_management"]
) {
  let ModuleEnabled: boolean = SMCurrConfiguration.enabled;
  let OnDutyRoles: string[] = SMCurrConfiguration.role_assignment.on_duty.slice();
  let OnBreakRoles: string[] = SMCurrConfiguration.role_assignment.on_break.slice();
  let LogChannel = SMCurrConfiguration.log_channel;

  const SCCompActionCollector = ConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.RoleSelect | ComponentType.StringSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const UpdateShiftConfigPrompt = async (Interact: ModulePromptUpdateSupportedInteraction) => {
    const ShiftModuleConfig: GuildSettings["shift_management"] = {
      ...SMCurrConfiguration,
      enabled: ModuleEnabled,
      log_channel: LogChannel,
      role_assignment: {
        on_duty: OnDutyRoles,
        on_break: OnBreakRoles,
      },
    };

    return UpdateConfigPrompt(
      Interact,
      ConfigPrompt,
      ShiftModuleConfig,
      GetShiftModuleConfigContainer
    );
  };

  const HandleSettingsSave = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      SMCurrConfiguration.enabled === ModuleEnabled &&
      SMCurrConfiguration.log_channel === LogChannel &&
      ArraysAreEqual(SMCurrConfiguration.role_assignment.on_duty, OnDutyRoles) &&
      ArraysAreEqual(SMCurrConfiguration.role_assignment.on_break, OnBreakRoles)
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "shifts")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({ flags: MessageFlags.Ephemeral });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      SelectInteract.guildId,
      {
        $set: {
          "settings.shift_management.enabled": ModuleEnabled,
          "settings.shift_management.log_channel": LogChannel,
          "settings.shift_management.role_assignment.on_duty": OnDutyRoles,
          "settings.shift_management.role_assignment.on_break": OnBreakRoles,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings.shift_management);

    if (UpdatedConfig) {
      SMCurrConfiguration = UpdatedConfig;
      const SetLogChannel = SMCurrConfiguration.log_channel
        ? channelMention(SMCurrConfiguration.log_channel)
        : "`None`";
      const SetOnDutyRoles = SMCurrConfiguration.role_assignment.on_duty.map((R) => roleMention(R));
      const SetOnBreakRoles = SMCurrConfiguration.role_assignment.on_break.map((R) =>
        roleMention(R)
      );

      const FormattedDesc = Dedent(`
        Successfully set/updated the app's shifts configuration.
        
        **Current Configuration:**
        - **Module Enabled:** ${SMCurrConfiguration.enabled ? "Yes" : "No"}
        - **Shift Log Channel:** ${SetLogChannel}
        - **On-Duty Role(s):**
          > ${SetOnDutyRoles.length ? ListFormatter.format(SetOnDutyRoles) : "*None*"}
        - **On-Break Role(s):**
          > ${SetOnBreakRoles.length ? ListFormatter.format(SetOnBreakRoles) : "*None*"}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  SCCompActionCollector.on("collect", async (RecInteract) => {
    const ActionId = RecInteract.customId;
    try {
      if (RecInteract.isButton()) {
        if (ActionId.startsWith(`${ConfigTopics.ShiftConfiguration}-cfm`)) {
          await HandleSettingsSave(RecInteract);
        } else if (ActionId.startsWith(`${ConfigTopics.ShiftConfiguration}-bck`)) {
          SCCompActionCollector.stop("Back");
          await RecInteract.deferUpdate();
          return Callback(RecInteract);
        } else if (ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].LogChannel)) {
          const SelectedChannel = await PromptChannelOrThreadSelection(
            RecInteract,
            CTAIds[ConfigTopics.ShiftConfiguration].LogChannel,
            "Shift Log",
            LogChannel
          );

          if (SelectedChannel !== undefined) {
            LogChannel = SelectedChannel;
            return UpdateShiftConfigPrompt(RecInteract).catch(() => null);
          }
        }
      }

      if (
        RecInteract.isStringSelectMenu() &&
        ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].ModuleEnabled)
      ) {
        ModuleEnabled = RecInteract.values[0] === "true";
      } else if (RecInteract.isRoleSelectMenu()) {
        if (ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].OnDutyRoles)) {
          OnDutyRoles = RecInteract.values.filter(
            (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
          );
        } else if (ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].OnBreakRoles)) {
          OnBreakRoles = RecInteract.values.filter(
            (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
          );
        }
        return UpdateShiftConfigPrompt(RecInteract).catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for shift management configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  SCCompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(LastInteract, "Shift Module", SelectInteract.message.id);
    }
  });
}

async function HandleLeaveConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  LNCurrConfiguration: GuildSettings["leave_notices"]
) {
  let ModuleEnabled = LNCurrConfiguration.enabled;
  let OnLeaveRole = LNCurrConfiguration.leave_role;
  let LogChannel = LNCurrConfiguration.log_channel;
  let RequestsChannel = LNCurrConfiguration.requests_channel;

  const SCCompActionCollector = ConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.StringSelect | ComponentType.RoleSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const UpdateLeaveConfigPrompt = async (Interact: ModulePromptUpdateSupportedInteraction) => {
    const LeaveModuleConfig: GuildSettings["leave_notices"] = {
      ...LNCurrConfiguration,
      enabled: ModuleEnabled,
      leave_role: OnLeaveRole,
      log_channel: LogChannel,
      requests_channel: RequestsChannel,
    };

    return UpdateConfigPrompt(
      Interact,
      ConfigPrompt,
      LeaveModuleConfig,
      GetLeaveModuleConfigContainer
    );
  };

  const HandleSettingsSave = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      LNCurrConfiguration.enabled === ModuleEnabled &&
      LNCurrConfiguration.leave_role === OnLeaveRole &&
      LNCurrConfiguration.log_channel === LogChannel &&
      LNCurrConfiguration.requests_channel === RequestsChannel
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "leave notices")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({ flags: MessageFlags.Ephemeral });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      SelectInteract.guildId,
      {
        $set: {
          "settings.leave_notices.enabled": ModuleEnabled,
          "settings.leave_notices.leave_role": OnLeaveRole,
          "settings.leave_notices.log_channel": LogChannel,
          "settings.leave_notices.requests_channel": RequestsChannel,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings.leave_notices);

    if (UpdatedConfig) {
      LNCurrConfiguration = UpdatedConfig;
      const SetOnLeaveRole = LNCurrConfiguration.leave_role
        ? roleMention(LNCurrConfiguration.leave_role)
        : "`None`";
      const SetLogChannel = LNCurrConfiguration.log_channel
        ? channelMention(LNCurrConfiguration.log_channel)
        : "`None`";
      const SetRequestsChannel = LNCurrConfiguration.requests_channel
        ? channelMention(LNCurrConfiguration.requests_channel)
        : "`None`";

      const FormattedDesc = Dedent(`
        Successfully set/updated the app's leave notices module configuration.
        
        **Current Configuration:**
        - **Module Enabled:** ${LNCurrConfiguration.enabled ? "Yes" : "No"}
        - **On-Leave Role:** ${SetOnLeaveRole}
        - **Log Channel:** ${SetLogChannel}
        - **Requests Channel:** ${SetRequestsChannel}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  SCCompActionCollector.on("collect", async (RecInteract) => {
    const ActionId = RecInteract.customId;
    try {
      if (RecInteract.isButton()) {
        if (ActionId.startsWith(`${ConfigTopics.LeaveConfiguration}-cfm`)) {
          await HandleSettingsSave(RecInteract);
        } else if (ActionId.startsWith(`${ConfigTopics.LeaveConfiguration}-bck`)) {
          SCCompActionCollector.stop("Back");
          await RecInteract.deferUpdate();
          return Callback(RecInteract);
        } else if (ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].LogChannel)) {
          const SelectedChannel = await PromptChannelOrThreadSelection(
            RecInteract,
            CTAIds[ConfigTopics.LeaveConfiguration].LogChannel,
            "Leave Event Log",
            LogChannel
          );

          if (SelectedChannel !== undefined) {
            LogChannel = SelectedChannel;
            return UpdateLeaveConfigPrompt(RecInteract).catch(() => null);
          }
        } else if (ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].RequestsChannel)) {
          const SelectedChannel = await PromptChannelOrThreadSelection(
            RecInteract,
            CTAIds[ConfigTopics.LeaveConfiguration].RequestsChannel,
            "Leave Requests",
            RequestsChannel
          );

          if (SelectedChannel !== undefined) {
            RequestsChannel = SelectedChannel;
            return UpdateLeaveConfigPrompt(RecInteract).catch(() => null);
          }
        }
      }

      if (
        RecInteract.isStringSelectMenu() &&
        ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].ModuleEnabled)
      ) {
        ModuleEnabled = RecInteract.values[0] === "true";
      } else if (
        RecInteract.isRoleSelectMenu() &&
        ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].OnLeaveRole)
      ) {
        OnLeaveRole = RecInteract.values[0] || null;
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for shift management configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  SCCompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(LastInteract, "Leave Module", SelectInteract.message.id);
    }
  });
}

async function HandleDutyActivitiesConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  DACurrentConfig: GuildSettings["duty_activities"]
) {
  let ArrestReportsChannels = DACurrentConfig.log_channels.arrests.slice();
  let CitationsLogChannels = DACurrentConfig.log_channels.citations.slice();
  let IncidentLogChannel = DACurrentConfig.log_channels.incidents;
  let ModuleEnabled = DACurrentConfig.enabled;

  const LCCompActionCollector = ConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.StringSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const UpdateDAConfigPrompt = async (Interact: ModulePromptUpdateSupportedInteraction) => {
    const DAModuleConfig: GuildSettings["duty_activities"] = {
      ...DACurrentConfig,
      enabled: ModuleEnabled,
      log_channels: {
        arrests: ArrestReportsChannels,
        citations: CitationsLogChannels,
        incidents: IncidentLogChannel,
      },
    };

    return UpdateConfigPrompt(
      Interact,
      ConfigPrompt,
      DAModuleConfig,
      GetDutyActivitiesModuleConfigContainer
    );
  };

  const HandleSaveConfirmation = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      ModuleEnabled === DACurrentConfig.enabled &&
      IncidentLogChannel === DACurrentConfig.log_channels.incidents &&
      ArraysAreEqual(DACurrentConfig.log_channels.arrests, ArrestReportsChannels) &&
      ArraysAreEqual(DACurrentConfig.log_channels.citations, CitationsLogChannels)
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "duty activities")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({ flags: MessageFlags.Ephemeral });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      SelectInteract.guildId,
      {
        $set: {
          "settings.duty_activities.enabled": ModuleEnabled,
          "settings.duty_activities.log_channels.arrests": ArrestReportsChannels,
          "settings.duty_activities.log_channels.incidents": IncidentLogChannel,
          "settings.duty_activities.log_channels.citations": CitationsLogChannels,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings.duty_activities);

    if (UpdatedConfig) {
      DACurrentConfig = UpdatedConfig;
      const ARSetChannels = DACurrentConfig.log_channels.arrests.map((CI) =>
        channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
      );

      const CLSetChannels = DACurrentConfig.log_channels.citations.map((CI) =>
        channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
      );

      const ILSetChannel = DACurrentConfig.log_channels.incidents
        ? channelMention(DACurrentConfig.log_channels.incidents)
        : "*None*";

      const FormattedDesc = Dedent(`
        Successfully set/updated the app's duty activities module configuration.
        
        **Current Configuration:**
        - **Module Enabled:** ${DACurrentConfig.enabled ? "Yes" : "No"}
        - **Incidents Log Channel:** ${ILSetChannel}
        - **Arrest Reports Log Channel(s):**
          > ${ARSetChannels.length ? ListFormatter.format(ARSetChannels) : "*None*"}
        - **Citation Issued Log Channel(s):**
          > ${CLSetChannels.length ? ListFormatter.format(CLSetChannels) : "*None*"}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  const HandleOutsideLogChannelSet = async (
    ButtonInteract: ButtonInteraction<"cached">,
    CurrentChannels: string[]
  ): Promise<string[]> => {
    const CCCopy = CurrentChannels.slice();
    const SetChannel = await HandleOutsideLogChannelBtnInteracts(ButtonInteract, CCCopy);
    if (SetChannel) {
      const ExistingChannelIndex = CurrentChannels.findIndex((C) => C.includes(":"));
      if (ExistingChannelIndex === -1) {
        CCCopy.push(SetChannel);
      } else {
        CCCopy[ExistingChannelIndex] = SetChannel;
      }
    } else {
      return CCCopy.filter((C) => !C.includes(":"));
    }
    return CCCopy;
  };

  const HandleButtonSelection = async (ButtonInteract: ButtonInteraction<"cached">) => {
    const BtnId = ButtonInteract.customId;

    if (BtnId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].OutsideArrestLogChannel)) {
      ArrestReportsChannels = await HandleOutsideLogChannelSet(
        ButtonInteract,
        ArrestReportsChannels
      );
    } else if (
      BtnId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].OutsideCitationLogChannel)
    ) {
      CitationsLogChannels = await HandleOutsideLogChannelSet(ButtonInteract, CitationsLogChannels);
    } else if (BtnId.startsWith(`${ConfigTopics.DutyActConfiguration}-cfm`)) {
      await HandleSaveConfirmation(ButtonInteract);
    } else if (BtnId.startsWith(`${ConfigTopics.DutyActConfiguration}-bck`)) {
      LCCompActionCollector.stop("Back");
      await ButtonInteract.deferUpdate();
      return Callback(ButtonInteract);
    }

    if (BtnId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].ArrestLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        ButtonInteract,
        CTAIds[ConfigTopics.DutyActConfiguration].ArrestLogLocalChannel,
        "Arrest Reports",
        ArrestReportsChannels.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return;
      if (ArrestReportsChannels.length) {
        const ExistingChannelIndex = ArrestReportsChannels.findIndex((C) => !C.includes(":"));
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          ArrestReportsChannels.push(SelectedChannel);
        } else if (SelectedChannel) {
          ArrestReportsChannels[ExistingChannelIndex] = SelectedChannel;
        } else {
          ArrestReportsChannels = ArrestReportsChannels.filter(
            (C) => C !== ArrestReportsChannels[ExistingChannelIndex]
          );
        }
      } else if (SelectedChannel) {
        ArrestReportsChannels = [SelectedChannel];
      }

      if (SelectedChannel !== undefined) {
        return UpdateDAConfigPrompt(ButtonInteract).catch(() => null);
      }

      return;
    }

    if (BtnId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].CitationLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        ButtonInteract,
        CTAIds[ConfigTopics.DutyActConfiguration].CitationLogLocalChannel,
        "Citation Log",
        CitationsLogChannels.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return;
      if (CitationsLogChannels.length) {
        const ExistingChannelIndex = CitationsLogChannels.findIndex((C) => !C.includes(":"));
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          CitationsLogChannels.push(SelectedChannel);
        } else if (SelectedChannel) {
          CitationsLogChannels[ExistingChannelIndex] = SelectedChannel;
        } else {
          CitationsLogChannels = CitationsLogChannels.filter(
            (C) => C !== CitationsLogChannels[ExistingChannelIndex]
          );
        }
      } else if (SelectedChannel) {
        CitationsLogChannels = [SelectedChannel];
      }

      if (SelectedChannel !== undefined) {
        return UpdateDAConfigPrompt(ButtonInteract).catch(() => null);
      }

      return;
    }

    if (BtnId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].IncidentLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        ButtonInteract,
        CTAIds[ConfigTopics.DutyActConfiguration].IncidentLogLocalChannel,
        "Incident Reports",
        IncidentLogChannel
      );

      if (SelectedChannel !== undefined) {
        IncidentLogChannel = SelectedChannel;
        return UpdateDAConfigPrompt(ButtonInteract).catch(() => null);
      }
    }
  };

  LCCompActionCollector.on("collect", async (RecInteract) => {
    try {
      if (RecInteract.isButton()) {
        await HandleButtonSelection(RecInteract);
      } else if (
        RecInteract.isStringSelectMenu() &&
        RecInteract.customId.startsWith(CTAIds[ConfigTopics.DutyActConfiguration].ModuleEnabled)
      ) {
        ModuleEnabled = RecInteract.values[0] === "true";
        await RecInteract.deferUpdate();
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for duty activities configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  LCCompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(
        LastInteract,
        "Duty Activities Module",
        SelectInteract.message.id
      );
    }
  });
}

async function HandleReducedActivityConfigPageInteracts(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  RACurrConfiguration: GuildSettings["reduced_activity"]
) {
  let ModuleEnabled = RACurrConfiguration.enabled;
  let RARole = RACurrConfiguration.ra_role;
  let LogChannel = RACurrConfiguration.log_channel;
  let RequestsChannel = RACurrConfiguration.requests_channel;

  const RACompActionCollector = ConfigPrompt.createMessageComponentCollector<
    ComponentType.Button | ComponentType.StringSelect | ComponentType.RoleSelect
  >({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  const UpdateRAConfigPrompt = async (Interact: ModulePromptUpdateSupportedInteraction) => {
    const RAModuleConfig: GuildSettings["reduced_activity"] = {
      ...RACurrConfiguration,
      enabled: ModuleEnabled,
      ra_role: RARole,
      log_channel: LogChannel,
      requests_channel: RequestsChannel,
    };

    return UpdateConfigPrompt(
      Interact,
      ConfigPrompt,
      RAModuleConfig,
      GetReducedActivityModuleConfigContainer
    );
  };

  const HandleSettingsSave = async (ButtonInteract: ButtonInteraction<"cached">) => {
    if (
      RACurrConfiguration.enabled === ModuleEnabled &&
      RACurrConfiguration.ra_role === RARole &&
      RACurrConfiguration.log_channel === LogChannel &&
      RACurrConfiguration.requests_channel === RequestsChannel
    ) {
      return new InfoContainer()
        .useInfoTemplate("ConfigTopicNoChangesMade", "reduced activity")
        .replyToInteract(ButtonInteract, true);
    }

    if (!ButtonInteract.deferred)
      await ButtonInteract.deferReply({ flags: MessageFlags.Ephemeral });

    const UpdatedConfig = await GuildModel.findByIdAndUpdate(
      SelectInteract.guildId,
      {
        $set: {
          "settings.reduced_activity.enabled": ModuleEnabled,
          "settings.reduced_activity.ra_role": RARole,
          "settings.reduced_activity.log_channel": LogChannel,
          "settings.reduced_activity.requests_channel": RequestsChannel,
        },
      },
      {
        new: true,
        strict: true,
        runValidators: true,
        projection: {
          settings: 1,
        },
      }
    ).then((GuildDoc) => GuildDoc?.settings.reduced_activity);

    if (UpdatedConfig) {
      RACurrConfiguration = UpdatedConfig;
      const SetRARole = RACurrConfiguration.ra_role
        ? roleMention(RACurrConfiguration.ra_role)
        : "`None`";
      const SetLogChannel = RACurrConfiguration.log_channel
        ? channelMention(RACurrConfiguration.log_channel)
        : "`None`";
      const SetRequestsChannel = RACurrConfiguration.requests_channel
        ? channelMention(RACurrConfiguration.requests_channel)
        : "`None`";

      const FormattedDesc = Dedent(`
        Successfully set/updated the app's reduced activity module configuration.
        
        **Current Configuration:**
        - **Module Enabled:** ${RACurrConfiguration.enabled ? "Yes" : "No"}
        - **Reduced Activity Role:** ${SetRARole}
        - **Requests Channel:** ${SetRequestsChannel}
        - **Log Channel:** ${SetLogChannel}
      `);

      return new SuccessContainer().setDescription(FormattedDesc).replyToInteract(ButtonInteract);
    } else {
      return new ErrorContainer().useErrTemplate("AppError").replyToInteract(ButtonInteract);
    }
  };

  RACompActionCollector.on("collect", async (RecInteract) => {
    const ActionId = RecInteract.customId;
    try {
      if (RecInteract.isButton()) {
        if (ActionId.startsWith(`${ConfigTopics.ReducedActivityConfiguration}-cfm`)) {
          await HandleSettingsSave(RecInteract);
        } else if (ActionId.startsWith(`${ConfigTopics.ReducedActivityConfiguration}-bck`)) {
          RACompActionCollector.stop("Back");
          await RecInteract.deferUpdate();
          return Callback(RecInteract);
        } else if (
          ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].LogChannel)
        ) {
          const SelectedChannel = await PromptChannelOrThreadSelection(
            RecInteract,
            CTAIds[ConfigTopics.ReducedActivityConfiguration].LogChannel,
            "Reduced Activity Event Logs",
            LogChannel
          );

          if (SelectedChannel !== undefined) {
            LogChannel = SelectedChannel;
            return UpdateRAConfigPrompt(RecInteract).catch(() => null);
          }
        } else if (
          ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].RequestsChannel)
        ) {
          const SelectedChannel = await PromptChannelOrThreadSelection(
            RecInteract,
            CTAIds[ConfigTopics.ReducedActivityConfiguration].RequestsChannel,
            "Reduced Activity Requests",
            RequestsChannel
          );

          if (SelectedChannel !== undefined) {
            RequestsChannel = SelectedChannel;
            return UpdateRAConfigPrompt(RecInteract).catch(() => null);
          }
        }
      }

      if (
        RecInteract.isStringSelectMenu() &&
        ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].ModuleEnabled)
      ) {
        ModuleEnabled = RecInteract.values[0] === "true";
      } else if (
        RecInteract.isRoleSelectMenu() &&
        ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].RARole)
      ) {
        RARole = RecInteract.values[0] || null;
        RecInteract.deferUpdate().catch(() => null);
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for reduced activity configuration;",
        error_id: ErrorId,
        label: FileLabel,
        stack: Err.stack,
      });
    }
  });

  RACompActionCollector.on("end", async (Collected, EndReason) => {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(
        LastInteract,
        "Reduced Activity Module",
        SelectInteract.message.id
      );
    }
  });
}

async function HandleBasicConfigSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetBasicConfigContainer(SelectInteract, GuildConfig);
    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleBasicConfigPageInteracts(SelectInteract, ConfigPrompt, GuildConfig);
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleAdditionalConfigSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetAdditionalConfigContainer(SelectInteract, GuildConfig);
    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleAdditionalConfigPageInteracts(SelectInteract, ConfigPrompt, GuildConfig);
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleShiftModuleSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetShiftModuleConfigContainer(
      SelectInteract,
      GuildConfig.shift_management
    );

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleShiftConfigPageInteracts(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.shift_management
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleDutyActivitiesModuleSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetDutyActivitiesModuleConfigContainer(
      SelectInteract,
      GuildConfig.duty_activities
    );

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleDutyActivitiesConfigPageInteracts(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.duty_activities
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleLeaveModuleSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetLeaveModuleConfigContainer(
      SelectInteract,
      GuildConfig.leave_notices
    );

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleLeaveConfigPageInteracts(SelectInteract, ConfigPrompt, GuildConfig.leave_notices);
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleReducedActivityModuleSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainer = GetReducedActivityModuleConfigContainer(
      SelectInteract,
      GuildConfig.reduced_activity
    );

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [ModuleContainer],
    });

    return HandleReducedActivityConfigPageInteracts(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.reduced_activity
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleConfigShowSelection(
  SelectInteract: StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">,
  PageIndex: number = 0
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (!GuildConfig) throw new AppError("GuildConfigNotFound");

  const ConfigSections = [
    {
      Title: "Basic App Configuration",
      Content: GetCSBasicSettingsContent(GuildConfig),
    },
    {
      Title: "Shift Management Module",
      Content: GetCSShiftModuleContent(GuildConfig),
    },
    {
      Title: "Leave Notices Module",
      Content: GetCSLeaveNoticesContent(GuildConfig),
    },
    {
      Title: "Reduced Activity Module",
      Content: GetCSReducedActivityContent(GuildConfig),
    },
    {
      Title: "Duty Activities Module",
      Content: GetCSDutyActivitiesContent(GuildConfig),
    },
    {
      Title: "Additional Configuration",
      Content: GetCSAdditionalConfigContent(GuildConfig),
    },
  ];

  const SectionsPerPage = 2;
  const TotalPages = Math.ceil(ConfigSections.length / SectionsPerPage);
  const SafePageIndex = Math.min(Math.max(0, PageIndex), TotalPages - 1);

  const StartIndex = SafePageIndex * SectionsPerPage;
  const SectionsToShow = ConfigSections.slice(StartIndex, StartIndex + SectionsPerPage);
  const ResponseContainer = new ContainerBuilder()
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder({
        content: `### ${Emojis.GearColored}  Current Configuration`,
      })
    );

  SectionsToShow.forEach((Section, Index) => {
    ResponseContainer.addSeparatorComponents(
      new SeparatorBuilder({ divider: true, spacing: Index === 0 ? 2 : 1 })
    );
    ResponseContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${Section.Title}**\n${Section.Content}`)
    );
  });

  ResponseContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));
  ResponseContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Showing configuration for the app modules as of ${FormatTime(SelectInteract.createdAt, "f")}`
    )
  );

  ResponseContainer.addActionRowComponents(
    ...GetShowConfigurationsPageComponents(SelectInteract, SafePageIndex, TotalPages)
  );

  const ShowConfigPageMsg = await SelectInteract.update({
    components: [ResponseContainer],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message as Message<true>);

  return HandleConfigShowPageInteractsWithPagination(
    SelectInteract,
    ShowConfigPageMsg,
    SafePageIndex
  );
}

async function HandleConfigShowPageInteractsWithPagination(
  Interaction: CmdSelectOrButtonInteract<"cached"> | ButtonInteraction<"cached">,
  ConfigPrompt: Message<true> | InteractionResponse<true>,
  CurrentPageIndex: number
) {
  try {
    const ReceivedInteraction = await ConfigPrompt.awaitMessageComponent({
      filter: (Interact) => Interact.user.id === Interaction.user.id,
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
    });

    if (ReceivedInteraction?.isButton()) {
      const BtnId = ReceivedInteraction.customId;

      if (BtnId.includes("prev")) {
        return HandleConfigShowSelection(ReceivedInteraction, CurrentPageIndex - 1);
      } else if (BtnId.includes("next")) {
        return HandleConfigShowSelection(ReceivedInteraction, CurrentPageIndex + 1);
      } else if (BtnId.includes("app-config-bck")) {
        await ReceivedInteraction.deferUpdate();
        return Callback(ReceivedInteraction);
      }
    }
  } catch (Err: any) {
    if (Err.message.match(/reason: \w+Delete/)) return;
    if (Err.message?.match(/reason: (?:time|idle)/i)) {
      const PromptMessage =
        ConfigPrompt instanceof Message ? ConfigPrompt : await ConfigPrompt.fetch();

      const MessageComponents = DisableMessageComponents(
        PromptMessage.components.map((Comp) => Comp.toJSON())
      );

      return Interaction.editReply({ components: MessageComponents }).catch(() => null);
    }
  }
}

// ---------------------------------------------------------------------------------------
// Initial Handlers:
// -----------------
async function HandleInitialRespActions(
  CmdInteract: CmdSelectOrButtonInteract<"cached">,
  CmdRespMsg: Message<true> | InteractionResponse<true>,
  SMenuDisabler: () => Promise<any>
) {
  const ComponentCollector = CmdRespMsg.createMessageComponentCollector({
    filter: (Interact) => Interact.user.id === CmdInteract.user.id,
    componentType: ComponentType.StringSelect,
    time: 10 * 60 * 1000,
  });

  ComponentCollector.on("collect", async function OnInitialRespCallback(TopicSelectInteract) {
    const SelectedConfigTopic = TopicSelectInteract.values[0];

    try {
      if (SelectedConfigTopic === ConfigTopics.BasicConfiguration) {
        await HandleBasicConfigSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.ShiftConfiguration) {
        await HandleShiftModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.DutyActConfiguration) {
        await HandleDutyActivitiesModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.ShowConfigurations) {
        await HandleConfigShowSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.LeaveConfiguration) {
        await HandleLeaveModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.AdditionalConfiguration) {
        await HandleAdditionalConfigSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.ReducedActivityConfiguration) {
        await HandleReducedActivityModuleSelection(TopicSelectInteract);
      } else {
        await new ErrorContainer()
          .useErrTemplate("UnknownConfigTopic")
          .replyToInteract(TopicSelectInteract);
      }

      ComponentCollector.stop("TopicSelected");
    } catch (Err) {
      if (Err instanceof AppError && Err.is_showable) {
        return new ErrorEmbed().useErrClass(Err).replyToInteract(TopicSelectInteract, true);
      }

      const ErrorId = GetErrorId();
      new ErrorEmbed()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(TopicSelectInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for app configuration topic selection;",
        error_id: ErrorId,
        label: FileLabel,
        stack: (Err as Error).stack,
        error: { ...(Err as Error) },
      });
    }
  });

  ComponentCollector.on("end", async (_, EndReason) => {
    if (EndReason === "TopicSelected" || EndReason.match(/reason: \w{1,8}Delete/)) return;
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      await SMenuDisabler().catch(() => null);
    }
  });
}

async function Callback(
  PromptInteraction: CmdSelectOrButtonInteract<"cached"> | ButtonInteraction<"cached">
) {
  const ConfigTopicsMenu = GetConfigTopicsDropdownMenu(PromptInteraction);
  const CmdRespContainer = new ContainerBuilder()
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          ### App Configuration
          **Please select a module or a topic from the drop-down list below.**
        `)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addActionRowComponents(ConfigTopicsMenu);

  let PromptMessage: Message<true>;
  const PromptMessageId =
    PromptInteraction instanceof MessageComponentInteraction ? PromptInteraction.message.id : null;

  if (PromptInteraction.replied || PromptInteraction.deferred) {
    PromptMessage = await PromptInteraction.editReply({
      components: [CmdRespContainer],
      flags: MessageFlags.IsComponentsV2,
      ...(PromptMessageId ? { message: PromptMessageId } : {}),
    });
  } else {
    PromptMessage = await PromptInteraction.reply({
      withResponse: true,
      components: [CmdRespContainer],
      flags: MessageFlags.IsComponentsV2,
    }).then((Resp) => Resp.resource!.message as Message<true>);
  }

  const DisablePrompt = () => {
    const APICompatibleComps = PromptMessage.components.map((Comp) => Comp.toJSON());
    const DisabledComponents = DisableMessageComponents(APICompatibleComps);
    return PromptInteraction.editReply({
      components: DisabledComponents,
      message: PromptMessage.id,
    });
  };

  return HandleInitialRespActions(PromptInteraction, PromptMessage, DisablePrompt);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject = {
  options: { user_perms: [PermissionFlagsBits.ManageGuild] },
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View and manage the application configuration for this server.")
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
