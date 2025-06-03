import { SlashCommandSubcommandBuilder } from "discord.js";
import UANListCmdCallback from "@Utilities/Discord/UANsListCmdCallback.js";
// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: async (Interaction: SlashCommandInteraction<"cached">) =>
    UANListCmdCallback(Interaction, "ReducedActivity"),
  data: new SlashCommandSubcommandBuilder()
    .setName("list")
    .setDescription("Lists reduced activity records.")
    .addStringOption((Option) =>
      Option.setName("status")
        .setDescription(
          "The status of the RA records to be displayed, either active or pending; defaults to active."
        )
        .setChoices({ name: "Active", value: "Active" }, { name: "Pending", value: "Pending" })
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
