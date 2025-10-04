/* eslint-disable sonarjs/no-duplicate-string */
import {
  Guild,
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
  CollectedInteraction,
  RoleSelectMenuBuilder,
  InteractionContextType,
  StringSelectMenuBuilder,
  InteractionResponseType,
  ChannelSelectMenuBuilder,
  InteractionUpdateOptions,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ApplicationIntegrationType,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  ModalActionRowComponentBuilder,
  MentionableSelectMenuInteraction,
} from "discord.js";

import {
  BaseExtraContainer,
  SuccessContainer,
  ErrorContainer,
  InfoContainer,
  WarnContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  DASignatureFormats,
  RiskyRolePermissions,
  SignatureFormatResolved,
} from "@Config/Constants.js";

import { ConcatenateLines, Dedent } from "@Utilities/Strings/Formatters.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { milliseconds } from "date-fns/milliseconds";
import { Colors, Emojis } from "@Config/Shared.js";
import { ArraysAreEqual } from "@Utilities/Helpers/ArraysAreEqual.js";
import { FilterUserInput } from "@Utilities/Strings/Redactor.js";
import { isValidObjectId } from "mongoose";
import { clone, isDeepEqual } from "remeda";
import { GetErrorId, RandomString } from "@Utilities/Strings/Random.js";

import ShowModalAndAwaitSubmission from "@Utilities/Discord/ShowModalAwaitSubmit.js";
import DisableMessageComponents from "@Utilities/Discord/DisableMsgComps.js";
import AwaitMessageWithTimeout from "@Utilities/Discord/MessageCreateListener.js";
import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import ParseDuration from "parse-duration";
import GuildModel from "@Models/Guild.js";
import DHumanize from "humanize-duration";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Chunks from "@Utilities/Helpers/SliceIntoChunks.js";

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

type ConfigTopicsCompIds = ValueOf<{
  [K in keyof typeof CTAIds]: ValueOf<(typeof CTAIds)[K]>;
}>;

type SettingsResolvable =
  | GuildSettings
  | GuildSettings[
      | "shift_management"
      | "duty_activities"
      | "leave_notices"
      | "reduced_activity"
      | "callsigns_module"];

type ModulePromptUpdateSupportedInteraction<Cached extends CacheType = "cached"> =
  | StringSelectMenuInteraction<Cached>
  | ChannelSelectMenuInteraction<Cached>
  | RoleSelectMenuInteraction<Cached>
  | UserSelectMenuInteraction<Cached>
  | MentionableSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

interface ModuleState<T extends SettingsResolvable> {
  ConfigTopic: ConfigTopics;
  TotalPages: number;

  /** The current page as an index; i.e. `0` = first page. */
  CurrentPage: number;

  /** Indicates whether the module settings has been modified (OriginalConfig ≠ ModuleConfig). */
  IsModified: () => boolean;

  /** The current configuration state; i.e. the modified settings (if modified). */
  ModuleConfig: T;

  /** The original configuration state; i.e. the settings before any modifications. */
  OriginalConfig: T;
}

enum ConfigTopics {
  ShowConfigurations = "app-config-vc",
  BasicConfiguration = "app-config-bc",
  ShiftConfiguration = "app-config-sc",
  LeaveConfiguration = "app-config-loa",
  CallsignsConfiguration = "app-config-cs",
  AdditionalConfiguration = "app-config-ac",
  DutyActivitiesConfiguration = "app-config-da",
  ReducedActivityConfiguration = "app-config-ra",
}

enum ConfigTopicMgmtButtonsIds {
  NextPage = "next",
  PrevPage = "prev",
  ReturnToMain = "bck",
  ConfirmAndSave = "cfm",
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
    ServerDefaultShiftQuota: `${ConfigTopics.ShiftConfiguration}-darq`,
  },

  [ConfigTopics.LeaveConfiguration]: {
    ModuleEnabled: `${ConfigTopics.LeaveConfiguration}-me`,
    RequestsChannel: `${ConfigTopics.LeaveConfiguration}-rc`,
    LogChannel: `${ConfigTopics.LeaveConfiguration}-lc`,
    OnLeaveRole: `${ConfigTopics.LeaveConfiguration}-olr`,
    AlertRoles: `${ConfigTopics.LeaveConfiguration}-ar`,
    ActivePrefix: `${ConfigTopics.LeaveConfiguration}-ap`,
  },

  [ConfigTopics.DutyActivitiesConfiguration]: {
    ModuleEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-me`,
    ArrestLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-alc`,
    CitationLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-clc`,
    IncidentLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-ilc`,

    SignatureFormatType: `${ConfigTopics.AdditionalConfiguration}-dasf`,
    ArrestReportsImgHeaderEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-ar-hdr`,
    IncReportsAutoThreadsMgmtEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-ir-atm`,

    OutsideArrestLogChannel: `${ConfigTopics.DutyActivitiesConfiguration}-oalc`,
    OutsideCitationLogChannel: `${ConfigTopics.DutyActivitiesConfiguration}-oclc`,
  },

  [ConfigTopics.AdditionalConfiguration]: {
    DActivitiesDeletionInterval: `${ConfigTopics.AdditionalConfiguration}-dadi`,
    UserTextInputFilteringEnabled: `${ConfigTopics.AdditionalConfiguration}-utfe`,
  },

  [ConfigTopics.ReducedActivityConfiguration]: {
    ModuleEnabled: `${ConfigTopics.ReducedActivityConfiguration}-me`,
    RequestsChannel: `${ConfigTopics.ReducedActivityConfiguration}-rc`,
    LogChannel: `${ConfigTopics.ReducedActivityConfiguration}-lc`,
    RARole: `${ConfigTopics.ReducedActivityConfiguration}-rar`,
    AlertRoles: `${ConfigTopics.ReducedActivityConfiguration}-ar`,
    ActivePrefix: `${ConfigTopics.ReducedActivityConfiguration}-ap`,
  },

  [ConfigTopics.CallsignsConfiguration]: {
    ModuleEnabled: `${ConfigTopics.CallsignsConfiguration}-me`,
    RequestsChannel: `${ConfigTopics.CallsignsConfiguration}-rc`,
    LogChannel: `${ConfigTopics.CallsignsConfiguration}-lc`,
    ManagerRoles: `${ConfigTopics.CallsignsConfiguration}-mgr`,
    AlertOnRequest: `${ConfigTopics.CallsignsConfiguration}-aor`,
    NicknameFormat: `${ConfigTopics.CallsignsConfiguration}-nf`,
    BeatNumberRestrictions: `${ConfigTopics.CallsignsConfiguration}-bnr`,
    AutoRenameOnApproval: `${ConfigTopics.CallsignsConfiguration}-ara`,
    UnitTypeRoleRestrictions: `${ConfigTopics.CallsignsConfiguration}-utrr`,
    UnitTypeRoleRestrictionsMode: `${ConfigTopics.CallsignsConfiguration}-utrm`,
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
        Name: "Roblox Account Link Required",
        Description:
          "Enable or disable the app's Roblox authorization requirement. If enabled, the app requires members to have their Roblox account linked before " +
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
      {
        Name: "Server Default Shift Quota",
        Description:
          "Set the default shift quota for all staff in here to a specific duration of time. This will be taken " +
          "into account, for example, when generating activity reports where a quota was not provided.",
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
        Name: "Alert Roles",
        Description:
          "The roles that will receive alerts, i.e. notifications, when a new leave or extension request is made and posted in the requests channel.",
      },
      {
        Name: "Active Prefix",
        Description:
          "The text prefix added to nicknames during active leaves. If the nickname is too long, it will be truncated from the end to fit the prefix within Discord's length limit. " +
          "The prefix is automatically removed when the leave ends.",
      },
      {
        Name: "Leave Requests Destination",
        Description:
          "The channel or thread used to send leave requests submitted by members. Setting this destination is optional, but if not set, management " +
          "staff will need to use the `/loa admin` command to review members' pending requests.",
      },
      {
        Name: "Activity Log Destination",
        Description:
          "A separate channel or thread used to log various activities in the leave of absence module, including leave approvals, denials, cancellations, and terminations.",
      },
    ],
  },
  [ConfigTopics.DutyActivitiesConfiguration]: {
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
          "Add additional channels from other servers to mirror your citation and arrest logs. " +
          "These will receive identical log messages alongside your primary local channels.",
      },
      {
        Name: "Signature Format",
        Description:
          "Select the format used for signatures when logging duty activities such as reports and citations. " +
          "If you choose a format that includes Roblox usernames or display names, members must have their Roblox account linked for logging to work.",
      },
      {
        Name: "Arrest Reports Gap Image Header",
        Description:
          "Choose whether to display the 'to protect & to serve' image header at the bottom of each arrest report embed. Disabling this keeps reports more compact and focused on essential details.",
      },
      {
        Name: "Incident Reports Auto Thread Management",
        Description:
          "When enabled, the app will automatically create a thread for each incident report message in the destination channel. " +
          "This allows discussing and investigating incidents in a dedicated space. The thread will be closed automatically when the incident status is updated to a closed category.\n\n" +
          "Note: Requires `Create Public Threads` permission and only works in non-forum channels.",
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
        Name: "Alert Roles",
        Description:
          "The roles that will receive alerts, i.e. notifications, when a new request is made and posted in the requests destination.",
      },
      {
        Name: "Active Prefix",
        Description:
          "The text prefix added to nicknames during active reduced activity. If the nickname is too long, it will be truncated from the end to fit the prefix within Discord's length limit. " +
          "The prefix is automatically removed when the notice ends.",
      },
      {
        Name: "Requests Destination",
        Description:
          "Designated channel or thread to post reduced activity requests in. If not configured, management staff will have to process requests via the `ra admin` command.",
      },
      {
        Name: "Activity Log Destination",
        Description:
          "Holds all reduced activity events including approvals, rejections, cancellations, and early terminations.",
      },
    ],
  },
  [ConfigTopics.CallsignsConfiguration]: {
    Title: "Call Signs Module Configuration",
    Settings: [
      {
        Name: "Module Enabled",
        Description: "Controls whether call signs commands and features are available.",
      },
      {
        Name: "Requests Destination",
        Description:
          "The channel or thread where all call sign-related requests will be sent for approval. " +
          "This setting is optional; however, requests will require explicit manual review by management using administrative slash commands.",
      },
      {
        Name: "Logging Destination",
        Description:
          "The channel or thread where all call sign-related logs such as assignment changes and approvals will be sent.",
      },
      {
        Name: "Manager Roles",
        Description:
          "Anyone with these configured roles is authorized to administer, manage, and oversee call sign requests. " +
          "Additionally, staff considered management or those with management app permissions can also take action.",
      },
      {
        Name: "Alert on New Request",
        Description:
          "Controls whether manager roles are notified when a new call sign request is made and posted in the requests destination.",
      },
      {
        Name: "Auto-Rename on Assignment",
        Description:
          "Determines whether assigned personnel are automatically renamed to their approved call sign based on the configured nickname format." +
          "Keep in mind that this will truncate the nickname if it exceeds Discord's character limit after applying the format.",
      },
      {
        Name: "Unit Type Restrictions Mode",
        Description:
          "Choose how unit type restrictions work:\n" +
          "- **Whitelist Mode:** Only unit types you've specifically configured are allowed for requests. All others are blocked.\n" +
          "- **Blacklist Mode:** All unit types are allowed by default. Only those you configure will have role requirements.",
      },
      {
        Name: "Nickname Format",
        Description:
          "The format to use when updating members' nicknames with their assigned call signs, if auto-renaming is enabled.\n\n" +
          "-# **Supported Tags:**\n" +
          "-# > `{division}`, `{unit_type}`, `{beat_num}`, `{nickname}`, `{display_name}`, `{roblox_username}`",
      },
      {
        Name: "Unit Type Role-based Restrictions",
        Description:
          "If a unit type is associated with specific roles, only members holding at least one of those roles can request that unit type. " +
          "This ensures that only qualified personnel can submit requests for specialized units.\n" +
          "-# > **Note:** this setting cannot be set or changed at the time being and is yet to be implemented.",
      },
      {
        Name: "Beat Number Role-based Restrictions",
        Description:
          "Define specific rules for assigning call sign beat numbers based on roles. These restrictions ensure that only qualified members can request certain beat numbers.\n" +
          "-# > **Note:** this setting cannot be set or changed at the time being and is yet to be implemented.",
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
  const IntervalInDays = Math.round(Interval / MillisInDay);
  if (IntervalInDays > 1) {
    return `${IntervalInDays} Days`;
  } else if (IntervalInDays === 1) {
    return "One Day";
  } else {
    return "Never";
  }
}

/**
 * Attaches configuration topic management buttons to a container.
 * @param Params - The parameters for attaching the buttons.
 * @property Params.Container - The container to attach the buttons to.
 * @property Params.Interaction - The interaction that triggered the attachment.
 * @property Params.ConfigTopicId - The Id of the configuration topic.
 * @property Params.CurrentPage - The current page number *as an index*.
 * @property Params.TotalPages - The total number of pages.
 * @returns The updated container with the buttons attached.
 */
function AttachNavMgmtCompsToContainer(Params: {
  Container: ContainerBuilder;
  Interaction: ModulePromptUpdateSupportedInteraction;
  ConfigTopicId: ConfigTopics;
  CurrentPage: number;
  TotalPages: number;
}): ContainerBuilder {
  const { Container, Interaction, ConfigTopicId, CurrentPage, TotalPages } = Params;
  const NavigationRows = CreateConfigTopicMgmtComponents(
    Interaction,
    ConfigTopicId,
    CurrentPage,
    TotalPages
  );

  return Container.addSeparatorComponents(
    new SeparatorBuilder().setDivider().setSpacing(2)
  ).addActionRowComponents(...NavigationRows);
}

/**
 * Filters out roles that are managed by an application or which have
 * specific unsafe permissions such as Manage Server or Administrator.
 * @param GuildId - The Id of the guild to check against.
 * @param RoleIds - An array of role Ids to filter.
 * @returns An array of role Ids that are safe to use in the context of role assignment.
 */
async function FilterUnsafeRoles(GuildInst: Guild, RoleIds: string[]) {
  const ResolvedRoles = RoleIds.map((Id) => GuildInst.roles.cache.get(Id)).filter((R) => !!R);
  return ResolvedRoles.filter(
    (Role) => !Role.managed && !Role.permissions.any(RiskyRolePermissions)
  ).map((R) => R.id);
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
  PromptMsg?: Message<true> | string
) {
  const MsgContainer = new InfoContainer()
    .useInfoTemplate("TimedOutConfigPrompt")
    .setTitle(`Timed Out - ${CurrModule}`);

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
 * Updates a configuration prompt with new selected/configured settings, utilizing the `ModuleState.ModuleConfig` property.
 * @param Interaction - The interaction that triggered the update.
 * @param ConfigPrompt - The message of the configuration prompt.
 * @param ModuleState - The current module state.
 * @param GetContainersFn - Function that generates the UI containers for this module.
 * @returns Promise resolving to the update operation result.
 */
async function UpdateConfigPrompt<T extends SettingsResolvable>(
  Interaction: ModulePromptUpdateSupportedInteraction,
  ConfigPrompt: Message<true>,
  ModuleState: ModuleState<T>,
  GetContainersFn: (
    Interaction: ModulePromptUpdateSupportedInteraction,
    Config: T
  ) => readonly ContainerBuilder[] | ContainerBuilder[]
) {
  const ConfigContainers = GetContainersFn(Interaction, ModuleState.ModuleConfig);
  const CurrentConfigContainer = AttachNavMgmtCompsToContainer({
    Interaction,
    ConfigTopicId: ModuleState.ConfigTopic,
    CurrentPage: ModuleState.CurrentPage,
    TotalPages: ModuleState.TotalPages,
    Container: ConfigContainers[ModuleState.CurrentPage],
  });

  if (!Interaction.deferred && !Interaction.replied) {
    return Interaction.update({
      components: [CurrentConfigContainer],
    });
  } else {
    return Interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      message: ConfigPrompt,
      components: [CurrentConfigContainer],
    });
  }
}

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
function GetCSBeatNumRestrictionsPromptComps(
  BtnInteract: ButtonInteraction<"cached">,
  IsUnitType: boolean
) {
  const ScopeLabel = IsUnitType ? "unit type" : "beat number";
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].BeatNumberRestrictions}-am:${BtnInteract.user.id}`
      )
      .setPlaceholder("Select an action...")
      .setMinValues(0)
      .setMaxValues(1)
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setValue("add")
          .setLabel("Add New Restriction")
          .setDescription(`Add a new ${ScopeLabel} restriction rule.`),
        new StringSelectMenuOptionBuilder()
          .setValue("remove")
          .setLabel("Remove Existing Restriction")
          .setDescription(`Remove an existing ${ScopeLabel} restriction rule by its ID.`),
        new StringSelectMenuOptionBuilder()
          .setValue("clear")
          .setLabel("Clear All Restrictions")
          .setDescription(`Remove all existing ${ScopeLabel} restriction rules.`),
        new StringSelectMenuOptionBuilder()
          .setValue("list")
          .setLabel("List All Restrictions")
          .setDescription("List all existing saved and unsaved restrictions."),
        new StringSelectMenuOptionBuilder()
          .setValue("confirm")
          .setLabel("Confirm Current Restrictions")
          .setDescription("Confirm currently set rules and return to module config."),
        new StringSelectMenuOptionBuilder()
          .setValue("discard")
          .setLabel("Cancel Changes")
          .setDescription("Discard all changes and return to module config.")
      )
  );
}

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

function CreateConfigTopicMgmtComponents<ConfigTopic extends ConfigTopics>(
  Interaction: ModulePromptUpdateSupportedInteraction,
  ConfigTopicId: ConfigTopic,
  CurrentPage: number,
  TotalPages: number
): ActionRowBuilder<ButtonBuilder>[] {
  const ActionRows: ActionRowBuilder<ButtonBuilder>[] = [];
  const PaginationRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Previous Page")
      .setEmoji(Emojis.NavPrev)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(CurrentPage <= 0)
      .setCustomId(
        `${ConfigTopicId}-${ConfigTopicMgmtButtonsIds.PrevPage}:${Interaction.user.id}:${CurrentPage}`
      ),

    new ButtonBuilder()
      .setLabel(`Page ${CurrentPage + 1} of ${TotalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${ConfigTopicId}-pg:${Interaction.user.id}:${CurrentPage}`)
      .setDisabled(true),

    new ButtonBuilder()
      .setLabel("Next Page")
      .setEmoji(Emojis.NavNext)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(CurrentPage >= TotalPages - 1)
      .setCustomId(
        `${ConfigTopicId}-${ConfigTopicMgmtButtonsIds.NextPage}:${Interaction.user.id}:${CurrentPage}`
      )
  );

  const ActionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Confirm and Save")
      .setEmoji(Emojis.WhiteCheck)
      .setStyle(ButtonStyle.Success)
      .setCustomId(
        `${ConfigTopicId}-${ConfigTopicMgmtButtonsIds.ConfirmAndSave}:${Interaction.user.id}:${CurrentPage}`
      ),

    new ButtonBuilder()
      .setLabel("Return to Topic Selection")
      .setEmoji(Emojis.WhiteBack)
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${ConfigTopicId}-${ConfigTopicMgmtButtonsIds.ReturnToMain}:${Interaction.user.id}`
      )
  );

  if (TotalPages > 1) {
    ActionRows.push(PaginationRow);
  }

  ActionRows.push(ActionRow);
  return ActionRows;
}

