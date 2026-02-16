/**
 * Call Signs Configuration module for the Config command.
 * Handles call sign module settings including requests, logs, and restrictions.
 */

import {
  roleMention,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  MessageFlags,
  resolveColor,
  ButtonBuilder,
  ComponentType,
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
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import {
  FileLabel,
  AccentColor,
  ModuleState,
  ConfigTopics,
  GuildSettings,
  ListFormatter,
  PromptInteraction,
  PromptChannelOrThreadSelection,
} from "./Shared.js";

import {
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
  BaseExtraContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import { ConcatenateLines, Dedent } from "#Utilities/Strings/Formatters.js";
import { isValidObjectId, Types } from "mongoose";
import { ServiceUnitTypes } from "#Resources/LAPDCallsigns.js";
import { FilterUserInput } from "#Utilities/Strings/Redactor.js";
import { ArraysAreEqual } from "#Utilities/Helpers/ArraysAreEqual.js";
import { ListSplitRegex } from "#Resources/RegularExpressions.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { Colors } from "#Config/Shared.js";
import { clone } from "remeda";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import HandlePagePagination from "#Utilities/Discord/HandlePagePagination.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import Chunks from "#Utilities/Helpers/SliceIntoChunks.js";

// ---------------------------------------------------------------------------------------
// Constants & Types:
// ------------------
const SUnitTypeLabels = new Set(ServiceUnitTypes.map((t) => t.unit));
const UnitTypeLabel = "Unit Type";
const BeatNumLabel = "Beat Number";

/** Type for beat/unit restrictions prompt function */
type PromptBeatOrUnitRestrictionsModFn = (
  BtnInteract: ButtonInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  Scope: "beat" | "unit"
) => Promise<
  | GuildSettings["callsigns_module"]["beat_restrictions"]
  | GuildSettings["callsigns_module"]["unit_type_restrictions"]
>;

export const CallSignsCTAIds = {
  ModuleEnabled: `${ConfigTopics.CallsignsConfiguration}-me`,
  RequestsChannel: `${ConfigTopics.CallsignsConfiguration}-rc`,
  LogChannel: `${ConfigTopics.CallsignsConfiguration}-lc`,
  ManagerRoles: `${ConfigTopics.CallsignsConfiguration}-mgr`,
  AlertOnRequest: `${ConfigTopics.CallsignsConfiguration}-aor`,
  NicknameFormat: `${ConfigTopics.CallsignsConfiguration}-nf`,
  BeatNumberRestrictions: `${ConfigTopics.CallsignsConfiguration}-bnr`,
  AutoRenameOnApproval: `${ConfigTopics.CallsignsConfiguration}-ara`,
  AutoCallsignRelease: `${ConfigTopics.CallsignsConfiguration}-acr`,
  UnitTypeRoleRestrictions: `${ConfigTopics.CallsignsConfiguration}-utrr`,
  UnitTypeRoleRestrictionsMode: `${ConfigTopics.CallsignsConfiguration}-utrm`,
} as const;

export const CallSignsExplanations = {
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
        "If enabled, personnel are automatically renamed to their approved call sign based on the configured nickname format.\n" +
        "Notice: Discord's character limit may need the app truncate the nickname after the format is applied.",
    },
    {
      Name: "Auto-Release for Inactive Members",
      Description:
        "Automatically releases call signs from inactive members to keep them available for active personnel. " +
        "Call signs are released after a 12-hour grace period when:\n" +
        "- They are no longer a member of the server.\n" +
        "- Or if they lose their staff role or status.",
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
        "The format to use when updating members' nicknames with their assigned call signs, if auto-renaming is enabled.",
    },
    {
      Name: "Unit Type Role-based Restrictions",
      Description:
        "If a unit type is associated with specific roles, only members holding at least one of those roles can request that unit type. " +
        "This ensures that only qualified personnel can submit requests for specialized units.",
    },
    {
      Name: "Beat Number Role-based Restrictions",
      Description:
        "Define specific rules for assigning call sign beat numbers based on roles. These restrictions ensure that only qualified members can request certain beat numbers.",
    },
  ],
} as const;

