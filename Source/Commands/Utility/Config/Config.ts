/**
 * Config Command - Orchestrates all configuration modules.
 * This file imports from modular components in ./Modules/ and provides
 * the command structure, collectors, and interaction handlers.
 */

import {
  Message,
  MessageFlags,
  ComponentType,
  SeparatorBuilder,
  ContainerBuilder,
  ButtonInteraction,
  TextDisplayBuilder,
  time as FormatTime,
  InteractionResponse,
  SlashCommandBuilder,
  PermissionFlagsBits,
  CollectedInteraction,
  InteractionContextType,
  ApplicationIntegrationType,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import {
  FileLabel,
  AccentColor,
  ModuleState,
  ConfigTopics,
  GuildSettings,
  PromptInteraction,
  SettingsResolvable,
  UpdateConfigPrompt,
  ConfigTopicMgmtButtonsIds,
  UpdatePromptReturnMessage,
  HandleConfigPageNavigation,
  GetConfigTopicsDropdownMenu,
  HandleConfigTimeoutResponse,
  AttachNavMgmtCompsToContainer,
  GetShowConfigurationsPageComponents,
} from "./Modules/Shared.js";

import {
  AdditionalConfigExplanations,
  GetCSAdditionalConfigContent,
  HandleAdditionalConfigDBSave,
  GetAdditionalConfigContainers,
  HandleAdditionalConfigSpecificInteracts,
} from "./Modules/AdditionalConfig.js";

import {
  BasicConfigExplanations,
  HandleBasicConfigDBSave,
  GetBasicConfigContainers,
  GetCSBasicSettingsContent,
  HandleBasicConfigSpecificInteracts,
} from "./Modules/BasicConfig.js";

import {
  CallSignsExplanations,
  GetCSCallsignsModuleContent,
  HandleCallsignsModuleDBSave,
  PromptBeatOrUnitRestrictionsMod,
  GetCallsignsModuleConfigContainers,
  HandleCallsignsModuleConfigPageInteracts,
} from "./Modules/CallSigns.js";

import {
  DutyActivitiesExplanations,
  GetCSDutyActivitiesContent,
  HandleDutyActivitiesModuleDBSave,
  GetDutyActivitiesModuleConfigContainers,
  HandleDutyActivitiesConfigPageInteracts,
} from "./Modules/DutyActivities.js";

import {
  HandleLeaveModuleDBSave,
  GetCSLeaveNoticesContent,
  LeaveOfAbsenceExplanations,
  GetLeaveModuleConfigContainers,
  HandleLeaveConfigSpecificInteracts,
} from "./Modules/LeaveOfAbsence.js";

import {
  ReducedActivityExplanations,
  GetCSReducedActivityContent,
  HandleReducedActivityModuleDBSave,
  GetReducedActivityModuleConfigContainers,
  HandleReducedActivityConfigPageInteracts,
} from "./Modules/ReducedActivity.js";

import {
  GetCSShiftModuleContent,
  HandleShiftModuleDBSave,
  ShiftManagementExplanations,
  GetShiftModuleConfigContainers,
  HandleShiftConfigSpecificInteracts,
} from "./Modules/ShiftManagement.js";

import {
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import { Emojis } from "#Config/Shared.js";
import { ErrorEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import { GetErrorId } from "#Utilities/Strings/Random.js";
import { clone, isDeepEqual } from "remeda";

import AppError from "#Utilities/Classes/AppError.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";

// ---------------------------------------------------------------------------------------
// #region - Local Types & Constants:
// ----------------------------------
const ConfigTopicsExplanations = {
  [ConfigTopics.BasicConfiguration]: BasicConfigExplanations,
  [ConfigTopics.ShiftConfiguration]: ShiftManagementExplanations,
  [ConfigTopics.LeaveConfiguration]: LeaveOfAbsenceExplanations,
  [ConfigTopics.CallsignsConfiguration]: CallSignsExplanations,
  [ConfigTopics.AdditionalConfiguration]: AdditionalConfigExplanations,
  [ConfigTopics.DutyActivitiesConfiguration]: DutyActivitiesExplanations,
  [ConfigTopics.ReducedActivityConfiguration]: ReducedActivityExplanations,
} as const;

type ConfigModuleDescriptor<T extends SettingsResolvable> = {
  GetContainers: (
    Interact: PromptInteraction,
    Config: T
  ) => readonly ContainerBuilder[] | ContainerBuilder[];
  GetConfig: (Config: GuildSettings) => T;
};

type ConfigModuleMapType = {
  [ConfigTopics.BasicConfiguration]: ConfigModuleDescriptor<GuildSettings>;
  [ConfigTopics.AdditionalConfiguration]: ConfigModuleDescriptor<GuildSettings>;
  [ConfigTopics.ShiftConfiguration]: ConfigModuleDescriptor<GuildSettings["shift_management"]>;
  [ConfigTopics.LeaveConfiguration]: ConfigModuleDescriptor<GuildSettings["leave_notices"]>;
  [ConfigTopics.ReducedActivityConfiguration]: ConfigModuleDescriptor<
    GuildSettings["reduced_activity"]
  >;
  [ConfigTopics.DutyActivitiesConfiguration]: ConfigModuleDescriptor<GuildSettings>;
  [ConfigTopics.CallsignsConfiguration]: ConfigModuleDescriptor<GuildSettings["callsigns_module"]>;
};

type ConfigTypeForTopic<T extends keyof ConfigModuleMapType> =
  ConfigModuleMapType[T] extends ConfigModuleDescriptor<infer U> ? U : never;

const ConfigModuleMap: ConfigModuleMapType = {
  [ConfigTopics.BasicConfiguration]: {
    GetContainers: GetBasicConfigContainers,
    GetConfig: (Config: GuildSettings) => Config,
  },
  [ConfigTopics.AdditionalConfiguration]: {
    GetContainers: GetAdditionalConfigContainers,
    GetConfig: (Config: GuildSettings) => Config,
  },
  [ConfigTopics.ShiftConfiguration]: {
    GetContainers: GetShiftModuleConfigContainers,
    GetConfig: (Config: GuildSettings) => Config.shift_management,
  },
  [ConfigTopics.LeaveConfiguration]: {
    GetContainers: GetLeaveModuleConfigContainers,
    GetConfig: (Config: GuildSettings) => Config.leave_notices,
  },
  [ConfigTopics.ReducedActivityConfiguration]: {
    GetContainers: GetReducedActivityModuleConfigContainers,
    GetConfig: (Config: GuildSettings) => Config.reduced_activity,
  },
  [ConfigTopics.DutyActivitiesConfiguration]: {
    GetContainers: GetDutyActivitiesModuleConfigContainers,
    GetConfig: (Config: GuildSettings) => Config,
  },
  [ConfigTopics.CallsignsConfiguration]: {
    GetContainers: GetCallsignsModuleConfigContainers,
    GetConfig: (Config: GuildSettings) => Config.callsigns_module,
  },
};

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Core Handlers:
// ------------------------
/**
 * Handles the save operation for configuration settings based on the module state.
 *
 * This function checks if any modifications were made to the configuration, defers the interaction reply if needed,
 * and then processes the save operation based on the specific configuration topic. It delegates to specialized
 * save handlers for each configuration topic type.
 *
 * @template SR - The type of settings being configured, must extend {@link SettingsResolvable}
 * @param Interaction - The Discord interaction that triggered the save operation. Must be from a cached guild context.
 * @param MState - The current state of the configuration module containing the settings to save
 * @returns A promise that resolves to `true` if the configuration was successfully saved, `false` otherwise
 *
 * @remarks
 * - If no changes were made, responds with an informational message and returns `false`
 * - Automatically defers the reply if not already deferred to prevent interaction timeout
 * - Handles different configuration topics through a switch statement, delegating to specific handlers
 * - Returns error responses for invalid topics or save failures
 * - Logs any errors that occur during the save process
 *
 * @throws Will catch and log any errors, returning `false` and responding with an error message to the user.
 */
async function HandleConfigSave<SR extends SettingsResolvable>(
  Interaction: PromptInteraction<"cached">,
  MState: ModuleState<SR>
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
      case ConfigTopics.ShowConfigurations: {
        return new ErrorContainer()
          .useErrTemplate("UnknownConfigTopic")
          .replyToInteract(Interaction, true)
          .then(() => false);
      }
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
          MState as ModuleState<GuildSettings>
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
    }

    if (SuccessMsgDescription) {
      await new SuccessContainer()
        .setTitle(`Saved — ${ConfigTopicTitle}`)
        .setDescription(SuccessMsgDescription)
        .replyToInteract(Interaction, true, true, "editReply");
    } else {
      await new ErrorContainer()
        .useErrTemplate("ConfigSaveFailedNCM", ConfigTopicTitle.toLowerCase())
        .replyToInteract(Interaction, true, true, "editReply");
      return false;
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Something went wrong while saving the config;",
      label: FileLabel,
      stack: Err?.stack,
      error: Err,
    });

    return new ErrorContainer()
      .useErrTemplate("AppError")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  return true;
}

/**
 * Handles module-specific interactions based on the current configuration topic.
 * Routes the collected interaction to the appropriate handler function based on the
 * configuration topic stored in the module state.
 *
 * @template SR - The settings resolvable type constraint for the module state
 * @param CollectedInteract - The interaction collected from the user
 * @param MState - The current module state containing configuration topic and settings
 * @returns A promise that resolves to `true` if the interaction was handled successfully,
 *          `false` if the interaction should not proceed further
 *
 * @remarks
 * This function acts as a dispatcher that routes interactions to topic-specific handlers:
 * - BasicConfiguration: Handles basic guild settings
 * - AdditionalConfiguration: Handles additional guild settings
 * - ShiftConfiguration: Handles shift management settings
 * - LeaveConfiguration: Handles leave notice settings
 * - ReducedActivityConfiguration: Handles reduced activity settings
 * - DutyActivitiesConfiguration: Handles duty activities settings
 * - CallsignsConfiguration: Handles callsigns module settings
 * - ShowConfigurations: Defers the update without further processing
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
        MState as ModuleState<GuildSettings>
      );
    }
    case ConfigTopics.CallsignsConfiguration: {
      return HandleCallsignsModuleConfigPageInteracts(
        CollectedInteract,
        MState as ModuleState<GuildSettings["callsigns_module"]>,
        PromptBeatOrUnitRestrictionsMod
      );
    }
    case ConfigTopics.ShowConfigurations: {
      CollectedInteract.deferUpdate().catch(() => null);
      return false;
    }
  }
}

/**
 * Handles module configuration interactions for a settings management interface.
 *
 * Manages the state and lifecycle of configuration prompts, including pagination,
 * modification tracking, and user interactions such as navigation, saving, and timeout handling.
 *
 * @template T - The configuration topic type
 * @param SelectInteract - The initial string select menu interaction from a cached guild
 * @param ConfigPrompt - The message containing the configuration prompt
 * @param DatabaseConfig - The current database configuration state
 * @param ConfigTopic - The configuration topic being managed
 * @param GetContainersFn - Function that retrieves container builders for the current interaction and config state
 * @returns A promise that resolves when the configuration interaction handling is complete
 *
 * @remarks
 * - Creates a component action collector with a 10-minute timeout
 * - Tracks configuration state including original values, modifications, and current page
 * - Handles button interactions for pagination (next/previous), navigation (back), and saving
 * - Processes module-specific interactions and updates the prompt accordingly
 * - Automatically handles timeout and idle states by triggering timeout response
 * - Logs errors encountered during interaction processing with error IDs for tracking
 *
 * @throws Does not throw; errors are caught and logged with error containers
 */
async function HandleModuleConfigInteractions<T extends keyof ConfigModuleMapType>(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigPrompt: Message<true>,
  DatabaseConfig: ConfigTypeForTopic<T>,
  ConfigTopic: T,
  GetContainersFn: (
    Interact: PromptInteraction,
    Config: ConfigTypeForTopic<T>
  ) => readonly ContainerBuilder[] | ContainerBuilder[]
): Promise<void> {
  const State: ModuleState<ConfigTypeForTopic<T>> = {
    TotalPages: GetContainersFn(SelectInteract, DatabaseConfig as any).length,
    OriginalConfig: clone(DatabaseConfig),
    ModuleConfig: clone(DatabaseConfig),
    ConfigTopic: ConfigTopic as ConfigTopics,
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
              error: Err,
            })
        );
      } else if (IsButton && CustomId.includes(`-${ConfigTopicMgmtButtonsIds.ReturnToMain}`)) {
        CompActionCollector.stop("Back");
        await RecInteract.deferUpdate();
        return CmdCallback(RecInteract);
      } else if (IsButton && CustomId.includes(`-${ConfigTopicMgmtButtonsIds.ConfirmAndSave}`)) {
        await HandleConfigSave(RecInteract, State);
      } else {
        const ShallUpdatePrompt = await HandleModuleSpecificInteractions(RecInteract, State);
        if (ShallUpdatePrompt) {
          await UpdateConfigPrompt(
            CompActionCollector.collected.last() ?? RecInteract,
            ConfigPrompt,
            State,
            GetContainersFn
          );
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
        error: Err,
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

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Config Topic Selection:
// ---------------------------------
/**
 * Generic handler for module configuration selection.
 * Replaces individual selection handlers with a unified approach using the ConfigModuleMap.
 *
 * @template T - The configuration topic type
 * @param SelectInteract - The string select menu interaction from the user
 * @param ConfigTopic - The configuration topic to handle
 * @returns A promise that resolves when the module configuration interaction is complete
 *
 * @throws {AppError} Throws "GuildConfigNotFound" if guild configuration cannot be retrieved
 *
 * @remarks
 * This function:
 * - Fetches guild configuration from database
 * - Retrieves module-specific containers using the ConfigModuleMap
 * - Sets up the first page with navigation components
 * - Initializes the configuration interaction collector
 */
async function HandleModuleSelection<T extends keyof ConfigModuleMapType>(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  ConfigTopic: T
): Promise<void> {
  const GuildConfig = await GetGuildSettings(SelectInteract.guildId);
  if (!GuildConfig) throw new AppError("GuildConfigNotFound");

  const ModuleDescriptor = ConfigModuleMap[ConfigTopic];
  // Type assertion is necessary here because TypeScript cannot fully infer the mapping
  // between ConfigTopic and the return type of GetConfig due to the union nature of GuildSettings.
  // The extracted ConfigData is correctly typed as ConfigTypeForTopic<T>, but TypeScript's
  // union type inference cannot verify the type matches at the call site, so we use 'any' here.
  const ConfigData: ConfigTypeForTopic<T> = ModuleDescriptor.GetConfig(
    GuildConfig
  ) as ConfigTypeForTopic<T>;
  const ModuleContainers = ModuleDescriptor.GetContainers(SelectInteract, ConfigData as any);

  const FirstPageContainer = AttachNavMgmtCompsToContainer({
    ConfigTopicId: ConfigTopic,
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
    ConfigData,
    ConfigTopic,
    ModuleDescriptor.GetContainers as any
  );
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
      Title: "Call Signs Module",
      Content: GetCSCallsignsModuleContent(GuildConfig),
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

  for (const [Index, Section] of SectionsToShow.entries()) {
    ResponseContainer.addSeparatorComponents(
      new SeparatorBuilder({ divider: true, spacing: Index === 0 ? 2 : 1 })
    );
    ResponseContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${Section.Title}**\n${Section.Content}`)
    );
  }

  ResponseContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));
  ResponseContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Showing configuration for the app modules as of ${FormatTime(
        SelectInteract.createdAt,
        "f"
      )}`
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
  Interaction: PromptInteraction<"cached">,
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

      if (BtnId.includes("config-show-prev")) {
        return HandleConfigShowSelection(ReceivedInteraction, CurrentPageIndex - 1);
      } else if (BtnId.includes("config-show-next")) {
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

// #endregion
// ---------------------------------------------------------------------------------------
// #region - Initial Handlers:
// ---------------------------
async function HandleInitialRespActions(
  CmdInteract: PromptInteraction<"cached"> | SlashCommandInteraction<"cached">,
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
      if (SelectedConfigTopic === ConfigTopics.ShowConfigurations) {
        await HandleConfigShowSelection(TopicSelectInteract);
      } else if (SelectedConfigTopic in ConfigModuleMap) {
        await HandleModuleSelection(
          TopicSelectInteract,
          SelectedConfigTopic as keyof ConfigModuleMapType
        );
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
        error: Err,
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
  PromptInteraction: PromptInteraction<"cached"> | SlashCommandInteraction<"cached">
) {
  const ConfigTopicsMenu = GetConfigTopicsDropdownMenu(PromptInteraction);
  const CmdRespContainer = new ContainerBuilder()
    .setAccentColor(AccentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "### App Configuration\n**Please select a module or a topic from the drop-down list below.**"
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

// #endregion
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

export default CommandObject;