function GetConfigTopicsDropdownMenu(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached"> | SlashCommandInteraction<"cached">
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
          .setValue(ConfigTopics.DutyActivitiesConfiguration),
        new StringSelectMenuOptionBuilder()
          .setLabel("Call Signs Module Configuration")
          .setDescription("Set and modify call signs module settings.")
          .setValue(ConfigTopics.CallsignsConfiguration),
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
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
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
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
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

  const LogChannelBtnAccessory = new ButtonBuilder()
    .setCustomId(`${CTAIds[ConfigTopics.ShiftConfiguration].LogChannel}:${Interaction.user.id}`)
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary);

  const SetDefaultShiftQuotaBtnAccessory = new ButtonBuilder()
    .setLabel("Set Default Shift Quota")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.ShiftConfiguration].ServerDefaultShiftQuota}:${Interaction.user.id}`
    );

  return [
    ModuleEnabledAR,
    OnDutyRolesAR,
    OnBreakRolesAR,
    LogChannelBtnAccessory,
    SetDefaultShiftQuotaBtnAccessory,
  ] as const;
}

function GetLeaveModuleConfigComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
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

  const AlertRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CTAIds[ConfigTopics.LeaveConfiguration].AlertRoles}:${Interaction.user.id}`)
      .setPlaceholder("Alert Roles")
      .setMinValues(0)
      .setMaxValues(3)
  );

  if (LeaveNoticesConfig.alert_roles.length) {
    AlertRolesAR.components[0].setDefaultRoles(LeaveNoticesConfig.alert_roles);
  }

  const ActivePrefixAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Active Prefix")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CTAIds[ConfigTopics.LeaveConfiguration].ActivePrefix}:${Interaction.user.id}`);

  const RequestsDestAccessoryBtn = new ButtonBuilder()
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
    AlertRolesAR,
    ActivePrefixAccessoryBtn,
    RequestsDestAccessoryBtn,
    LogDestAccessoryCAButton,
  ] as const;
}

function GetDutyActModuleConfigComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  DActivitiesConfig: GuildSettings["duty_activities"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].ModuleEnabled}:${Interaction.user.id}`
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
      `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].CitationLogLocalChannel}:${Interaction.user.id}`
    );

  const LocalArrestsLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Arrest Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].ArrestLogLocalChannel}:${Interaction.user.id}`
    );

  const IncidentLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Incident Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].IncidentLogLocalChannel}:${Interaction.user.id}`
    );

  const SetOutsideLogChannelBtns = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Set Outside Citation Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].OutsideCitationLogChannel}:${Interaction.user.id}`
      ),
    new ButtonBuilder()
      .setLabel("Set Outside Arrest Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].OutsideArrestLogChannel}:${Interaction.user.id}`
      )
  );

  const SignatureFormatAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Signature Format")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].SignatureFormatType}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Discord Nickname")
          .setDescription("[DiscordNickname]")
          .setValue(DASignatureFormats.DiscordNickname.toString())
          .setDefault(DActivitiesConfig.signature_format === DASignatureFormats.DiscordNickname),
        new StringSelectMenuOptionBuilder()
          .setLabel("Discord Username")
          .setDescription("@[DiscordUsername]")
          .setValue(DASignatureFormats.DiscordUsername.toString())
          .setDefault(DActivitiesConfig.signature_format === DASignatureFormats.DiscordUsername),
        new StringSelectMenuOptionBuilder()
          .setLabel("Discord Nickname and Username")
          .setDescription("[DiscordNickname] (@[DiscordUsername])")
          .setValue(DASignatureFormats.DiscordNicknameDiscordUsername.toString())
          .setDefault(
            DActivitiesConfig.signature_format === DASignatureFormats.DiscordNicknameDiscordUsername
          ),
        new StringSelectMenuOptionBuilder()
          .setLabel("Roblox Display Name")
          .setDescription("[RobloxDisplayName]")
          .setValue(DASignatureFormats.RobloxDisplayName.toString())
          .setDefault(DActivitiesConfig.signature_format === DASignatureFormats.RobloxDisplayName),
        new StringSelectMenuOptionBuilder()
          .setLabel("Roblox Username")
          .setDescription("@[RobloxUsername]")
          .setValue(DASignatureFormats.RobloxUsername.toString())
          .setDefault(DActivitiesConfig.signature_format === DASignatureFormats.RobloxUsername),
        new StringSelectMenuOptionBuilder()
          .setLabel("Roblox Display Name and Username")
          .setDescription("[RobloxDisplayName] (@[RobloxUsername])")
          .setValue(DASignatureFormats.RobloxDisplayNameRobloxUsername.toString())
          .setDefault(
            DActivitiesConfig.signature_format ===
              DASignatureFormats.RobloxDisplayNameRobloxUsername
          ),
        new StringSelectMenuOptionBuilder()
          .setLabel("Discord Nickname and Roblox Username")
          .setDescription("[DiscordNickname] (@[RobloxUsername])")
          .setValue(DASignatureFormats.DiscordNicknameRobloxUsername.toString())
          .setDefault(
            DActivitiesConfig.signature_format === DASignatureFormats.DiscordNicknameRobloxUsername
          )
      )
  );

  const ArrestReportsImgHeaderEnabledAR =
    new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
      new StringSelectMenuBuilder()
        .setPlaceholder("Arrest Reports Image Header Enabled/Disabled")
        .setMinValues(1)
        .setMaxValues(1)
        .setCustomId(
          `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].ArrestReportsImgHeaderEnabled}:${Interaction.user.id}`
        )
        .setOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("Enabled")
            .setValue("true")
            .setDescription("Include the image header in posted arrest reports.")
            .setDefault(DActivitiesConfig.arrest_reports.show_header_img),
          new StringSelectMenuOptionBuilder()
            .setLabel("Disabled")
            .setValue("false")
            .setDescription("Do not include the image header in arrest reports.")
            .setDefault(!DActivitiesConfig.arrest_reports.show_header_img)
        )
    );

  const IncidentReportsAutoThreadsMgmtEnabledAR =
    new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
      new StringSelectMenuBuilder()
        .setPlaceholder("Incident Reports Auto Threads Management Enabled/Disabled")
        .setMinValues(1)
        .setMaxValues(1)
        .setCustomId(
          `${CTAIds[ConfigTopics.DutyActivitiesConfiguration].IncReportsAutoThreadsMgmtEnabled}:${Interaction.user.id}`
        )
        .setOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("Enabled")
            .setValue("true")
            .setDescription("Enable automatic thread management for incident reports.")
            .setDefault(DActivitiesConfig.incident_reports.auto_thread_management),
          new StringSelectMenuOptionBuilder()
            .setLabel("Disabled")
            .setValue("false")
            .setDescription("Disable automatic thread management for incident reports.")
            .setDefault(!DActivitiesConfig.incident_reports.auto_thread_management)
        )
    );

  return [
    ModuleEnabledAR,
    LocalCitsLogChannelBtn,
    LocalArrestsLogChannelBtn,
    IncidentLogChannelBtn,
    SetOutsideLogChannelBtns,
    SignatureFormatAR,
    ArrestReportsImgHeaderEnabledAR,
    IncidentReportsAutoThreadsMgmtEnabledAR,
  ] as const;
}

function GetAdditionalConfigComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  GuildConfig: NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>
) {
  const SetIntervalInDays = Math.round(
    GuildConfig.duty_activities.log_deletion_interval / MillisInDay
  );
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

  for (const Option of LogDelIntervalSMAR.components[0].options) {
    if (Option.data.value === `${SetIntervalInDays}d`) {
      Option.setDefault(true);
      break;
    }
  }

  return [LogDelIntervalSMAR, UTIFilteringEnabledAR] as const;
}

function GetReducedActivityModuleConfigComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
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

  const AlertRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(
        `${CTAIds[ConfigTopics.ReducedActivityConfiguration].AlertRoles}:${Interaction.user.id}`
      )
      .setPlaceholder("Alert Roles")
      .setMinValues(0)
      .setMaxValues(3)
  );

  if (ReducedActivityConfig.alert_roles.length) {
    AlertRolesAR.components[0].setDefaultRoles(ReducedActivityConfig.alert_roles);
  }

  const ActivePrefixAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Active Prefix")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.ReducedActivityConfiguration].ActivePrefix}:${Interaction.user.id}`
    );

  const RequestsDestinationButton = new ButtonBuilder()
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

  return [
    ModuleEnabledAR,
    RARoleAR,
    AlertRolesAR,
    ActivePrefixAccessoryBtn,
    RequestsDestinationButton,
    LogDestAccessoryButton,
  ] as const;
}

function GetCallsignsModuleConfigComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  CSModuleConfig: GuildSettings["callsigns_module"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].ModuleEnabled}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Allow the usage of this module.")
          .setDefault(CSModuleConfig.enabled),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Prevent the usage of this module and its commands.")
          .setDefault(!CSModuleConfig.enabled)
      )
  );

  const RequestsDestinationButton = new ButtonBuilder()
    .setLabel("Set Requests Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.CallsignsConfiguration].RequestsChannel}:${Interaction.user.id}`
    );

  const LogDestAccessoryButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.CallsignsConfiguration].LogChannel}:${Interaction.user.id}`
    );

  const ManagerRolesSelectMenuAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].ManagerRoles}:${Interaction.user.id}`
      )
      .setMinValues(0)
      .setMaxValues(6)
      .setPlaceholder("Select up to 6 manager roles...")
      .setDefaultRoles(CSModuleConfig.manager_roles)
  );

  const AlertOnNewRequestsAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Alerts Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].AlertOnRequest}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Send an alert when a new call sign request is made.")
          .setDefault(CSModuleConfig.alert_on_request),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Do not send alerts for new call sign requests.")
          .setDefault(!CSModuleConfig.alert_on_request)
      )
  );

  const AutoRenameOnAssignmentAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Auto-Rename Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].AutoRenameOnApproval}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Automatically rename on assignment, if applicable.")
          .setDefault(CSModuleConfig.update_nicknames),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Do not automatically rename.")
          .setDefault(!CSModuleConfig.update_nicknames)
      )
  );

  const UnitTypeRestrictionsModeAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Unit Type Restrictions Mode")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(
        `${CTAIds[ConfigTopics.CallsignsConfiguration].UnitTypeRoleRestrictionsMode}:${Interaction.user.id}`
      )
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Whitelist")
          .setValue("true")
          .setDescription("Only allow specific unit types, as per configured.")
          .setDefault(CSModuleConfig.unit_type_whitelist),
        new StringSelectMenuOptionBuilder()
          .setLabel("Blacklist")
          .setValue("false")
          .setDescription("Allow all unit types except specific ones.")
          .setDefault(!CSModuleConfig.unit_type_whitelist)
      )
  );

  const NicknameFormatAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Nickname Format")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(
      `${CTAIds[ConfigTopics.CallsignsConfiguration].NicknameFormat}:${Interaction.user.id}`
    );

  // TODO: Enable when modal prompts are completed.
  const SetUnitTypeRoleBasedRestrictionsAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Restrictions")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
    .setCustomId(
      `${CTAIds[ConfigTopics.CallsignsConfiguration].UnitTypeRoleRestrictions}:${Interaction.user.id}`
    );

  const SetBeatNumberRestrictionsAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Restrictions")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
    .setCustomId(
      `${CTAIds[ConfigTopics.CallsignsConfiguration].BeatNumberRestrictions}:${Interaction.user.id}`
    );

  return [
    ModuleEnabledAR,
    RequestsDestinationButton,
    LogDestAccessoryButton,
    ManagerRolesSelectMenuAR,
    AlertOnNewRequestsAR,
    AutoRenameOnAssignmentAR,
    UnitTypeRestrictionsModeAR,
    NicknameFormatAccessoryBtn,
    SetUnitTypeRoleBasedRestrictionsAccessoryBtn,
    SetBeatNumberRestrictionsAccessoryBtn,
  ] as const;
}

function GetShowConfigurationsPageComponents(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached"> | ButtonInteraction<"cached">,
  SafePIndex: number,
  TotalPages: number
) {
  const PaginationRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`config-show-prev:${Interaction.user.id}:${SafePIndex - 1}`)
      .setLabel("Previous Page")
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
      .setLabel("Next Page")
      .setEmoji(Emojis.NavNext)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(SafePIndex >= TotalPages - 1)
  );

  const BackButtonRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Return to Topic Selection")
      .setCustomId(`app-config-bck:${Interaction.user.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(Emojis.WhiteBack)
  );

  return [PaginationRow, BackButtonRow] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// -------------------
function GetBasicConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  GuildSettings: GuildSettings
) {
  const BasicConfigInteractComponents = GetBasicConfigComponents(SelectInteract, GuildSettings);
  const Page_1 = new ContainerBuilder()
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
    .addActionRowComponents(BasicConfigInteractComponents[2]);

  return [Page_1] as const;
}

function GetShiftModuleConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  ShiftModuleConfig: GuildSettings["shift_management"]
) {
  const ShiftModuleInteractComponents = GetShiftModuleConfigComponents(
    SelectInteract,
    ShiftModuleConfig
  );

  const ModuleTitleText = new TextDisplayBuilder().setContent(
    `### ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Title}`
  );

  const ConfiguredDefaultServerQuota = ShiftModuleConfig.default_quota
    ? FormatDuration(ShiftModuleConfig.default_quota)
    : "None";

  const CurrentlyConfiguredLogChannel = ShiftModuleConfig.log_channel
    ? `<#${ShiftModuleConfig.log_channel}>`
    : "None";

  const Page_1 = new ContainerBuilder()
    .setId(2)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      ModuleTitleText,
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
          2. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[1].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(ShiftModuleInteractComponents[1])
    .addActionRowComponents(ShiftModuleInteractComponents[2]);

  const Page_2 = new ContainerBuilder()
    .setId(2)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ShiftModuleInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              3. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLogChannel}
              ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[2].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
            4. **${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[3].Name}**
            **Currently Set:** ${ConfiguredDefaultServerQuota}
            ${ConfigTopicsExplanations[ConfigTopics.ShiftConfiguration].Settings[3].Description}
          `)
          )
        )
        .setButtonAccessory(ShiftModuleInteractComponents[4])
    );

  return [Page_1, Page_2] as const;
}

function GetDutyActivitiesModuleConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  DAModuleConfig: GuildSettings["duty_activities"]
) {
  const DutyActivitiesInteractComponents = GetDutyActModuleConfigComponents(
    SelectInteract,
    DAModuleConfig
  );

  const CurrConfiguredCitLogLocalChannel = DAModuleConfig.log_channels.citations.find(
    (LC) => !LC.includes(":")
  );

  const CurrConfiguredArrestLogLocalChannel = DAModuleConfig.log_channels.arrests.find(
    (LC) => !LC.includes(":")
  );

  const ContainerTitleComp = new TextDisplayBuilder().setContent(
    `### ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Title}`
  );

  const CurrentlyConfiguredLocalChannels = {
    ArrestLog: CurrConfiguredArrestLogLocalChannel
      ? `<#${CurrConfiguredArrestLogLocalChannel}>`
      : "None",
    CitationLog: CurrConfiguredCitLogLocalChannel
      ? `<#${CurrConfiguredCitLogLocalChannel}>`
      : "None",
    IncidentLog: DAModuleConfig.log_channels.incidents
      ? `<#${DAModuleConfig.log_channels.incidents}>`
      : "None",
  };

  const Page_1 = new ContainerBuilder()
    .setId(3)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      ContainerTitleComp,
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[0].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[0].Description}
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
              2. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[1].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.CitationLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[1].Description}
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
              3. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.ArrestLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[2].Description}
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
              4. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[3].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.IncidentLog}
              ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[3].Description}
            `)
          )
        )
    );

  const Page_2 = new ContainerBuilder()
    .setId(3)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ContainerTitleComp)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          5. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[4].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[4].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[4])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          6. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[5].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[5].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[5])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          7. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[6].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[6].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[6]);

  const Page_3 = new ContainerBuilder()
    .setId(3)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ContainerTitleComp)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          8. **${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[7].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.DutyActivitiesConfiguration].Settings[7].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[7]);

  return [Page_1, Page_2, Page_3] as const;
}

function GetLeaveModuleConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  LeaveModuleConfig: GuildSettings["leave_notices"]
) {
  const LeaveModuleInteractComponents = GetLeaveModuleConfigComponents(
    SelectInteract,
    LeaveModuleConfig
  );

  const ActivePrefixConfigured = LeaveModuleConfig.active_prefix?.length
    ? `\`${LeaveModuleConfig.active_prefix}\``
    : "None";

  const CurrentlyConfiguredChannels = {
    Log: LeaveModuleConfig.log_channel ? `<#${LeaveModuleConfig.log_channel}>` : "None",
    Requests: LeaveModuleConfig.requests_channel
      ? `<#${LeaveModuleConfig.requests_channel}>`
      : "None",
  };

  const ModuleTitleText = new TextDisplayBuilder().setContent(
    `### ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Title}`
  );

  const Page_1 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
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
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[2].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[2].Description}
        `)
      )
    )
    .addActionRowComponents(LeaveModuleInteractComponents[2]);

  const Page_2 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(LeaveModuleInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              4. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[3].Name}**
              **Currently Configured:** ${ActivePrefixConfigured}
              ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[3].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(LeaveModuleInteractComponents[4])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              5. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[4].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[4].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(LeaveModuleInteractComponents[5])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              6. **${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[5].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${ConfigTopicsExplanations[ConfigTopics.LeaveConfiguration].Settings[5].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2] as const;
}

function GetReducedActivityModuleConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  RAModuleConfig: GuildSettings["reduced_activity"]
) {
  const ReducedActivityInteractComponents = GetReducedActivityModuleConfigComponents(
    SelectInteract,
    RAModuleConfig
  );

  const ActivePrefixConfigured = RAModuleConfig.active_prefix?.length
    ? `\`${RAModuleConfig.active_prefix}\``
    : "None";

  const CurrentlyConfiguredChannels = {
    Log: RAModuleConfig.log_channel ? `<#${RAModuleConfig.log_channel}>` : "None",
    Requests: RAModuleConfig.requests_channel ? `<#${RAModuleConfig.requests_channel}>` : "None",
  };

  const ModuleTitleText = new TextDisplayBuilder().setContent(
    `### ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Title}`
  );

  const Page_1 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
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
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[2].Name}**
          ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[2].Description}
        `)
      )
    )
    .addActionRowComponents(ReducedActivityInteractComponents[2]);

  const Page_2 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ReducedActivityInteractComponents[3])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              4. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[3].Name}**
              **Currently Configured:** ${ActivePrefixConfigured}
              ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[3].Description}
            `)
          )
        )
    )

    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ReducedActivityInteractComponents[4])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              5. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[4].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[4].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(ReducedActivityInteractComponents[5])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              6. **${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[5].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${ConfigTopicsExplanations[ConfigTopics.ReducedActivityConfiguration].Settings[5].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2] as const;
}

function GetCallsignsModuleConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  CSModuleConfig: GuildSettings["callsigns_module"]
) {
  const SettingsInfo = ConfigTopicsExplanations[ConfigTopics.CallsignsConfiguration].Settings;
  const ModuleTitleText = new TextDisplayBuilder().setContent(
    `### ${ConfigTopicsExplanations[ConfigTopics.CallsignsConfiguration].Title}`
  );

  const CallsignsModuleInteractComponents = GetCallsignsModuleConfigComponents(
    SelectInteract,
    CSModuleConfig
  );

  const CurrentlyConfiguredTexts = {
    LogChannel: CSModuleConfig.log_channel ? `<#${CSModuleConfig.log_channel}>` : "None",
    RequestsChannel: CSModuleConfig.requests_channel
      ? `<#${CSModuleConfig.requests_channel}>`
      : "None",

    ManagerRoles: CSModuleConfig.manager_roles.length
      ? CSModuleConfig.manager_roles.map(roleMention).join(", ")
      : "None",

    UTRSet: CSModuleConfig.unit_type_restrictions.length || "None",
    BNRSet: CSModuleConfig.beat_restrictions.length || "None",
  };

  const Page_1 = new ContainerBuilder()
    .setId(1)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${SettingsInfo[0].Name}**
          ${SettingsInfo[0].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[1])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              2. **${SettingsInfo[1].Name}**
              **Currently Configured:** ${CurrentlyConfiguredTexts.RequestsChannel}
              ${SettingsInfo[1].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[2])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              3. **${SettingsInfo[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredTexts.LogChannel}
              ${SettingsInfo[2].Description}
            `)
          )
        )
    );

  const Page_2 = new ContainerBuilder()
    .setId(2)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          4. **${SettingsInfo[3].Name}**
          ${SettingsInfo[3].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[3])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          5. **${SettingsInfo[4].Name}**
          ${SettingsInfo[4].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[4])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          6. **${SettingsInfo[5].Name}**
          ${SettingsInfo[5].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[5]);

  const Page_3 = new ContainerBuilder()
    .setId(3)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          7. **${SettingsInfo[6].Name}**
          ${SettingsInfo[6].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[6])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[7])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              8. **${SettingsInfo[7].Name}**
              **Currently Configured:** \`${CSModuleConfig.nickname_format}\`
              ${SettingsInfo[7].Description}
            `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[8])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              9. **${SettingsInfo[8].Name}**
              **Restrictions Set:** ${CurrentlyConfiguredTexts.UTRSet}
              ${SettingsInfo[8].Description}
            `)
          )
        )
    );

  const Page_4 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[9])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              10. **${SettingsInfo[9].Name}**
              **Restrictions Set:** ${CurrentlyConfiguredTexts.BNRSet}
              ${SettingsInfo[9].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2, Page_3, Page_4] as const;
}

function GetAdditionalConfigContainers(
  SelectInteract: ModulePromptUpdateSupportedInteraction<"cached">,
  GuildSettings: GuildSettings
) {
  const AdditionalConfigInteractComponents = GetAdditionalConfigComponents(
    SelectInteract,
    GuildSettings
  );

  const Page_1 = new ContainerBuilder()
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
    .addActionRowComponents(AdditionalConfigInteractComponents[1]);

  return [Page_1] as const;
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

function GetCSBeatOrUnitTypeRestrictionsPromptContainer(
  RecInteract: ButtonInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
): BaseExtraContainer {
  const TypeScopeLabel = IsUnitType ? "Unit Type" : "Beat Number";
  const ScopeRestrictionsCount = IsUnitType
    ? MStateObj.ModuleConfig.unit_type_restrictions.length
    : MStateObj.ModuleConfig.beat_restrictions.length;

  const ActionSelectMenu = GetCSBeatNumRestrictionsPromptComps(RecInteract, IsUnitType);
  const PromptContainer = new BaseExtraContainer()
    .setColor(Colors.DarkGrey)
    .setTitle(`Call Signs Module: ${TypeScopeLabel} Restrictions`)
    .setDescription(
      Dedent(`
        Use the dropdown menu below to manage ${TypeScopeLabel.toLowerCase()} restrictions for the call signs module. \
        You can add new restrictions, remove existing ones, view all current restrictions, or confirm changes and return to the module config.

        **Currently Configured:** \`${ScopeRestrictionsCount}\` restriction${ScopeRestrictionsCount === 1 ? "" : "s"}.
      `)
    )
    .setFooter(
      "This prompt will timeout in 10 minutes. Remember to save your changes in the main configuration menu afterwards."
    );

  return PromptContainer.attachPromptActionRows(ActionSelectMenu);
}

function GetCSBeatOrUnitTypeRestrictionsListContainers(
  CSModuleState: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
): BaseExtraContainer[] {
  const Restrictions = IsUnitType
    ? CSModuleState.ModuleConfig.unit_type_restrictions
    : CSModuleState.ModuleConfig.beat_restrictions;

  type UnitTypeRestriction = (typeof CSModuleState.ModuleConfig.unit_type_restrictions)[number];
  type BeatNumberRestriction = (typeof CSModuleState.ModuleConfig.beat_restrictions)[number];
  type RestrictionObj = (typeof Restrictions)[number];

  const Pages: BaseExtraContainer[] = [];
  const RestrictionsChunks = Chunks(Restrictions as RestrictionObj[], 3);

  for (const RulesSet of RestrictionsChunks) {
    const RuleDisplayTexts: string[] = [];
    const ScopeRestrictionsCount = IsUnitType
      ? CSModuleState.ModuleConfig.unit_type_restrictions.length
      : CSModuleState.ModuleConfig.beat_restrictions.length;

    const PageContainer = new BaseExtraContainer().setColor(Colors.DarkGrey).setTitle(
      Dedent(`
        Call Signs Module: ${IsUnitType ? "Unit Type" : "Beat Number"} Restrictions
        Showing ${RulesSet.length} of ${ScopeRestrictionsCount} total restriction${ScopeRestrictionsCount === 1 ? "" : "s"}.  
      `)
    );

    for (const Rule of RulesSet) {
      const OriginalRule = Restrictions.find((ORule) => ORule._id === Rule._id);
      let RuleStatus: string;

      if (!OriginalRule) {
        RuleStatus = "New";
      } else if (isDeepEqual(Rule, OriginalRule)) {
        RuleStatus = "Saved";
      } else {
        RuleStatus = "Updated";
      }

      const PermittedRolesText = Rule.permitted_roles.length
        ? ListFormatter.format(Rule.permitted_roles.map(roleMention))
        : "*None - Cannot be requested*";

      RuleDisplayTexts.push(
        ConcatenateLines(
          `**ID:** \`${Rule._id}\``,
          `> **Status:** ${RuleStatus}`,
          IsUnitType
            ? `> **Unit Type:** \`${(Rule as UnitTypeRestriction).unit_type}\``
            : `> **Beat Range:** \`${(Rule as BeatNumberRestriction).range.join(" - ")}\``,
          `> **Permitted Roles:** ${PermittedRolesText}`
        )
      );
    }

    RuleDisplayTexts.forEach((RDT, Index) => {
      PageContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(RDT));
      if (Index !== RuleDisplayTexts.length - 1) {
        PageContainer.addSeparatorComponents(new SeparatorBuilder().setDivider());
      }
    });

    Pages.push(PageContainer);
  }

  return Pages;
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
    **Server Default Quota:** ${GuildSettings.shift_management.default_quota === 0 ? "None" : FormatDuration(GuildSettings.shift_management.default_quota)}
    **Role Assignment:**
    - **On-Duty Role${SMOnDutyRoles.length > 1 ? "s" : ""}:** ${SMOnDutyRoles.length ? "\n" + ListFormatter.format(SMOnDutyRoles) : "None"}
    - **On-Break Role${SMOnBreakRoles.length > 1 ? "s" : ""}:** ${SMOnBreakRoles.length ? "\n" + ListFormatter.format(SMOnBreakRoles) : "None"}
  `);
}

function GetCSLeaveNoticesContent(GuildSettings: GuildSettings): string {
  const MSettings = GuildSettings.leave_notices;
  return Dedent(`
    >>> **Module Enabled:** ${MSettings.enabled ? "Yes" : "No"}
    **On-Leave Role:** ${MSettings.leave_role ? roleMention(MSettings.leave_role) : "None"}
    **Active Prefix:** ${MSettings.active_prefix?.length ? `\`${MSettings.active_prefix}\`` : "None"}
    **Alert Roles:** ${MSettings.alert_roles.length ? ListFormatter.format(MSettings.alert_roles.map(roleMention)) : "None"}
    **Requests Channel:** ${MSettings.requests_channel ? channelMention(MSettings.requests_channel) : "None"}
    **Leave Log Channel:** ${MSettings.log_channel ? channelMention(MSettings.log_channel) : "None"}
  `);
}

function GetCSReducedActivityContent(GuildSettings: GuildSettings): string {
  const MSettings = GuildSettings.reduced_activity;
  return Dedent(`
    >>> **Module Enabled:** ${MSettings.enabled ? "Yes" : "No"}
    **RA Active Role:** ${MSettings.ra_role ? roleMention(MSettings.ra_role) : "None"}
    **Active Prefix:** ${MSettings.active_prefix?.length ? `\`${MSettings.active_prefix}\`` : "None"}
    **Alert Roles:** ${MSettings.alert_roles.length ? ListFormatter.format(MSettings.alert_roles.map(roleMention)) : "None"}
    **Requests Channel:** ${MSettings.requests_channel ? channelMention(MSettings.requests_channel) : "None"}
    **Log Channel:** ${MSettings.log_channel ? channelMention(MSettings.log_channel) : "None"}
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
    **Signature Format:** \`${SignatureFormatResolved[GuildSettings.duty_activities.signature_format]}\`
    **Incident Log Channel:** ${IncidentLogChannel}
    **Citation Log Channel${CitationLogChannels.length > 1 ? "s" : ""}:** 
    ${CitationLogChannels.length ? ListFormatter.format(CitationLogChannels) : "*None*"}
    **Arrest Log Channel${ArrestLogChannels.length > 1 ? "s" : ""}:** 
    ${ArrestLogChannels.length ? ListFormatter.format(ArrestLogChannels) : "*None*"}
  `);
}

function GetCSCallsignsModuleContent(GuildSettings: GuildSettings): string {
  const MSettings = GuildSettings.callsigns_module;
  const ManagerRolesMentioned = ListFormatter.format(MSettings.manager_roles.map(roleMention));

  const LogsDest = MSettings.log_channel ? channelMention(MSettings.log_channel) : "None";
  const RequestsDest = MSettings.requests_channel
    ? channelMention(MSettings.requests_channel)
    : "None";

  return Dedent(`
    >>> **Module Enabled:** ${MSettings.enabled ? "Yes" : "No"}
    **New Requests Notifications:** ${MSettings.alert_on_request ? "Enabled" : "Disabled"}
    **Assignment Auto-Renaming:** ${MSettings.update_nicknames ? "Enabled" : "Disabled"}

    **Requests Destination:** ${RequestsDest}
    **Logs Destination:** ${LogsDest}
    **Manager Role(s):** ${ManagerRolesMentioned.length ? ManagerRolesMentioned : "None"}
    **Nickname Format:** \`${MSettings.nickname_format}\`
    **Unit Type Restrictions:** ${MSettings.unit_type_restrictions.length} Set
    **Beat Number Restrictions:** ${MSettings.beat_restrictions.length} Set
  `);
}

function GetCSAdditionalConfigContent(GuildSettings: GuildSettings): string {
  return Dedent(`
    >>> **Log Deletion Interval:** ${GetHumanReadableLogDeletionInterval(GuildSettings.duty_activities.log_deletion_interval)}
    **User Text Input Filtering:** ${GuildSettings.utif_enabled ? "Enabled" : "Disabled"}
  `);
}

