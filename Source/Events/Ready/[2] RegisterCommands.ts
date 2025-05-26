import { Discord } from "@Config/Secrets.js";
import {
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  GuildApplicationCommandManager,
  ApplicationCommandManager,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  ApplicationCommand,
  Collection,
  Guild,
} from "discord.js";

import GetDeployedCommands from "@Utilities/Other/GetAppCmds.js";
import CmdsAreIdentical from "@Utilities/Other/CmdsAreIdentical.js";
import GetLocalCommands from "@Utilities/Other/GetLocalCmds.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Chalk from "chalk";
import Util from "node:util";

type LocalCmds = Awaited<ReturnType<typeof GetLocalCommands>>;
const LogLabel = "Events:Ready:RegisterCommands";

/**
 * Handles command registration, deployment, and updates.
 * @param Client - The Discord.js client instance.
 * @returns A promise that resolves when all commands are registered and deployed successfully.
 */
export default async function RegisterCommands(Client: DiscordClient): Promise<void> {
  AppLogger.debug({
    message: "Started registering and deploying application commands...",
    label: LogLabel,
  });

  try {
    const TestingGuild = Client.guilds.cache.get(Discord.TestGuildId);
    const [AppCommands, LocalCommands, TestingGuildCommands] = await Promise.all([
      GetDeployedCommands(Client),
      GetLocalCommands(),
      TestingGuild ? TestingGuild.commands.fetch() : null,
    ]);

    const AppCommandsMap = new Collection(AppCommands.cache.map((Cmd) => [Cmd.name, Cmd]));
    const GuildCommandsMap = TestingGuildCommands
      ? new Collection(TestingGuildCommands.map((Cmd) => [Cmd.name, Cmd]))
      : new Collection<string, DiscordJS.ApplicationCommand>();

    const CategorizedCmds = await CategorizeCommands(
      Client,
      LocalCommands,
      AppCommandsMap,
      GuildCommandsMap,
      TestingGuild
    );

    const TotalCommandChanges =
      CategorizedCmds.GlobalCommands.length +
      CategorizedCmds.DeletedCommands.length +
      CategorizedCmds.CommandsToUpdate.length +
      CategorizedCmds.GuildOnlyCommands.length +
      CategorizedCmds.CommandsForScopeSwitch.length;

    if (TotalCommandChanges > 5) {
      // Use bulk processing for more than 5 changes or during
      // the initial deployment to avoid rate limits.
      await BulkProcessAllCommands(
        Client,
        CategorizedCmds,
        TestingGuild,
        AppCommandsMap,
        GuildCommandsMap
      );
    } else {
      const CommandProcessingPromises: Promise<any>[] = [];
      CommandProcessingPromises.push(
        ProcessCommandsToUpdate(Client, CategorizedCmds.CommandsToUpdate)
      );

      CommandProcessingPromises.push(
        ProcessDeletedCommands(CategorizedCmds.DeletedCommands, AppCommandsMap, GuildCommandsMap)
      );

      if (CategorizedCmds.CommandsForScopeSwitch.length > 0) {
        for (const LocalCommand of CategorizedCmds.CommandsForScopeSwitch) {
          const CmdName = LocalCommand.data.name;
          const AppDeployedCmd = AppCommandsMap.get(CmdName) ?? GuildCommandsMap.get(CmdName);
          if (AppDeployedCmd) {
            CommandProcessingPromises.push(
              HandleCommandScopeSwitching(Client, LocalCommand, AppDeployedCmd)
            );
          }
        }
      }

      await Promise.all(CommandProcessingPromises);
      if (TestingGuild && CategorizedCmds.GuildOnlyCommands.length > 0) {
        await RegisterGuildCommands(Client, TestingGuild, CategorizedCmds.GuildOnlyCommands);
      }

      if (CategorizedCmds.GlobalCommands.length > 0) {
        await RegisterGlobalCommands(Client, AppCommands, CategorizedCmds.GlobalCommands);
      }
    }

    const GlobalRegCmds = Client.application.commands.cache.size;
    const GuildRegCmds = TestingGuild?.commands.cache.size ?? 0;
    const LocallyRegCmds = Client.commands.size + Client.ctx_commands.size;
    const PluralLocalCmds = [LocallyRegCmds > 1 ? "s" : "", LocallyRegCmds > 1 ? "have" : "has"];

    const DeployedDetailsText = Util.format(
      "(%s global, %s guild-only)",
      Chalk.yellow(GlobalRegCmds),
      Chalk.yellow(GuildRegCmds)
    );

    const LocalRegDetailsText = Util.format(
      "(%s slash, %s context menu)",
      Chalk.yellow(Client.commands.size),
      Chalk.yellow(Client.ctx_commands.size)
    );

    AppLogger.info({
      message: "Command registration complete: %o local command%s registered %s, %o deployed %s.",
      label: LogLabel,
      local_cmds: {
        context_menu: Client.ctx_commands.map((Cmd) => Cmd.data.name),
        slash_cmds: Client.commands.map((Cmd) => Cmd.data.name),
      },
      deployed_cmds: {
        global_cmds: Client.application.commands.cache.map((Cmd) => Cmd.name),
        guild_cmds: TestingGuild?.commands.cache.map((Cmd) => Cmd.name) ?? null,
      },
      splat: [
        LocallyRegCmds,
        PluralLocalCmds[0],
        Chalk.dim(LocalRegDetailsText),
        GlobalRegCmds + GuildRegCmds,
        Chalk.dim(DeployedDetailsText),
        GlobalRegCmds,
        GuildRegCmds,
      ],
    });
  } catch (Err: unknown) {
    AppLogger.error({
      message: "An error occurred while registering commands.",
      label: LogLabel,
      stack: (Err as Error).stack,
      error: { ...(Err as Error) },
    });
  }
}

