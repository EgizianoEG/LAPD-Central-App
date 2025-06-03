import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  codeBlock,
  EmbedBuilder,
  SlashCommandBuilder,
  InteractionContextType,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

// ---------------------------------------------------------------------------------------
/**
 * @param Client
 * @param Interaction
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const AutomoderationRules = await Interaction.guild.autoModerationRules.fetch();

  if (AutomoderationRules.size === 0) {
    return new ErrorEmbed()
      .setDescription("There are no auto-moderation rules in this guild to show.")
      .replyToInteract(Interaction, true);
  }

  const JSONConverted = AutomoderationRules.toJSON();
  let JsonString = JSON.stringify(JSONConverted, null, 2);
  const MaxLength = 1994;
  const Pages: EmbedBuilder[] = [];

  while (JsonString.length > MaxLength) {
    const PageContent = JsonString.substring(0, MaxLength);
    Pages.push(new EmbedBuilder().setDescription(codeBlock("json", PageContent)));
    JsonString = JsonString.substring(MaxLength);
  }

  if (JsonString.length > 0) {
    Pages.push(new EmbedBuilder().setDescription(codeBlock("json", JsonString)));
  }

  return HandlePagePagination({
    pages: Pages,
    interact: Interaction,
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  options: { dev_only: true },
  data: new SlashCommandBuilder()
    .setName("automod-rules-show")
    .setContexts(InteractionContextType.Guild)
    .setDescription("Shows auto-moderation rules for this server as a JSON object."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