// ---------------------------------------------------------------------------------------
// Setting Save Handlers:
// ----------------------
async function HandleConfigSave<T extends SettingsResolvable>(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<T>
): Promise<boolean> {
  if (MState.IsModified() === false) {
    return new InfoContainer()
      .useInfoTemplate(
        "ConfigTopicNoChangesMade",
        ConfigTopicsExplanations[MState.ConfigTopic].Title.toLowerCase()
      )
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  if (!Interaction.deferred) {
    await Interaction.deferReply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    }).catch(() => null);
  }

  let SuccessMsgDescription: string | null = null;
  const ConfigTopicTitle: string = ConfigTopicsExplanations[MState.ConfigTopic].Title;

  try {
    switch (MState.ConfigTopic) {
      case ConfigTopics.BasicConfiguration: {
        SuccessMsgDescription = await HandleBasicConfigDBSave(
          Interaction,
          MState as ModuleState<GuildSettings>
        );
        break;
      }
      case ConfigTopics.ShiftConfiguration: {
        SuccessMsgDescription = await HandleShiftModuleDBSave(
          Interaction,
          MState as ModuleState<GuildSettings["shift_management"]>
        );
        break;
      }
      case ConfigTopics.DutyActivitiesConfiguration: {
        SuccessMsgDescription = await HandleDutyActivitiesModuleDBSave(
          Interaction,
          MState as ModuleState<GuildSettings["duty_activities"]>
        );
        break;
      }
      case ConfigTopics.LeaveConfiguration: {
        SuccessMsgDescription = await HandleLeaveModuleDBSave(
          Interaction,
          MState as ModuleState<GuildSettings["leave_notices"]>
        );
        break;
      }
      case ConfigTopics.ReducedActivityConfiguration: {
        SuccessMsgDescription = await HandleReducedActivityModuleDBSave(
          Interaction,
          MState as ModuleState<GuildSettings["reduced_activity"]>
        );
        break;
      }
      case ConfigTopics.AdditionalConfiguration: {
        SuccessMsgDescription = await HandleAdditionalConfigDBSave(
          Interaction,
          MState as ModuleState<GuildSettings>
        );
        break;
      }
      case ConfigTopics.CallsignsConfiguration: {
        SuccessMsgDescription = await HandleCallsignsModuleDBSave(
          Interaction,
          MState as ModuleState<GuildSettings["callsigns_module"]>
        );
        break;
      }
      default: {
        return new ErrorContainer()
          .useErrTemplate("UnknownConfigTopic")
          .replyToInteract(Interaction, true)
          .then(() => false);
      }
    }
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    AppLogger.error({
      message: "An error occurred while saving settings for %s;",
      splat: [ConfigTopicTitle.toLowerCase()],
      error_id: ErrorId,
      label: FileLabel,
      stack: Err?.stack,
      error: { ...(Err ?? {}) },
    });

    return new ErrorContainer()
      .useErrTemplate("ConfigSaveFailedNCM", ConfigTopicTitle.toLowerCase())
      .setErrorId(ErrorId)
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  if (SuccessMsgDescription) {
    return new SuccessContainer()
      .setDescription(SuccessMsgDescription)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else {
    return new ErrorContainer()
      .useErrTemplate("AppError")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }
}

async function HandleBasicConfigDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<string | null> {
  const AppMember = await Interaction.guild.members.fetchMe().catch(() => null);

  if (
    MState.ModuleConfig.utif_enabled === true &&
    AppMember?.permissions.has(PermissionFlagsBits.ManageGuild) === false
  ) {
    await new WarnContainer()
      .useErrTemplate("InsufficientUTIFManageGuildPerm")
      .replyToInteract(Interaction, true, true, "reply");
  }

  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.role_perms.staff": MState.ModuleConfig.role_perms.staff,
        "settings.role_perms.management": MState.ModuleConfig.role_perms.management,
        "settings.require_authorization": MState.ModuleConfig.require_authorization,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        settings: 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings);

  if (UpdatedSettings) {
    MState.OriginalConfig = clone(UpdatedSettings);
    MState.ModuleConfig = clone(UpdatedSettings);

    const SetStaffRoles = UpdatedSettings.role_perms.staff.map((R) => roleMention(R));
    const SetMgmtRoles = UpdatedSettings.role_perms.management.map((R) => roleMention(R));

    return Dedent(`
      Successfully set/updated the app's basic configuration.
      
      **Current Configuration:**
      - **Roblox Auth Required:** ${UpdatedSettings.require_authorization ? "Yes" : "No"}
      - **Staff Role(s):**
        > ${SetStaffRoles.length ? ListFormatter.format(SetStaffRoles) : "*None*"}
      - **Management Role(s):**
        > ${SetMgmtRoles.length ? ListFormatter.format(SetMgmtRoles) : "*None*"}
    `);
  } else {
    return null;
  }
}

async function HandleShiftModuleDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings["shift_management"]>
): Promise<string | null> {
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.shift_management.enabled": MState.ModuleConfig.enabled,
        "settings.shift_management.log_channel": MState.ModuleConfig.log_channel,
        "settings.shift_management.default_quota": MState.ModuleConfig.default_quota,
        "settings.shift_management.role_assignment.on_duty":
          MState.ModuleConfig.role_assignment.on_duty,
        "settings.shift_management.role_assignment.on_break":
          MState.ModuleConfig.role_assignment.on_break,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        "settings.shift_management": 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings.shift_management);

  if (UpdatedSettings) {
    MState.OriginalConfig = { ...UpdatedSettings };
    const SetLogChannel = UpdatedSettings.log_channel
      ? channelMention(UpdatedSettings.log_channel)
      : "`None`";

    const SetOnDutyRoles = UpdatedSettings.role_assignment.on_duty.map((R) => roleMention(R));
    const SetOnBreakRoles = UpdatedSettings.role_assignment.on_break.map((R) => roleMention(R));

    return Dedent(`
      Successfully set/updated the app's shifts configuration.
      
      **Current Configuration:**
      - **Module Enabled:** ${UpdatedSettings.enabled ? "Yes" : "No"}
      - **Shift Log Channel:** ${SetLogChannel}
      - **Server Default Shift Quota:** ${UpdatedSettings.default_quota ? FormatDuration(UpdatedSettings.default_quota) : "*None*"}
      - **On-Duty Role(s):**
        > ${SetOnDutyRoles.length ? ListFormatter.format(SetOnDutyRoles) : "*None*"}
      - **On-Break Role(s):**
        > ${SetOnBreakRoles.length ? ListFormatter.format(SetOnBreakRoles) : "*None*"}
    `);
  } else {
    return null;
  }
}

async function HandleLeaveModuleDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings["leave_notices"]>
): Promise<string | null> {
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.leave_notices.enabled": MState.ModuleConfig.enabled,
        "settings.leave_notices.leave_role": MState.ModuleConfig.leave_role,
        "settings.leave_notices.requests_channel": MState.ModuleConfig.requests_channel,
        "settings.leave_notices.log_channel": MState.ModuleConfig.log_channel,
        "settings.leave_notices.active_prefix": MState.ModuleConfig.active_prefix,
        "settings.leave_notices.alert_roles": MState.ModuleConfig.alert_roles,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        "settings.leave_notices": 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings.leave_notices);

  if (UpdatedSettings) {
    MState.OriginalConfig = { ...UpdatedSettings };
    const SetLeaveRole = UpdatedSettings.leave_role
      ? roleMention(UpdatedSettings.leave_role)
      : "`None`";

    const SetRequestsChannel = UpdatedSettings.requests_channel
      ? channelMention(UpdatedSettings.requests_channel)
      : "`None`";

    const SetLogChannel = UpdatedSettings.log_channel
      ? channelMention(UpdatedSettings.log_channel)
      : "`None`";

    const SetAlertRoles = UpdatedSettings.alert_roles.length
      ? ListFormatter.format(UpdatedSettings.alert_roles.map(roleMention))
      : "`None`";

    return Dedent(`
      Successfully set/updated the app's leave notices module configuration.
        
      **Current Configuration:**
      - **Module Enabled:** ${UpdatedSettings.enabled ? "Yes" : "No"}
      - **On-Leave Role:** ${SetLeaveRole}
      - **Alert Roles:** ${SetAlertRoles}
      - **Active Prefix:** \`${UpdatedSettings.active_prefix || "None"}\`
      - **Requests Channel:** ${SetRequestsChannel}
      - **Leave Logs Channel:** ${SetLogChannel}
    `);
  } else {
    return null;
  }
}

async function HandleReducedActivityModuleDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings["reduced_activity"]>
): Promise<string | null> {
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.reduced_activity.enabled": MState.ModuleConfig.enabled,
        "settings.reduced_activity.ra_role": MState.ModuleConfig.ra_role,
        "settings.reduced_activity.requests_channel": MState.ModuleConfig.requests_channel,
        "settings.reduced_activity.log_channel": MState.ModuleConfig.log_channel,
        "settings.reduced_activity.active_prefix": MState.ModuleConfig.active_prefix,
        "settings.reduced_activity.alert_roles": MState.ModuleConfig.alert_roles,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        "settings.reduced_activity": 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings.reduced_activity);

  if (UpdatedSettings) {
    MState.OriginalConfig = { ...UpdatedSettings };
    const SetRaRole = UpdatedSettings.ra_role ? roleMention(UpdatedSettings.ra_role) : "`None`";

    const SetRequestsChannel = UpdatedSettings.requests_channel
      ? channelMention(UpdatedSettings.requests_channel)
      : "`None`";

    const SetLogChannel = UpdatedSettings.log_channel
      ? channelMention(UpdatedSettings.log_channel)
      : "`None`";

    const SetAlertRoles = UpdatedSettings.alert_roles.length
      ? ListFormatter.format(UpdatedSettings.alert_roles.map(roleMention))
      : "`None`";

    return Dedent(`
      Successfully set/updated the app's reduced activity module configuration.
      
      **Current Configuration:**
      - **Module Enabled:** ${UpdatedSettings.enabled ? "Yes" : "No"}
      - **Reduced Activity Role:** ${SetRaRole}
      - **Alert Roles:** ${SetAlertRoles}
      - **Active Prefix:** \`${UpdatedSettings.active_prefix || "None"}\`
      - **Requests Channel:** ${SetRequestsChannel}
      - **Log Channel:** ${SetLogChannel}
    `);
  } else {
    return null;
  }
}

async function HandleDutyActivitiesModuleDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings["duty_activities"]>
): Promise<string | null> {
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.duty_activities.enabled": MState.ModuleConfig.enabled,
        "settings.duty_activities.signature_format": MState.ModuleConfig.signature_format,
        "settings.duty_activities.log_channels.incidents":
          MState.ModuleConfig.log_channels.incidents,
        "settings.duty_activities.log_channels.citations":
          MState.ModuleConfig.log_channels.citations,
        "settings.duty_activities.log_channels.arrests": MState.ModuleConfig.log_channels.arrests,
        "settings.duty_activities.incident_reports.auto_thread_management":
          MState.ModuleConfig.incident_reports.auto_thread_management,
        "settings.duty_activities.arrest_reports.show_header_img":
          MState.ModuleConfig.arrest_reports.show_header_img,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        "settings.duty_activities": 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings.duty_activities);

  if (UpdatedSettings) {
    MState.OriginalConfig = clone(UpdatedSettings);
    MState.ModuleConfig = clone(UpdatedSettings);

    const ARSetChannels = UpdatedSettings.log_channels.arrests.map((CI) =>
      channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
    );

    const CLSetChannels = UpdatedSettings.log_channels.citations.map((CI) =>
      channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
    );

    const ILSetChannel = UpdatedSettings.log_channels.incidents
      ? channelMention(UpdatedSettings.log_channels.incidents)
      : "*None*";

    return Dedent(`
      Successfully set/updated the app's duty activities module configuration.
      
      **Current Configuration:**
      **General:**
      > - **Module Enabled:** ${UpdatedSettings.enabled ? "Yes" : "No"}
      > - **Signature Format:** \`${SignatureFormatResolved[UpdatedSettings.signature_format]}\`
      > - **Inc. Reports Auto Thread Management:** ${UpdatedSettings.incident_reports.auto_thread_management ? "`Enabled`" : "`Disabled`"}
      > - **Arrest Reports P&S Header Image:** ${UpdatedSettings.arrest_reports.show_header_img ? "`Enabled`" : "`Disabled`"}

      **Log Destinations:**
      > - **Incident Log:** ${ILSetChannel}
      > - **Citation Log:** ${CLSetChannels.length ? ListFormatter.format(CLSetChannels) : "*None*"}
      > - **Arrest Log:** ${ARSetChannels.length ? ListFormatter.format(ARSetChannels) : "*None*"}
    `);
  } else {
    return null;
  }
}

async function HandleCallsignsModuleDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings["callsigns_module"]>
) {
  const MPath = "settings.callsigns_module";
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        [`${MPath}.enabled`]: MState.ModuleConfig.enabled,
        [`${MPath}.log_channel`]: MState.ModuleConfig.log_channel,
        [`${MPath}.manager_roles`]: MState.ModuleConfig.manager_roles,
        [`${MPath}.requests_channel`]: MState.ModuleConfig.requests_channel,
        [`${MPath}.nickname_format`]: MState.ModuleConfig.nickname_format,
        [`${MPath}.update_nicknames`]: MState.ModuleConfig.update_nicknames,
        [`${MPath}.alert_on_request`]: MState.ModuleConfig.alert_on_request,
        [`${MPath}.unit_type_whitelist`]: MState.ModuleConfig.unit_type_whitelist,
        [`${MPath}.beat_restrictions`]: MState.ModuleConfig.beat_restrictions,
        [`${MPath}.unit_type_restrictions`]: MState.ModuleConfig.unit_type_restrictions,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        "settings.callsigns_module": 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings.callsigns_module);

  if (UpdatedSettings) {
    MState.OriginalConfig = clone(UpdatedSettings);
    MState.ModuleConfig = clone(UpdatedSettings);

    const SetRequestsChannel = UpdatedSettings.requests_channel
      ? channelMention(UpdatedSettings.requests_channel)
      : "`None`";

    const SetLogChannel = UpdatedSettings.log_channel
      ? channelMention(UpdatedSettings.log_channel)
      : "`None`";

    return Dedent(`
      Successfully set/updated the app's call signs module configuration.

      **Current Configuration:**
      - **Module Enabled:** ${UpdatedSettings.enabled ? "Yes" : "No"}
      - **Requests Channel:** ${SetRequestsChannel}
      - **Log Channel:** ${SetLogChannel}
      - **Manager Roles:** ${UpdatedSettings.manager_roles.length ? ListFormatter.format(UpdatedSettings.manager_roles.map(roleMention)) : "`None`"}
      - **Alert on New Requests:** ${UpdatedSettings.alert_on_request ? "Enabled" : "Disabled"}

      - **Nickname Format:** \`${UpdatedSettings.nickname_format}\`
      - **Auto-Rename on Approval:** ${UpdatedSettings.update_nicknames ? "Enabled" : "Disabled"}
      - **Unit Type Rules Mode:** ${UpdatedSettings.unit_type_whitelist ? "Whitelist" : "Blacklist"}
      - **Unit Type Restrictions:** ${UpdatedSettings.unit_type_restrictions?.length ? `${UpdatedSettings.unit_type_restrictions.length} restriction(s) set` : "`None`"}
      - **Beat Number Restrictions:** ${UpdatedSettings.beat_restrictions?.length ? `${UpdatedSettings.beat_restrictions.length} restriction(s) set` : "`None`"}
    `);
  } else {
    return null;
  }
}