// -----------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Determines whether the provided command object is a context menu command or a slash command.
 * @param Cmd - The command object, which can be either a SlashCommandObject or a ContextMenuCommandObject.
 * @returns A string indicating whether the command is a "context menu command" or a "slash command".
 */
function SlashCmdOrContextMenuCmdText(Cmd: SlashCommandObject | ContextMenuCommandObject) {
  return Cmd.data instanceof ContextMenuCommandBuilder ? "context menu command" : "slash command";
}

/**
 * Categorizes local command definitions against currently deployed application and guild commands,
 * determining which commands should be registered globally, registered only in a testing guild,
 * deleted, or updated.
 *
 * @param Client - The Discord client instance.
 * @param LocalCommands - An array of local command definitions to be processed.
 * @param AppCommandsMap - A map of globally deployed application commands, keyed by command name.
 * @param GuildCommandsMap - A map of guild-specific deployed commands, keyed by command name.
 * @param TestingGuild - The testing guild where development-only commands may be registered.
 * @returns An object containing arrays of commands to be registered globally, registered in the guild, deleted, and updated.
 */
async function CategorizeCommands(
  Client: DiscordClient,
  LocalCommands: LocalCmds,
  AppCommandsMap: Map<string, ApplicationCommand>,
  GuildCommandsMap: Map<string, ApplicationCommand>,
  TestingGuild?: Guild
) {
  const CommandsForScopeSwitch: LocalCmds = [];
  const GuildOnlyCommands: LocalCmds = [];
  const GlobalCommands: LocalCmds = [];
  const DeletedCommands: LocalCmds = [];
  const CommandsToUpdate: [ApplicationCommand, LocalCmds[number]][] = [];

  for (const LocalCommand of LocalCommands) {
    const CmdName = LocalCommand.data.name;
    const AppDeployedCmd = AppCommandsMap.get(CmdName);
    const GuildExistingCmd = GuildCommandsMap.get(CmdName);

    if (LocalCommand.options?.deleted) {
      if (AppDeployedCmd || GuildExistingCmd) {
        DeletedCommands.push(LocalCommand);
      } else {
        AppLogger.info({
          message: "Registering '%s' command was skipped; property 'deleted' is set to true.",
          splat: [Chalk.bold(CmdName)],
          label: LogLabel,
        });
      }
      continue;
    }

    if (AppDeployedCmd) {
      const CmdManager = AppDeployedCmd.manager;
      if (
        (CmdManager.constructor === ApplicationCommandManager && LocalCommand.options?.dev_only) ||
        (CmdManager.constructor === GuildApplicationCommandManager &&
          !LocalCommand.options?.dev_only)
      ) {
        CommandsForScopeSwitch.push(LocalCommand);
        RegisterCommandInClient(Client, LocalCommand);
      } else if (
        LocalCommand.options?.force_update ||
        !CmdsAreIdentical(AppDeployedCmd, LocalCommand)
      ) {
        CommandsToUpdate.push([AppDeployedCmd, LocalCommand]);
      } else {
        RegisterCommandInClient(Client, LocalCommand);
      }
      continue;
    }

    if (GuildExistingCmd) {
      const CmdManager = GuildExistingCmd.manager;
      if (
        (CmdManager.constructor === ApplicationCommandManager && LocalCommand.options?.dev_only) ||
        (CmdManager.constructor === GuildApplicationCommandManager &&
          !LocalCommand.options?.dev_only)
      ) {
        CommandsForScopeSwitch.push(LocalCommand);
        RegisterCommandInClient(Client, LocalCommand);
      } else if (
        LocalCommand.options?.force_update ||
        !CmdsAreIdentical(GuildExistingCmd, LocalCommand)
      ) {
        CommandsToUpdate.push([GuildExistingCmd, LocalCommand]);
      } else {
        RegisterCommandInClient(Client, LocalCommand);
      }
      continue;
    }

    if (LocalCommand.options?.dev_only) {
      if (TestingGuild) {
        GuildOnlyCommands.push(LocalCommand);
      } else {
        AppLogger.info({
          message:
            "Registering '%s' command skipped; could not find the testing guild to register on.",
          splat: [Chalk.bold(CmdName)],
          label: LogLabel,
        });
      }
    } else {
      GlobalCommands.push(LocalCommand);
    }
  }

  return {
    GlobalCommands,
    GuildOnlyCommands,
    DeletedCommands,
    CommandsToUpdate,
    CommandsForScopeSwitch,
  };
}

