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
    .setName("admin")
    .setDescription("Administrate individual callsigns."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
