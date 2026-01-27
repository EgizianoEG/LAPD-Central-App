/**
 * Duty Activities Configuration module for the Config command.
 * Handles log channels, signature format, and other duty activity settings.
 */

import {
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
  PermissionFlagsBits,
  CollectedInteraction,
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
  PromptChannelOrThreadSelection,
  ConfigHasRobloxDependencyConflict,
} from "./Shared.js";

import { clone } from "remeda";
import { Dedent } from "#Utilities/Strings/Formatters.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { ErrorContainer } from "#Utilities/Classes/ExtraContainers.js";
import { DASignatureFormats, SignatureFormatResolved } from "#Config/Constants.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import GuildModel from "#Models/Guild.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
const ICEnabled = "`Enabled`";
const ICDisabled = "`Disabled`";

export const DutyActivitiesCTAIds = {
  ModuleEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-me`,
  CitationLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-clc`,
  ArrestLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-alc`,

  IncidentLogLocalChannel: `${ConfigTopics.DutyActivitiesConfiguration}-ilc`,
  OutsideCitationLogChannel: `${ConfigTopics.DutyActivitiesConfiguration}-oclc`,
  OutsideArrestLogChannel: `${ConfigTopics.DutyActivitiesConfiguration}-oalc`,

  SignatureFormatType: `${ConfigTopics.AdditionalConfiguration}-dasf`,
  ArrestReportsImgHeaderEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-ar-hdr`,
  IncReportsAutoThreadsMgmtEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-ir-atm`,
  CACodesAutoAnnotationEnabled: `${ConfigTopics.DutyActivitiesConfiguration}-cc-aca`,
} as const;

export const DutyActivitiesExplanations = {
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
    {
      Name: "California Codes Auto-Annotation",
      Description:
        "When enabled, the app will attempt to detect and annotate California Vehicle Codes in citations and Penal Codes in arrest charges, and will attempt to remove any redundant code descriptions entered by staff. " +
        "This option does not affect the current behavior of enforcing structured format; i.e. ordered list of charges or violations.",
    },
  ],
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetDutyActModuleConfigComponents(
  Interaction: PromptInteraction<"cached">,
  DActivitiesConfig: GuildSettings["duty_activities"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${DutyActivitiesCTAIds.ModuleEnabled}:${Interaction.user.id}`)
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
    .setCustomId(`${DutyActivitiesCTAIds.CitationLogLocalChannel}:${Interaction.user.id}`);

  const LocalArrestsLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Arrest Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${DutyActivitiesCTAIds.ArrestLogLocalChannel}:${Interaction.user.id}`);

  const IncidentLogChannelBtn = new ButtonBuilder()
    .setLabel("Set Incident Reports Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${DutyActivitiesCTAIds.IncidentLogLocalChannel}:${Interaction.user.id}`);

  const SetOutsideLogChannelBtns = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Set Outside Citation Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${DutyActivitiesCTAIds.OutsideCitationLogChannel}:${Interaction.user.id}`),
    new ButtonBuilder()
      .setLabel("Set Outside Arrest Log Channel")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${DutyActivitiesCTAIds.OutsideArrestLogChannel}:${Interaction.user.id}`)
  );

  const SignatureFormatAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Signature Format")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${DutyActivitiesCTAIds.SignatureFormatType}:${Interaction.user.id}`)
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
        .setCustomId(`${DutyActivitiesCTAIds.ArrestReportsImgHeaderEnabled}:${Interaction.user.id}`)
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
          `${DutyActivitiesCTAIds.IncReportsAutoThreadsMgmtEnabled}:${Interaction.user.id}`
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

  const AutoCACodesAnnotationEnabledAR =
    new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
      new StringSelectMenuBuilder()
        .setPlaceholder("California Codes Auto-Annotation Enabled/Disabled")
        .setMinValues(1)
        .setMaxValues(1)
        .setCustomId(`${DutyActivitiesCTAIds.CACodesAutoAnnotationEnabled}:${Interaction.user.id}`)
        .setOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("Enabled")
            .setValue("true")
            .setDescription("Enable automatic code assignment.")
            .setDefault(DActivitiesConfig.auto_annotate_ca_codes),
          new StringSelectMenuOptionBuilder()
            .setLabel("Disabled")
            .setValue("false")
            .setDescription("Disable automatic code assignment.")
            .setDefault(!DActivitiesConfig.auto_annotate_ca_codes)
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
    AutoCACodesAnnotationEnabledAR,
  ] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetDutyActivitiesModuleConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
  AllConfig: GuildSettings
) {
  const DAModuleConfig = AllConfig.duty_activities;
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
    `### ${DutyActivitiesExplanations.Title}`
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
          1. **${DutyActivitiesExplanations.Settings[0].Name}**
          ${DutyActivitiesExplanations.Settings[0].Description}
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
              2. **${DutyActivitiesExplanations.Settings[1].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.CitationLog}
              ${DutyActivitiesExplanations.Settings[1].Description}
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
              3. **${DutyActivitiesExplanations.Settings[2].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.ArrestLog}
              ${DutyActivitiesExplanations.Settings[2].Description}
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
              4. **${DutyActivitiesExplanations.Settings[3].Name}**
              **Currently Configured:** ${CurrentlyConfiguredLocalChannels.IncidentLog}
              ${DutyActivitiesExplanations.Settings[3].Description}
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
          5. **${DutyActivitiesExplanations.Settings[4].Name}**
          ${DutyActivitiesExplanations.Settings[4].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[4])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          6. **${DutyActivitiesExplanations.Settings[5].Name}**
          ${DutyActivitiesExplanations.Settings[5].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[5])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          7. **${DutyActivitiesExplanations.Settings[6].Name}**
          ${DutyActivitiesExplanations.Settings[6].Description}
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
          8. **${DutyActivitiesExplanations.Settings[7].Name}**
          ${DutyActivitiesExplanations.Settings[7].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[7])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          9. **${DutyActivitiesExplanations.Settings[8].Name}**
          ${DutyActivitiesExplanations.Settings[8].Description}
        `)
      )
    )
    .addActionRowComponents(DutyActivitiesInteractComponents[8]);

  return [Page_1, Page_2, Page_3] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSDutyActivitiesContent(GuildSettings: GuildSettings): string {
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
    **Auto-Annotate CA Codes:** ${GuildSettings.duty_activities.auto_annotate_ca_codes ? ICEnabled : ICDisabled}
    **Arrest Reports P&S Header Image:** ${GuildSettings.duty_activities.arrest_reports.show_header_img ? ICEnabled : ICDisabled}
    **Inc. Reports Auto Thread Management:** ${GuildSettings.duty_activities.incident_reports.auto_thread_management ? ICEnabled : ICDisabled}
    **Signature Format:** \`${SignatureFormatResolved[GuildSettings.duty_activities.signature_format]}\`
    **Incident Log Channel:** ${IncidentLogChannel}
    **Citation Log Channel${CitationLogChannels.length > 1 ? "s" : ""}:** 
    ${CitationLogChannels.length ? ListFormatter.format(CitationLogChannels) : "*None*"}
    **Arrest Log Channel${ArrestLogChannels.length > 1 ? "s" : ""}:** 
    ${ArrestLogChannels.length ? ListFormatter.format(ArrestLogChannels) : "*None*"}
  `);
}

