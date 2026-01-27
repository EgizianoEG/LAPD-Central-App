/**
 * Leave of Absence Configuration module for the Config command.
 * Handles leave role, alert roles, requests channel, and log settings.
 */

import {
  roleMention,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  ButtonBuilder,
  channelMention,
  SectionBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  TextInputBuilder,
  ButtonInteraction,
  TextDisplayBuilder,
  CollectedInteraction,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import {
  AccentColor,
  ModuleState,
  ConfigTopics,
  GuildSettings,
  ListFormatter,
  FilterUnsafeRoles,
  PromptInteraction,
  PromptChannelOrThreadSelection,
} from "./Shared.js";

import { Dedent } from "#Utilities/Strings/Formatters.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { FilterUserInput } from "#Utilities/Strings/Redactor.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const LeaveOfAbsenceCTAIds = {
  ModuleEnabled: `${ConfigTopics.LeaveConfiguration}-me`,
  RequestsChannel: `${ConfigTopics.LeaveConfiguration}-rc`,
  LogChannel: `${ConfigTopics.LeaveConfiguration}-lc`,
  OnLeaveRole: `${ConfigTopics.LeaveConfiguration}-olr`,
  AlertRoles: `${ConfigTopics.LeaveConfiguration}-ar`,
  ActivePrefix: `${ConfigTopics.LeaveConfiguration}-ap`,
} as const;

