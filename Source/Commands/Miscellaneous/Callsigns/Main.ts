import IsUserRobloxIdLinked from "#Utilities/Database/IsUserLoggedIn.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import IsModuleEnabled from "#Utilities/Database/IsModuleEnabled.js";
import { ErrorEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import {
  ApplicationIntegrationType,
  AutocompleteInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import {
  AutocompleteBeatNumber,
  AutocompleteDivisionBeat,
  AutocompleteServiceUnitType,
} from "#Utilities/Autocompletion/CallsignsDesgnations.js";

const Subcommands = [
  (await import("./Subcmds/Request.js")).default,
  (await import("./Subcmds/Manage.js")).default,
  (await import("./Subcmds/Admin.js")).default,
  (await import("./Subcmds/List.js")).default,
];

// ---------------------------------------------------------------------------------------
// Handling & Logic:
// -----------------
/**
 * Authorize a management slash command usage; returns `true` is it is authorized or `false` otherwise.
 * @param Interaction - The interaction to check.
 * @returns `true` if authorized; `false` otherwise.
 */
async function IsAuthorizedCmdUsage(Interaction: SlashCommandInteraction<"cached">) {
  const SubcmdName = Interaction.options.getSubcommand();
  const ModuleEnabled = await IsModuleEnabled(Interaction.guildId, "callsigns_module");

  if (ModuleEnabled === false) {
    return new ErrorEmbed()
      .useErrTemplate("CallsignsModuleDisabled")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  const GuildSettings = await GetGuildSettings(Interaction.guildId);
  const NeedsRobloxForNickname =
    GuildSettings?.callsigns_module.update_nicknames &&
    GuildSettings.callsigns_module.nickname_format.includes("roblox");

  if (
    SubcmdName === "request" &&
    (GuildSettings?.require_authorization === true || NeedsRobloxForNickname)
  ) {
    const LinkedRobloxUser = await IsUserRobloxIdLinked(Interaction);
    if (!LinkedRobloxUser) {
      return new ErrorEmbed()
        .useErrTemplate("RobloxUserNotLinked")
        .replyToInteract(Interaction, true)
        .then(() => false);
    }
  }

  return true;
}

async function CmdInitialCallback(Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  const Authorized = await IsAuthorizedCmdUsage(Interaction);

  if (Authorized !== true) return;
  for (const SubCommand of Subcommands) {
    if (SubCommand.data.name === SubCommandName && typeof SubCommand.callback === "function") {
      return SubCommand.callback(Interaction);
    }
  }
}

async function Autocomplete(Interaction: AutocompleteInteraction<"cached">) {
  const { name, value } = Interaction.options.getFocused(true);
  const SubcommandName = Interaction.options.getSubcommand();

  if (SubcommandName === "request" && name === "unit-type") {
    return Interaction.respond(
      await AutocompleteServiceUnitType(value, Interaction.guildId, Interaction.member)
    );
  } else if (SubcommandName === "request" && name === "division") {
    return Interaction.respond(AutocompleteDivisionBeat(value));
  } else if (SubcommandName === "request" && name === "beat-num") {
    const Division = Interaction.options.getInteger("division", false);
    return Interaction.respond(
      await AutocompleteBeatNumber(
        value,
        Interaction.guildId,
        Interaction.member,
        Division?.toString()
      )
    );
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject = {
  callback: CmdInitialCallback,
  autocomplete: Autocomplete,
  options: {
    cooldown: {
      request: 10,
      $all_other: 5,
    },
    user_perms: {
      list: { management: true },
      admin: { management: true },
      $all_other: { staff: true },
    },
  },

  data: new SlashCommandBuilder()
    .setName("callsign")
    .setDescription("Call sign management commands.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

for (const SubCommand of Subcommands) {
  CommandObject.data.addSubcommand(SubCommand.data);
}

// ---------------------------------------------------------------------------------------
export default CommandObject;
