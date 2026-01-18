import { FormatUsername } from "#Utilities/Strings/Formatters.js";
import { Roblox } from "#Config/Secrets.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import NobloxJs from "noblox.js";
import Chalk from "chalk";

export default async function OpenBloxConfigSetter() {
  try {
    if (Roblox.CloudKey) {
      NobloxJs.setAPIKey(Roblox.CloudKey);
    }

    if (Roblox.Cookie) {
      await NobloxJs.setCookie(Roblox.Cookie, true).then((AuthUser) => {
        AppLogger.info({
          message: "Noblox cookie authentication successful. Account: %s.",
          label: "Handlers:NobloxConfigSetter",
          splat: [Chalk.bold(FormatUsername(AuthUser))],
        });
      });
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "An error occurred while setting up Noblox credentials;",
      label: "Handlers:NobloxConfigSetter",
      stack: Err.stack,
      details: {
        ...(Err as object),
      },
    });
  }
}