// ---------------------------------------------------------------------------------------
// Component Getters:
// ------------------
export function GetCallsignsModuleConfigComponents(
  Interaction: PromptInteraction<"cached">,
  CSModuleConfig: GuildSettings["callsigns_module"]
) {
  const ModuleEnabledAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Module Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${CallSignsCTAIds.ModuleEnabled}:${Interaction.user.id}`)
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
    .setCustomId(`${CallSignsCTAIds.RequestsChannel}:${Interaction.user.id}`);

  const LogDestAccessoryButton = new ButtonBuilder()
    .setLabel("Set Logs Destination")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CallSignsCTAIds.LogChannel}:${Interaction.user.id}`);

  const ManagerRolesSelectMenuAR = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CallSignsCTAIds.ManagerRoles}:${Interaction.user.id}`)
      .setMinValues(0)
      .setMaxValues(6)
      .setPlaceholder("Select up to 6 manager roles...")
      .setDefaultRoles(CSModuleConfig.manager_roles.slice(0, 6))
  );

  const AlertOnNewRequestsAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Alerts Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setCustomId(`${CallSignsCTAIds.AlertOnRequest}:${Interaction.user.id}`)
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
      .setCustomId(`${CallSignsCTAIds.AutoRenameOnApproval}:${Interaction.user.id}`)
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
      .setCustomId(`${CallSignsCTAIds.UnitTypeRoleRestrictionsMode}:${Interaction.user.id}`)
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

  const AutoCallsignReleaseAR = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CallSignsCTAIds.AutoCallsignRelease}:${Interaction.user.id}`)
      .setPlaceholder("Auto Call Sign Release Enabled/Disabled")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Enabled")
          .setValue("true")
          .setDescription("Automatically release call signs when a criteria is met.")
          .setDefault(CSModuleConfig.release_on_inactivity),
        new StringSelectMenuOptionBuilder()
          .setLabel("Disabled")
          .setValue("false")
          .setDescription("Do not automatically release call signs.")
          .setDefault(!CSModuleConfig.release_on_inactivity)
      )
  );

  const NicknameFormatAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Nickname Format")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CallSignsCTAIds.NicknameFormat}:${Interaction.user.id}`);

  const SetUnitTypeRoleBasedRestrictionsAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Restrictions")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CallSignsCTAIds.UnitTypeRoleRestrictions}:${Interaction.user.id}`);

  const SetBeatNumberRestrictionsAccessoryBtn = new ButtonBuilder()
    .setLabel("Set Restrictions")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`${CallSignsCTAIds.BeatNumberRestrictions}:${Interaction.user.id}`);

  return [
    ModuleEnabledAR,
    RequestsDestinationButton,
    LogDestAccessoryButton,
    ManagerRolesSelectMenuAR,
    AlertOnNewRequestsAR,
    AutoRenameOnAssignmentAR,
    AutoCallsignReleaseAR,
    UnitTypeRestrictionsModeAR,
    NicknameFormatAccessoryBtn,
    SetUnitTypeRoleBasedRestrictionsAccessoryBtn,
    SetBeatNumberRestrictionsAccessoryBtn,
  ] as const;
}

// ---------------------------------------------------------------------------------------
// Container Getters:
// ------------------
export function GetCallsignsModuleConfigContainers(
  SelectInteract: PromptInteraction<"cached">,
  CSModuleConfig: GuildSettings["callsigns_module"]
) {
  const SettingsInfo = CallSignsExplanations.Settings;
  const ModuleTitleText = new TextDisplayBuilder().setContent(`### ${CallSignsExplanations.Title}`);

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
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          8. **${SettingsInfo[7].Name}**
          ${SettingsInfo[7].Description}
        `)
      )
    )
    .addActionRowComponents(CallsignsModuleInteractComponents[7])
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[8])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              9. **${SettingsInfo[8].Name}**
              **Currently Configured:** \`${CSModuleConfig.nickname_format}\`
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
              **Restrictions Set:** ${CurrentlyConfiguredTexts.UTRSet}
              ${SettingsInfo[9].Description}
              `)
          )
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(CallsignsModuleInteractComponents[10])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              11. **${SettingsInfo[10].Name}**
              **Restrictions Set:** ${CurrentlyConfiguredTexts.BNRSet}
              ${SettingsInfo[10].Description}
            `)
          )
        )
    );

  return [Page_1, Page_2, Page_3, Page_4] as const;
}

// ---------------------------------------------------------------------------------------
// Show Content Getter:
// --------------------
export function GetCSCallsignsModuleContent(GuildSettings: GuildSettings): string {
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
    **Auto-Release Inactive Call Signs:** ${MSettings.release_on_inactivity ? "Enabled" : "Disabled"}
    **Requests Destination:** ${RequestsDest}
    **Logs Destination:** ${LogsDest}
    **Manager Role(s):** ${ManagerRolesMentioned.length ? ManagerRolesMentioned : "None"}
    **Nickname Format:** \`${MSettings.nickname_format}\`
    **Unit Type Restrictions:** ${MSettings.unit_type_restrictions.length} set
    **Beat Number Restrictions:** ${MSettings.beat_restrictions.length} set
  `);
}

