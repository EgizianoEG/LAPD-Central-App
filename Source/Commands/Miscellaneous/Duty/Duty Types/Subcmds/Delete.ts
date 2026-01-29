// Dependencies:
// -------------

import {
  Colors,
  ButtonStyle,
  EmbedBuilder,
  ButtonBuilder,
  ComponentType,
  ActionRowBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { ShiftTypeExists } from "#Utilities/Database/ShiftTypeValidators.js";
import { IsValidShiftTypeName } from "#Utilities/Helpers/Validators.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "#Utilities/Classes/ExtraEmbeds.js";

import Dedent from "dedent";
import DeleteShiftType from "#Utilities/Database/DeleteShiftType.js";
import HandleCollectorFiltering from "#Utilities/Discord/HandleCollectorFilter.js";
import HandleActionCollectorExceptions from "#Utilities/Discord/HandleCompCollectorExceptions.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Handles validation of the `name` interaction option (Shift Type Name).
 * @param Interaction - The user command interaction
 * @param ShiftTypeName - The provided name from the user
 * @returns The interaction reply (an error reply) if validation failed; otherwise `undefined`
 */
async function HandleSTNameValidation(
  Interaction: SlashCommandInteraction<"cached">,
  ShiftTypeName: string
): Promise<boolean> {
  if (!IsValidShiftTypeName(ShiftTypeName)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (ShiftTypeName.match(/Default/i)) {
    return new ErrorEmbed()
      .useErrTemplate("PreservedShiftTypeDeletion")
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (!(await ShiftTypeExists(Interaction.guildId, ShiftTypeName)))
    return new ErrorEmbed()
      .useErrTemplate("NonexistentShiftTypeDeletion", ShiftTypeName)
      .replyToInteract(Interaction, true)
      .then(() => true);

  return false;
}

/**
 * Handles the command execution process for deleting a duty shift type.
 * @param _ - The Discord.js client instance (not used in this function)
 * @param Interaction - The user command interaction
 * @description
 * Handles the entire process of deleting a duty shift type. Validates the provided shift type name,
 * displays a confirmation prompt, waits for user interaction, and performs the deletion or cancellation.
 *
 * @execution
 * 1. Retrieve the provided shift type name from the interaction options.
 * 2. Validate the shift type name using the HandleNameValidation function.
 * 3. If validation fails or interaction is already replied, return early.
 * 4. Build and send the deletion confirmation prompt embed with components.
 * 5. Await user interaction (button click) with a timeout of 5 minutes.
 * 6. If timed out, cancel the deletion and reply with a cancellation message.
 * 7. If user clicks "Confirm and Delete," execute the deletion process.
 * 8. If deletion fails, send an error reply with the error details.
 * 9. If deletion is successful, reply with a success message.
 * 10. If user clicks "Cancel Deletion," reply with a cancellation message.
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ShiftTypeName = Interaction.options.getString("name", true);
  if (await HandleSTNameValidation(Interaction, ShiftTypeName)) return;

  const PromptEmbed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle("Confirmation Required")
    .setFooter({ text: "This prompt will automatically cancel after five minutes of inactivity." })
    .setDescription(
      Dedent(`
        **Are you sure you want to delete the shift type named \`${ShiftTypeName}\`?**
        **Note:** Deleting the shift type will not erase the logged shift data associated with it. This data can still be accessed by recreating the shift type with the same name.
      `)
    );

  const PromptComponents = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dt-delete-confirm:${Interaction.user.id}:${Interaction.guildId}`)
        .setLabel("Confirm and Delete")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`dt-delete-cancel:${Interaction.user.id}:${Interaction.guildId}`)
        .setLabel("Cancel Deletion")
        .setStyle(ButtonStyle.Secondary)
    ) as ActionRowBuilder<ButtonBuilder>,
  ];

  const PromptMessage = await Interaction.reply({
    embeds: [PromptEmbed],
    components: PromptComponents,
    withResponse: true,
  }).then((Res) => Res.resource!.message!);

  await PromptMessage.awaitMessageComponent({
    filter: (ButtonInteract) => HandleCollectorFiltering(Interaction, ButtonInteract),
    componentType: ComponentType.Button,
    time: 5 * 60_000,
  })
    .then(async (ButtonInteract) => {
      if (ButtonInteract.customId.includes("confirm")) {
        await DeleteShiftType(ShiftTypeName, Interaction.guildId);
        return ButtonInteract.update({
          components: [],
          embeds: [
            new SuccessEmbed().setDescription(
              "Successfully deleted `%s` shift type.",
              ShiftTypeName
            ),
          ],
        });
      } else {
        return ButtonInteract.update({
          components: [],
          embeds: [
            new InfoEmbed()
              .setTitle("Deletion Cancelled")
              .setDescription(
                "Deletion cancelled for the `%s` shift type at your request.",
                ShiftTypeName
              ),
          ],
        });
      }
    })
    .catch((Err) => HandleActionCollectorExceptions(Err, PromptMessage));
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  data: new SlashCommandSubcommandBuilder()
    .setName("delete")
    .setDescription("Delete and remove a specific duty shift type.")
    .addStringOption((Option) =>
      Option.setName("name")
        .setDescription("The shift type to be deleted.")
        .setMinLength(3)
        .setMaxLength(20)
        .setAutocomplete(true)
        .setRequired(true)
    ),

  callback: Callback,
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
