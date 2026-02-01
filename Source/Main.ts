import { Client, Options, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Discord as DiscordSecrets } from "#Config/Secrets.js";
import { PerformGracefulShutdown } from "#Handlers/ProcessShutdownHandler.js";

import Path from "node:path";
import Chalk from "chalk";
import GetFiles from "#Utilities/Helpers/GetFilesFrom.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
AppLogger.info(Chalk.grey("=========================== New Run ==========================="));

// -------------------------------------------------------------------------------------------
// Discord Application:
// --------------------
export const App: Client = new Client({
  allowedMentions: {},
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 80,
  }),
  sweepers: {
    messages: {
      interval: 60,
      filter: () => (Msg) => Msg.partial || (Msg.author !== null && Msg.author.id !== App.user?.id),
    },
  },
  partials: [Partials.GuildMember],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

App.commands = new Collection();
App.ctx_commands = new Collection();
App.modalListeners = new Collection();
App.buttonListeners = new Collection();

(async function RunApplication() {
  const HandlersDirectoryPath = Path.join(import.meta.dirname, "Handlers");
  const HandlerPaths = GetFiles(HandlersDirectoryPath);

  await Promise.all(
    HandlerPaths.map((File) =>
      import(File).then((Module) => {
        if (typeof Module.default === "function") {
          AppLogger.debug({
            message: "Loading and executing handler: %s",
            label: "Main.ts",
            splat: [Chalk.grey.bold(Path.basename(File))],
          });

          return Module.default(App);
        }
        return null;
      })
    )
  );

  await App.login(DiscordSecrets.AppToken)
    .then(() => {
      if (!App.user) throw new Error("Unexpected error: 'App.user' is not accessible.");
      if (process.send && typeof process.send === "function") process.send("ready");

      AppLogger.info({
        label: "Main.ts",
        message: "%s application is online.",
        splat: [Chalk.cyanBright.bold(App.user.username)],
      });
    })
    .catch((Err) => {
      AppLogger.fatal({
        message:
          "Failed to initialize and login to the Discord application. Terminating process...",
        label: "Main.ts",
        stack: Err.stack,
        error: Err,
      });

      PerformGracefulShutdown(App, 1);
    });
})();