async function HandleAdditionalConfigDBSave(
  Interaction: ModulePromptUpdateSupportedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<string | null> {
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.utif_enabled": MState.ModuleConfig.utif_enabled,
        "settings.duty_activities.log_deletion_interval":
          MState.ModuleConfig.duty_activities.log_deletion_interval,
      },
    },
    {
      new: true,
      lean: true,
      strict: true,
      runValidators: true,
      projection: {
        settings: 1,
      },
    }
  ).then((GuildDoc) => GuildDoc?.settings);

  if (UpdatedSettings) {
    MState.OriginalConfig = clone(UpdatedSettings);
    MState.ModuleConfig = clone(UpdatedSettings);

    const LDIFormatted = GetHumanReadableLogDeletionInterval(
      UpdatedSettings.duty_activities.log_deletion_interval
    );

    return Dedent(`
      Successfully set/updated the app's additional configuration.
      
      **Current Configuration:**
      - **Log Deletion Interval:** ${LDIFormatted}
      - **User Text Input Filtering:** ${UpdatedSettings.utif_enabled ? "Enabled" : "Disabled"}
    `);
  } else {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// Module-Specific Interaction Handlers:
// -------------------------------------
/**
 * Handles module-specific interactions and updates the configuration state if necessary.
 * @param CollectedInteract - The component interaction received from the user.
 * @param MState - The current module state containing the configuration topic and settings.
 * @returns A boolean indicating whether the interaction was handled successfully and requires prompt update.
 */
async function HandleModuleSpecificInteractions<SR extends SettingsResolvable>(
  CollectedInteract: CollectedInteraction<"cached">,
  MState: ModuleState<SR>
): Promise<boolean> {
  const ConfigTopic = MState.ConfigTopic;
  switch (ConfigTopic) {
    case ConfigTopics.BasicConfiguration: {
      return HandleBasicConfigSpecificInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings>
      );
    }
    case ConfigTopics.AdditionalConfiguration: {
      return HandleAdditionalConfigSpecificInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings>
      );
    }
    case ConfigTopics.ShiftConfiguration: {
      return HandleShiftConfigSpecificInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["shift_management"]>
      );
    }
    case ConfigTopics.LeaveConfiguration: {
      return HandleLeaveConfigSpecificInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["leave_notices"]>
      );
    }
    case ConfigTopics.ReducedActivityConfiguration: {
      return HandleReducedActivityConfigPageInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["reduced_activity"]>
      );
    }
    case ConfigTopics.DutyActivitiesConfiguration: {
      return HandleDutyActivitiesConfigPageInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["duty_activities"]>
      );
    }
    case ConfigTopics.CallsignsConfiguration: {
      return HandleCallsignsModuleConfigPageInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["callsigns_module"]>
      );
    }
    default: {
      CollectedInteract.deferUpdate().catch(() => null);
      return false;
    }
  }
}

async function HandleBasicConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<boolean> {
  if (RecInteract.isRoleSelectMenu()) {
    if (RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].StaffRoles)) {
      MState.ModuleConfig.role_perms.staff = RecInteract.values.filter(
        (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
      );
    } else if (RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].MgmtRoles)) {
      MState.ModuleConfig.role_perms.management = RecInteract.values.filter(
        (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
      );
    }

    return true;
  } else if (
    RecInteract.isStringSelectMenu() &&
    RecInteract.customId.startsWith(CTAIds[ConfigTopics.BasicConfiguration].RobloxAuthRequired)
  ) {
    MState.ModuleConfig.require_authorization = RecInteract.values[0] === "true";
    RecInteract.deferUpdate().catch(() => null);
    return false;
  }

  return false;
}

async function HandleAdditionalConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<boolean> {
  const CustomId = RecInteract.customId;

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(CTAIds[ConfigTopics.AdditionalConfiguration].DActivitiesDeletionInterval)
  ) {
    MState.ModuleConfig.duty_activities.log_deletion_interval =
      (parseInt(RecInteract.values[0]) || 0) * MillisInDay;
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(CTAIds[ConfigTopics.AdditionalConfiguration].UserTextInputFilteringEnabled)
  ) {
    MState.ModuleConfig.utif_enabled = RecInteract.values[0].toLowerCase() === "true";
  }

  if (!RecInteract.deferred && !RecInteract.replied) {
    RecInteract.deferUpdate().catch(() => null);
  }

  return false;
}

async function HandleShiftConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["shift_management"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;

  if (
    RecInteract.isButton() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].LogChannel)
  ) {
    const SelectedChannel = await PromptChannelOrThreadSelection(
      RecInteract,
      CTAIds[ConfigTopics.ShiftConfiguration].LogChannel,
      "Shift Log",
      MState.ModuleConfig.log_channel
    );

    if (SelectedChannel !== undefined) {
      MState.ModuleConfig.log_channel = SelectedChannel;
      return true;
    }
  }

  if (
    RecInteract.isButton() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].ServerDefaultShiftQuota)
  ) {
    const ResolvedQuotaMs = await HandleDefaultShiftQuotaBtnInteract(
      RecInteract,
      MState.ModuleConfig.default_quota
    );

    if (ResolvedQuotaMs !== MState.ModuleConfig.default_quota) {
      MState.ModuleConfig.default_quota = ResolvedQuotaMs;
      return true;
    }
  }

  if (
    RecInteract.isStringSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].ModuleEnabled)
  ) {
    MState.ModuleConfig.enabled = RecInteract.values[0].toLowerCase() === "true";
  } else if (RecInteract.isRoleSelectMenu()) {
    if (ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].OnDutyRoles)) {
      MState.ModuleConfig.role_assignment.on_duty = await FilterUnsafeRoles(
        RecInteract.guild,
        RecInteract.values
      );
    } else if (ActionId.startsWith(CTAIds[ConfigTopics.ShiftConfiguration].OnBreakRoles)) {
      MState.ModuleConfig.role_assignment.on_break = await FilterUnsafeRoles(
        RecInteract.guild,
        RecInteract.values
      );
    }

    return true;
  }

  return false;
}

async function HandleLeaveConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["leave_notices"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;
  if (RecInteract.isButton()) {
    if (ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.LeaveConfiguration].LogChannel,
        "Leave Event Log",
        MState.ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].RequestsChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.LeaveConfiguration].RequestsChannel,
        "Leave Requests",
        MState.ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].ActivePrefix)) {
      return HandleUANActivePrefixBtnInteract(RecInteract, MState);
    }
  }

  if (
    RecInteract.isStringSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].ModuleEnabled)
  ) {
    MState.ModuleConfig.enabled = RecInteract.values[0] === "true";
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].OnLeaveRole)
  ) {
    const LeaveRole = await FilterUnsafeRoles(RecInteract.guild, [RecInteract.values[0]]);
    MState.ModuleConfig.leave_role = LeaveRole[0] || null;
    if (RecInteract.values[0]?.length) return true;
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.LeaveConfiguration].AlertRoles)
  ) {
    MState.ModuleConfig.alert_roles = RecInteract.values;
  }

  return false;
}

async function HandleReducedActivityConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["reduced_activity"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;
  if (RecInteract.isButton()) {
    if (ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.ReducedActivityConfiguration].LogChannel,
        "Reduced Activity Event Logs",
        MState.ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    } else if (
      ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].RequestsChannel)
    ) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.ReducedActivityConfiguration].RequestsChannel,
        "Reduced Activity Requests",
        MState.ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    } else if (
      ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].ActivePrefix)
    ) {
      return HandleUANActivePrefixBtnInteract(RecInteract, MState);
    }
  }

  if (
    RecInteract.isStringSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].ModuleEnabled)
  ) {
    MState.ModuleConfig.enabled = RecInteract.values[0].toLowerCase() === "true";
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].RARole)
  ) {
    const RARole = await FilterUnsafeRoles(RecInteract.guild, [RecInteract.values[0]]);
    MState.ModuleConfig.ra_role = RARole[0] || null;
    if (RecInteract.values[0]?.length) return true;
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(CTAIds[ConfigTopics.ReducedActivityConfiguration].AlertRoles)
  ) {
    MState.ModuleConfig.alert_roles = RecInteract.values;
  }

  return false;
}

async function HandleDutyActivitiesConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["duty_activities"]>
): Promise<boolean> {
  const CustomId = RecInteract.customId;
  const HandleOutsideLogChannelSet = async (
    ButtonInteract: ButtonInteraction<"cached">,
    CurrentChannels: string[]
  ): Promise<string[]> => {
    const ChannelsCopy = CurrentChannels.slice();
    const SetChannel = await HandleOutsideLogChannelBtnInteracts(ButtonInteract, ChannelsCopy);
    if (SetChannel) {
      const ExistingChannelIndex = CurrentChannels.findIndex((C) => C.includes(":"));
      if (ExistingChannelIndex === -1) {
        ChannelsCopy.push(SetChannel);
      } else {
        ChannelsCopy[ExistingChannelIndex] = SetChannel;
      }
    } else {
      return ChannelsCopy.filter((C) => !C.includes(":"));
    }
    return ChannelsCopy;
  };

  if (RecInteract.isButton()) {
    if (
      CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].OutsideArrestLogChannel)
    ) {
      MState.ModuleConfig.log_channels.arrests = await HandleOutsideLogChannelSet(
        RecInteract,
        MState.ModuleConfig.log_channels.arrests
      );
    }

    if (
      CustomId.startsWith(
        CTAIds[ConfigTopics.DutyActivitiesConfiguration].OutsideCitationLogChannel
      )
    ) {
      MState.ModuleConfig.log_channels.citations = await HandleOutsideLogChannelSet(
        RecInteract,
        MState.ModuleConfig.log_channels.citations
      );
    }

    if (
      CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].ArrestLogLocalChannel)
    ) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.DutyActivitiesConfiguration].ArrestLogLocalChannel,
        "Arrest Reports",
        MState.ModuleConfig.log_channels.arrests.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return false;
      if (MState.ModuleConfig.log_channels.arrests.length) {
        const ExistingChannelIndex = MState.ModuleConfig.log_channels.arrests.findIndex(
          (C) => !C.includes(":")
        );
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          MState.ModuleConfig.log_channels.arrests.push(SelectedChannel);
        } else if (SelectedChannel) {
          MState.ModuleConfig.log_channels.arrests[ExistingChannelIndex] = SelectedChannel;
        } else {
          MState.ModuleConfig.log_channels.arrests =
            MState.ModuleConfig.log_channels.arrests.filter(
              (C) => C !== MState.ModuleConfig.log_channels.arrests[ExistingChannelIndex]
            );
        }
      } else if (SelectedChannel) {
        MState.ModuleConfig.log_channels.arrests = [SelectedChannel];
      }

      return SelectedChannel !== undefined;
    }

    if (
      CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].CitationLogLocalChannel)
    ) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.DutyActivitiesConfiguration].CitationLogLocalChannel,
        "Citation Log",
        MState.ModuleConfig.log_channels.citations.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return false;
      if (MState.ModuleConfig.log_channels.citations.length) {
        const ExistingChannelIndex = MState.ModuleConfig.log_channels.citations.findIndex(
          (C) => !C.includes(":")
        );
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          MState.ModuleConfig.log_channels.citations.push(SelectedChannel);
        } else if (SelectedChannel) {
          MState.ModuleConfig.log_channels.citations[ExistingChannelIndex] = SelectedChannel;
        } else {
          MState.ModuleConfig.log_channels.citations =
            MState.ModuleConfig.log_channels.citations.filter(
              (C) => C !== MState.ModuleConfig.log_channels.citations[ExistingChannelIndex]
            );
        }
      } else if (SelectedChannel) {
        MState.ModuleConfig.log_channels.citations = [SelectedChannel];
      }

      return SelectedChannel !== undefined;
    }

    if (
      CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].IncidentLogLocalChannel)
    ) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CTAIds[ConfigTopics.DutyActivitiesConfiguration].IncidentLogLocalChannel,
        "Incident Reports",
        MState.ModuleConfig.log_channels.incidents
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.log_channels.incidents = SelectedChannel;
        return true;
      }
    }

    return false;
  }

  if (!RecInteract.isStringSelectMenu()) return false;
  if (CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].ModuleEnabled)) {
    MState.ModuleConfig.enabled = RecInteract.values[0] === "true";
  } else if (
    CustomId.startsWith(CTAIds[ConfigTopics.DutyActivitiesConfiguration].SignatureFormatType)
  ) {
    MState.ModuleConfig.signature_format = parseInt(RecInteract.values[0]);
  } else if (
    CustomId.startsWith(
      CTAIds[ConfigTopics.DutyActivitiesConfiguration].ArrestReportsImgHeaderEnabled
    )
  ) {
    MState.ModuleConfig.arrest_reports.show_header_img = RecInteract.values[0] === "true";
  } else if (
    CustomId.startsWith(
      CTAIds[ConfigTopics.DutyActivitiesConfiguration].IncReportsAutoThreadsMgmtEnabled
    )
  ) {
    MState.ModuleConfig.incident_reports.auto_thread_management = RecInteract.values[0] === "true";
  }

  RecInteract.deferUpdate().catch(() => null);
  return false;
}