export const LeaveOfAbsenceExplanations = {
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
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetLeaveModuleConfigComponents(
  Interaction: PromptInteraction<"cached">,
  LeaveNoticesConfig: GuildSettings["leave_notices"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${LeaveOfAbsenceCTAIds.ModuleEnabled}:${Interaction.user.id}`)
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
      .setCustomId(`${LeaveOfAbsenceCTAIds.OnLeaveRole}:${Interaction.user.id}`)
      .setDefaultRoles(LeaveNoticesConfig.leave_role ? [LeaveNoticesConfig.leave_role] : [])
      .setPlaceholder("On-Leave Role")
      .setMinValues(0)
      .setMaxValues(1)
  );

  const AlertRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${LeaveOfAbsenceCTAIds.AlertRoles}:${Interaction.user.id}`)
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
    .setCustomId(`${LeaveOfAbsenceCTAIds.ActivePrefix}:${Interaction.user.id}`);

  const RequestsDestAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Requests Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${LeaveOfAbsenceCTAIds.RequestsChannel}:${Interaction.user.id}`);

  const LogDestAccessoryCAButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${LeaveOfAbsenceCTAIds.LogChannel}:${Interaction.user.id}`);

  return [
    ModuleEnabledAR,
    OnLeaveRoleAR,
    AlertRolesAR,
    ActivePrefixAccessoryBtn,
    RequestsDestAccessoryBtn,
    LogDestAccessoryCAButton,
  ] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetLeaveModuleConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
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
    `### ${LeaveOfAbsenceExplanations.Title}`
  );

  const Page_1 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${LeaveOfAbsenceExplanations.Settings[0].Name}**
          ${LeaveOfAbsenceExplanations.Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(LeaveModuleInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${LeaveOfAbsenceExplanations.Settings[1].Name}**
          ${LeaveOfAbsenceExplanations.Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(LeaveModuleInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${LeaveOfAbsenceExplanations.Settings[2].Name}**
          ${LeaveOfAbsenceExplanations.Settings[2].Description}
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
              4. **${LeaveOfAbsenceExplanations.Settings[3].Name}**
              **Currently Configured:** ${ActivePrefixConfigured}
              ${LeaveOfAbsenceExplanations.Settings[3].Description}
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
              5. **${LeaveOfAbsenceExplanations.Settings[4].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${LeaveOfAbsenceExplanations.Settings[4].Description}
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
              6. **${LeaveOfAbsenceExplanations.Settings[5].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${LeaveOfAbsenceExplanations.Settings[5].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSLeaveNoticesContent(GuildSettings: GuildSettings): string {
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

// ---------------------------------------------------------------------------------------
// Active Prefix Handler:
// ----------------------
export async function HandleUANActivePrefixBtnInteract(
  RecInteract: ButtonInteraction<"cached">,
  MState: ModuleState<GuildSettings["leave_notices"] | GuildSettings["reduced_activity"]>
): Promise<boolean> {
  const ModuleId = MState.ConfigTopic as
    | ConfigTopics.LeaveConfiguration
    | ConfigTopics.ReducedActivityConfiguration;

  const ModuleTitle =
    ModuleId === ConfigTopics.LeaveConfiguration ? "Leave of Absence" : "Reduced Activity";

  const PrefixInputField = new TextInputBuilder()
    .setCustomId("prefix")
    .setPlaceholder('Enter prefix here, use "%s" for trailing space(s)...')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(10)
    .setMinLength(2);

  const InputModal = new ModalBuilder()
    .setTitle("Set Active Prefix")
    .setCustomId(
      `${LeaveOfAbsenceCTAIds.ActivePrefix}-input:${RecInteract.user.id}:${RandomString(4)}`
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(`Active ${ModuleTitle} Prefix`)
        .setDescription(
          `The nickname prefix to use when staff go on active ${ModuleTitle.toLowerCase()}; leave empty for none.`
        )
        .setTextInputComponent(PrefixInputField)
    );

  if (MState.ModuleConfig.active_prefix) {
    PrefixInputField.setValue(MState.ModuleConfig.active_prefix.replace(/ $/, "%s"));
  }

  const Submission = await ShowModalAndAwaitSubmission(RecInteract, InputModal);
  let InputPrefix = Submission?.fields.getTextInputValue("prefix") || null;
  InputPrefix =
    InputPrefix?.replaceAll(/(?<!\\)%s/g, " ")
      .trimStart()
      .slice(0, 8) ?? null;

  if (!Submission) return false;
  if (InputPrefix === null || InputPrefix.length < 2) {
    MState.ModuleConfig.active_prefix = null;
    Submission.deferUpdate().catch(() => null);
    return true;
  }

  const GuildSettingsData = await GetGuildSettings(RecInteract.guildId);
  const FilteredPrefix = await FilterUserInput(InputPrefix, {
    guild_instance: RecInteract.guild,
    filter_links_emails: true,
    utif_setting_enabled: GuildSettingsData?.utif_enabled,
  });

  MState.ModuleConfig.active_prefix = FilteredPrefix;
  Submission?.deferUpdate().catch(() => null);

  return true;
}

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleLeaveConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["leave_notices"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;
  const ModuleConfig = MState.ModuleConfig;

  if (RecInteract.isButton()) {
    if (ActionId.startsWith(LeaveOfAbsenceCTAIds.LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        LeaveOfAbsenceCTAIds.LogChannel,
        "Leave Event Log",
        ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(LeaveOfAbsenceCTAIds.RequestsChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        LeaveOfAbsenceCTAIds.RequestsChannel,
        "Leave Requests",
        ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(LeaveOfAbsenceCTAIds.ActivePrefix)) {
      return HandleUANActivePrefixBtnInteract(RecInteract, MState);
    }
  }

  if (RecInteract.isStringSelectMenu() && ActionId.startsWith(LeaveOfAbsenceCTAIds.ModuleEnabled)) {
    ModuleConfig.enabled = RecInteract.values[0] === "true";
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(LeaveOfAbsenceCTAIds.OnLeaveRole)
  ) {
    const LeaveRole = await FilterUnsafeRoles(RecInteract.guild, [RecInteract.values[0]]);
    ModuleConfig.leave_role = LeaveRole[0] || null;
    if (RecInteract.values[0]?.length) return true;
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(LeaveOfAbsenceCTAIds.AlertRoles)
  ) {
    ModuleConfig.alert_roles = RecInteract.values;
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleLeaveModuleDBSave(
  Interaction: PromptInteraction<"cached">,
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
