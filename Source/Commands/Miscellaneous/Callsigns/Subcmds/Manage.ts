import { SlashCommandSubcommandBuilder } from "discord.js";
// ---------------------------------------------------------------------------------------
// Logic & Handling:
// -----------------
async function CmdCallback(Interaction: SlashCommandInteraction<"cached">) {}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage your currently assigned callsign or pending approval one."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