/**
 * Registers a command in the appropriate client collection
 * @param Client Discord client instance
 * @param Command Command object to register
 */
function RegisterCommandInClient(
  Client: DiscordClient,
  Command: SlashCommandObject | ContextMenuCommandObject
) {
  const CommandName = Command.data.name;
  if (Command.data instanceof ContextMenuCommandBuilder) {
    Client.ctx_commands.set(CommandName, Command as ContextMenuCommandObject);
  } else {
    Client.commands.set(CommandName, Command as SlashCommandObject<SlashCommandBuilder>);
  }
}

/**
 * Processes and deletes commands that are no longer present locally but still exist in the application's or guild's command maps.
 * @param DeletedCommands - An array of local command definitions that should be deleted.
 * @param AppCommandsMap - A map of global application commands, keyed by command name.
 * @param GuildCommandsMap - A map of guild-specific application commands, keyed by command name.
 * @returns A promise that resolves when all deletions have been attempted.
 */
function ProcessDeletedCommands(
  DeletedCommands: LocalCmds,
  AppCommandsMap: Map<string, DiscordJS.ApplicationCommand>,
  GuildCommandsMap: Map<string, DiscordJS.ApplicationCommand>
): Promise<unknown> {
  return Promise.all(
    DeletedCommands.map(async (LocalCmd) => {
      const CmdName = LocalCmd.data.name;
      const ExistingCmd = AppCommandsMap.get(CmdName) || GuildCommandsMap.get(CmdName);
      const CmdManager = ExistingCmd?.manager;
      if (!CmdManager) return;

      return CmdManager.delete(ExistingCmd.id)
        .then(() => {
          AppLogger.info({
            message: "'%s' slash command has been deleted%s; property 'deleted' is set to true.",
            label: LogLabel,
            splat: [
              Chalk.bold(ExistingCmd.name),
              CmdManager instanceof GuildApplicationCommandManager ? " (guild scope)" : " globally",
            ],
          });
        })
        .catch((Err) => {
          AppLogger.error({
            label: LogLabel,
            message: "Failed to delete '%s' slash command.",
            splat: [Chalk.bold(ExistingCmd.name)],
            stack: (Err as Error).stack,
          });
        });
    })
  );
}

/**
 * Updates a list of existing Discord application commands with new local command data.
 * Uses individual updates for 5 or fewer commands, and a bulk update with a single API call for more than 5 commands.
 * @param Client - The Discord client instance to register updated commands with.
 * @param CommandsToUpdate - An array of tuples, each containing an existing Discord application command and its corresponding local command definition.
 * @returns A promise that resolves when all command updates have been attempted.
 */
function ProcessCommandsToUpdate(
  Client: DiscordClient,
  CommandsToUpdate: [DiscordJS.ApplicationCommand, LocalCmds[number]][]
): Promise<unknown> {
  return Promise.all(
    CommandsToUpdate.map(async ([ExistingCmd, LocalCmd]) => {
      let GuildId: string | null = ExistingCmd.guildId;
      const CmdManager = ExistingCmd.manager;
      const SlashOrContext = SlashCmdOrContextMenuCmdText(LocalCmd);

      // Handle scope switching if necessary.
      if (LocalCmd.options?.dev_only && !ExistingCmd.guildId) {
        GuildId = Discord.TestGuildId ?? null;
      } else if (!LocalCmd.options?.dev_only && ExistingCmd.guildId) {
        GuildId = null;
      }

      await (
        GuildId
          ? CmdManager.edit(ExistingCmd.id, LocalCmd.data, GuildId)
          : CmdManager.edit(ExistingCmd.id, LocalCmd.data)
      )
        .then((Cmd) => {
          RegisterCommandInClient(Client, LocalCmd);
          AppLogger.info({
            message: "Successfully updated '%s' %s %s.",
            splat: [Chalk.bold(Cmd.name), Cmd.guildId ? "guild-scoped" : "global", SlashOrContext],
            label: LogLabel,
          });
        })
        .catch((Err) => {
          AppLogger.error({
            message: "Failed to update '%s' %s.",
            splat: [Chalk.bold(ExistingCmd.name), SlashOrContext],
            stack: (Err as Error).stack,
            label: LogLabel,
          });
        });
    })
  );
}

