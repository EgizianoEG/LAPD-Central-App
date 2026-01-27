/**
 * Basic Configuration module for the Config command.
 * Handles staff roles, management roles, and Roblox authorization settings.
 */

import {
  roleMention,
  ActionRowBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  PermissionFlagsBits,
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
  PromptInteraction,
  ConfigHasRobloxDependencyConflict,
} from "./Shared.js";

import { ErrorContainer, WarnContainer } from "#Utilities/Classes/ExtraContainers.js";
import { Dedent } from "#Utilities/Strings/Formatters.js";
import { clone } from "remeda";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const BasicConfigCTAIds = {
  RobloxAuthRequired: `${ConfigTopics.BasicConfiguration}-rar`,
  StaffRoles: `${ConfigTopics.BasicConfiguration}-sr`,
  MgmtRoles: `${ConfigTopics.BasicConfiguration}-mr`,
} as const;

export const BasicConfigExplanations = {
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
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetBasicConfigComponents(
  Interaction: PromptInteraction<"cached">,
  GuildConfig: GuildSettings
) {
  const RobloxAuthorizationAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Roblox Authorization Required")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${BasicConfigCTAIds.RobloxAuthRequired}:${Interaction.user.id}`)
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
      .setCustomId(`${BasicConfigCTAIds.StaffRoles}:${Interaction.user.id}`)
      .setDefaultRoles(GuildConfig.role_perms.staff)
      .setPlaceholder("Staff Roles")
      .setMinValues(0)
      .setMaxValues(10)
  );

  const ManagementRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${BasicConfigCTAIds.MgmtRoles}:${Interaction.user.id}`)
      .setDefaultRoles(GuildConfig.role_perms.management)
      .setPlaceholder("Management Roles")
      .setMinValues(0)
      .setMaxValues(10)
  );

  return [RobloxAuthorizationAR, StaffRolesAR, ManagementRolesAR] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetBasicConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
  GuildSettings: GuildSettings
) {
  const BasicConfigInteractComponents = GetBasicConfigComponents(SelectInteract, GuildSettings);
  const Page_1 = new ContainerBuilder()
    .setId(1)
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${BasicConfigExplanations.Title}`),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${BasicConfigExplanations.Settings[0].Name}**
          ${BasicConfigExplanations.Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${BasicConfigExplanations.Settings[1].Name}**
          ${BasicConfigExplanations.Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[1])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          3. **${BasicConfigExplanations.Settings[2].Name}**
          ${BasicConfigExplanations.Settings[2].Description}
        `)
      )
    )
    .addActionRowComponents(BasicConfigInteractComponents[2]);

  return [Page_1] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSBasicSettingsContent(GuildSettings: GuildSettings): string {
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

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleBasicConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<boolean> {
  if (RecInteract.isRoleSelectMenu()) {
    if (RecInteract.customId.startsWith(BasicConfigCTAIds.StaffRoles)) {
      MState.ModuleConfig.role_perms.staff = RecInteract.values.filter(
        (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
      );
    } else if (RecInteract.customId.startsWith(BasicConfigCTAIds.MgmtRoles)) {
      MState.ModuleConfig.role_perms.management = RecInteract.values.filter(
        (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
      );
    }

    return true;
  } else if (
    RecInteract.isStringSelectMenu() &&
    RecInteract.customId.startsWith(BasicConfigCTAIds.RobloxAuthRequired)
  ) {
    const ShouldActivate = RecInteract.values[0] === "true";
    const TempClone = clone(MState.ModuleConfig);
    TempClone.require_authorization = ShouldActivate;

    if (ConfigHasRobloxDependencyConflict(TempClone)) {
      await new ErrorContainer()
        .useErrTemplate("RobloxDependentFeatureSettingConflict")
        .replyToInteract(RecInteract, true, true, "followUp")
        .catch(() => null);
      return true;
    }

    MState.ModuleConfig.require_authorization = ShouldActivate;
    RecInteract.deferUpdate().catch(() => null);
    return false;
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleBasicConfigDBSave(
  Interaction: PromptInteraction<"cached">,
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

  if (ConfigHasRobloxDependencyConflict(MState.ModuleConfig)) {
    return new ErrorContainer()
      .useErrTemplate("RobloxDependentFeatureSettingConflict")
      .replyToInteract(Interaction, true, true, "reply")
      .then(() => "");
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
