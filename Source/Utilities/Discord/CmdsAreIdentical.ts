import {
  LocalizationMap,
  ContextMenuCommandBuilder,
  ApplicationCommandOptionType,
} from "discord.js";

import type {
  ApplicationCommand,
  APIApplicationCommandOption,
  APIApplicationCommandOptionBase,
  APIApplicationCommandOptionChoice,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  APIApplicationCommandOptionWithAutocompleteOrChoicesWrapper,
} from "discord.js";

/**
 * Validates two commands if they are semi-equal in properties and values.
 * @param Cmd_1 - The first command to compare.
 * @param Cmd_2 - The second command to compare.
 * @returns boolean indicating whether commands are equal.
 */
export default function CmdsAreEqual(
  Cmd_1: ApplicationCommand,
  Cmd_2: SlashCommandObject | ContextMenuCommandObject
): boolean {
  if (Cmd_2.data instanceof ContextMenuCommandBuilder) {
    return ContextMenuCommandsAreIdentical(Cmd_1, Cmd_2 as ContextMenuCommandObject);
  }

  const Cmd_Data_1 = Cmd_1.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
  const Cmd_Data_2 = Cmd_2.data.toJSON();

  if (Cmd_Data_1.name !== Cmd_Data_2.name || Cmd_Data_1.description !== Cmd_Data_2.description) {
    return false;
  }

  if (Cmd_Data_2.nsfw !== undefined && Cmd_Data_1.nsfw !== Cmd_Data_2.nsfw) {
    return false;
  }

  const DeployedMemberPermissions = Cmd_Data_1.default_member_permissions ?? null;
  const LocalMemberPermissions = Cmd_Data_2.default_member_permissions ?? null;
  if (LocalMemberPermissions !== null && DeployedMemberPermissions !== LocalMemberPermissions) {
    return false;
  }

  const Options_1 = Cmd_Data_1.options ?? [];
  const Options_2 = Cmd_Data_2.options ?? [];
  if (Options_1.length !== Options_2.length) {
    return false;
  }

  if (!Cmd_1.guildId) {
    const DeployedContexts = Cmd_Data_1.contexts ?? null;
    const LocalContexts = Cmd_Data_2.contexts ?? null;
    if (
      LocalContexts !== null &&
      (!DeployedContexts ||
        DeployedContexts.length !== LocalContexts.length ||
        !LocalContexts.every((ctx) => DeployedContexts.includes(ctx)))
    ) {
      return false;
    }
  }

  return !AreSlashCommandOptionsDifferent(Options_1, Options_2);
}

// ---------------------------------------------------------------------------------------
// Helpers:
// ---------
function AreSlashCommandOptionChoicesDifferent(
  ExistingChoices:
    | APIApplicationCommandOptionWithAutocompleteOrChoicesWrapper<
        APIApplicationCommandOptionBase<ApplicationCommandOptionType>,
        APIApplicationCommandOptionChoice<string | number>
      >["choices"]
    | undefined,
  LocalChoices:
    | APIApplicationCommandOptionWithAutocompleteOrChoicesWrapper<
        APIApplicationCommandOptionBase<ApplicationCommandOptionType>,
        APIApplicationCommandOptionChoice<string | number>
      >["choices"]
    | undefined
): boolean {
  if (!ExistingChoices?.length && !LocalChoices?.length) return false;
  if (!ExistingChoices?.length || !LocalChoices?.length) return true;
  if (ExistingChoices.length !== LocalChoices.length) return true;

  for (const LocalChoice of LocalChoices) {
    const ExistingChoice = ExistingChoices.find((choice) => choice.name === LocalChoice.name);
    if (!ExistingChoice) {
      return true;
    }

    if (
      LocalChoice.value !== ExistingChoice.value ||
      AreLocalizationsDifferent(LocalChoice.name_localizations, ExistingChoice.name_localizations)
    ) {
      return true;
    }
  }

  return false;
}

function AreSlashCommandOptionsDifferent(
  ExistingOptions: APIApplicationCommandOption[] | undefined,
  LocalCmdOptions: APIApplicationCommandOption[] | undefined
): boolean {
  if (!ExistingOptions?.length && !LocalCmdOptions?.length) return false;
  if (!ExistingOptions?.length || !LocalCmdOptions?.length) return true;
  if (ExistingOptions.length !== LocalCmdOptions.length) return true;

  // Sort options by name to ensure consistent ordering for comparison
  const SortedExisting = [...ExistingOptions].sort((a, b) => a.name.localeCompare(b.name));
  const SortedLocal = [...LocalCmdOptions].sort((a, b) => a.name.localeCompare(b.name));

  for (let i = 0; i < SortedLocal.length; i++) {
    const LocalOption = SortedLocal[i];
    const ExistingOption = SortedExisting[i];

    if (
      LocalOption.name !== ExistingOption.name ||
      LocalOption.type !== ExistingOption.type ||
      LocalOption.required !== ExistingOption.required ||
      LocalOption.description !== ExistingOption.description ||
      AreLocalizationsDifferent(
        LocalOption.name_localizations,
        ExistingOption.name_localizations
      ) ||
      AreLocalizationsDifferent(
        LocalOption.description_localizations,
        ExistingOption.description_localizations
      )
    ) {
      return true;
    }

    if (
      "autocomplete" in LocalOption &&
      "autocomplete" in ExistingOption &&
      LocalOption.autocomplete !== ExistingOption.autocomplete
    ) {
      return true;
    }

    if (
      "choices" in LocalOption &&
      "choices" in ExistingOption &&
      AreSlashCommandOptionChoicesDifferent(LocalOption.choices, ExistingOption.choices)
    ) {
      return true;
    }

    if (
      (LocalOption.type === ApplicationCommandOptionType.Subcommand ||
        LocalOption.type === ApplicationCommandOptionType.SubcommandGroup) &&
      "options" in LocalOption &&
      "options" in ExistingOption &&
      AreSlashCommandOptionsDifferent(LocalOption.options, ExistingOption.options)
    ) {
      return true;
    }
  }

  return false;
}

function ContextMenuCommandsAreIdentical(
  Cmd_1: ApplicationCommand,
  Cmd_2: ContextMenuCommandObject
): boolean {
  const Json_1 = Cmd_1.toJSON() as RESTPostAPIContextMenuApplicationCommandsJSONBody;
  const Json_2 = Cmd_2.data.toJSON();

  if (Json_1.name !== Json_2.name) {
    return false;
  }

  return (
    Json_1.type === Json_2.type &&
    (Json_1.contexts || []).length === (Json_2.contexts || []).length &&
    (Json_1.contexts || []).every((context) => Json_2.contexts?.includes(context)) &&
    !AreLocalizationsDifferent(Json_1.name_localizations, Json_2.name_localizations)
  );
}

function AreLocalizationsDifferent(
  Localizations_1: LocalizationMap | null = null,
  Localizations_2: LocalizationMap | null = null
) {
  if (!Localizations_1 && !Localizations_2) return false;
  if (!Localizations_1 || !Localizations_2) return true;
  if (Object.keys(Localizations_1).length !== Object.keys(Localizations_2).length) return true;

  for (const [Key, Value] of Object.entries(Localizations_1)) {
    if (Localizations_2[Key] !== Value) return true;
  }

  return false;
}
