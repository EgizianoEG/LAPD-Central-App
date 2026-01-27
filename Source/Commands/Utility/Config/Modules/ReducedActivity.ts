/**
 * Reduced Activity Configuration module for the Config command.
 * Handles RA role, alert roles, requests channel, and log settings.
 */

import {
  roleMention,
  ButtonStyle,
  ButtonBuilder,
  channelMention,
  SectionBuilder,
  ActionRowBuilder,
  SeparatorBuilder,
  ContainerBuilder,
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

import { HandleUANActivePrefixBtnInteract } from "./LeaveOfAbsence.js";
import { Dedent } from "#Utilities/Strings/Formatters.js";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const ReducedActivityCTAIds = {
  ModuleEnabled: `${ConfigTopics.ReducedActivityConfiguration}-me`,
  RequestsChannel: `${ConfigTopics.ReducedActivityConfiguration}-rc`,
  LogChannel: `${ConfigTopics.ReducedActivityConfiguration}-lc`,
  RARole: `${ConfigTopics.ReducedActivityConfiguration}-rar`,
  AlertRoles: `${ConfigTopics.ReducedActivityConfiguration}-ar`,
  ActivePrefix: `${ConfigTopics.ReducedActivityConfiguration}-ap`,
} as const;

export const ReducedActivityExplanations = {
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
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetReducedActivityModuleConfigComponents(
  Interaction: PromptInteraction<"cached">,
  ReducedActivityConfig: GuildSettings["reduced_activity"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${ReducedActivityCTAIds.ModuleEnabled}:${Interaction.user.id}`)
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
      .setCustomId(`${ReducedActivityCTAIds.RARole}:${Interaction.user.id}`)
      .setDefaultRoles(ReducedActivityConfig.ra_role ? [ReducedActivityConfig.ra_role] : [])
      .setPlaceholder("Reduced Activity Role")
      .setMinValues(0)
      .setMaxValues(1)
  );

  const AlertRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${ReducedActivityCTAIds.AlertRoles}:${Interaction.user.id}`)
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
    .setCustomId(`${ReducedActivityCTAIds.ActivePrefix}:${Interaction.user.id}`);

  const RequestsDestinationButton = new ButtonBuilder()
    .setLabel("Set Requests Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${ReducedActivityCTAIds.RequestsChannel}:${Interaction.user.id}`);

  const LogDestAccessoryButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${ReducedActivityCTAIds.LogChannel}:${Interaction.user.id}`);

  return [
    ModuleEnabledAR,
    RARoleAR,
    AlertRolesAR,
    ActivePrefixAccessoryBtn,
    RequestsDestinationButton,
    LogDestAccessoryButton,
  ] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetReducedActivityModuleConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
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
    `### ${ReducedActivityExplanations.Title}`
  );

  const Page_1 = new ContainerBuilder()
    .setId(4)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(ModuleTitleText)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${ReducedActivityExplanations.Settings[0].Name}**
          ${ReducedActivityExplanations.Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(ReducedActivityInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ReducedActivityExplanations.Settings[1].Name}**
          ${ReducedActivityExplanations.Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(ReducedActivityInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${ReducedActivityExplanations.Settings[2].Name}**
          ${ReducedActivityExplanations.Settings[2].Description}
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
              4. **${ReducedActivityExplanations.Settings[3].Name}**
              **Currently Configured:** ${ActivePrefixConfigured}
              ${ReducedActivityExplanations.Settings[3].Description}
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
              5. **${ReducedActivityExplanations.Settings[4].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Requests}
              ${ReducedActivityExplanations.Settings[4].Description}
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
              6. **${ReducedActivityExplanations.Settings[5].Name}**
              **Currently Configured:** ${CurrentlyConfiguredChannels.Log}
              ${ReducedActivityExplanations.Settings[5].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSReducedActivityContent(GuildSettings: GuildSettings): string {
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

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleReducedActivityConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["reduced_activity"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;
  const ModuleConfig = MState.ModuleConfig;

  if (RecInteract.isButton()) {
    if (ActionId.startsWith(ReducedActivityCTAIds.LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        ReducedActivityCTAIds.LogChannel,
        "Reduced Activity Event Logs",
        ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(ReducedActivityCTAIds.RequestsChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        ReducedActivityCTAIds.RequestsChannel,
        "Reduced Activity Requests",
        ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    } else if (ActionId.startsWith(ReducedActivityCTAIds.ActivePrefix)) {
      return HandleUANActivePrefixBtnInteract(RecInteract, MState);
    }
  }

  if (
    RecInteract.isStringSelectMenu() &&
    ActionId.startsWith(ReducedActivityCTAIds.ModuleEnabled)
  ) {
    ModuleConfig.enabled = RecInteract.values[0].toLowerCase() === "true";
  } else if (RecInteract.isRoleSelectMenu() && ActionId.startsWith(ReducedActivityCTAIds.RARole)) {
    const RARole = await FilterUnsafeRoles(RecInteract.guild, [RecInteract.values[0]]);
    ModuleConfig.ra_role = RARole[0] || null;
    if (RecInteract.values[0]?.length) return true;
  } else if (
    RecInteract.isRoleSelectMenu() &&
    ActionId.startsWith(ReducedActivityCTAIds.AlertRoles)
  ) {
    ModuleConfig.alert_roles = RecInteract.values;
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleReducedActivityModuleDBSave(
  Interaction: PromptInteraction<"cached">,
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
