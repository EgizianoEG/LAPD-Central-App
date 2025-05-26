import { IsValidCmdObject } from "./Validators.js";
import { GetDirName } from "./Paths.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import GetFiles from "./GetFilesFrom.js";
import Path from "node:path";
const FileLabel = "Utilities:Other:GetLocalCommands";

/**
 * Collects all the local commands and returns them as an array of command objects
 * @param Exceptions - The names of commands and exceptions which to ignore when collecting local commands
 * @returns An array of command objects
 */
export default async function GetLocalCommands(
  Exceptions: string[] = []
): Promise<Array<SlashCommandObject | ContextMenuCommandObject>> {
  const LocalCommands: SlashCommandObject[] = [];
  const CommandCats = GetFiles(
    Path.join(GetDirName(import.meta.url), "..", "..", "Commands"),
    true
  );

  await Promise.all(
    CommandCats.map(async (CommandCat) => {
      const Commands = GetFiles(CommandCat);
      const CommandGroups = GetFiles(CommandCat, true);

      await ProcessCommandGroups(CommandGroups, Exceptions, LocalCommands);
      await ProcessCommands(Commands, Exceptions, LocalCommands);
    })
  );

  return LocalCommands;
}

async function ProcessCommandGroups(
  CommandGroups: string[],
  Exceptions: string[],
  LocalCommands: SlashCommandObject[]
) {
  return Promise.all(
    CommandGroups.map((CommandGroup) => {
      const CmdGroupName = Path.basename(CommandGroup);
      const CommandPaths = GetFiles(CommandGroup);

      for (const CommandPath of CommandPaths) {
        if (new RegExp(`(?:${CmdGroupName}|Main).[jt]s$`).exec(CommandPath)) {
          return TryImportCommand(CommandPath, Exceptions, LocalCommands);
        }
      }

      return Promise.resolve();
    })
  );
}

async function ProcessCommands(
  Commands: string[],
  Exceptions: string[],
  LocalCommands: SlashCommandObject[]
) {
  return Promise.all(
    Commands.map((CommandPath) => TryImportCommand(CommandPath, Exceptions, LocalCommands))
  );
}

async function TryImportCommand(
  CommandPath: string,
  Exceptions: string[],
  LocalCommands: SlashCommandObject[]
) {
  try {
    const CommandObj = (await ImportWithTimeout(CommandPath)).default;
    if (IsValidCmdObject(CommandObj, Exceptions)) {
      LocalCommands.push(CommandObj);
    }
  } catch (Err: unknown) {
    if (Err instanceof Error) {
      AppLogger.warn({
        message: "Failed to import main command file; Skipping...",
        stack: Err.stack,
        label: FileLabel,
      });
    }
  }
}

async function ImportWithTimeout(CommandPath: string, TimeoutMs: number = 10_000) {
  return Promise.race([
    import(CommandPath),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `(Timed Out) Failed to import ${CommandPath} within ${TimeoutMs}ms. Check for circular imports, correct file paths, or infinite loops.`
            )
          ),
        TimeoutMs
      )
    ),
  ]);
}