/**
 * Registers a set of guild-specific commands for a Discord bot.
 * @param Client - The Discord client instance used to interact with the Discord API.
 * @param TestingGuild - The guild (server) where the commands will be registered.
 * @param GuildOnlyCommands - An array of local command definitions to be registered in the guild.
 * @returns A promise that resolves when all commands have been successfully registered.
 */
async function RegisterGuildCommands(
  Client: DiscordClient,
  TestingGuild: DiscordJS.Guild,
  GuildOnlyCommands: LocalCmds
): Promise<void> {
  for (const LocalCommand of GuildOnlyCommands) {
    const SlashOrContext = SlashCmdOrContextMenuCmdText(LocalCommand);
    await TestingGuild.commands
      .create(LocalCommand.data)
      .then(() => {
        RegisterCommandInClient(Client, LocalCommand);
        AppLogger.info({
          message: "'%s' %s has been registered on '%s' server.",
          label: LogLabel,
          splat: [
            Chalk.bold(LocalCommand.data.name),
            SlashOrContext,
            Chalk.bold(TestingGuild.name),
          ],
        });
      })
      .catch((Err) => {
        AppLogger.error({
          message: "Failed to register '%s' %s.",
          splat: [Chalk.bold(LocalCommand.data.name), SlashOrContext],
          stack: (Err as Error).stack,
          label: LogLabel,
        });
      });
  }
}

/**
 * Registers global application commands for the app.
 * @param Client - The Discord client instance used to manage the bot's state.
 * @param CommandManager - The manager responsible for handling application commands.
 * @param GlobalCommands - A collection of local commands to be registered globally.
 * @returns A promise that resolves when all commands have been registered.
 */
async function RegisterGlobalCommands(
  Client: DiscordClient,
  CommandManager: DiscordJS.ApplicationCommandManager,
  GlobalCommands: LocalCmds
): Promise<void> {
  for (const LocalCommand of GlobalCommands) {
    const SlashOrContext = SlashCmdOrContextMenuCmdText(LocalCommand);
    await CommandManager.create(LocalCommand.data)
      .then(() => {
        RegisterCommandInClient(Client, LocalCommand);
        AppLogger.info({
          message: "'%s' %s has been registered globally.",
          label: LogLabel,
          splat: [Chalk.bold(LocalCommand.data.name), SlashOrContext],
        });
      })
      .catch((Err) => {
        AppLogger.error({
          message: "Failed to register '%s' %s.",
          splat: [Chalk.bold(LocalCommand.data.name), SlashOrContext],
          stack: (Err as Error).stack,
          label: LogLabel,
        });
      });
  }
}

/**
 * Handles switching the scope of a Discord application command between guild and global.
 *
 * This function deletes the existing command from its current scope (guild or global)
 * and re-creates it in the opposite scope. It updates the client's command collections
 * and logs the operation. If the command is already in the desired scope, no action is taken.
 *
 * @param Client - The Discord client instance.
 * @param LocalCmd - The local command object to register, either a slash command or context menu command.
 * @param ExistingCmd - The existing Discord.js application command to switch scope for.
 * @returns A promise that resolves when the command scope switch is complete.
 */
async function HandleCommandScopeSwitching(
  Client: DiscordClient,
  LocalCmd: SlashCommandObject | ContextMenuCommandObject,
  ExistingCmd: DiscordJS.ApplicationCommand
) {
  const OrgCmdManager = ExistingCmd.manager;
  const SwitchFrom = ExistingCmd.guildId ? "guild" : "global";
  const SwitchTo = ExistingCmd.guildId ? "global" : "guild";
  const ContextOrSlash = SlashCmdOrContextMenuCmdText(LocalCmd);

  if (
    (SwitchTo === "global" && OrgCmdManager.constructor === ApplicationCommandManager) ||
    (SwitchTo === "guild" && OrgCmdManager.constructor === GuildApplicationCommandManager)
  ) {
    return;
  }

  await OrgCmdManager.delete(ExistingCmd.id).catch((Err) => {
    AppLogger.error({
      message: "Failed to delete '%s' %s from %s scope; skipping.",
      splat: [Chalk.bold(ExistingCmd.name), ContextOrSlash, SwitchFrom],
      stack: (Err as Error).stack,
      error: { ...(Err as Error) },
      label: LogLabel,
    });
  });

  await Client.application.commands
    .create(LocalCmd.data, SwitchTo === "guild" ? Discord.TestGuildId : undefined)
    .then((Cmd) => {
      if (LocalCmd.data instanceof ContextMenuCommandBuilder) {
        Client.ctx_commands.set(Cmd.name, LocalCmd as ContextMenuCommandObject);
      } else {
        Client.commands.set(Cmd.name, LocalCmd as SlashCommandObject<SlashCommandBuilder>);
      }

      AppLogger.info({
        label: LogLabel,
        splat: [Chalk.bold(Cmd.name), ContextOrSlash, Chalk.bold(SwitchTo), Chalk.bold(SwitchFrom)],
        message: "Successfully switched '%s' %s scope to %s rather than %s.",
      });
    })
    .catch((Err) => {
      AppLogger.error({
        message: "Failed to deploy '%s' %s on %s scope; skipping.",
        splat: [Chalk.bold(ExistingCmd.name), ContextOrSlash, SwitchTo],
        stack: (Err as Error).stack,
        error: { ...(Err as Error) },
        label: LogLabel,
      });
    });
}

