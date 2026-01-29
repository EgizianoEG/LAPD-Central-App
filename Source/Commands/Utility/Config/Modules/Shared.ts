/**
 * Shared types, constants, and utilities for the Config command modules.
 * This file provides common functionality used across all config modules.
 */

import {
  Guild,
  Message,
  CacheType,
  ButtonStyle,
  ChannelType,
  resolveColor,
  MessageFlags,
  ButtonBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonInteraction,
  GuildBasedChannel,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  InteractionUpdateOptions,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  MentionableSelectMenuInteraction,
} from "discord.js";

import { Dedent } from "#Utilities/Strings/Formatters.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { milliseconds } from "date-fns/milliseconds";
import { Colors, Emojis } from "#Config/Shared.js";
import { BaseExtraContainer, InfoContainer } from "#Utilities/Classes/ExtraContainers.js";
import { DASignatureFormats, RiskyRolePermissions } from "#Config/Constants.js";

import AwaitMessageWithTimeout from "#Utilities/Discord/MessageCreateListener.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import DHumanize from "humanize-duration";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const ListFormatter = new Intl.ListFormat("en");
export const MillisInDay = milliseconds({ days: 1 });
export const AccentColor = resolveColor("#5f9ea0");
export const FileLabel = "Commands:Utility:Config";
export const FormatDuration = DHumanize.humanizer({
  conjunction: " and ",
  largest: 3,
  round: true,
});

// ---------------------------------------------------------------------------------------
// Types & Interfaces:
// -------------------
export type GuildSettings = NonNullable<Awaited<ReturnType<typeof GetGuildSettings>>>;

export type SettingsResolvable =
  | GuildSettings
  | GuildSettings[
      | "shift_management"
      | "duty_activities"
      | "leave_notices"
      | "reduced_activity"
      | "callsigns_module"];

export type PromptInteraction<Cached extends CacheType = "cached"> =
  | StringSelectMenuInteraction<Cached>
  | ChannelSelectMenuInteraction<Cached>
  | RoleSelectMenuInteraction<Cached>
  | UserSelectMenuInteraction<Cached>
  | MentionableSelectMenuInteraction<Cached>
  | ButtonInteraction<Cached>;

