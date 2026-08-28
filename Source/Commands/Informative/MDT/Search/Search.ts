import { SlashCommandSubcommandGroupBuilder } from "discord.js";
const Subcommands = [
  (await import("./Subcmds/Arrest.js")).default,
  (await import("./Subcmds/Citation.js")).default,
  (await import("./Subcmds/Incident.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * @param Client
 * @param Interaction
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const SubcommandName = Interaction.options.getSubcommand();

  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === SubcommandName) {
      if (typeof Subcommand.callback === "function") {
        return Subcommand.callback(Interaction);
      }

      break;
    }
  }
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const SubcommandGroupObject = {
  callback: Callback,
  data: new SlashCommandSubcommandGroupBuilder()
    .setName("search")
    .setDescription("Search for specific MDT entries."),
};

for (const Subcommand of Subcommands) {
  SubcommandGroupObject.data.addSubcommand(Subcommand.data);
}

// ---------------------------------------------------------------------------------------
export default SubcommandGroupObject;