/**
 * Processes all command changes (updates, deletions, creations) in bulk when there are more than 5 changes.
 * This function uses PUT requests to efficiently update all commands at once per scope.
 *
 * @param Client - The Discord client instance
 * @param CategorizeCmds - Categorized commands from the CategorizeCommands function
 * @param TestingGuild - The testing guild where development commands are registered
 * @param AppCommandsMap - Map of global application commands by name
 * @param GuildCommandsMap - Map of guild-specific commands by name
 * @returns A promise that resolves when all bulk operations are complete
 */
async function BulkProcessAllCommands(
  Client: DiscordClient,
  CategorizeCmds: Awaited<ReturnType<typeof CategorizeCommands>>,
  TestingGuild: Guild | undefined,
  AppCommandsMap: Collection<string, ApplicationCommand>,
  GuildCommandsMap: Collection<string, ApplicationCommand>
): Promise<void> {
  const AppCmdsManager = Client.application.commands;
  const LocalCmdMap = new Collection<string, LocalCmds[number]>();
  const GlobalCommandsToKeep = new Collection<string, LocalCmds[number] | ApplicationCommand>();
  const GuildCommandsByGuildId = new Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >();

  if (TestingGuild) {
    GuildCommandsByGuildId.set(TestingGuild.id, new Collection());
  }

  ProcessCommandsForScopeSwitch(
    CategorizeCmds.CommandsForScopeSwitch,
    GlobalCommandsToKeep,
    GuildCommandsByGuildId,
    AppCommandsMap,
    TestingGuild,
    LocalCmdMap
  );

  ProcessCommandsToUpdateBulk(
    CategorizeCmds.CommandsToUpdate,
    CategorizeCmds.DeletedCommands,
    GlobalCommandsToKeep,
    GuildCommandsByGuildId,
    LocalCmdMap
  );

  ProcessNewCommands(
    CategorizeCmds.GlobalCommands,
    CategorizeCmds.GuildOnlyCommands,
    GlobalCommandsToKeep,
    GuildCommandsByGuildId,
    TestingGuild,
    LocalCmdMap
  );

  ProcessExistingCommands(
    AppCommandsMap,
    GuildCommandsMap,
    GlobalCommandsToKeep,
    GuildCommandsByGuildId,
    LocalCmdMap,
    CategorizeCmds.DeletedCommands
  );

  await DeployGlobalCommands(Client, AppCmdsManager, GlobalCommandsToKeep, LocalCmdMap);
  await DeployGuildCommands(Client, AppCmdsManager, GuildCommandsByGuildId, LocalCmdMap);

  if (CategorizeCmds.DeletedCommands.length > 0) {
    AppLogger.info({
      message: "Bulk processed %o deleted commands (automatically handled by the bulk update).",
      splat: [CategorizeCmds.DeletedCommands.length],
      label: LogLabel,
    });
  }
}

// -----------------------------------------------------------------------------
// Bulk Processing Helpers:
// ------------------------
/**
 * Processes commands that need to switch scope between global and guild-specific.
 *
 * @param CommandsForScopeSwitch - An array of local command definitions to evaluate for scope changes.
 * @param GlobalCommandsToKeep - A collection mapping command names to commands that should remain registered globally.
 * @param GuildCommandsByGuildId - A collection mapping guild IDs to another collection of command names
 *                                 and their command definitions or application commands for guild scope.
 * @param AppCommandsMap - A map of existing application commands keyed by command name.
 *                         Used to determine the original scope of each command.
 * @param TestingGuild - An optional Guild instance representing the target guild for guild-scoped commands.
 * @param LocalCmdMap - A collection to populate with every processed local command, keyed by command name.
 *
 * @remarks
 * For each local command:
 * - Determines current scope (global vs. guild) based on the existing application command’s `guildId`.
 * - Decides whether to keep it in its current scope or switch it to the opposite scope.
 * - Logs debug or warning messages to indicate scope switches or missing testing guild.
 * - Populates the appropriate collections for global persistence or guild registration.
 */
