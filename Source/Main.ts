/* eslint-disable sonarjs/no-duplicate-string */
import { connections as MongooseConnection, STATES as DBStates } from "mongoose";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { Discord as DiscordSecrets } from "@Config/Secrets.js";
import { GetDirName } from "@Utilities/Other/Paths.js";

import Path from "node:path";
import Chalk from "chalk";
import Express from "express";
import GetFiles from "@Utilities/Other/GetFilesFrom.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import FileSystem from "node:fs";
import GetOSMetrics from "@Utilities/Other/GetOSMetrics.js";
import DurHumanizer from "humanize-duration";
AppLogger.info(Chalk.grey("=========================== New Run ==========================="));

// -------------------------------------------------------------------------------------------
// Discord Application:
// --------------------
export const App = new Client({
  allowedMentions: {},
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
  const HandlersDirectoryPath = Path.join(GetDirName(import.meta.url), "Handlers");
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
      AppLogger.info({
        label: "Main.ts",
        message: "%s application is online.",
        splat: [Chalk.cyanBright.bold(App.user.username)],
      });
    })
    .catch((Err) => {
      setTimeout(() => {
        process.exit(1);
      }, 3000);

      AppLogger.fatal({
        message:
          "Failed to initialize and login to the Discord application. Terminating the current process...",
        label: "Main.ts",
        stack: Err.stack,
      });
    });
})();

// -------------------------------------------------------------------------------------------
// Express Application:
// --------------------
const EAppPort = process.env.PORT ?? 10_000;
const ExpressApp = Express();
ExpressApp.disable("x-powered-by");

const NotFoundPage = FileSystem.readFileSync(
  Path.join(GetDirName(import.meta.url), "Resources", "HTML", "404.html"),
  { encoding: "utf-8" }
);

ExpressApp.get("/metrics", (_, Res) => {
  GetOSMetrics(true).then((Metrics) => {
    Res.setHeader("Content-Type", "application/json");
    Res.end(
      JSON.stringify(
        {
          message: "OK",
          client: {
            online: App.isReady(),
            uptime: DurHumanizer(App.uptime ?? 0, {
              conjunction: " and ",
              largest: 4,
              round: true,
            }),
          },
          database: { status: DBStates[MongooseConnection[0].readyState] },
          metrics: Metrics,
        },
        null,
        2
      )
    );
  });
});

ExpressApp.get("/", (_, Res) => {
  Res.setHeader("Content-Type", "application/json");
  Res.end(JSON.stringify({ message: "OK" }, null, 2));
});

ExpressApp.use((_, Res) => {
  Res.setHeader("Content-Type", "text/html");
  Res.end(NotFoundPage);
});

ExpressApp.listen(EAppPort, () => {
  AppLogger.info("Express app listening on port %o.", EAppPort);
});