// ---------------------------------------------------------------------------------------
// Nickname Format Handler:
// ------------------------
export async function HandleCallsignNicknameFormatSetBtnInteract(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentFormat: string
): Promise<string> {
  const FormatInputField = new TextInputBuilder()
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("e.g, {division}-{unit_type}-{beat_num} | {nickname}")
    .setCustomId("format")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(70);

  const InputModal = new ModalBuilder()
    .setTitle("Call Sign Nickname Format")
    .setCustomId(CallSignsCTAIds.NicknameFormat + RandomString(4))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          Define the nickname format template to automatically apply when assigning approved call signs to staff members.
          
          Available placeholders and tags:
          >>> \`{division}\` - The division beat number; e.g., \`1\` for Central, \`7\` for Willshire, etc.,
          \`{unit_type}\` - The service unit type; e.g., \`A\`, \`K9\`, \`SL\`, etc.,
          \`{beat_num}\` - The beat number; e.g., \`20\`, \`134\`, \`250\`, etc.,
          \`{nickname}\` - The member's current server nickname at assignment time; defaults to display name if no nickname is set,
          \`{display_name}\` - The member's current server display name at assignment time, and,
          \`{roblox_username}\` - The *linked* Roblox account username. This will be replaced empty if there is no linked account at the time of assignment.
        `)
      )
    )
    .addLabelComponents(
      new LabelBuilder().setLabel("Nickname Format").setTextInputComponent(FormatInputField)
    );

  if (CurrentFormat.length >= 10 && CurrentFormat.length <= 70) {
    FormatInputField.setValue(CurrentFormat);
  }

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 5 * 60 * 1000);
  if (!ModalSubmission) return CurrentFormat;
  ModalSubmission.deferUpdate().catch(() => null);

  const InputFormat = ModalSubmission.fields.getTextInputValue("format");
  return FilterUserInput(InputFormat, {
    guild_instance: ModalSubmission.guild,
    allow_discord_safe_links: false,
  });
}

