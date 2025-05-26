import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import { ErrorContainer } from "@Utilities/Classes/ExtraContainers.js";
import {
  SlashCommandSubcommandsOnlyBuilder,
  ModalSubmitInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  MessageFlags,
  ModalBuilder,
  codeBlock,
} from "discord.js";

// ---------------------------------------------------------------------------------------

async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ComponentsInput = new TextInputBuilder()
    .setCustomId("components_input")
    .setLabel("Components V2 Array (JSON format)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter your Components V2 array as JSON...")
    .setRequired(true);

  const ActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(ComponentsInput);
  const JSONInputModal = new ModalBuilder()
    .setCustomId("components_v2_modal")
    .setTitle("Components V2 Message Creator")
    .addComponents(ActionRow);

  const ModalSubmission = await ShowModalAndAwaitSubmission(
    Interaction,
    JSONInputModal,
    5 * 60_000
  );

  if (!ModalSubmission) return;
  await HandleModalSubmit(ModalSubmission);
}

async function HandleModalSubmit(Interaction: ModalSubmitInteraction<"cached">) {
  try {
    const ComponentsText = Interaction.fields.getTextInputValue("components_input");
    const ComponentsArray = JSON.parse(ComponentsText);

    return Interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: ComponentsArray,
    });
  } catch (Err: any) {
    return new ErrorContainer()
      .setDescription(`Error processing components:\n${codeBlock(Err)}`)
      .replyToInteract(Interaction, true);
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  options: { dev_only: true },
  data: new SlashCommandBuilder()
    .setName("cv2-send-message")
    .setContexts(InteractionContextType.Guild)
    .setDescription("Creates a message with custom Components V2 array."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
