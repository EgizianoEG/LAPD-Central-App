import { SlashCommandSubcommandBuilder } from "discord.js";
import UANListCmdCallback from "#Utilities/Discord/UANsListCmdCallback.js";
// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: async (Interaction: SlashCommandInteraction<"cached">) =>
    UANListCmdCallback(Interaction, "LeaveOfAbsence"),
  data: new SlashCommandSubcommandBuilder()
    .setName("list")
    .setDescription("Displays the server's leave of absence records with a specified status.")
    .addStringOption((Option) =>
      Option.setName("status")
        .setDescription(
          "The status of the LOA records to be displayed, either active or pending; defaults to “Active.”"
        )
        .setChoices({ name: "Active", value: "Active" }, { name: "Pending", value: "Pending" })
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