function GetCSBeatOrUnitTypeRestrictionsPromptComps(
  BtnInteract: ButtonInteraction<"cached">,
  IsUnitType: boolean
) {
  const ScopeLabel = IsUnitType ? "unit type" : "beat number";
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CallSignsCTAIds.BeatNumberRestrictions}-am:${BtnInteract.user.id}`)
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

function GetCSBeatOrUnitTypeRestrictionsPromptContainer(
  RecInteract: ButtonInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
): BaseExtraContainer {
  const TypeScopeLabel = IsUnitType ? UnitTypeLabel : BeatNumLabel;
  const ScopeRestrictionsCount = IsUnitType
    ? MStateObj.ModuleConfig.unit_type_restrictions.length
    : MStateObj.ModuleConfig.beat_restrictions.length;

  const ActionSelectMenu = GetCSBeatOrUnitTypeRestrictionsPromptComps(RecInteract, IsUnitType);
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
  CSOriginalModuleState: ModuleState<GuildSettings["callsigns_module"]>,
  CSModuleState: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
): ContainerBuilder[] {
  const OrgRestrictions = IsUnitType
    ? CSOriginalModuleState.ModuleConfig.unit_type_restrictions
    : CSOriginalModuleState.ModuleConfig.beat_restrictions;

  const Restrictions = IsUnitType
    ? CSModuleState.ModuleConfig.unit_type_restrictions
    : CSModuleState.ModuleConfig.beat_restrictions;

  type UnitTypeRestriction = (typeof CSModuleState.ModuleConfig.unit_type_restrictions)[number];
  type BeatNumberRestriction = (typeof CSModuleState.ModuleConfig.beat_restrictions)[number];
  type RestrictionObj = (typeof Restrictions)[number];

  const Pages: ContainerBuilder[] = [];
  const RestrictionsChunks = Chunks(Restrictions as RestrictionObj[], 3);

  for (const RulesSet of RestrictionsChunks) {
    const RuleDisplayTexts: string[] = [];
    const ScopeRestrictionsCount = IsUnitType
      ? CSModuleState.ModuleConfig.unit_type_restrictions.length
      : CSModuleState.ModuleConfig.beat_restrictions.length;

    const PageContainer = new ContainerBuilder()
      .setAccentColor(resolveColor(Colors.DarkGrey))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          Dedent(`
            ### Call Signs Module: ${IsUnitType ? UnitTypeLabel : BeatNumLabel} Restrictions
            -# Showing ${RulesSet.length} of ${ScopeRestrictionsCount} total restriction${ScopeRestrictionsCount === 1 ? "" : "s"}.  
          `)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider());

    for (const Rule of RulesSet) {
      const OriginalRule = OrgRestrictions.find(
        (ORule) => ORule._id.toString() === Rule._id.toString()
      );

      const RuleStatus = OriginalRule ? "Saved" : "Unsaved";
      const PermittedRolesText = Rule.permitted_roles.length
        ? ListFormatter.format(Rule.permitted_roles.map(roleMention))
        : "*None - Cannot be requested*";

      RuleDisplayTexts.push(
        ConcatenateLines(
          `**ID:** \`${Rule._id.toString()}\``,
          `> **Status:** ${RuleStatus}`,
          IsUnitType
            ? `> **Unit Type:** \`${(Rule as UnitTypeRestriction).unit_type}\``
            : `> **Beat Range:** \`${(Rule as BeatNumberRestriction).range.join(" - ")}\``,
          `> **Permitted Roles:** ${PermittedRolesText}`
        )
      );
    }

    for (const [Index, RDT] of RuleDisplayTexts.entries()) {
      PageContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(RDT));
      if (Index !== RuleDisplayTexts.length - 1) {
        PageContainer.addSeparatorComponents(new SeparatorBuilder().setDivider());
      }
    }

    Pages.push(PageContainer);
  }

  return Pages;
}

