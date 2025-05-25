import { secondsInDay } from "date-fns/constants";
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ApplicationIntegrationType,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

const Subcommands = [
  (await import("./Subcmds/Search.js")).default,
  (await import("./Subcmds/Replace.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === Interaction.options.getSubcommand()) {
      if (typeof Subcommand.callback === "function") {
        return Subcommand.callback(Interaction);
      } else {
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  options: {
    app_perms: { replace: [PermissionFlagsBits.ManageNicknames] },
    user_perms: { replace: [PermissionFlagsBits.Administrator], $all_other: { staff: true } },
    cooldown: {
      search: {
        $user: {
          max_executions: 20,
          timeframe: secondsInDay,
          cooldown: 15,
        },
      },
      replace: {
        $user: 60,
        $guild: {
          max_executions: 4,
          timeframe: secondsInDay,
          cooldown: 2 * 60,
        },
      },
    },
  },

  data: new SlashCommandBuilder()
    .setName("nicknames")
    .setDescription("Utility commands for member nicknames.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(Subcommands[0].data)
    .addSubcommand(Subcommands[1].data),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
