import Dedent from "dedent";
import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import { FilterUserInput } from "@Utilities/Strings/Redactor.js";
import {
  SlashCommandSubcommandsOnlyBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  codeBlock,
  Colors,
} from "discord.js";

// ---------------------------------------------------------------------------------------
/**
 * @param Client
 * @param Interaction
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const InputModal = new ModalBuilder()
    .setCustomId(`filter-input:${Interaction.user.id}:${Interaction.createdTimestamp}`)
    .setTitle("Filter Input")
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("input")
          .setLabel("Input String")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

  const ModalSubmission = await ShowModalAndAwaitSubmission(
    Interaction,
    InputModal,
    10 * 60 * 1000
  );

  if (!ModalSubmission) return;
  await ModalSubmission.deferReply({ flags: MessageFlags.Ephemeral });

  const InputString = ModalSubmission.fields.getTextInputValue("input");
  const FilteredString = await FilterUserInput(InputString, {
    guild_instance: Interaction.guild,
    filter_links_emails: true,
    replacement: "#",
  });

  const ResponseMessage = new EmbedBuilder().setColor(Colors.DarkAqua).setDescription(
    Dedent(`
      ### Original input:
      ${codeBlock(InputString)}
      ### Filtered input:
      ${codeBlock(FilteredString)}  
    `)
  );

  return ModalSubmission.editReply({ embeds: [ResponseMessage] });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  options: { dev_only: true },
  data: new SlashCommandBuilder()
    .setName("filter-input")
    .setContexts(InteractionContextType.Guild)
    .setDescription("Filters an input string."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
