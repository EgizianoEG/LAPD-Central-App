import IsModuleEnabled from "@Utilities/Database/IsModuleEnabled.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
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
} from "@Utilities/Autocompletion/CallsignsDesgnations.js";

const Subcommands = [
  (await import("./Subcmds/Request.js")).default,
  (await import("./Subcmds/Manage.js")).default,
  (await import("./Subcmds/Admin.js")).default,
  (await import("./Subcmds/List.js")).default,
];

// ---------------------------------------------------------------------------------------
// Handling & Logic:
// -----------------
async function CmdInitialCallback(Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  const ModuleEnabled = await IsModuleEnabled(Interaction.guildId, "callsigns_module");

  if (ModuleEnabled === false && SubCommandName !== "list") {
    return new ErrorEmbed()
      .useErrTemplate("CallsignsModuleDisabled")
      .replyToInteract(Interaction, true, true);
  }

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
