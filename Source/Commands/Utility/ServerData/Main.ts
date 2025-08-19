import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ApplicationIntegrationType,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

const Subcommands = [(await import("./Subcmds/Manage.js")).default];

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
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  options: {
    cooldown: 2.5,
    user_perms: { manage: [PermissionFlagsBits.ManageGuild], $all_other: { management: true } },
  },

  data: new SlashCommandBuilder()
    .setName("server-data")
    .setDescription("Server data management related commands.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(Subcommands[0].data),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