async function ModalPromptBeatOrUnitTypeRuleAdd(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
): Promise<any> {
  const ScopeLabel = IsUnitType ? UnitTypeLabel : BeatNumLabel;
  const ModalId =
    CallSignsCTAIds[IsUnitType ? "UnitTypeRoleRestrictions" : "BeatNumberRestrictions"] +
    "add:" +
    SelectInteract.user.id +
    ":" +
    RandomString(6);

  const GuideText = Dedent(`
    ### Add ${ScopeLabel} Restriction
    
    **How it works:**
    1. Complete the form below with your restriction details
    2. The restriction is created locally in this configuration session
    3. 'Confirm Current Restrictions' when done
    4. Save through the module config panel to enforce the restriction
    
    **Tip:** ${IsUnitType ? "Multiple unit types" : "Multiple beat number ranges"} can be added simultaneously by separating them with commas.
  `);

  let ConfigurableLabelComp: LabelBuilder;
  const InputModal = new ModalBuilder()
    .setCustomId(ModalId)
    .setTitle(`Add ${ScopeLabel} Restriction`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(GuideText));

  if (IsUnitType) {
    ConfigurableLabelComp = new LabelBuilder()
      .setLabel("Choose a Unit Type")
      .setDescription(
        "Type in a valid LAPD unit type in the text box below to restrict/allow it to certain roles."
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setCustomId("unit_types")
          .setPlaceholder("e.g, 'SL', 'K9'")
          .setMinLength(1)
          .setMaxLength(14)
          .setRequired(true)
      );
  } else {
    ConfigurableLabelComp = new LabelBuilder()
      .setLabel("Beat Number Range(s)")
      .setDescription(
        "The range is inclusive and must be between 1-999; the format for the range is 'start-end'."
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Short)
          .setCustomId("beat_ranges")
          .setPlaceholder("eg., 10-99, 200-250")
          .setMinLength(1)
          .setMaxLength(38)
          .setRequired(true)
      );
  }

  InputModal.addLabelComponents(
    ConfigurableLabelComp,
    new LabelBuilder()
      .setLabel("Permitted Roles")
      .setDescription(
        `Choose the roles that will be permitted for the selected ${IsUnitType ? "type(s)." : "range(s)."}`
      )
      .setRoleSelectMenuComponent(
        new RoleSelectMenuBuilder()
          .setCustomId("permitted")
          .setMinValues(1)
          .setMaxValues(6)
          .setRequired(true)
      )
  );

  const ModalSubmission = await ShowModalAndAwaitSubmission(SelectInteract, InputModal, 5 * 60_000);
  if (!ModalSubmission) return;
  const InputPermittedRoles = ModalSubmission.fields
    .getSelectedRoles("permitted", true)
    .map((r) => r.id);

  if (IsUnitType) {
    const InputUnitTypes = ModalSubmission.fields
      .getTextInputValue("unit_types")
      .split(ListSplitRegex);

    const FilteredTypes = InputUnitTypes.map((t) =>
      t.toLowerCase() === "air" ? "Air" : t.trim()
    ).filter((t) => SUnitTypeLabels.has(t));

    if (FilteredTypes.length !== InputUnitTypes.length) {
      return new ErrorContainer()
        .useErrTemplate("CallsignConfigInvalidUnitTypes")
        .replyToInteract(ModalSubmission, true);
    }

    for (const Type of FilteredTypes) {
      MStateObj.ModuleConfig.unit_type_restrictions.push({
        _id: new Types.ObjectId(),
        permitted_roles: InputPermittedRoles,
        unit_type: Type,
      });
    }

    return new SuccessContainer()
      .setDescription(
        "`%i` unit type restriction(s) %s been successfully set. Remember to confirm and save changes to enforce them.",
        FilteredTypes.length,
        FilteredTypes.length > 1 ? "have" : "has"
      )
      .replyToInteract(ModalSubmission, true);
  }

  const InputRanges = ModalSubmission.fields.getTextInputValue("beat_ranges").split(ListSplitRegex);
  const FilteredMappedRanges = InputRanges.map((Range) => {
    const Match = Range.match(/(\d{1,3})-(\d{1,3})/);
    if (!Match) return null;
    const [, Start, End] = Match;
    const Parsed = [Number.parseInt(Start), Number.parseInt(End)];

    if (
      Parsed[0] < 1 ||
      Parsed[1] > 999 ||
      Parsed[0] > Parsed[1] ||
      Number.isNaN(Parsed[0]) ||
      Number.isNaN(Parsed[1])
    ) {
      return null;
    }

    return [Number.parseInt(Start), Number.parseInt(End)];
  }).filter((r) => r !== null) as [number, number][];

  if (FilteredMappedRanges.length !== InputRanges.length) {
    return new ErrorContainer()
      .useErrTemplate("CallsignConfigInvalidBeatRanges")
      .replyToInteract(ModalSubmission, true);
  }

  for (const Range of FilteredMappedRanges) {
    MStateObj.ModuleConfig.beat_restrictions.push({
      _id: new Types.ObjectId(),
      permitted_roles: InputPermittedRoles,
      range: Range,
    });
  }

  return new SuccessContainer()
    .setDescription(
      "`%i` beat number restriction(s) %s been successfully set. Remember to confirm and save changes to enforce them.",
      FilteredMappedRanges.length,
      FilteredMappedRanges.length > 1 ? "have" : "has"
    )
    .replyToInteract(ModalSubmission, true);
}

