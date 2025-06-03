import { App as Client } from "@DiscordApp";

/**
 * Mentions a command by its full name given.
 * @param CmdName - The full name of the slash command to mention, including any subcommand groups or subcommands separated by one space.
 * @returns The formatted mention string. Unless an id for the command is found, the string will be formatted as `/<CmdName>`.
 */
export default function MentionCmdByName(CmdName: string): string {
  CmdName = CmdName.trim();
  const [BaseCommand] = CmdName.split(" ");
  const CommandID = Client.application?.commands.cache.find((Cmd) => Cmd.name === BaseCommand)?.id;

  return CommandID ? `</${CmdName}:${CommandID}>` : `/${CmdName}`;
}
