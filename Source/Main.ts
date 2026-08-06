import { Client, Options, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Discord as DiscordSecrets } from "#Config/Secrets.js";
import { PerformGracefulShutdown } from "#Handlers/ProcessShutdownHandler.js";
import { differenceInMinutes } from "date-fns";
import { ActiveUsersTracker } from "#Utilities/Helpers/Cache.js";
import { HasRolePersist } from "#Utilities/Database/RolePersists.js";

import Path from "node:path";
import Chalk from "chalk";
import GetFiles from "#Utilities/Helpers/GetFilesFrom.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

AppLogger.info(
  Chalk.grey("=========================== New Deployment ===========================")
);

const ClientCacheLimits = {
  ...Options.DefaultMakeCacheSettings,
  MessageManager: 55,
  PresenceManager: 0,
  ReactionManager: 0,
  VoiceStateManager: 0,
  GuildInviteManager: 0,
  GuildStickerManager: 0,
  ReactionUserManager: 0,
  StageInstanceManager: 0,
  GuildScheduledEventManager: 0,
} satisfies Parameters<typeof Options.cacheWithLimits>[0];

// -------------------------------------------------------------------------------------------
// Discord App & Client Setup:
// ---------------------------
/**
 * The main Discord application client instance.
 * Takeaways:
 * - Messages are swept every 15 minutes if they are partial, unmodified within the recent 14 hours, or if they were sent by anyone other than the app itself.
 * - Members are swept every 20 minutes if they are not the app itself, are inactive, and do not have a role persist record (to keep the functionality's intended behavior intact).
 * - Users are swept every 20 minutes if they are not the app itself and inactive.
 */
export const App: Client = new Client({
  allowedMentions: {},
  makeCache: Options.cacheWithLimits(ClientCacheLimits),
  partials: [Partials.GuildMember],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],

  sweepers: {
    ...Options.DefaultSweeperSettings,
    users: {
      interval: 30 * 60,
      filter: () => (User) => {
        if (User.id === App.user?.id) return false;
        return !ActiveUsersTracker.has(User.id);
      },
    },

    guildMembers: {
      interval: 20 * 60,
      filter: () => (Member) => {
        if (Member.id === App.user?.id) return false;
        if (HasRolePersist(Member.guild.id, Member.id)) return false;
        return !ActiveUsersTracker.has(Member.id);
      },
    },

    messages: {
      interval: 15 * 60,
      filter: () => (Msg) => {
        if (Msg.partial) return true;
        const MessageAgeMinutes = differenceInMinutes(new Date(), Msg.editedAt ?? Msg.createdAt);
        const IsAppMessage = Msg.author.id === App.user?.id;
        return IsAppMessage ? MessageAgeMinutes >= 14 * 60 : MessageAgeMinutes >= 15;
      },
    },
  },
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
