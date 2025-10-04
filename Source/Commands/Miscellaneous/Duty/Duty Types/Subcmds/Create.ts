// Dependencies:
// -------------

import {
  SlashCommandSubcommandBuilder,
  RoleSelectMenuBuilder,
  InteractionResponse,
  ButtonInteraction,
  ActionRowBuilder,
  escapeMarkdown,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  roleMention,
  Message,
  Colors,
} from "discord.js";

import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { IsValidShiftTypeName } from "@Utilities/Helpers/Validators.js";
import { ShiftTypeExists } from "@Utilities/Database/ShiftTypeValidators.js";

import Dedent from "dedent";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import CreateShiftType from "@Utilities/Database/CreateShiftType.js";
import HandleCollectorFiltering from "@Utilities/Discord/HandleCollectorFilter.js";
const ListFormatter = new Intl.ListFormat("en");

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Handles validation of the `name` interaction option (Shift Type Name).
 * @param Interaction - The user command interaction
 * @param ShiftTypeName - The provided name from the user
 * @returns The interaction reply (an error reply) if validation failed; otherwise a falsey value.
 */
async function HandleNameValidation(
  Interaction: SlashCommandInteraction<"cached">,
  ShiftTypeName: string
): Promise<Message<boolean> | InteractionResponse<boolean> | null> {
  if (!IsValidShiftTypeName(ShiftTypeName)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(Interaction, true);
  } else if (ShiftTypeName.match(/Default/i)) {
    return new ErrorEmbed()
      .useErrTemplate("PreservedShiftTypeCreation")
      .replyToInteract(Interaction, true);
  } else if (await ShiftTypeExists(Interaction.guildId, ShiftTypeName)) {
    return new ErrorEmbed()
      .useErrTemplate("ShiftTypeAlreadyExists", ShiftTypeName)
      .replyToInteract(Interaction, true);
  }

  return null;
}