// ---------------------------------------------------------------------------------------
// Outside Log Channel Handler:
// ----------------------------
export async function HandleOutsideLogChannelBtnInteracts(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentLogChannels: string[]
): Promise<null | undefined | string> {
  const CurrLogChannel = CurrentLogChannels.find((C) => C.includes(":"));
  const LogChannelTopic = BtnInteract.customId.startsWith(
    DutyActivitiesCTAIds.OutsideArrestLogChannel
  )
    ? "Arrest Reports"
    : "Citation Logs";

  const ChannelInputField = new TextInputBuilder()
    .setPlaceholder("ServerID:ChannelID")
    .setCustomId("channel_id")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMinLength(31)
    .setMaxLength(45);

  const InputModal = new ModalBuilder()
    .setTitle(`Outside Log Channel - ${LogChannelTopic}`)
    .setCustomId(`${BtnInteract.customId}:${RandomString(4)}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Channel")
        .setDescription("The channel in the format: ServerID:ChannelID")
        .setTextInputComponent(ChannelInputField)
    );

  if (CurrLogChannel) {
    ChannelInputField.setValue(CurrLogChannel);
  }

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

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleDutyActivitiesConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<boolean> {
  const ModuleConfig = MState.ModuleConfig.duty_activities;
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
    if (CustomId.startsWith(DutyActivitiesCTAIds.OutsideArrestLogChannel)) {
      ModuleConfig.log_channels.arrests = await HandleOutsideLogChannelSet(
        RecInteract,
        ModuleConfig.log_channels.arrests
      );
    }

    if (CustomId.startsWith(DutyActivitiesCTAIds.OutsideCitationLogChannel)) {
      ModuleConfig.log_channels.citations = await HandleOutsideLogChannelSet(
        RecInteract,
        ModuleConfig.log_channels.citations
      );
    }

    if (CustomId.startsWith(DutyActivitiesCTAIds.ArrestLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        DutyActivitiesCTAIds.ArrestLogLocalChannel,
        "Arrest Reports",
        ModuleConfig.log_channels.arrests.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return false;
      if (ModuleConfig.log_channels.arrests.length) {
        const ExistingChannelIndex = ModuleConfig.log_channels.arrests.findIndex(
          (C) => !C.includes(":")
        );
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          ModuleConfig.log_channels.arrests.push(SelectedChannel);
        } else if (SelectedChannel) {
          ModuleConfig.log_channels.arrests[ExistingChannelIndex] = SelectedChannel;
        } else {
          ModuleConfig.log_channels.arrests = ModuleConfig.log_channels.arrests.filter(
            (C) => C !== ModuleConfig.log_channels.arrests[ExistingChannelIndex]
          );
        }
      } else if (SelectedChannel) {
        ModuleConfig.log_channels.arrests = [SelectedChannel];
      }

      return SelectedChannel !== undefined;
    }

    if (CustomId.startsWith(DutyActivitiesCTAIds.CitationLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        DutyActivitiesCTAIds.CitationLogLocalChannel,
        "Citation Log",
        ModuleConfig.log_channels.citations.find((C) => !C.includes(":")) || null
      );

      if (SelectedChannel === undefined) return false;
      if (ModuleConfig.log_channels.citations.length) {
        const ExistingChannelIndex = ModuleConfig.log_channels.citations.findIndex(
          (C) => !C.includes(":")
        );
        if (ExistingChannelIndex === -1 && SelectedChannel) {
          ModuleConfig.log_channels.citations.push(SelectedChannel);
        } else if (SelectedChannel) {
          ModuleConfig.log_channels.citations[ExistingChannelIndex] = SelectedChannel;
        } else {
          ModuleConfig.log_channels.citations = ModuleConfig.log_channels.citations.filter(
            (C) => C !== ModuleConfig.log_channels.citations[ExistingChannelIndex]
          );
        }
      } else if (SelectedChannel) {
        ModuleConfig.log_channels.citations = [SelectedChannel];
      }

      return SelectedChannel !== undefined;
    }

    if (CustomId.startsWith(DutyActivitiesCTAIds.IncidentLogLocalChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        DutyActivitiesCTAIds.IncidentLogLocalChannel,
        "Incident Reports",
        ModuleConfig.log_channels.incidents
      );

      if (SelectedChannel !== undefined) {
        ModuleConfig.log_channels.incidents = SelectedChannel;
        return true;
      }
    }

    return false;
  }

  if (!RecInteract.isStringSelectMenu()) return false;
  if (CustomId.startsWith(DutyActivitiesCTAIds.ModuleEnabled)) {
    ModuleConfig.enabled = RecInteract.values[0] === "true";
  } else if (CustomId.startsWith(DutyActivitiesCTAIds.SignatureFormatType)) {
    const SignatureFormat = Number.parseInt(RecInteract.values[0]);
    const TempClone = clone(MState.ModuleConfig);
    TempClone.duty_activities.signature_format = SignatureFormat;

    if (ConfigHasRobloxDependencyConflict(TempClone)) {
      await new ErrorContainer()
        .useErrTemplate("RobloxAuthRequiredSettingDisabled")
        .replyToInteract(RecInteract, true);
      return true;
    }

    ModuleConfig.signature_format = Number.parseInt(RecInteract.values[0]);
  } else if (CustomId.startsWith(DutyActivitiesCTAIds.ArrestReportsImgHeaderEnabled)) {
    ModuleConfig.arrest_reports.show_header_img = RecInteract.values[0] === "true";
  } else if (CustomId.startsWith(DutyActivitiesCTAIds.IncReportsAutoThreadsMgmtEnabled)) {
    ModuleConfig.incident_reports.auto_thread_management = RecInteract.values[0] === "true";
  } else if (CustomId.startsWith(DutyActivitiesCTAIds.CACodesAutoAnnotationEnabled)) {
    ModuleConfig.auto_annotate_ca_codes = RecInteract.values[0] === "true";
  }

  RecInteract.deferUpdate().catch(() => null);
  return false;
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleDutyActivitiesModuleDBSave(
  Interaction: PromptInteraction<"cached">,
  MState: ModuleState<GuildSettings>
): Promise<string | null> {
  const MConfig = MState.ModuleConfig.duty_activities;
  const UpdatedSettings = await GuildModel.findByIdAndUpdate(
    Interaction.guildId,
    {
      $set: {
        "settings.duty_activities.enabled": MConfig.enabled,
        "settings.duty_activities.signature_format": MConfig.signature_format,
        "settings.duty_activities.auto_annotate_ca_codes": MConfig.auto_annotate_ca_codes,
        "settings.duty_activities.log_channels.incidents": MConfig.log_channels.incidents,
        "settings.duty_activities.log_channels.citations": MConfig.log_channels.citations,
        "settings.duty_activities.log_channels.arrests": MConfig.log_channels.arrests,
        "settings.duty_activities.incident_reports.auto_thread_management":
          MConfig.incident_reports.auto_thread_management,
        "settings.duty_activities.arrest_reports.show_header_img":
          MConfig.arrest_reports.show_header_img,
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

    const UpdatedDASettings = UpdatedSettings.duty_activities;
    const ARSetChannels = UpdatedDASettings.log_channels.arrests.map((CI) =>
      channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
    );

    const CLSetChannels = UpdatedDASettings.log_channels.citations.map((CI) =>
      channelMention(CI.match(/:?(\d+)$/)?.[1] || "0")
    );

    const ILSetChannel = UpdatedDASettings.log_channels.incidents
      ? channelMention(UpdatedDASettings.log_channels.incidents)
      : "*None*";

    return Dedent(`
      Successfully set/updated the app's duty activities module configuration.
      
      **Current Configuration:**
      **General:**
      > - **Module Enabled:** ${UpdatedDASettings.enabled ? "Yes" : "No"}
      > - **Signature Format:** \`${SignatureFormatResolved[UpdatedDASettings.signature_format]}\`
      > - **Inc. Reports Auto Thread Management:** ${UpdatedDASettings.incident_reports.auto_thread_management ? ICEnabled : ICDisabled}
      > - **Arrest Reports P&S Header Image:** ${UpdatedDASettings.arrest_reports.show_header_img ? ICEnabled : ICDisabled}
      > - **Auto-Annotate CA Codes:** ${UpdatedDASettings.auto_annotate_ca_codes ? ICEnabled : ICDisabled}

      **Log Destinations:**
      > - **Incident Log:** ${ILSetChannel}
      > - **Citation Log:** ${CLSetChannels.length ? ListFormatter.format(CLSetChannels) : "*None*"}
      > - **Arrest Log:** ${ARSetChannels.length ? ListFormatter.format(ARSetChannels) : "*None*"}
    `);
  } else {
    return null;
  }
}