async function ModalPromptBeatOrUnitTypeRuleRemove(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  IsUnitType: boolean
) {
  const ScopeLabel = IsUnitType ? UnitTypeLabel : BeatNumLabel;
  const ModalBaseId =
    CallSignsCTAIds[IsUnitType ? "UnitTypeRoleRestrictions" : "BeatNumberRestrictions"];
  const InputIdModal = new ModalBuilder()
    .setTitle(`Call Signs: ${ScopeLabel} Restriction Removal`)
    .setCustomId(ModalBaseId + "-remove:" + SelectInteract.user.id + RandomString(6))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Restriction IDs")
        .setDescription(
          "The ID of the restriction(s) to remove, separated by commas.\nUse the list option to view IDs."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Short)
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
  const InputIds = ModalSubmission.fields.getTextInputValue("id");
  const IdList = InputIds.split(ListSplitRegex)
    .map((id) => id.trim())
    .filter(Boolean);

  const InvalidIds = IdList.filter((id) => !isValidObjectId(id));
  if (InvalidIds.length > 0) {
    return new ErrorContainer()
      .useErrTemplate("Invalid24HexaID")
      .replyToInteract(ModalSubmission, true);
  }

  const ExistingIndexes = IdList.map((id) => ({
    id,
    index: IsUnitType
      ? MStateObj.ModuleConfig.unit_type_restrictions.findIndex((R) => R._id.toString() === id)
      : MStateObj.ModuleConfig.beat_restrictions.findIndex((R) => R._id.toString() === id),
  })).filter((item) => item.index !== -1);

  const NotFoundIds = IdList.filter((id) => !ExistingIndexes.some((item) => item.id === id));
  if (NotFoundIds.length > 0) {
    return new ErrorContainer()
      .useErrTemplate("CallsignBeatOrUnitTypeRestrictionNotFound")
      .replyToInteract(ModalSubmission, true);
  }

  const RemovedCount = ExistingIndexes.length;
  for (const Item of ExistingIndexes.toSorted((a, b) => b.index - a.index)) {
    if (IsUnitType) {
      MStateObj.ModuleConfig.unit_type_restrictions.splice(Item.index, 1);
    } else {
      MStateObj.ModuleConfig.beat_restrictions.splice(Item.index, 1);
    }
  }

  return new SuccessContainer()
    .useTemplate(
      "CallsignBeatOrUnitTypeRestrictionRemoved",
      ScopeLabel.toLowerCase(),
      RemovedCount > 1 ? `${RemovedCount} restrictions` : "restriction"
    )
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

export async function PromptBeatOrUnitRestrictionsMod(
  BtnInteract: ButtonInteraction<"cached">,
  MStateObj: ModuleState<GuildSettings["callsigns_module"]>,
  Scope: "beat" | "unit"
): Promise<
  | GuildSettings["callsigns_module"]["beat_restrictions"]
  | GuildSettings["callsigns_module"]["unit_type_restrictions"]
> {
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
  }).then((IR) => IR.resource!.message!);

  const ActionsCollector = PromptMessage.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (I) => I.user.id === BtnInteract.user.id,
    time: 10 * 60 * 1000,
  });

  ActionsCollector.on("collect", async function OnActionSelection(SelectInteract) {
    const Selected = SelectInteract.values[0];
    try {
      switch (Selected) {
        case "list": {
          const Pages = GetCSBeatOrUnitTypeRestrictionsListContainers(
            MStateObj,
            MStateObjCopy,
            ScopeIsUnitType
          );

          if (Pages.length === 0) {
            await new InfoContainer()
              .useInfoTemplate("CallsignNoRestrictionsToList")
              .replyToInteract(SelectInteract, true, true);
          } else {
            await HandlePagePagination({
              interact: SelectInteract,
              pagination_timeout: 8 * 60 * 1000,
              pages: Pages,
              context: FileLabel,
              ephemeral: true,
            });
          }

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
          return ActionsCollector.stop("ChangesDismissed");
        case "confirm":
          return ActionsCollector.stop("ChangesConfirmed");
        default:
          return SelectInteract.deferUpdate().catch(() => null);
      }

      if (!(SelectInteract.deferred || SelectInteract.replied)) return;
      return await SelectInteract.editReply({
        message: PromptMessage.id,
        components: [
          GetCSBeatOrUnitTypeRestrictionsPromptContainer(
            BtnInteract,
            MStateObjCopy,
            ScopeIsUnitType
          ),
        ],
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

  return new Promise<
    | GuildSettings["callsigns_module"]["beat_restrictions"]
    | GuildSettings["callsigns_module"]["unit_type_restrictions"]
  >((resolve) => {
    ActionsCollector.on("end", async (Collected, Reason) => {
      const LastInteract = Collected.last() ?? BtnInteract;

      if (Reason === "ChangesConfirmed") {
        resolve(
          ScopeIsUnitType
            ? MStateObjCopy.ModuleConfig.unit_type_restrictions
            : MStateObjCopy.ModuleConfig.beat_restrictions
        );
      } else {
        resolve(
          ScopeIsUnitType
            ? MStateObj.ModuleConfig.unit_type_restrictions
            : MStateObj.ModuleConfig.beat_restrictions
        );
      }

      if (!LastInteract.deferred && !LastInteract.replied) {
        await LastInteract.deferUpdate()
          .then(() => LastInteract.deleteReply(PromptMessage))
          .catch(() => null);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------
// Interaction Handler:
// --------------------
export async function HandleCallsignsModuleConfigPageInteracts(
  RecInteract: CollectedInteraction<"cached">,
  MState: ModuleState<GuildSettings["callsigns_module"]>,
  PromptBeatOrUnitRestrictionsMod: PromptBeatOrUnitRestrictionsModFn
): Promise<boolean> {
  const CustomId = RecInteract.customId;

  if (RecInteract.isButton()) {
    if (CustomId.startsWith(CallSignsCTAIds.LogChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CallSignsCTAIds.LogChannel,
        "Call Signs Log",
        MState.ModuleConfig.log_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.log_channel = SelectedChannel;
        return true;
      }
    }

    if (CustomId.startsWith(CallSignsCTAIds.RequestsChannel)) {
      const SelectedChannel = await PromptChannelOrThreadSelection(
        RecInteract,
        CallSignsCTAIds.RequestsChannel,
        "Call Sign Requests",
        MState.ModuleConfig.requests_channel
      );

      if (SelectedChannel !== undefined) {
        MState.ModuleConfig.requests_channel = SelectedChannel;
        return true;
      }
    }

    if (CustomId.startsWith(CallSignsCTAIds.NicknameFormat)) {
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

    if (CustomId.startsWith(CallSignsCTAIds.UnitTypeRoleRestrictions)) {
      const UpdatedRestrictions = await PromptBeatOrUnitRestrictionsMod(
        RecInteract,
        MState,
        "unit"
      );

      MState.ModuleConfig.unit_type_restrictions =
        UpdatedRestrictions as GuildSettings["callsigns_module"]["unit_type_restrictions"];

      return true;
    }

    if (CustomId.startsWith(CallSignsCTAIds.BeatNumberRestrictions)) {
      const UpdatedRestrictions = await PromptBeatOrUnitRestrictionsMod(
        RecInteract,
        MState,
        "beat"
      );

      MState.ModuleConfig.beat_restrictions =
        UpdatedRestrictions as GuildSettings["callsigns_module"]["beat_restrictions"];

      return true;
    }
  }

  if (RecInteract.isStringSelectMenu() && CustomId.startsWith(CallSignsCTAIds.ModuleEnabled)) {
    MState.ModuleConfig.enabled = RecInteract.values[0] === "true";
  }

  if (RecInteract.isStringSelectMenu() && CustomId.startsWith(CallSignsCTAIds.AlertOnRequest)) {
    MState.ModuleConfig.alert_on_request = RecInteract.values[0] === "true";
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(CallSignsCTAIds.AutoCallsignRelease)
  ) {
    MState.ModuleConfig.release_on_inactivity = RecInteract.values[0] === "true";
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(CallSignsCTAIds.AutoRenameOnApproval)
  ) {
    MState.ModuleConfig.update_nicknames = RecInteract.values[0] === "true";
  }

  if (
    RecInteract.isStringSelectMenu() &&
    CustomId.startsWith(CallSignsCTAIds.UnitTypeRoleRestrictionsMode)
  ) {
    MState.ModuleConfig.unit_type_whitelist = RecInteract.values[0] === "true";
  }

  if (RecInteract.isRoleSelectMenu() && CustomId.startsWith(CallSignsCTAIds.ManagerRoles)) {
    MState.ModuleConfig.manager_roles = RecInteract.values.filter(
      (Id) => !RecInteract.guild.roles.cache.get(Id)?.managed
    );

    return !ArraysAreEqual(MState.ModuleConfig.manager_roles, RecInteract.values);
  }

  RecInteract.deferUpdate().catch(() => null);
  return false;
}

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Safely converts any value to a proper MongoDB ObjectId instance.
 * Handles ObjectId instances, strings, and plain objects that were ObjectIds before cloning.
 * @param Value - The value to convert (ObjectId, string, or plain object)
 * @returns A proper ObjectId instance
 * @throws Error if the value cannot be converted to a valid ObjectId
 */
function ToObjectId(Value: any): Types.ObjectId {
  if (Value instanceof Types.ObjectId) {
    return Value;
  }

  if (typeof Value === "string") {
    return new Types.ObjectId(Value);
  }

  if (Value && typeof Value === "object") {
    if (Value.id) {
      if (Buffer.isBuffer(Value.id)) {
        return new Types.ObjectId(Value.id);
      }
      if (typeof Value.id === "string") {
        return new Types.ObjectId(Value.id);
      }
    }

    if (Value._bsontype === "ObjectId" && Value.id) {
      return new Types.ObjectId(Value.id);
    }

    try {
      return new Types.ObjectId(Value);
    } catch {
      throw new Error(`Cannot convert to ObjectId: ${JSON.stringify(Value)}`);
    }
  }

  throw new Error(`Invalid ObjectId value: ${Value}`);
}

/**
 * Normalizes callsigns module configuration by converting ObjectId instances to strings.
 * This ensures compatibility with clone operations that strip ObjectId prototypes.
 *
 * @param Config - The callsigns module configuration from MongoDB
 * @returns Configuration with ObjectIds converted to strings
 */
function NormalizeCallsignsConfigObjectIds(Config: GuildSettings["callsigns_module"]): Omit<
  GuildSettings["callsigns_module"],
  "beat_restrictions" | "unit_type_restrictions"
> & {
  beat_restrictions: { _id: string; range: [number, number]; permitted_roles: string[] }[];
  unit_type_restrictions: { _id: string; unit_type: string; permitted_roles: string[] }[];
} {
  return {
    ...Config,
    beat_restrictions: Config.beat_restrictions.map((R) => ({
      ...R,
      _id: ToObjectId(R._id).toString(),
    })),
    unit_type_restrictions: Config.unit_type_restrictions.map((R) => ({
      ...R,
      _id: ToObjectId(R._id).toString(),
    })),
  };
}

// ---------------------------------------------------------------------------------------
// Database Save Handler:
// ----------------------
export async function HandleCallsignsModuleDBSave(
  Interaction: PromptInteraction<"cached">,
  MState: ModuleState<GuildSettings["callsigns_module"]>
): Promise<string | null> {
  const MPath = "settings.callsigns_module";
  const BeatRestrictionsForDB = MState.ModuleConfig.beat_restrictions.map((R) => ({
    ...R,
    _id: ToObjectId(R._id),
  }));

  const UnitTypeRestrictionsForDB = MState.ModuleConfig.unit_type_restrictions.map((R) => ({
    ...R,
    _id: ToObjectId(R._id),
  }));

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
        [`${MPath}.release_on_inactivity`]: MState.ModuleConfig.release_on_inactivity,
        [`${MPath}.beat_restrictions`]: BeatRestrictionsForDB,
        [`${MPath}.unit_type_restrictions`]: UnitTypeRestrictionsForDB,
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
    const NormalizedSettings = NormalizeCallsignsConfigObjectIds(
      UpdatedSettings
    ) as unknown as GuildSettings["callsigns_module"];

    MState.OriginalConfig = clone(NormalizedSettings);
    MState.ModuleConfig = clone(NormalizedSettings);

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
      - **Auto-Release Inactive Call Signs:** ${UpdatedSettings.release_on_inactivity ? "Enabled" : "Disabled"}

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
