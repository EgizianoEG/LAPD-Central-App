import { Colors } from "@Config/Shared.js";
import {
  InteractionContextType,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

// ---------------------------------------------------------------------------------------
async function Callback(Interaction: SlashCommandInteraction) {
  const ResponseEmbed = new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle("Help and Information")
    .setDescription(
      "For more information and assistance with LAPD Central, please visit our [documentation site](https://lapd-central-app.gitbook.io/documentation)."
    );

  return Interaction.reply({
    embeds: [ResponseEmbed],
    flags: MessageFlags.Ephemeral,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject = {
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Learn more about LAPD Central.")
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
