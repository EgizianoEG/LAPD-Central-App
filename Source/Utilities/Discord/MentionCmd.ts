import { App as Client } from "#DiscordApp";

/**
 * Mentions a command by its full name given.
 * @param CmdName - The full name of the slash command to mention, including any subcommand groups or subcommands separated by one space.
 * @param GuildId - The ID of the guild where the command is registered. If not provided, it will use the global application commands.
 * @returns The formatted mention string. Unless an id for the command is found, the string will be formatted as `/<CmdName>`.
 */
export default function MentionCmdByName(CmdName: string, GuildId?: string): string {
  CmdName = CmdName.trim();
  const [BaseCommand] = CmdName.split(" ");
  let CommandID: string | null = null;

  if (GuildId) {
    const Guild = Client.guilds.cache.get(GuildId);
    if (!Guild) return `/${CmdName}`;
    CommandID = Guild.commands.cache.find((Cmd) => Cmd.name === BaseCommand)?.id ?? null;
  } else {
    CommandID =
      Client.application?.commands.cache.find((Cmd) => Cmd.name === BaseCommand)?.id ?? null;
  }

  return CommandID ? `</${CmdName}:${CommandID}>` : `/${CmdName}`;
}