function ProcessCommandsForScopeSwitch(
  CommandsForScopeSwitch: LocalCmds,
  GlobalCommandsToKeep: Collection<string, LocalCmds[number] | ApplicationCommand>,
  GuildCommandsByGuildId: Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >,
  AppCommandsMap: Map<string, ApplicationCommand>,
  TestingGuild: Guild | undefined,
  LocalCmdMap: Collection<string, LocalCmds[number]>
): void {
  for (const LocalCmd of CommandsForScopeSwitch) {
    const CmdName = LocalCmd.data.name;
    const ExistingCmd = AppCommandsMap.get(CmdName)!;
    const OrgCmdManager = ExistingCmd.manager;
    const SwitchFrom = ExistingCmd.guildId ? "guild" : "global";
    const SwitchTo = ExistingCmd.guildId ? "global" : "guild";
    const ContextOrSlash = SlashCmdOrContextMenuCmdText(LocalCmd);

    LocalCmdMap.set(CmdName, LocalCmd);
    const AlreadyInCorrectScope =
      (SwitchTo === "global" && OrgCmdManager instanceof ApplicationCommandManager) ||
      (SwitchTo === "guild" && OrgCmdManager instanceof GuildApplicationCommandManager);

    if (AlreadyInCorrectScope) {
      if (SwitchTo === "global") {
        GlobalCommandsToKeep.set(CmdName, LocalCmd);
      } else if (SwitchTo === "guild" && TestingGuild) {
        const GuildCmds = GuildCommandsByGuildId.get(TestingGuild.id)!;
        GuildCmds.set(CmdName, LocalCmd);
      }
      continue;
    }

    if (SwitchTo === "guild") {
      if (TestingGuild) {
        const GuildCmds = GuildCommandsByGuildId.get(TestingGuild.id)!;
        GuildCmds.set(CmdName, LocalCmd);

        AppLogger.debug({
          message: "Preparing to switch '%s' %s scope from %s to %s.",
          splat: [
            Chalk.bold(CmdName),
            ContextOrSlash,
            Chalk.bold(SwitchFrom),
            Chalk.bold(SwitchTo),
          ],
          label: LogLabel,
        });
      } else {
        AppLogger.warn({
          message:
            "Failed to switch '%s' %s scope to %s rather than %s; no testing guild found to switch to.",
          label: LogLabel,
          splat: [
            Chalk.bold(CmdName),
            ContextOrSlash,
            Chalk.bold(SwitchTo),
            Chalk.bold(SwitchFrom),
          ],
        });
      }
    } else {
      GlobalCommandsToKeep.set(CmdName, LocalCmd);
      AppLogger.debug({
        message: "Preparing to switch '%s' %s scope from %s to %s.",
        label: LogLabel,
        splat: [Chalk.bold(CmdName), ContextOrSlash, Chalk.bold(SwitchFrom), Chalk.bold(SwitchTo)],
      });
    }
  }
}

/**
 * Processes a list of commands to update in bulk, updating local command mappings,
 * global commands, and guild-specific commands as necessary.
 *
 * @param CommandsToUpdate - An array of tuples where each tuple contains an existing
 *                           application command and its corresponding local command definition.
 * @param DeletedCommands - A list of local commands that have been marked for deletion.
 * @param GlobalCommandsToKeep - A collection to store global commands that should be retained.
 * @param GuildCommandsByGuildId - A collection mapping guild IDs to their respective
 *                                 collections of guild-specific commands.
 * @param LocalCmdMap - A collection mapping command names to their corresponding local command definitions.
 * @returns void
 */
function ProcessCommandsToUpdateBulk(
  CommandsToUpdate: [ApplicationCommand, LocalCmds[number]][],
  DeletedCommands: LocalCmds,
  GlobalCommandsToKeep: Collection<string, LocalCmds[number] | ApplicationCommand>,
  GuildCommandsByGuildId: Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >,
  LocalCmdMap: Collection<string, LocalCmds[number]>
): void {
  for (const [ExistingCmd, LocalCmd] of CommandsToUpdate) {
    const CmdName = LocalCmd.data.name;
    if (DeletedCommands.some((Cmd) => Cmd.data.name === CmdName)) {
      continue;
    }

    LocalCmdMap.set(CmdName, LocalCmd);
    if (ExistingCmd.guildId) {
      let GuildCmds = GuildCommandsByGuildId.get(ExistingCmd.guildId);
      if (!GuildCmds) {
        GuildCmds = new Collection();
        GuildCommandsByGuildId.set(ExistingCmd.guildId, GuildCmds);
      }
      GuildCmds.set(CmdName, LocalCmd);
    } else {
      GlobalCommandsToKeep.set(CmdName, LocalCmd);
    }
  }
}

/**
 * Processes and registers new commands for both global and guild-specific contexts.
 * @param GlobalCommands - A collection of global commands to be registered.
 * @param GuildOnlyCommands - A collection of commands that are specific to guilds.
 * @param GlobalCommandsToKeep - A collection to store global commands that should be retained.
 * @param GuildCommandsByGuildId - A mapping of guild Ids to their respective collections of commands.
 * @param TestingGuild - The guild used for testing, if available.
 * @param LocalCmdMap - A collection to map command names to their respective local command objects.
 */