async function HandleCallsignsModuleConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["callsigns_module"]>
): Promise<boolean> {
  const ActionMap = CTAIds[ConfigTopics.CallsignsConfiguration];
  const CustomId = RecInteract.customId;

  if (RecInteract.isButton()) {
    if (CustomId.startsWith(ActionMap.LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        ActionMap.LogChannel,
        "Call Signs Log",
        MState.ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    }

    if (CustomId.startsWith(ActionMap.RequestsChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        ActionMap.RequestsChannel,
        "Call Sign Requests",
        MState.ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    }

    if (CustomId.startsWith(ActionMap.NicknameFormat)) {
      const InputFormat = await HandleCallsignNicknameFormatSetBtnInteract(
        RecInteract,
        MState.ModuleConfig.nickname_format
      );

      if (InputFormat !== MState.ModuleConfig.nickname_format) {
        MState.ModuleConfig.nickname_format = InputFormat;
        return true;
      }

      return false;
    }

    if (CustomId.startsWith(ActionMap.UnitTypeRoleRestrictions)) {
      const UpdatedRestrictions = await PromptBeatOrUnitRestrictionsMod(
        RecInteract,
        MState,
        "unit"
      );

      if (UpdatedRestrictions.length !== MState.ModuleConfig.unit_type_restrictions.length) {
        return true;
      }
    }

    if (CustomId.startsWith(ActionMap.BeatNumberRestrictions)) {
      const UpdatedRestrictions = await PromptBeatOrUnitRestrictionsMod(
        RecInteract,
        MState,
        "beat"
      );

      if (UpdatedRestrictions.length !== MState.ModuleConfig.beat_restrictions.length) {
        return true;
      }
    }
  }

  if (RecInteract.isStringSelectMenu() && CustomId.startsWith(ActionMap.ModuleEnabled)) {
    MState.ModuleConfig.enabled = RecInteract.values[0] === "true";
  }

  if (RecInteract.isStringSelectMenu() && CustomId.startsWith(ActionMap.AutoRenameOnApproval)) {
    MState.ModuleConfig.update_nicknames = RecInteract.values[0] === "true";
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(ActionMap.UnitTypeRoleRestrictionsMode)
  ) {
    MState.ModuleConfig.unit_type_whitelist = RecInteract.values[0] === "true";
  }

  if (RecInteract.isRoleSelectMenu() && CustomId.startsWith(ActionMap.ManagerRoles)) {
    MState.ModuleConfig.manager_roles = RecInteract.values.filter(
      (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
    );

    return !ArraysAreEqual(MState.ModuleConfig.manager_roles, RecInteract.values);
  }

  RecInteract.deferUpdate().catch(() => null);
  return false;
}

// ---------------------------------------------------------------------------------------
// Specific Config Helpers & Handlers:
// -----------------------------------
async function HandleUANActivePrefixBtnInteract(
  RecInteract: ButtonInteraction<"cached">,
  MState: ModuleState<GuildSettings["leave_notices"] | GuildSettings["reduced_activity"]>
): Promise<boolean> {
  const ModuleId = MState.ConfigTopic as
    | ConfigTopics.LeaveConfiguration
    | ConfigTopics.ReducedActivityConfiguration;

  const ModuleTitle =
    ModuleId === ConfigTopics.LeaveConfiguration ? "Leave of Absence" : "Reduced Activity";

  const InputModal = new ModalBuilder()
    .setTitle("Set Active Prefix")
    .setCustomId(`${CTAIds[ModuleId].ActivePrefix}-input:${RecInteract.user.id}:${RandomString(4)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("prefix")
          .setLabel(`Active ${ModuleTitle} Prefix`)
          .setPlaceholder("Enter prefix here, use '%s' for trailing space...")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(10)
          .setMinLength(2)
      )
    );

  if (MState.ModuleConfig.active_prefix) {
    InputModal.components[0].components[0].setValue(
      MState.ModuleConfig.active_prefix.replace(/ $/, "%s")
    );
  }

  const Submission = await ShowModalAndAwaitSubmission(RecInteract, InputModal);
  let InputPrefix = Submission?.fields.getTextInputValue("prefix") || null;
  InputPrefix =
    InputPrefix?.replace(/(?<!\\)%s/g, " ")
      .trimStart()
      .slice(0, 8) ?? null;

  if (!Submission) return false;
  if (InputPrefix === null || InputPrefix.length < 2) {
    MState.ModuleConfig.active_prefix = null;
    Submission.deferUpdate().catch(() => null);
    return true;
  }

  const GuildSettings = await GetGuildSettings(RecInteract.guildId);
  const FilteredPrefix = await FilterUserInput(InputPrefix, {
    guild_instance: RecInteract.guild,
    filter_links_emails: true,
    utif_setting_enabled: GuildSettings?.utif_enabled,
  });

  MState.ModuleConfig.active_prefix = FilteredPrefix;
  Submission?.deferUpdate().catch(() => null);

  return true;
}

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

async function HandleConfigPageNavigation<T extends SettingsResolvable>(
  Interaction: ButtonInteraction<"cached">,
  ConfigPrompt: Message<true>,
  State: ModuleState<T>,
  GetContainersFn: (
    Interact: ModulePromptUpdateSupportedInteraction,
    Config: T
  ) => readonly ContainerBuilder[] | ContainerBuilder[]
): Promise<void> {
  const ActionParts = Interaction.customId.split(":");
  const ActionType = ActionParts[0].split("-").pop();
  const NewPageIndex =
    ActionType === "next"
      ? Math.min(State.CurrentPage + 1, State.TotalPages - 1)
      : Math.max(State.CurrentPage - 1, 0);

  const ContainerPages = GetContainersFn(Interaction, State.ModuleConfig);
  const CurrentContainer = ContainerPages[NewPageIndex];
  const NavigatedContainer = AttachNavMgmtCompsToContainer({
    Container: CurrentContainer,
    Interaction,
    TotalPages: State.TotalPages,
    CurrentPage: NewPageIndex,
    ConfigTopicId: State.ConfigTopic,
  });

  if (Interaction.deferred || Interaction.replied) {
    await Interaction.editReply({
      message: ConfigPrompt,
      components: [NavigatedContainer],
    });
  } else {
    await Interaction.update({ components: [NavigatedContainer] });
  }

  State.CurrentPage = NewPageIndex;
}

async function HandleOutsideLogChannelBtnInteracts(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentLogChannels: string[]
): Promise<null | undefined | string> {
  const CurrLogChannel = CurrentLogChannels.find((C) => C.includes(":"));
  const LogChannelTopic = BtnInteract.customId.startsWith(
    CTAIds[ConfigTopics.DutyActivitiesConfiguration].OutsideArrestLogChannel
  )
    ? "Arrest Reports"
    : "Citation Logs";

  const InputModal = new ModalBuilder()
    .setTitle(`Outside Log Channel - ${LogChannelTopic}`)
    .setCustomId(`${BtnInteract.customId}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Channel in The Format: [ServerID:ChannelID]")
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
    .setCustomId(CTAIds[ConfigTopics.ShiftConfiguration].ServerDefaultShiftQuota + RandomString(4))
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
    let FormattedDuration: string = FormatDuration(CurrentQuota);
    if (FormattedDuration.length > 20) {
      FormattedDuration = FormattedDuration.replace("and", "");
      if (FormattedDuration.length > 20) {
        FormattedDuration = FormattedDuration.replace(/ ?week(s)?/g, "w")
          .replace(/ ?year(s)?/g, "y")
          .replace(/ ?month(s)?/g, "mo")
          .replace(/ ?minute(s)?/g, "min")
          .replace(/ ?second(s)?/g, "s")
          .replace(/ ?hour(s)?/g, "h")
          .replace(/ ?day(s)?/g, "d");
      }
    }

    FormattedDuration = FormattedDuration.length <= 20 ? FormattedDuration : "";
    if (FormattedDuration.length <= 20 && FormattedDuration.length > 0) {
      InputModal.components[0].components[0].setValue(FormattedDuration);
    }
  }

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 8 * 60 * 1000);
  if (!ModalSubmission) return CurrentQuota;

  const InputDuration = ModalSubmission.fields.getTextInputValue("default_quota").trim();
  const ParsedDuration = ParseDuration(InputDuration, "millisecond");

  if (typeof ParsedDuration === "number") {
    ModalSubmission.deferUpdate().catch(() => null);
    return Math.round(Math.abs(ParsedDuration));
  } else if (InputDuration.length) {
    new ErrorContainer()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(ModalSubmission, true, true);

    return CurrentQuota;
  } else {
    ModalSubmission.deferUpdate().catch(() => null);
    return 0;
  }
}

async function HandleCallsignNicknameFormatSetBtnInteract(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentFormat: string
): Promise<string> {
  const InputModal = new ModalBuilder()
    .setTitle("Call Sign Nickname Format")
    .setCustomId(CTAIds[ConfigTopics.CallsignsConfiguration].NicknameFormat + RandomString(4))
    .setComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Paragraph)
          .setValue(CurrentFormat)
          .setLabel("Nickname Format")
          .setPlaceholder("ex., {division}-{unit_type}-{beat_num} | {nickname}")
          .setCustomId("format")
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(70)
      )
    );

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 5 * 60 * 1000);
  if (!ModalSubmission) return CurrentFormat;
  ModalSubmission.deferUpdate().catch(() => null);

  return ModalSubmission.fields.getTextInputValue("format");
}

// TODO: Complete once discord.js package support
// select menus, text display, and labels inside modals.
async function ModalPromptBeatOrUnitTypeRuleAdd(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  _MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  _IsUnitType: boolean
): Promise<void> {
  const ScopeLabel = _IsUnitType ? "Unit Type" : "Beat Number";
  const ModalId =
    CTAIds[ConfigTopics.CallsignsConfiguration][
      _IsUnitType ? "UnitTypeRoleRestrictions" : "BeatNumberRestrictions"
    ] +
    "add:" +
    SelectInteract.user.id +
    ":" +
    RandomString(6);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars
  const _InputModalJSON = {
    type: InteractionResponseType.Modal,
    data: {
      title: `Add ${ScopeLabel} Restriction`,
      custom_id: ModalId,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: Dedent(`
              Provide the details below to add a new ${ScopeLabel.toLowerCase()} restriction. \
              Submitting this form will create the restriction locally to the \
              current prompt session, you would have to confirm and then save \
              the changes on the module config panel afterwards to enforce it.
          `),
        },
        {
          type: 18, // ComponentType.LABEL
          label: "Choose a Range",
          description:
            "The range is inclusive and must be between 1-999; the format for the range is 'start-end'.",
          component: {
            type: ComponentType.TextInput,
            custom_id: "range",
            minLength: 3,
            maxLength: 7,
            required: true,
            style: TextInputStyle.Short,
            placeholder: "Ex., 100-199 or 1-99",
          },
        },
        // {
        //   type: 18, // ComponentType.LABEL
        //   label: "Choose a Unit Type",
        //   description:
        //     "Type in a valid LAPD unit type in the text box below to restrict it to certain roles.",
        //   component: {
        //     type: ComponentType.TextInput,
        //     custom_id: "unit_type",
        //     minLength: 1,
        //     maxLength: 3,
        //     required: true,
        //     style: TextInputStyle.Short,
        //     placeholder: "Ex., 'K9' or 'SL'",
        //   },
        // },
        {
          type: 18, // ComponentType.LABEL
          label: "Range Permitted Roles",
          description: `Select the roles of which holders are permitted to use this ${_IsUnitType ? "unit type" : "beat number range"}.`,
          component: {
            type: ComponentType.RoleSelect,
            custom_id: "roles",
            placeholder: "Select roles permitted for this restriction...",
            max_values: 10,
            min_values: 0,
            required: false,
          },
        },
      ],
    },
  };

  // To be completed once discord.js package support
  // select menus, text display, and labels inside modals.
}