export interface ModuleState<T extends SettingsResolvable> {
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

// ---------------------------------------------------------------------------------------
// Enums:
// ------
export enum ConfigTopics {
  ShowConfigurations = "app-config-vc",
  BasicConfiguration = "app-config-bc",
  ShiftConfiguration = "app-config-sc",
  LeaveConfiguration = "app-config-loa",
  CallsignsConfiguration = "app-config-cs",
  AdditionalConfiguration = "app-config-ac",
  DutyActivitiesConfiguration = "app-config-da",
  ReducedActivityConfiguration = "app-config-ra",
}

export enum ConfigTopicMgmtButtonsIds {
  NextPage = "next",
  PrevPage = "prev",
  ReturnToMain = "bck",
  ConfirmAndSave = "cfm",
}

// ---------------------------------------------------------------------------------------
// General Helpers:
// ----------------
/**
 * Converts a log deletion interval from milliseconds to a human-readable string.
 * @param Interval - The interval in milliseconds.
 * @returns A string representing the interval in days.
 */
export function GetHumanReadableLogDeletionInterval(Interval: number) {
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
 * Filters out roles that are managed by an application or which have
 * specific unsafe permissions such as Manage Server or Administrator.
 * @param GuildInst - The guild instance to check against.
 * @param RoleIds - An array of role Ids to filter.
 * @returns An array of role Ids that are safe to use in the context of role assignment.
 */
export async function FilterUnsafeRoles(GuildInst: Guild, RoleIds: string[]) {
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
export async function UpdatePromptReturnMessage(
  Interact: MessageComponentInteraction<"cached">,
  Opts: InteractionUpdateOptions
): Promise<Message<true>> {
  return Interact.update({ ...Opts, withResponse: true }).then((resp) => resp.resource!.message!);
}

/**
 * Handles the update of a timeout prompt for a specific configuration module.
 * @param Interact - Any prompt-related interaction which webhook hasn't expired yet.
 * @param CurrModule - The name of the current module for which the configuration prompt has timed out.
 * @param PromptMsg - The prompt message object.
 * @returns A promise that resolves when the prompt has been updated.
 */
export async function HandleConfigTimeoutResponse(
  Interact: MessageComponentInteraction<"cached">,
  CurrModule: string,
  PromptMsg: Message<true>
): Promise<any> {
  const MsgContainer = new InfoContainer()
    .useInfoTemplate("TimedOutConfigPrompt")
    .setTitle(`Timed Out — ${CurrModule}`);

  if (Date.now() - Interact.createdTimestamp <= 14.6 * 60 * 1000) {
    return (
      PromptMsg.editable &&
      PromptMsg.edit({
        components: [MsgContainer],
      }).catch(() => null)
    );
  }

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
 * Updates a configuration prompt with new selected/configured settings.
 * @param Interaction - The interaction that triggered the update.
 * @param ConfigPrompt - The message of the configuration prompt.
 * @param ModuleState - The current module state.
 * @param GetContainersFn - Function that generates the UI containers for this module.
 * @returns A promise that resolves when the prompt has been updated.
 */
export async function UpdateConfigPrompt<T extends SettingsResolvable>(
  Interaction: PromptInteraction,
  ConfigPrompt: Message<true>,
  ModuleState: ModuleState<T>,
  GetContainersFn: (
    Interaction: PromptInteraction,
    Config: T
  ) => readonly ContainerBuilder[] | ContainerBuilder[]
): Promise<any> {
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

/**
 * Attaches configuration topic management buttons to a container.
 * @param Params - The parameters for attaching the buttons.
 * @returns The updated container with the buttons attached.
 */
export function AttachNavMgmtCompsToContainer(Params: {
  Container: ContainerBuilder;
  Interaction: PromptInteraction;
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
 * Creates an array of `ActionRowBuilder<ButtonBuilder>` components for managing configuration topics,
 * including pagination controls and action buttons for confirming or returning to topic selection.
 *
 * @template ConfigTopic - The type representing the configuration topic.
 * @param Interaction - The interaction context, used to identify the user and session.
 * @param ConfigTopicId - The identifier for the current configuration topic.
 * @param CurrentPage - The current page index (zero-based) in the paginated topic list.
 * @param TotalPages - The total number of pages available for the topic.
 * @returns An array of `ActionRowBuilder<ButtonBuilder>` containing pagination and action buttons.
 */
export function CreateConfigTopicMgmtComponents<ConfigTopic extends ConfigTopics>(
  Interaction: PromptInteraction,
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

/**
 * Generates the prompt components for selecting or deselecting a text channel in a Discord guild.
 *
 * @param Interact - The message component interaction from the user, used to personalize component Ids.
 * @param TargetConfig - The configuration key or identifier for the target channel setting.
 * @param SelectedChannelId - (Optional) The currently selected channel Id, if any, to be shown as default.
 * @returns A tuple containing:
 *   - The action row with the channel select menu.
 *   - The action row with the "Deselect Current Destination" button.
 */
export function GetChannelSelectionPromptComponents(
  Interact: MessageComponentInteraction<"cached">,
  TargetConfig: string,
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

/**
 * Generates a prompt container for selecting a text-based channel or thread, or for providing a direct configuration format.
 *
 * This function creates a UI container that allows users to select a channel or thread from a dropdown menu,
 * or alternatively copy and paste a configuration format into their desired channel or thread. It displays
 * the currently selected destination, provides usage notes, and includes action rows for user interaction.
 *
 * @param RecInteract - The message component interaction that triggered this prompt, scoped to cached messages.
 * @param TargettedConfig - The configuration key or identifier that this selection will affect.
 * @param ContainerTitle - The title to display at the top of the prompt container.
 * @param CSCopyFormat - The string format that users can copy and paste into a channel or thread to set the configuration directly.
 * @param CurrentDestination - (Optional) The currently selected channel or thread, if any.
 * @returns A `BaseExtraContainer` configured with the prompt UI, description, and action rows for channel/thread selection.
 */
export function GetChannelOrThreadSelPromptContainer(
  RecInteract: MessageComponentInteraction<"cached">,
  TargettedConfig: string,
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

/**
 * Generates a dropdown menu (StringSelectMenu) for selecting configuration topics in the app.
 *
 * @param Interaction - The interaction object, either a PromptInteraction or SlashCommandInteraction, both with "cached" state.
 * @returns An ActionRowBuilder containing a StringSelectMenuBuilder with options for various configuration topics.
 *
 * @remarks
 * The dropdown includes options for:
 * - Basic Configuration
 * - Shift Module Configuration
 * - Leave of Absence Module Configuration
 * - Reduced Activity Module Configuration
 * - Duty Activities Module Configuration
 * - Call Signs Module Configuration
 * - Additional Configurations
 * - Show All Configurations
 *
 * The custom Id of the menu is suffixed with the user's Id to ensure uniqueness per user interaction and proper interaction validation.
 */
export function GetConfigTopicsDropdownMenu(
  Interaction: PromptInteraction<"cached"> | SlashCommandInteraction<"cached">
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

/**
 * Generates the pagination and navigation components for the configuration display page.
 *
 * @param Interaction - The interaction object, either a PromptInteraction or ButtonInteraction, both with "cached" state.
 * @param SafePIndex - The current page index (zero-based), used to determine pagination state.
 * @param TotalPages - The total number of pages available for configuration display.
 * @returns A tuple containing two ActionRowBuilder<ButtonBuilder> instances:
 *   - The first row contains pagination buttons (Previous, Current Page, Next).
 *   - The second row contains a button to return to the topic selection.
 */
export function GetShowConfigurationsPageComponents(
  Interaction: PromptInteraction<"cached"> | ButtonInteraction<"cached">,
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

/**
 * Handles navigation between pages in a configuration prompt using button interactions.
 *
 * This function updates the current page index based on the navigation action (next/previous),
 * retrieves the appropriate container for the new page, attaches navigation management components,
 * and updates the prompt message accordingly.
 *
 * @template T - The type of the settings object that extends `SettingsResolvable`.
 * @param Interaction - The button interaction triggering the navigation, must be cached.
 * @param ConfigPrompt - The original configuration prompt message to be updated.
 * @param State - The current module state, including page index, total pages, and module config.
 * @param GetContainersFn - A function that returns an array of container builders for the config pages.
 * @returns A promise that resolves when the navigation handling is complete.
 */
export async function HandleConfigPageNavigation<T extends SettingsResolvable>(
  Interaction: ButtonInteraction<"cached">,
  ConfigPrompt: Message<true>,
  State: ModuleState<T>,
  GetContainersFn: (
    Interact: PromptInteraction,
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

/**
 * Determines whether the provided guild configuration has Roblox-dependent features enabled.
 * @param Config - The guild settings to check for Roblox dependency conflicts.
 * @returns `true` if there are Roblox-dependent features enabled without requiring authorization; otherwise, `false`.
 */
export function ConfigHasRobloxDependencyConflict(Config: GuildSettings): boolean {
  const DASigFormat = Config.duty_activities.signature_format;
  return (
    (!!(DASigFormat & DASignatureFormats.RobloxDisplayName) ||
      !!(DASigFormat & DASignatureFormats.RobloxUsername)) &&
    Config.require_authorization === false
  );
}

/**
 * Extracts detailed information about Roblox-dependent feature conflicts in the configuration.
 *
 * Detects when Roblox-dependent duty activity signature formats (Roblox Display Name or
 * Roblox Username) are enabled but Roblox account link requirement is disabled. This creates
 * a conflict because logging cannot function properly without linked Roblox accounts.
 *
 * @param Config - The guild settings to check for conflicts
 * @returns An object containing:
 *   - `HasConflict`: Boolean indicating if a conflict exists (Roblox-dependent features enabled
 *     while Roblox account link requirement is disabled)
 *   - `EnabledFeatures`: Array of specific Roblox-dependent features currently enabled
 *     (e.g., "Roblox Display Name", "Roblox Username")
 *   - `DisabledSetting`: The name of the setting that needs to be enabled to resolve conflicts
 *     ("Roblox Account Link Required")
 */
export function GetRobloxDependencyConflictDetails(Config: GuildSettings): {
  HasConflict: boolean;
  EnabledFeatures: string[];
  DisabledSetting: string;
} {
  const DASigFormat = Config.duty_activities.signature_format;
  const EnabledFeatures: string[] = [];

  if (
    (DASigFormat & DASignatureFormats.RobloxDisplayName) ===
    DASignatureFormats.RobloxDisplayName
  ) {
    EnabledFeatures.push("`DA: Roblox Display Name signature format`");
  }

  if ((DASigFormat & DASignatureFormats.RobloxUsername) === DASignatureFormats.RobloxUsername) {
    EnabledFeatures.push("`DA: Roblox Username signature format`");
  }

  return {
    HasConflict: EnabledFeatures.length > 0 && Config.require_authorization === false,
    EnabledFeatures,
    DisabledSetting: "Roblox Account Link Required",
  };
}

/**
 * Prompts a user to select a channel or thread destination through an interactive message component.
 *
 * @param RecInteract - The message component interaction that triggered the prompt
 * @param TargetConfig - The configuration key or identifier for the target destination
 * @param DestinationFor - A descriptive label for what the destination is being configured for
 * @param CurrentlyConfigured - Optional channel or thread Id that is currently configured as the destination
 *
 * @returns A promise that resolves to:
 *   - A channel or thread Id string if the user selects a destination
 *   - `null` if the user deselects/cancels the configuration
 *   - `undefined` if the prompt times out or an error occurs
 *
 * @remarks
 * - The prompt displays for 5 minutes (300,000 milliseconds) before timing out
 * - Users can respond by either:
 *   1. Clicking a button in the ephemeral prompt message (deselect to return `null`)
 *   2. Selecting a channel from the channel select menu
 *   3. Posting a message in a valid guild text channel or public thread that mentions the app and includes the unique identifier
 * - The prompt message is automatically deleted after a successful response
 * - Only text channels and public threads are valid destination types
 * - The user will receive a 👌 reaction confirmation on their message if the app has permission to add reactions
 */
export async function PromptChannelOrThreadSelection(
  RecInteract: MessageComponentInteraction<"cached">,
  TargetConfig: string,
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
  }).then((IR) => IR.resource!.message!);

  const MsgFormatFilter = (Msg: Message) => {
    const Channel = Msg.channel;
    if (!Channel.isSendable()) return false;
    if (Channel.isDMBased() || !Msg.inGuild()) return false;
    if (Msg.guildId !== RecInteract.guild.id) return false;
    if (Msg.author.id !== RecInteract.user.id) return false;
    if (!Msg.mentions.users.has(RecInteract.client.user.id)) return false;
    if (![ChannelType.GuildText, ChannelType.PublicThread].includes(Channel.type)) {
      return false;
    }
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

  const PromptResponses = [TimeoutAwaitedSelectPromise, PromptInteractResponse] as const;
  const Res = await Promise.race(PromptResponses).catch(() => undefined);

  for (const Response of PromptResponses) {
    if ("cancel" in Response && typeof Response.cancel === "function") {
      Response.cancel();
    }
  }

  if (Res instanceof Message) {
    return Res.channelId;
  }

  return Res;
}