function ProcessNewCommands(
  GlobalCommands: LocalCmds,
  GuildOnlyCommands: LocalCmds,
  GlobalCommandsToKeep: Collection<string, LocalCmds[number] | ApplicationCommand>,
  GuildCommandsByGuildId: Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >,
  TestingGuild: Guild | undefined,
  LocalCmdMap: Collection<string, LocalCmds[number]>
): void {
  for (const Cmd of GlobalCommands) {
    const CmdName = Cmd.data.name;
    GlobalCommandsToKeep.set(CmdName, Cmd);
    LocalCmdMap.set(CmdName, Cmd);
  }

  if (!TestingGuild) {
    return;
  }

  const GuildCmds = GuildCommandsByGuildId.get(TestingGuild.id) ?? new Collection();
  for (const Cmd of GuildOnlyCommands) {
    const CmdName = Cmd.data.name;
    if (!GuildCmds.has(CmdName)) {
      GuildCmds.set(CmdName, Cmd);
      LocalCmdMap.set(CmdName, Cmd);
    }
  }

  GuildCommandsByGuildId.set(TestingGuild.id, GuildCmds);
}

/**
 * Processes existing application and guild commands, ensuring that commands
 * are either preserved or updated based on their local definitions and deployment status.
 *
 * @param AppCommandsMap - A collection of global application commands mapped by their names.
 * @param GuildCommandsMap - A collection of guild-specific commands mapped by their names.
 * @param GlobalCommandsToKeep - A collection to store global commands that should be preserved.
 * @param GuildCommandsByGuildId - A collection mapping guild Ids to their respective commands.
 * @param LocalCmdMap - A collection of locally defined commands mapped by their names.
 * @param DeletedCommands - An array of commands that have been marked for deletion.
 *
 * The function performs the following tasks:
 * - For global commands:
 *   - Preserves commands that are either marked to be kept or are not defined locally.
 *   - Logs a warning for commands that exist on the API but are not defined locally.
 *   - Adds non-development-only local commands to the list of commands to keep.
 * - For guild-specific commands:
 *   - Preserves commands that are not defined locally but exist in a specific guild.
 *   - Logs a warning for commands that exist in a guild but are not defined locally.
 *   - Adds local commands to the respective guild's command collection if not already present.
 */
function ProcessExistingCommands(
  AppCommandsMap: Collection<string, ApplicationCommand>,
  GuildCommandsMap: Collection<string, ApplicationCommand>,
  GlobalCommandsToKeep: Collection<string, LocalCmds[number] | ApplicationCommand>,
  GuildCommandsByGuildId: Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >,
  LocalCmdMap: Collection<string, LocalCmds[number]>,
  DeletedCommands: LocalCmds
): void {
  for (const [CmdName, ExistingCmd] of AppCommandsMap.entries()) {
    if (
      GlobalCommandsToKeep.has(CmdName) ||
      DeletedCommands.some((Cmd) => Cmd.data.name === CmdName)
    ) {
      continue;
    }

    const LocalCmd = LocalCmdMap.get(CmdName);
    if (!LocalCmd) {
      // Command exists on API but not locally - preserve it;
      // although the application will complain later and log warn when executed...
      GlobalCommandsToKeep.set(CmdName, ExistingCmd);
      AppLogger.warn({
        message: "Command '%s' is deployed but not defined locally; keeping as-is.",
        splat: [Chalk.bold(CmdName)],
        label: LogLabel,
      });
    } else if (!LocalCmd.options?.dev_only) {
      GlobalCommandsToKeep.set(CmdName, LocalCmd);
    }
  }

  for (const [CmdName, ExistingCmd] of GuildCommandsMap.entries()) {
    if (DeletedCommands.some((Cmd) => Cmd.data.name === CmdName)) {
      continue;
    }

    if (!ExistingCmd.guildId) continue;
    const LocalCmd = LocalCmdMap.get(CmdName);
    const GuildCmds = GuildCommandsByGuildId.get(ExistingCmd.guildId) ?? new Collection();

    if (!LocalCmd) {
      // Command exists on guild but not locally - preserve it;
      // similarly to global commands handling above...
      if (!GuildCmds.has(CmdName)) {
        GuildCmds.set(CmdName, ExistingCmd);
        GuildCommandsByGuildId.set(ExistingCmd.guildId, GuildCmds);
      }

      AppLogger.warn({
        message: "Command '%s' is deployed in '%s' guild but not defined locally; keeping as-is.",
        splat: [Chalk.bold(CmdName), Chalk.bold(ExistingCmd.guildId)],
        label: LogLabel,
      });
    } else if (!GuildCmds.has(CmdName)) {
      GuildCmds.set(CmdName, LocalCmd);
      GuildCommandsByGuildId.set(ExistingCmd.guildId, GuildCmds);
    }
  }
}

