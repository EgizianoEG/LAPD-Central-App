import IncidentModel from "@Models/Incident.js";
import { HandleCommandValidationAndPossiblyGetIncident } from "./UpdateIncidentReport.js";
import {
  MessageContextMenuCommandInteraction,
  ApplicationIntegrationType,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  InteractionContextType,
  ActionRowBuilder,
  ComponentType,
  ButtonBuilder,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import {
  ErrorContainer,
  InfoContainer,
  WarnContainer,
} from "@Utilities/Classes/ExtraContainers.js";

// ---------------------------------------------------------------------------------------
// Handling:
// ---------
async function Callback(Interaction: MessageContextMenuCommandInteraction<"cached">) {
  const ValidationResult = await HandleCommandValidationAndPossiblyGetIncident(Interaction);
  const MsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  if (ValidationResult.handled && !ValidationResult.incident) return;
  await Interaction.deferReply({ flags: MsgFlags });

  const IncidentRecord = ValidationResult.incident!;
  const ConfirmationComponents = GetDeleteConfirmationButtons();
  const DeletionPromptContainer = new WarnContainer()
    .setTitle("Incident Report Deletion")
    .setDescription(
      `Please confirm your intent to the deletion of incident report with number \`${IncidentRecord.num}\` from the database.\n`
    )
    .setFooter("The deletion will be cancelled automatically after five minutes.")
    .attachPromptActionRows(ConfirmationComponents);

  const PromptMessage = await Interaction.editReply({
    components: [DeletionPromptContainer],
    flags: MsgFlags,
  });

  const ButtonInteract = await PromptMessage.awaitMessageComponent({
    filter: (ButtonInteract) => ButtonInteract.user.id === Interaction.user.id,
    componentType: ComponentType.Button,
    time: 5 * 60_000,
  }).catch(() => null);

  if (!ButtonInteract) {
    return Interaction.deleteReply().catch(() => null);
  } else if (ButtonInteract.customId.includes("cancel")) {
    await ButtonInteract.deferUpdate();
    return Interaction.deleteReply().catch(() => null);
  } else if (ButtonInteract.customId.includes("confirm")) {
    const DeletedReport = await IncidentModel.findOneAndDelete(
      { _id: IncidentRecord._id, guild: Interaction.guildId },
      { projection: { _id: 1, num: 1 }, lean: true }
    ).exec();

    if (!DeletedReport) {
      return ButtonInteract.update({
        components: [new ErrorContainer().useErrTemplate("UpdateIncidentReportDBFailed")],
        flags: MsgFlags,
      });
    }

    await ButtonInteract.update({
      flags: MsgFlags,
      components: [
        new InfoContainer()
          .setTitle("Incident Report Deleted")
          .setDescription(
            `Incident report with number \`${DeletedReport.num}\` has been deleted successfully from the database.`
          ),
      ],
    });
  }
}

function GetDeleteConfirmationButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ir-delete-confirm")
      .setLabel("Confirm and Delete")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ir-delete-cancel")
      .setLabel("Cancel Deletion")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ---------------------------------------------------------------------------------------
// Command Definition:
// -------------------
const CommandObject: ContextMenuCommandObject = {
  callback: Callback,
  options: { user_perms: { management: true }, cooldown: 5 },
  data: new ContextMenuCommandBuilder()
    .setName("Delete Incident Report")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .setType(ApplicationCommandType.Message),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
