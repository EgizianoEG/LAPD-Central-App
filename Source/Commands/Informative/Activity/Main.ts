// Dependencies:
// -------------
import AutocompleteShiftType from "#Utilities/Autocompletion/ShiftType.js";
import AutocompleteDateTimeExpressions from "#Utilities/Autocompletion/DateTimeExpressions.js";
import AutocompleteTimeDuration from "../../../Utilities/Autocompletion/TimeDuration.js";
import { secondsInDay, secondsInHour } from "date-fns/constants";
import {
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  type AutocompleteInteraction,
  type ApplicationCommandOptionChoiceData,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

const Subcommands = [
  (await import("./Subcmds/Officer.js")).default,
  (await import("./Subcmds/Report.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === SubCommandName) {
      if (typeof Subcommand.callback === "function") {
        return (Subcommand.callback as any)(Interaction);
      } else {
        continue;
      }
    }
  }
}

async function Autocomplete(Interaction: AutocompleteInteraction<"cached">): Promise<void> {
  const { name, value } = Interaction.options.getFocused(true);
  let Suggestions: ApplicationCommandOptionChoiceData[];

  if (name === "shift-type") {
    Suggestions = await AutocompleteShiftType(value, Interaction.guildId);
  } else if (name === "since") {
    Suggestions = AutocompleteDateTimeExpressions(value, { mode: "start" });
  } else if (["to", "until"].includes(name)) {
    Suggestions = AutocompleteDateTimeExpressions(value, { mode: "end" });
  } else if (name === "time-requirement") {
    Suggestions = AutocompleteTimeDuration(value);
  } else {
    Suggestions = [];
  }

  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  autocomplete: Autocomplete,
  callback: Callback,
  options: {
    user_perms: { report: { management: true }, $all: { staff: true } },
    cooldown: {
      for: 2.5,
      report: {
        $user: {
          cooldown: 10,
          max_executions: 8,
          timeframe: secondsInHour,
        },

        $guild: {
          max_executions: 30,
          timeframe: secondsInDay,
          cooldown: 10,
        },
      },
    },
  },

  data: new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Get information about server activity.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(Subcommands[0].data)
    .addSubcommand(Subcommands[1].data),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
