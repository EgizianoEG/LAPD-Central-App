import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  Message,
  ButtonStyle,
  MessageFlags,
  ComponentType,
  ButtonBuilder,
  ActionRowBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  SuccessContainer,
  ErrorContainer,
  InfoContainer,
  WarnContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import Dedent from "dedent";
import GetActiveShifts from "@Utilities/Database/GetShiftActive.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import HandleCollectorFiltering from "@Utilities/Other/HandleCollectorFilter.js";
import DisableMessageComponents from "@Utilities/Other/DisableMsgComps.js";
import HandleShiftRoleAssignment from "@Utilities/Other/HandleShiftRoleAssignment.js";
import HandleActionCollectorExceptions from "@Utilities/Other/HandleCompCollectorExceptions.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ActiveShift = await GetActiveShifts({ Interaction, UserOnly: true });
  if (!ActiveShift) {
    return new ErrorEmbed()
      .useErrTemplate("ShiftMustBeActive")
      .replyToInteract(Interaction, true, false);
  }

  const PromptDesc = Dedent(`
    **Are you sure you want to void the currently active shift of type \`${ActiveShift.type}\`?**
    **Note:** This action will permanently delete this shift from the shift records.
  `);

  const PromptContainer = new WarnContainer()
    .setTitle("Shift Void Confirmation")
    .setFooter("*This prompt will automatically cancel after five minutes of inactivity.*")
    .setDescription(PromptDesc);

  const PromptButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm-void:${Interaction.user.id}`)
      .setLabel("Confirm and Void")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancel-void:${Interaction.user.id}`)
      .setLabel("Cancel Shift Void")
      .setStyle(ButtonStyle.Secondary)
  );

  const PromptMessage = await Interaction.reply({
    components: [PromptContainer.attachPromptActionRows(PromptButtons)],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    withResponse: true,
  }).then((Resp) => Resp.resource!.message! as Message<true>);

  const DisablePrompt = () => {
    const APICompatibleComps = PromptMessage.components.map((Comp) => Comp.toJSON());
    const DisabledComponents = DisableMessageComponents(APICompatibleComps);
    return Interaction.editReply({
      components: DisabledComponents,
    });
  };

  await PromptMessage.awaitMessageComponent({
    filter: (ButtonInteract) => HandleCollectorFiltering(Interaction, ButtonInteract),
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  })
    .then(async (ButtonInteract) => {
      await ButtonInteract.deferUpdate();
      const ActiveShiftLatestVer = await GetActiveShifts({ Interaction, UserOnly: true });
      if (!ActiveShiftLatestVer) {
        return new ErrorContainer()
          .useErrTemplate("ShiftMustBeActive")
          .replyToInteract(ButtonInteract, true);
      } else if (ActiveShift._id !== ActiveShiftLatestVer._id) {
        return new ErrorContainer()
          .useErrTemplate("ShiftVoidMismatch")
          .replyToInteract(ButtonInteract, true);
      }

      if (ButtonInteract.customId.includes("confirm-void")) {
        const DelResponse = await ActiveShiftLatestVer.deleteOne().exec();
        if (!DelResponse.acknowledged) {
          return new ErrorContainer()
            .useErrTemplate("FailedToVoidShift")
            .replyToInteract(ButtonInteract, true);
        }

        return Promise.allSettled([
          ShiftActionLogger.LogShiftVoid(ActiveShiftLatestVer, ButtonInteract),
          HandleShiftRoleAssignment(
            "off-duty",
            ButtonInteract.client,
            ButtonInteract.guild,
            ButtonInteract.user.id
          ),
          ButtonInteract.editReply({
            components: [
              new SuccessContainer().setDescription(
                "Successfully voided and deleted the current active shift."
              ),
            ],
          }),
        ]);
      } else {
        return ButtonInteract.editReply({
          components: [
            new InfoContainer()
              .setTitle("Shift Void Cancelled")
              .setDescription(
                "Voiding the currently active shift has been cancelled and no changes have been made."
              ),
          ],
        });
      }
    })
    .catch((Err) => HandleActionCollectorExceptions(Err, DisablePrompt));
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("void")
    .setDescription("Voids a currently active shift, removing it from shift records."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
