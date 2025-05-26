// Dependencies:
// -------------
import { SlashCommandSubcommandBuilder } from "discord.js";
import { SharedCmdOptions } from "./CitWarn.js";
import { ReporterInfo } from "../Log.js";
import AnyCitationCallback from "./Funcs/AnyCitationHandler.js";
const CmdFileLabel = "Commands:Miscellaneous:Log:CitFine";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function CitFineCmdCallback(
  Interaction: SlashCommandInteraction<"cached">,
  CitingOfficer: ReporterInfo
) {
  return AnyCitationCallback(Interaction, CitingOfficer, CmdFileLabel);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CitFineCmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("citation-fine")
    .setDescription("Creates and logs a notice to appear as a citation record for a person.")
    .addStringOption((Option) =>
      Option.setName("name")
        .setDescription("The username of the violator.")
        .setRequired(true)
        .setMaxLength(3)
        .setMaxLength(20)
        .setAutocomplete(true)
    )
    .addIntegerOption((Option) =>
      Option.setName("fine-amount")
        .setDescription("The amount of the fine in US dollars ($).")
        .setRequired(true)
        .setMinValue(20)
        .setMaxValue(1000)
    ),
};

SharedCmdOptions.forEach((Option, Index) => {
  if (Index === 0) return;
  CommandObject.data.options.push(Option);
});

// ---------------------------------------------------------------------------------------
export default CommandObject;
