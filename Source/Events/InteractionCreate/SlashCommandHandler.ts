import AppError from "@Utilities/Classes/AppError.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import { MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { InfoEmbed, ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { GetErrorId } from "@Utilities/Strings/Random.js";
import {
  HandleCommandCooldowns,
  HandleDevOnlyCommands,
  HandleUserPermissions,
  HandleAppPermissions,
} from "@Utilities/Other/CommandExecutionGuards.js";

const FileLogLabel = "Events:InteractionCreate:SlashCommandHandler";
// ------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Handles the user execution of slash commands.
 * @param Client - The Discord client instance.
 * @param Interaction - The interaction object representing the slash command.
 * @throws {ReferenceError} If the command's callback function is not found.
 */
export default async function SlashCommandHandler(
  Client: DiscordClient,
  Interaction: ChatInputCommandInteraction
) {
  if (!Interaction.isChatInputCommand()) return;
  const CommandName = Interaction.commandName;
  const CommandObject = Client.commands.get(CommandName);
  const FullCmdName = [
    CommandName,
    Interaction.options.getSubcommandGroup(false),
    Interaction.options.getSubcommand(false),
  ]
    .filter(Boolean)
    .join(" ");

  try {
    if (!CommandObject) {
      AppLogger.warn({
        message:
          "Could not find the command object of slash command %o; terminating command execution.",
        label: FileLogLabel,
        splat: [FullCmdName],
        cmd_options: Interaction.options,
      });

      return new ErrorEmbed()
        .setDescription("Attempt execution of a non-existent command on the application.")
        .replyToInteract(Interaction, true);
    }

    await HandleCommandCooldowns(Interaction, CommandObject, FullCmdName);
    await HandleDevOnlyCommands(CommandObject, Interaction);
    await HandleUserPermissions(CommandObject, Interaction);
    await HandleAppPermissions(CommandObject, Interaction);
    if (Interaction.replied) return;

    if (typeof CommandObject.callback === "function") {
      if (CommandObject.callback.length > 1) {
        await (CommandObject.callback as AnySlashCmdCallback)(Client, Interaction);
      } else {
        await (CommandObject.callback as AnySlashCmdCallback)(Interaction);
      }

      AppLogger.debug({
        message: "Handled execution of slash command %o.",
        label: FileLogLabel,
        splat: [FullCmdName],
        execution_time: ReadableDuration(Date.now() - Interaction.createdTimestamp),
        stringified: Interaction.toString(),
        cmd_options: Interaction.options,
      });

      if (Interaction.replied || Interaction.deferred) return;
      await Interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new InfoEmbed()
            .setTitle("Hold up!")
            .setDescription("This command appears to be still being worked on."),
        ],
      });
    } else {
      throw new ReferenceError(
        `The slash command ${CommandName}'s callback function has not been found.`
      );
    }
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    AppLogger.error({
      message: "An error occurred while executing slash command %o;",
      label: FileLogLabel,
      error_id: ErrorId,
      stack: Err.stack,
      error: { ...Err },
      splat: [FullCmdName],
      cmd_options: Interaction.options,
    });

    if (Err instanceof AppError && Err.is_showable) {
      await new ErrorEmbed()
        .setTitle(Err.title)
        .setErrorId(ErrorId)
        .setDescription(Err.message)
        .replyToInteract(Interaction, true);
    } else {
      await new ErrorEmbed()
        .useErrTemplate("AppError")
        .setErrorId(ErrorId)
        .replyToInteract(Interaction, true);
    }
  }
}
