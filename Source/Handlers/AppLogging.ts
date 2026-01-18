import { Events, RESTEvents } from "discord.js";
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

  Client.rest.on(RESTEvents.RateLimited, (RLInfo) => {
    AppLogger.warn({
      label: "DiscordClient",
      message: `Rate limited on route ${Chalk.bold(RLInfo.route)}. Retry after ${Chalk.bold(RLInfo.timeToReset + "ms")}`,
      details: RLInfo,
    });
  });

  Client.rest.on(RESTEvents.Response, (Req, Resp) => {
    if (Resp.status === 403 || Resp.status === 429) {
      AppLogger.warn({
        label: "DiscordClient",
        message: `Received a ${Chalk.bold(Resp.status.toString())} response for ${Chalk.bold(Req.method)} ${Chalk.bold(Req.path)} request.`,
        details: { request: Req, response: Resp },
      });
    }
  });

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
