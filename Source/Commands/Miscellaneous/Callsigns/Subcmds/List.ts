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
    .setName("list")
    .setDescription("List currently assigned callsigns and/or pending approval ones."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
