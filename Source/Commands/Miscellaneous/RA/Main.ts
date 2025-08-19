import IsModuleEnabled from "@Utilities/Database/IsModuleEnabled.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

const Subcommands = [
  (await import("./Subcmds/List.js")).default,
  (await import("./Subcmds/Admin.js")).default,
  (await import("./Subcmds/Manage.js")).default,
  (await import("./Subcmds/Request.js")).default,
];

// ---------------------------------------------------------------------------------------
async function Callback(_Client: DiscordClient, Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  const ModuleEnabled = await IsModuleEnabled(Interaction.guildId, "reduced_activity");

  if (ModuleEnabled === false && SubCommandName !== "list") {
    return new ErrorEmbed()
      .useErrTemplate("ReducedActivityModuleDisabled")
      .replyToInteract(Interaction, true, true);
  }

  for (const SubCommand of Subcommands) {
    if (SubCommand.data.name === SubCommandName && typeof SubCommand.callback === "function") {
      return SubCommand.callback(Interaction);
    }
  }
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject = {
  callback: Callback,
  options: {
    cooldown: 2.5,
    user_perms: {
      list: { management: true },
      admin: { management: true },
      $all_other: { staff: true },
    },
  },

  data: new SlashCommandBuilder()
    .setName("ra")
    .setDescription("Reduced activity related actions.")
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
};

for (const SubCommand of Subcommands) {
  CommandObject.data.addSubcommand(SubCommand.data);
}

// ---------------------------------------------------------------------------------------
export default CommandObject;
