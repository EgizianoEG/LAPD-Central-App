/**
 * Additional Configuration module for the Config command.
 * Handles log deletion interval and user text input filtering settings.
 */

import {
  ActionRowBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  CollectedInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import {
  PromptInteraction,
  GetHumanReadableLogDeletionInterval,
  AccentColor,
  MillisInDay,
  ModuleState,
  ConfigTopics,
  GuildSettings,
} from "./Shared.js";

import { clone } from "remeda";
import { Dedent } from "#Utilities/Strings/Formatters.js";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const AdditionalConfigCTAIds = {
  DActivitiesDeletionInterval: `${ConfigTopics.AdditionalConfiguration}-dadi`,
  UserTextInputFilteringEnabled: `${ConfigTopics.AdditionalConfiguration}-utfe`,
} as const;

export const AdditionalConfigExplanations = {
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
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetAdditionalConfigComponents(
  Interaction: PromptInteraction<"cached">,
  GuildConfig: GuildSettings
) {
  const SetIntervalInDays = Math.round(
    GuildConfig.duty_activities.log_deletion_interval / MillisInDay
  );
  const LogDelIntervalSMAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Log Deletion Interval")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${AdditionalConfigCTAIds.DActivitiesDeletionInterval}:${Interaction.user.id}`)
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
      .setCustomId(`${AdditionalConfigCTAIds.UserTextInputFilteringEnabled}:${Interaction.user.id}`)
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

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetAdditionalConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
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
      new TextDisplayBuilder().setContent(`### ${AdditionalConfigExplanations.Title}`),
      new TextDisplayBuilder().setContent(
        Dedent(`
          1. **${AdditionalConfigExplanations.Settings[0].Name}**
          ${AdditionalConfigExplanations.Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(AdditionalConfigInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${AdditionalConfigExplanations.Settings[1].Name}**
          ${AdditionalConfigExplanations.Settings[1].Description}
        `)
      )
    )
    .addActionRowComponents(AdditionalConfigInteractComponents[1]);

  return [Page_1] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSAdditionalConfigContent(GuildSettings: GuildSettings): string {
  return Dedent(`
    >>> **Log Deletion Interval:** ${GetHumanReadableLogDeletionInterval(GuildSettings.duty_activities.log_deletion_interval)}
    **User Text Input Filtering:** ${GuildSettings.utif_enabled ? "Enabled" : "Disabled"}
  `);
}

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleAdditionalConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<boolean> {
  const CustomId = RecInteract.customId;

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(AdditionalConfigCTAIds.DActivitiesDeletionInterval)
  ) {
    MState.ModuleConfig.duty_activities.log_deletion_interval =
      (Number.parseInt(RecInteract.values[0]) || 0) * MillisInDay;
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(AdditionalConfigCTAIds.UserTextInputFilteringEnabled)
  ) {
    MState.ModuleConfig.utif_enabled = RecInteract.values[0].toLowerCase() === "true";
  }

  if (!RecInteract.deferred && !RecInteract.replied) {
    RecInteract.deferUpdate().catch(() => null);
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleAdditionalConfigDBSave(
  Interaction: PromptInteraction<"cached">,
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
