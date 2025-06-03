import { GetDirName } from "@Utilities/Helpers/Paths.js";
import { CamelCase } from "@Utilities/Strings/Converters.js";
import { Events } from "discord.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import GetFiles from "@Utilities/Helpers/GetFilesFrom.js";
import Path from "node:path";

export default async function EventHandler(Client: DiscordClient) {
  const EventsPath = Path.join(GetDirName(import.meta.url), "..", "Events");
  const HandlerLabel = "Handlers:EventHandler";
  const EventFolders = GetFiles(EventsPath, true);
  const ListenersData: Record<string, number> = {};
  const ClientEventsSet = new Set(Object.values(Events) as string[]);

  for (const EventFolder of EventFolders) {
    const EventName = CamelCase(Path.basename(EventFolder));
    const EventFiles = GetFiles(EventFolder).sort((a, b) => {
      const a_pos = a.match(/\[(\d+)\]/)?.[1];
      const b_pos = b.match(/\[(\d+)\]/)?.[1];

      if (a_pos && b_pos) return +a_pos - +b_pos;
      else if (a_pos) return -1;
      else if (b_pos) return 1;
      else return 0;
    });

    const FuncsToExecute = (
      await Promise.all(
        EventFiles.map(async (EventFile) => {
          try {
            const Module = await import(EventFile);
            return typeof Module.default === "function" ? Module.default : null;
          } catch (Err) {
            AppLogger.error({
              label: HandlerLabel,
              message: "Failed to load event file: %s",
              splat: [Path.basename(EventFile)],
              stack: (Err as Error).stack,
            });
            return null;
          }
        })
      )
    ).filter(Boolean) as ((Client: DiscordClient, ...Args: any[]) => any)[];

    if (ClientEventsSet.has(EventName)) {
      ListenersData[EventName] = FuncsToExecute.length;
      if (FuncsToExecute.length === 1) {
        const SingleHandler = FuncsToExecute[0];
        Client.on(EventName, (...Args) => SingleHandler(Client, ...Args));
      } else if (FuncsToExecute.length > 1) {
        Client.on(EventName, (...Args) => {
          FuncsToExecute.forEach((Func) => Func(Client, ...Args));
        });
      }
    } else {
      AppLogger.warn({
        message:
          "Listening to event '%s' was skipped as it does not exist in DiscordJS Client instance.",
        label: HandlerLabel,
        splat: [EventName],
        details: {
          event: EventName,
          total_funcs: FuncsToExecute.length,
        },
      });
    }
  }

  AppLogger.info({
    message:
      "Successfully loaded all event listeners. Listening for the %o events with %o total listeners.",
    label: HandlerLabel,
    splat: [
      Object.entries(ListenersData).length,
      Object.values(ListenersData).reduce((prev, curr) => prev + curr, 0),
    ],
  });
}
