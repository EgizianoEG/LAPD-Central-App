/**
 * Shift Management Configuration module for the Config command.
 * Handles on-duty/on-break roles, log channels, and shift quota settings.
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
  FormatDuration,
  FilterUnsafeRoles,
  PromptChannelOrThreadSelection,
  PromptInteraction,
} from "./Shared.js";

import { Dedent } from "#Utilities/Strings/Formatters.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { ErrorContainer } from "#Utilities/Classes/ExtraContainers.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import ParseDuration from "parse-duration";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
export const ShiftManagementCTAIds = {
  ModuleEnabled: `${ConfigTopics.ShiftConfiguration}-me`,
  LogChannel: `${ConfigTopics.ShiftConfiguration}-lc`,
  OnDutyRoles: `${ConfigTopics.ShiftConfiguration}-odr`,
  OnBreakRoles: `${ConfigTopics.ShiftConfiguration}-obr`,
  ServerDefaultShiftQuota: `${ConfigTopics.ShiftConfiguration}-darq`,
} as const;

export const ShiftManagementExplanations = {
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
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetShiftModuleConfigComponents(
  Interaction: PromptInteraction<"cached">,
  ShiftModuleConfig: GuildSettings["shift_management"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${ShiftManagementCTAIds.ModuleEnabled}:${Interaction.user.id}`)
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
      .setCustomId(`${ShiftManagementCTAIds.OnDutyRoles}:${Interaction.user.id}`)
  );

  const OnBreakRolesAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setMinValues(0)
      .setMaxValues(3)
      .setPlaceholder("On-Break Role(s)")
      .setDefaultRoles(ShiftModuleConfig.role_assignment.on_break)
      .setCustomId(`${ShiftManagementCTAIds.OnBreakRoles}:${Interaction.user.id}`)
  );

  const LogChannelBtnAccessory = new ButtonBuilder()
    .setCustomId(`${ShiftManagementCTAIds.LogChannel}:${Interaction.user.id}`)
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary);

  const SetDefaultShiftQuotaBtnAccessory = new ButtonBuilder()
    .setLabel("Set Default Shift Quota")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${ShiftManagementCTAIds.ServerDefaultShiftQuota}:${Interaction.user.id}`);

  return [
    ModuleEnabledAR,
    OnDutyRolesAR,
    OnBreakRolesAR,
    LogChannelBtnAccessory,
    SetDefaultShiftQuotaBtnAccessory,
  ] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetShiftModuleConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
  ShiftModuleConfig: GuildSettings["shift_management"]
) {
  const ShiftModuleInteractComponents = GetShiftModuleConfigComponents(
    SelectInteract,
    ShiftModuleConfig
  );

  const ModuleTitleText = new TextDisplayBuilder().setContent(
    `### ${ShiftManagementExplanations.Title}`
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
          1. **${ShiftManagementExplanations.Settings[0].Name}**
          ${ShiftManagementExplanations.Settings[0].Description}
        `)
      )
    )
    .addActionRowComponents(ShiftModuleInteractComponents[0])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          2. **${ShiftManagementExplanations.Settings[1].Name}**
          ${ShiftManagementExplanations.Settings[1].Description}
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
              3. **${ShiftManagementExplanations.Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLogChannel}
              ${ShiftManagementExplanations.Settings[2].Description}
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
            4. **${ShiftManagementExplanations.Settings[3].Name}**
            **Currently Set:** ${ConfiguredDefaultServerQuota}
            ${ShiftManagementExplanations.Settings[3].Description}
          `)
          )
        )
        .setButtonAccessory(ShiftModuleInteractComponents[4])
    );

  return [Page_1, Page_2] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSShiftModuleContent(GuildSettings: GuildSettings): string {
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

// ---------------------------------------------------------------------------------------
// Shift Quota Handler:
// --------------------
export async function HandleDefaultShiftQuotaBtnInteract(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentQuota: number
): Promise<number> {
  const QuotaInputField = new TextInputBuilder()
    .setPlaceholder("e.g, 2h, 30m")
    .setCustomId("default_quota")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMinLength(2)
    .setMaxLength(20);

  const InputModal = new ModalBuilder()
    .setTitle("Default Shift Quota Duration")
    .setCustomId(ShiftManagementCTAIds.ServerDefaultShiftQuota + RandomString(4))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Default Quota")
        .setDescription("The server's default shift quota. Keep blank for none.")
        .setTextInputComponent(QuotaInputField)
    );

  if (CurrentQuota) {
    let FormattedDuration: string = FormatDuration(CurrentQuota);
    if (FormattedDuration.length > 20) {
      FormattedDuration = FormattedDuration.replace("and", "");
      if (FormattedDuration.length > 20) {
        FormattedDuration = FormattedDuration.replaceAll(/ ?week(s)?/g, "w")
          .replaceAll(/ ?year(s)?/g, "y")
          .replaceAll(/ ?month(s)?/g, "mo")
          .replaceAll(/ ?minute(s)?/g, "min")
          .replaceAll(/ ?second(s)?/g, "s")
          .replaceAll(/ ?hour(s)?/g, "h")
          .replaceAll(/ ?day(s)?/g, "d");
      }
    }

    FormattedDuration = FormattedDuration.length <= 20 ? FormattedDuration : "";
    if (FormattedDuration.length <= 20 && FormattedDuration.length > 0) {
      QuotaInputField.setValue(FormattedDuration);
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

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleShiftConfigSpecificInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["shift_management"]>
): Promise<boolean> {
  const ActionId = RecInteract.customId;
  const ModuleConfig = MState.ModuleConfig;

  if (RecInteract.isButton() && ActionId.startsWith(ShiftManagementCTAIds.LogChannel)) {
    const SelectedChannel = await PromptChannelOrThreadSelection(
      RecInteract,
      ShiftManagementCTAIds.LogChannel,
      "Shift Log",
      ModuleConfig.log_channel
    );

    if (SelectedChannel !== undefined) {
      ModuleConfig.log_channel = SelectedChannel;
      return true;
    }
  }

  if (
    RecInteract.isButton() &&
    ActionId.startsWith(ShiftManagementCTAIds.ServerDefaultShiftQuota)
  ) {
    const ResolvedQuotaMs = await HandleDefaultShiftQuotaBtnInteract(
      RecInteract,
      ModuleConfig.default_quota
    );

    if (ResolvedQuotaMs !== ModuleConfig.default_quota) {
      ModuleConfig.default_quota = ResolvedQuotaMs;
      return true;
    }
  }

  if (
    RecInteract.isStringSelectMenu() &&
    ActionId.startsWith(ShiftManagementCTAIds.ModuleEnabled)
  ) {
    ModuleConfig.enabled = RecInteract.values[0].toLowerCase() === "true";
  } else if (RecInteract.isRoleSelectMenu()) {
    if (ActionId.startsWith(ShiftManagementCTAIds.OnDutyRoles)) {
      ModuleConfig.role_assignment.on_duty = await FilterUnsafeRoles(
        RecInteract.guild,
        RecInteract.values
      );
    } else if (ActionId.startsWith(ShiftManagementCTAIds.OnBreakRoles)) {
      ModuleConfig.role_assignment.on_break = await FilterUnsafeRoles(
        RecInteract.guild,
        RecInteract.values
      );
    }

    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleShiftModuleDBSave(
  Interaction: PromptInteraction<"cached">,
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