async function ModalPromptBeatOrUnitTypeRuleRemove(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
) {
  const ScopeLabel = IsUnitType ? "Unit Type" : "Beat Number";
  const ModalBaseId =
    CTAIds[ConfigTopics.CallsignsConfiguration][
      IsUnitType ? "UnitTypeRoleRestrictions" : "BeatNumberRestrictions"
    ];
  const InputIdModal = new ModalBuilder()
    .setTitle(`Call Signs: ${ScopeLabel} Restriction Removal`)
    .setCustomId(ModalBaseId + "-remove:" + SelectInteract.user.id + RandomString(6))
    .setComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Paragraph)
          .setLabel("Restriction ID")
          .setPlaceholder("The ID of the restriction to remove, use the list option to view IDs.")
          .setCustomId("id")
          .setRequired(true)
          .setMinLength(24)
          .setMaxLength(24)
      )
    );

  const ModalSubmission = await ShowModalAndAwaitSubmission(
    SelectInteract,
    InputIdModal,
    5 * 60 * 1000
  );

  if (!ModalSubmission) return;
  const InputId = ModalSubmission.fields.getTextInputValue("id");
  const ExistingIndex = MStateObj.ModuleConfig.beat_restrictions.findIndex(
    (R) => R._id.toString() === InputId
  );

  if (!isValidObjectId(InputId)) {
    return new ErrorContainer()
      .useErrTemplate("Invalid24HexaID")
      .replyToInteract(ModalSubmission, true);
  }

  if (ExistingIndex === -1) {
    return new ErrorContainer()
      .useErrTemplate("CallsignBeatOrUnitTypeRestrictionNotFound")
      .replyToInteract(ModalSubmission, true);
  }

  MStateObj.ModuleConfig.beat_restrictions.splice(ExistingIndex, 1);
  return new SuccessContainer()
    .useTemplate("CallsignBeatOrUnitTypeRestrictionRemoved", ScopeLabel.toLowerCase())
    .replyToInteract(ModalSubmission, true);
}

async function HandleBeatNumOrUnitTypeRulesClear(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
) {
  const ScopeLabel = IsUnitType ? "unit type" : "beat number";
  const RestrictionsKey = IsUnitType ? "unit_type_restrictions" : "beat_restrictions";
  if (MStateObj.ModuleConfig[RestrictionsKey].length === 0) {
    return new InfoContainer()
      .useInfoTemplate("CallsignBeatNumOrUnitTypeNoRestrictionsToClear", ScopeLabel)
      .replyToInteract(SelectInteract, true, true);
  }

  MStateObj.ModuleConfig[RestrictionsKey] = [];
  return new SuccessContainer()
    .useTemplate("CallsignBeatOrUnitTypeRestrictionsCleared", ScopeLabel)
    .replyToInteract(SelectInteract, true, true);
}

async function PromptBeatOrUnitRestrictionsMod(
  BtnInteract: ButtonInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  Scope: "beat" | "unit"
): Promise<GuildSettings["callsigns_module"]["beat_restrictions"]> {
  const ScopeIsUnitType = Scope === "unit";
  const PromptContainer = GetCSBeatOrUnitTypeRestrictionsPromptContainer(
    BtnInteract,
    MStateObj,
    ScopeIsUnitType
  );

  const MStateObjCopy = clone(MStateObj);
  const PromptMessage = await BtnInteract.reply({
    withResponse: true,
    components: [PromptContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  }).then((IR) => IR.resource!.message! as Message<true>);

  const ActionsCollector = PromptMessage.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (I) => I.user.id === BtnInteract.user.id,
    time: 10 * 60 * 1000,
  });

  ActionsCollector.on("collect", async (SelectInteract) => {
    const Selected = SelectInteract.values[0];
    try {
      switch (Selected) {
        case "list": {
          const Pages = GetCSBeatOrUnitTypeRestrictionsListContainers(
            MStateObjCopy,
            ScopeIsUnitType
          );

          if (Pages.length === 0) {
            await new InfoContainer()
              .useInfoTemplate("CallsignNoRestrictionsToList")
              .replyToInteract(SelectInteract, true, true);
          }

          HandlePagePagination({
            interact: SelectInteract,
            pagination_timeout: 8 * 60 * 1000,
            pages: Pages,
            context: FileLabel,
            ephemeral: true,
          });
          break;
        }
        case "add":
          await ModalPromptBeatOrUnitTypeRuleAdd(SelectInteract, MStateObjCopy, ScopeIsUnitType);
          break;
        case "remove":
          await ModalPromptBeatOrUnitTypeRuleRemove(SelectInteract, MStateObjCopy, ScopeIsUnitType);
          break;
        case "clear":
          await HandleBeatNumOrUnitTypeRulesClear(SelectInteract, MStateObjCopy, ScopeIsUnitType);
          break;
        case "discard":
          ActionsCollector.stop("ChangesDismissed");
          break;
        case "confirm":
        default:
          ActionsCollector.stop("ChangesConfirmed");
      }

      return await SelectInteract.editReply({
        message: PromptMessage.id,
        components: [PromptContainer],
      });
    } catch (Err: any) {
      AppLogger.error({
        message: "Something went wrong while handling callsign restrictions modification;",
        label: FileLabel,
        stack: Err?.stack,
        error: Err,
      });
    }
  });

  return new Promise<GuildSettings["callsigns_module"]["beat_restrictions"]>((resolve) => {
    ActionsCollector.on("end", (Collected, EndReason) => {
      const LastInteract = Collected.last() ?? BtnInteract;
      LastInteract.deleteReply().catch(() => null);

      return EndReason.includes("Confirmed")
        ? resolve(MStateObjCopy.ModuleConfig.beat_restrictions)
        : resolve(MStateObj.ModuleConfig.beat_restrictions);
    });
  });
}

// ---------------------------------------------------------------------------------------
// Config Topic Selection:
// -----------------------
async function HandleBasicConfigSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetBasicConfigContainers(SelectInteract, GuildConfig);
    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.BasicConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig,
      ConfigTopics.BasicConfiguration,
      GetBasicConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleAdditionalConfigSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetAdditionalConfigContainers(SelectInteract, GuildConfig);
    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.AdditionalConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig,
      ConfigTopics.AdditionalConfiguration,
      GetAdditionalConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleShiftModuleSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetShiftModuleConfigContainers(
      SelectInteract,
      GuildConfig.shift_management
    );

    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.ShiftConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.shift_management,
      ConfigTopics.ShiftConfiguration,
      GetShiftModuleConfigContainers
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
    const ModuleContainers = GetDutyActivitiesModuleConfigContainers(
      SelectInteract,
      GuildConfig.duty_activities
    );

    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.DutyActivitiesConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.duty_activities,
      ConfigTopics.DutyActivitiesConfiguration,
      GetDutyActivitiesModuleConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleLeaveModuleSelection(SelectInteract: StringSelectMenuInteraction<"cached">) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetLeaveModuleConfigContainers(
      SelectInteract,
      GuildConfig.leave_notices
    );

    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.LeaveConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.leave_notices,
      ConfigTopics.LeaveConfiguration,
      GetLeaveModuleConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleReducedActivityModuleSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetReducedActivityModuleConfigContainers(
      SelectInteract,
      GuildConfig.reduced_activity
    );

    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.ReducedActivityConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.reduced_activity,
      ConfigTopics.ReducedActivityConfiguration,
      GetReducedActivityModuleConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleCallsignsModuleSelection(
  SelectInteract: StringSelectMenuInteraction<"cached">
) {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (GuildConfig) {
    const ModuleContainers = GetCallsignsModuleConfigContainers(
      SelectInteract,
      GuildConfig.callsigns_module
    );

    const FirstPageContainer = AttachNavMgmtCompsToContainer({
      ConfigTopicId: ConfigTopics.CallsignsConfiguration,
      Container: ModuleContainers[0],
      TotalPages: ModuleContainers.length,
      Interaction: SelectInteract,
      CurrentPage: 0,
    });

    const ConfigPrompt = await UpdatePromptReturnMessage(SelectInteract, {
      components: [FirstPageContainer],
    });

    return HandleModuleConfigInteractions(
      SelectInteract,
      ConfigPrompt,
      GuildConfig.callsigns_module,
      ConfigTopics.CallsignsConfiguration,
      GetCallsignsModuleConfigContainers
    );
  } else {
    throw new AppError("GuildConfigNotFound");
  }
}

async function HandleModuleConfigInteractions<SR extends SettingsResolvable>(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  DatabaseConfig: SR,
  ConfigTopic: ConfigTopics,
  GetContainersFn: (
    Interact: ModulePromptUpdateSupportedInteraction,
    Config: SR
  ) => readonly ContainerBuilder[] | ContainerBuilder[]
): Promise<void> {
  const State: ModuleState<SR> = {
    TotalPages: GetContainersFn(SelectInteract, DatabaseConfig).length,
    OriginalConfig: clone(DatabaseConfig),
    ModuleConfig: clone(DatabaseConfig),
    ConfigTopic,
    CurrentPage: 0,

    IsModified() {
      return isDeepEqual(this.OriginalConfig, this.ModuleConfig) === false;
    },
  };

  const CompActionCollector = ConfigPrompt.createMessageComponentCollector({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    time: 10 * 60 * 1000,
  });

  CompActionCollector.on("collect", async (RecInteract) => {
    try {
      const CustomId = RecInteract.customId;
      const IsButton = RecInteract.isButton();

      if (
        IsButton &&
        (CustomId.includes(`-${ConfigTopicMgmtButtonsIds.NextPage}`) ||
          CustomId.includes(`-${ConfigTopicMgmtButtonsIds.PrevPage}`))
      ) {
        await HandleConfigPageNavigation(RecInteract, ConfigPrompt, State, GetContainersFn).catch(
          (Err) =>
            AppLogger.error({
              message: "Encountered an error during config module page navigation;",
              label: FileLabel,
              stack: Err?.stack,
              error: { ...(Err ?? {}) },
            })
        );
      } else if (IsButton && CustomId.includes(`-${ConfigTopicMgmtButtonsIds.ReturnToMain}`)) {
        CompActionCollector.stop("Back");
        await RecInteract.deferUpdate();
        return CmdCallback(RecInteract);
      } else if (IsButton && CustomId.includes(`-${ConfigTopicMgmtButtonsIds.ConfirmAndSave}`)) {
        await HandleConfigSave(RecInteract, State);
      } else {
        // Handles module-specific component interactions
        // This will possibly need to update State.ModuleConfig
        const ShallUpdatePrompt = await HandleModuleSpecificInteractions(RecInteract, State);
        if (ShallUpdatePrompt) {
          await UpdateConfigPrompt(RecInteract, ConfigPrompt, State, GetContainersFn);
        } else if (!RecInteract.deferred && !RecInteract.replied) {
          RecInteract.deferUpdate().catch(() => null);
        }
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      new ErrorContainer()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(RecInteract, true);

      AppLogger.error({
        message: "Failed to handle component interactions for %s;",
        splat: [ConfigTopicsExplanations[ConfigTopic].Title.toLowerCase()],
        error_id: ErrorId,
        label: FileLabel,
        stack: Err?.stack,
        error: {
          ...(Err ?? {}),
        },
      });
    }
  });

  CompActionCollector.on("end", async function OnConfigModuleEnd(Collected, EndReason) {
    if (EndReason.includes("time") || EndReason.includes("idle")) {
      const LastInteract = Collected.last() ?? SelectInteract;
      return HandleConfigTimeoutResponse(
        LastInteract,
        ConfigTopicsExplanations[ConfigTopic].Title,
        SelectInteract.message
      );
    }
  });
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
    {
      Title: "Call Signs Module",
      Content: GetCSCallsignsModuleContent(GuildConfig),
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
  Interaction: ModulePromptUpdateSupportedInteraction<"cached"> | ButtonInteraction<"cached">,
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
        return CmdCallback(ReceivedInteraction);
      }
    }
  } catch (Err: any) {
    if (Err.message?.match(/reason: \w+Delete/)) return;
    if (Err.message?.match(/reason: (?:time|idle)/i)) {
      const PromptMessage =
        ConfigPrompt instanceof Message
          ? ConfigPrompt
          : await ConfigPrompt.fetch().catch(() => null);

      if (!PromptMessage) return;
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
  CmdInteract: ModulePromptUpdateSupportedInteraction<"cached"> | SlashCommandInteraction<"cached">,
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
      } else if (SelectedConfigTopic === ConfigTopics.DutyActivitiesConfiguration) {
        await HandleDutyActivitiesModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.ShowConfigurations) {
        await HandleConfigShowSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.LeaveConfiguration) {
        await HandleLeaveModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.AdditionalConfiguration) {
        await HandleAdditionalConfigSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.ReducedActivityConfiguration) {
        await HandleReducedActivityModuleSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic === ConfigTopics.CallsignsConfiguration) {
        await HandleCallsignsModuleSelection(TopicSelectInteract);
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

async function CmdCallback(
  PromptInteraction:
    | ModulePromptUpdateSupportedInteraction<"cached">
    | SlashCommandInteraction<"cached">
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
  callback: CmdCallback,
  options: { user_perms: [PermissionFlagsBits.ManageGuild] },
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View and manage the application configuration for this server.")
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
