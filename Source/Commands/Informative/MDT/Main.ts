// Dependencies:
// -------------
import AutocompleteIncidentNum from "@Utilities/Autocompletion/IncidentNum.js";
import AutocompleteCitationNum from "@Utilities/Autocompletion/NoticeToAppearNum.js";
import AutocompleteBookingNum from "@Utilities/Autocompletion/BookingNum.js";
import AutocompleteUsername from "@Utilities/Autocompletion/Username.js";
import SearchSubcmdGroup from "./Search/Search.js";
import {
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  type AutocompleteInteraction,
  type ApplicationCommandOptionChoiceData,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

const Subcommands = [(await import("./Subcmds/Lookup.js")).default];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  const SubCommandGroupName = Interaction.options.getSubcommandGroup();

  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === SubCommandName) {
      if (typeof Subcommand.callback === "function") {
        return (Subcommand.callback as any)(Interaction);
      } else {
        continue;
      }
    }
  }

  if (SubCommandGroupName === "search" && typeof SearchSubcmdGroup.callback === "function") {
    return SearchSubcmdGroup.callback(Interaction);
  }
}

async function Autocomplete(Interaction: AutocompleteInteraction<"cached">): Promise<void> {
  const { name, value } = Interaction.options.getFocused(true);
  let Suggestions: ApplicationCommandOptionChoiceData[];

  if (name === "name") {
    Suggestions = await AutocompleteUsername(value);
  } else if (name === "citation-num") {
    Suggestions = await AutocompleteCitationNum(value, Interaction.guildId);
  } else if (name === "booking-num") {
    Suggestions = await AutocompleteBookingNum(value, Interaction.guildId);
  } else if (name === "incident-num") {
    Suggestions = await AutocompleteIncidentNum(value, Interaction.guildId);
  } else {
    Suggestions = [];
  }

  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  autocomplete: Autocomplete,
  callback: Callback,
  options: {
    user_perms: { staff: true },
    cooldown: {
      $all: 2.5,
      lookup: 8,
    },
  },

  data: new SlashCommandBuilder()
    .setName("mdt")
    .setDescription("Mobile data terminal commands.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(Subcommands[0].data)
    .addSubcommandGroup(SearchSubcmdGroup.data)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
