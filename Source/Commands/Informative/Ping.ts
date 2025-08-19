import { InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { SuccessContainer } from "@Utilities/Classes/ExtraContainers.js";

// ---------------------------------------------------------------------------------------
async function Callback(Client: DiscordClient, Interaction: SlashCommandInteraction) {
  const MsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  await Interaction.deferReply({ flags: MsgFlags });
  const Reply = await Interaction.fetchReply();
  const ResponseLatency = Reply.createdTimestamp - Interaction.createdTimestamp;

  const ResponseContainer = new SuccessContainer().setDescription(
    "Round Trip Latency: `%ims`\n" + "Websocket: `%ims`\n",
    ResponseLatency,
    Math.max(Client.ws.ping, 0)
  );

  return Interaction.editReply({
    components: [ResponseContainer],
    flags: MsgFlags,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject = {
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Shows the arpproximate current response latency of the app and the websocket connection."
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