/**
 * Handles the command execution process for creating a new duty shift type.
 * @param _ - The Discord.js client instance (not used in this function)
 * @param Interaction - The user command interaction
 * @description
 * This function guides the user through the process of creating a new duty shift type
 * by providing a prompt with instructions and components for role selection and confirmation.
 * It listens for user interactions and responds accordingly to create or cancel the shift type.
 *
 * @execution
 * 1. Validate the provided Shift Type Name using the `HandleNameValidation` function.
 * 2. If an error reply was sent during validation, return and exit the function.
 * 3. Construct a prompt embed containing instructions for creating a new shift type.
 * 4. Build action rows with components for role selection and confirmation buttons.
 * 5. Declare disable prompt components function to prevent further interaction with them later.
 * 6. Send the prompt embed as a reply to the user's interaction.
 * 7. Create a collector to listen for button and role menu interactions.
 * 8. Handle "collect" events by responding to button and role menu interactions.
 * 9. Handle the "end" event to process the results of the interaction.
 *    - Remove all event listeners
 *    - If the end reason is related to deletion of the prompt (e.g. guildDelete, channelDelete),
 *      - Return and halt the execution
 *    - If the end reason is "confirmation":
 *      - Attempt to create the new shift type in the database using `CreateShiftType` helper function.
 *      - Respond with a success embed or an error message.
 *    - If the end reason is "cancellation":
 *      - Respond with a cancellation message indicating user's request.
 *    - If the end reason is "idle":
 *      - Respond with a message indicating shift type creation was canceled due to inactivity.
 *    - If the end reason is "time":
 *      - Respond with a message indicating shift type creation was canceled due to exceeding time limit.
 * 10. Handle any errors that occurred during the process by sending an error reply and logging the error.
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ShiftTypeName = Interaction.options.getString("name", true);
  const IsDefaultType = !!Interaction.options.getBoolean("default", false);
  let ShiftTypePermittedRoles: string[] = [];

  await HandleNameValidation(Interaction, ShiftTypeName);
  if (Interaction.replied) return;

  const PromptEmbed = new EmbedBuilder()
    .setColor(Colors.DarkBlue)
    .setTitle("Shift Type Creation")
    .setDescription(
      Dedent(`
        - **Name:** \`${escapeMarkdown(ShiftTypeName)}\`
        - **Is Default:** \`${IsDefaultType ? "True" : "False"}\`
        - **Access Roles:**
          - Select roles below to limit who can use this shift type.
          - Leave the selection empty to make it available to all members.
          - Press the \`Confirm and Create\` button when finished to proceed with the creation.
  
        *This prompt will automatically cancel after five minutes of inactivity.*
      `)
    );

  const PromptComponents = [
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`dt-create-ar:${Interaction.user.id}`)
        .setPlaceholder("Specify which roles may utilize this shift type")
        .setMinValues(0)
        .setMaxValues(12)
    ) as ActionRowBuilder<RoleSelectMenuBuilder>,
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dt-create-confirm:${Interaction.user.id}`)
        .setLabel("Confirm and Create")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`dt-create-cancel:${Interaction.user.id}`)
        .setLabel("Cancel Creation")
        .setStyle(ButtonStyle.Secondary)
    ) as ActionRowBuilder<ButtonBuilder>,
  ];

  const PromptMessage = await Interaction.reply({
    embeds: [PromptEmbed],
    components: PromptComponents,
  });

  const CompCollector = PromptMessage.createMessageComponentCollector({
    filter: (Collected) => HandleCollectorFiltering(Interaction, Collected),
    idle: 5 * 60_000,
    time: 14.5 * 60_000,
  });

  CompCollector.on("collect", async (CollectInteraction) => {
    if (CollectInteraction.isButton()) {
      if (CollectInteraction.customId.includes("confirm")) {
        CompCollector.stop("confirmation");
      } else if (CollectInteraction.customId.includes("cancel")) {
        CompCollector.stop("cancellation");
      }
    } else if (CollectInteraction.isRoleSelectMenu()) {
      ShiftTypePermittedRoles = CollectInteraction.values;
      CollectInteraction.deferUpdate().catch(() => null);
    }
  });

  CompCollector.once("end", async (CollectedInt, EndReason) => {
    const LastInteraction = CollectedInt.last() ?? Interaction;
    if (EndReason.match(/^\w+Delete/)) return;

    try {
      if (LastInteraction instanceof ButtonInteraction && EndReason === "confirmation") {
        const Response = await CreateShiftType({
          name: ShiftTypeName,
          guild_id: Interaction.guildId,
          is_default: IsDefaultType,
          access_roles: ShiftTypePermittedRoles,
        });

        if (Response instanceof Error) {
          await new ErrorEmbed()
            .useErrClass(Response)
            .replyToInteract(LastInteraction, false, false);
        } else {
          const SuccessCreationEmbed = new SuccessEmbed()
            .setTitle("Shift Type Created")
            .setDescription(
              `**Name:** \`${Response.name}\`\n`,
              `**Is Default:** \`${Response.is_default ? "Yes" : "No"}\`\n`,
              "**Access Roles:**\n",
              ShiftTypePermittedRoles.length
                ? ListFormatter.format(ShiftTypePermittedRoles.map((RoleId) => roleMention(RoleId)))
                : "*Usable by all staff identified members*"
            );

          await LastInteraction.update({
            embeds: [SuccessCreationEmbed],
            components: [],
          });
        }
      } else if (LastInteraction instanceof ButtonInteraction && EndReason === "cancellation") {
        const CancellationRespEmbed = new InfoEmbed()
          .setTitle("Process Cancellation")
          .setDescription("Shift type creation has been cancelled at your request.");

        LastInteraction.update({
          embeds: [CancellationRespEmbed],
          components: [],
        });
      } else if (EndReason === "idle" || EndReason === "time") {
        PromptComponents[1].components.forEach((Button) => Button.setDisabled(true));
        PromptComponents[0].components[0].setDisabled(true);
        await LastInteraction.editReply({
          message: PromptMessage.id,
          components: PromptComponents,
        }).catch(() => null);
      }
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while creating a new duty shift type;",
        label: "Commands:Miscellaneous:DutyTypes:Create",
        stack: Err.stack,
        guild: Interaction.guildId,
      });

      await new ErrorEmbed()
        .useErrTemplate("AppError")
        .replyToInteract(LastInteraction, false, true);
    }
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  data: new SlashCommandSubcommandBuilder()
    .setName("create")
    .setDescription("Create a new duty shift type for managing and organizing shifts.")
    .addStringOption((Option) =>
      Option.setName("name")
        .setDescription("Name of the duty shift type (3-20 characters).")
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(true)
    )
    .addBooleanOption((Option) =>
      Option.setName("default")
        .setRequired(false)
        .setDescription("Set this type as default (overwrites existing default if true).")
    ),

  callback: Callback,
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