/**
 * Deploys global application commands to the Discord API and registers them in the client.
 * This function ensures that only the specified global commands are deployed, while keeping
 * the existing commands that are intended to remain.
 *
 * @param Client - The Discord client instance used to register commands locally.
 * @param AppCmdsManager - The application command manager responsible for interacting with the Discord API.
 * @param GlobalCommandsToKeep - A collection of global commands to retain, either as local command definitions or existing application commands.
 * @param LocalCmdMap - A collection mapping local command names to their definitions, used for registration.
 * @returns A promise that resolves when the global commands have been successfully deployed.
 */
async function DeployGlobalCommands(
  Client: DiscordClient,
  AppCmdsManager: ApplicationCommandManager,
  GlobalCommandsToKeep: Collection<string, LocalCmds[number] | ApplicationCommand>,
  LocalCmdMap: Collection<string, LocalCmds[number]>
): Promise<void> {
  // Skip empty collection rather than unintentionally deleting all global commands.
  // It's advised to set the deleted property to true in the local command definition
  // instead or temporarily having a callback to delete them using an empty rest put request.
  if (GlobalCommandsToKeep.size === 0) return;
  try {
    const CommandsToRegister = Array.from(GlobalCommandsToKeep.values()).map((Cmd) =>
      Cmd instanceof ApplicationCommand
        ? (Cmd.toJSON() as
            | RESTPostAPIChatInputApplicationCommandsJSONBody
            | RESTPostAPIContextMenuApplicationCommandsJSONBody)
        : Cmd.data.toJSON()
    );

    const Deployed = await AppCmdsManager.set(CommandsToRegister);
    GlobalCommandsToKeep.forEach((Cmd) => {
      if (Cmd instanceof ApplicationCommand) {
        const FoundLocalCmd = LocalCmdMap.get(Cmd.name);
        if (FoundLocalCmd) RegisterCommandInClient(Client, FoundLocalCmd);
      } else {
        RegisterCommandInClient(Client, Cmd);
      }
    });

    AppLogger.info({
      message: "Successfully bulk processed and deployed %o global commands.",
      splat: [Deployed.size],
      label: LogLabel,
    });
  } catch (Err) {
    AppLogger.error({
      message: "Failed to bulk process global commands.",
      stack: (Err as Error).stack,
      error: { ...(Err as Error) },
      label: LogLabel,
    });
  }
}

/**
 * Deploys and registers application commands for specific guilds.
 *
 * This function processes a collection of guild-specific commands and registers them
 * using the provided `ApplicationCommandManager`. It ensures that commands are only
 * deployed for guilds with non-empty command collections and handles both local and
 * existing application commands. Additionally, it logs the success or failure of the
 * deployment process for each guild.
 *
 * @param Client - The Discord client instance used to register commands locally.
 * @param AppCmdsManager - The manager responsible for handling application commands.
 * @param GuildCommandsByGuildId - A collection mapping guild Ids to their respective
 * command collections, which can include both local commands and existing application commands.
 * @param LocalCmdMap - A collection mapping command names to their respective local command definitions.
 * @returns A promise that resolves when all guild commands have been processed and deployed.
 */
async function DeployGuildCommands(
  Client: DiscordClient,
  AppCmdsManager: ApplicationCommandManager,
  GuildCommandsByGuildId: Collection<
    string,
    Collection<string, LocalCmds[number] | ApplicationCommand>
  >,
  LocalCmdMap: Collection<string, LocalCmds[number]>
): Promise<void> {
  // We're skipping empty guilds to avoid unintentionally deleting all commands.
  for (const [GuildId, CommandMap] of GuildCommandsByGuildId.entries()) {
    if (CommandMap.size === 0) continue;
    try {
      const CommandsToRegister = Array.from(CommandMap.values()).map((Cmd) =>
        Cmd instanceof ApplicationCommand
          ? (Cmd.toJSON() as
              | RESTPostAPIChatInputApplicationCommandsJSONBody
              | RESTPostAPIContextMenuApplicationCommandsJSONBody)
          : Cmd.data.toJSON()
      );

      const Deployed = await AppCmdsManager.set(CommandsToRegister, GuildId);
      CommandMap.forEach((Cmd) => {
        if (Cmd instanceof ApplicationCommand) {
          const FoundLocalCmd = LocalCmdMap.get(Cmd.name);
          if (FoundLocalCmd) RegisterCommandInClient(Client, FoundLocalCmd);
        } else {
          RegisterCommandInClient(Client, Cmd);
        }
      });

      AppLogger.info({
        message: "Successfully bulk processed and deployed %o commands for guild '%s' (%s).",
        splat: [Deployed.size, Deployed.at(0)?.guild?.name ?? "[unknown]", GuildId],
        label: LogLabel,
      });
    } catch (Err) {
      AppLogger.error({
        message: "Failed to bulk process commands for guild '%s'.",
        splat: [GuildId],
        stack: (Err as Error).stack,
        error: { ...(Err as Error) },
        label: LogLabel,
      });
    }
  }
}
