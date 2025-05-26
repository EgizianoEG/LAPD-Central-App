// Dependencies:
// -------------

import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { ErrorMessages } from "@Resources/AppMessages.js";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  ActionRowBuilder,
  ComponentType,
  ButtonBuilder,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import {
  WarnContainer,
  InfoContainer,
  SuccessContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import HandleActionCollectorExceptions from "@Utilities/Other/HandleCompCollectorExceptions.js";
import UpdateLinkedRobloxUser from "@Utilities/Database/UpdateLinkedUser.js";
import IsUserLoggedIn from "@Utilities/Database/IsUserLoggedIn.js";
import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";

// ---------------------------------------------------------------------------------------
// Functions:
// -----------
/**
 * Handles the case where the command runner is not logged in
 * @param Interaction
 * @param IsLoggedIn
 * @returns A boolean indication if the interaction was handled or not.
 */
async function HandleLoggedInUser(
  Interaction: SlashCommandInteraction,
  IsLoggedIn: boolean
): Promise<boolean> {
  if (!IsLoggedIn) {
    return Interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new ErrorEmbed()
          .setTitle(ErrorMessages.LORobloxUserNotLinked.Title)
          .setDescription(ErrorMessages.LORobloxUserNotLinked.Description),
      ],
    }).then(() => true);
  }
  return false;
}

/**
 * Handles the logic for the command interaction to log out and unlink a Roblox account.
 * @param Interaction
 * @execution
 * This function executes the following steps:
 * 1. Check if the command runner is already logged in; if not, provide an error message.
 * 2. Retrieve the logged-in user's Roblox username.
 * 3. Create buttons for "Confirm and Log Out" and "Cancel".
 * 4. Send a prompt embed along with the buttons to the user.
 * 5. Await a button interaction within a time limit.
 * 6. Based on the button interaction:
 *    - If "Confirm and Log Out" is clicked, update linked Roblox user data, disable the prompt, and reply with a success message.
 *    - If "Cancel" is clicked, disable the prompt and reply with a cancellation message.
 * 7. Handle errors, including timeouts, with appropriate responses.
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const UserLoggedIn = await IsUserLoggedIn(Interaction);
  if (await HandleLoggedInUser(Interaction, !!UserLoggedIn)) return;

  const MsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  const RobloxUsername = (await GetUserInfo(UserLoggedIn)).name;
  const ButtonsActionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("Confirm and Log Out")
      .setCustomId("confirm-logout")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel("Cancel")
      .setCustomId("cancel-logout")
      .setStyle(ButtonStyle.Secondary)
  );

  const PromptContainer = new WarnContainer()
    .setTitle("Logout Process")
    .setFooter("*This prompt will automatically cancel after 5 minutes of inactivity.*")
    .setDescription(
      `Are you sure that you want to log out and unlink your Roblox account, \`${RobloxUsername}\`, from the application?\n` +
        "- To confirm your log out, press the `Confirm and Log Out` button\n" +
        "- To cancel the logout, press the `Cancel` button\n\n"
    );

  const PromptReply = await Interaction.reply({
    components: [PromptContainer.attachPromptActionRows(ButtonsActionRow)],
    flags: MsgFlags,
  });

  return PromptReply.awaitMessageComponent({
    componentType: ComponentType.Button,
    time: 5 * 60_000,
  })
    .then(async (ButtonAction) => {
      await ButtonAction.deferUpdate();
      if (ButtonAction.customId === "confirm-logout") {
        await UpdateLinkedRobloxUser(Interaction);
        return ButtonAction.editReply({
          flags: MsgFlags,
          components: [
            new SuccessContainer().setDescription(
              "Successfully unlinked Roblox account `%s` and logged out of the application.",
              RobloxUsername
            ),
          ],
        });
      } else {
        return ButtonAction.editReply({
          flags: MsgFlags,
          components: [
            new InfoContainer()
              .setTitle("Process Cancellation")
              .setDescription("Logout process has been cancelled at your request."),
          ],
        });
      }
    })
    .catch((Err) => HandleActionCollectorExceptions(Err, PromptReply));
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject = {
  callback: Callback,
  options: { cooldown: 10 },
  data: new SlashCommandBuilder()
    .setName("log-out")
    .setDescription("Log out and unlink the associated Roblox account from the application.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
