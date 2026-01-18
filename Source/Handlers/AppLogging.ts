import { Events } from "discord.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import Mongoose from "mongoose";
import Chalk from "chalk";
import Util from "node:util";

export default function AppLogging(Client: DiscordClient) {
  const ClientLogLevels: ("error" | "debug" | "warn")[] = [Events.Debug, Events.Warn, Events.Error];
  for (const Level of ClientLogLevels) {
    Client.on(Level, (Msg: any) => {
      AppLogger.log(Level, {
        label: "DiscordClient",
        message: Msg.message ?? Msg,
        stack: Msg.stack,
        details: typeof Msg === "object" ? { ...Msg } : undefined,
      });
    });
  }

  Mongoose.set("debug", function OnMongooseDebug(CollectionName, MethodName, ...MethodArgs) {
    AppLogger.debug({
      label: "Mongoose",
      message: "%s.%s(%s)",
      splat: [
        Chalk.bold(CollectionName),
        Chalk.hex("#f1fa8c")(MethodName),
        MethodArgs.map((Arg) =>
          Util.inspect(Arg, { depth: 1, colors: true, compact: true, breakLength: 100 })
        ).join(", "),
      ],
      details: {
        method: MethodName,
        collection: CollectionName,
        method_args: MethodArgs,
      },
    });
  });
}
