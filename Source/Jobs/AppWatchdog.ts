import { PresenceUpdateStatus, Routes } from "discord.js";
import { HTTP429OccurrencesTracker } from "#Utilities/Helpers/Cache.js";
import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import { AppResponse } from "#Source/Utilities/Helpers/GetOSMetrics.js";
import TriggerAppStatus from "#Utilities/Discord/TriggerAppStatus.js";
import AppLogger from "#Source/Utilities/Classes/AppLogger.js";

const IdleTriggerAfterMs = 30 * 1000;
const OnlineResetAfterMs = 60 * 1000;

async function AppWatchdog(_Now: Date | "init" | "manual", Client: DiscordClient) {
  const NowMs = Date.now();
  const First429At = HTTP429OccurrencesTracker.get("http429:first");
  const Last429At = HTTP429OccurrencesTracker.get("http429:last");

  if (!Last429At || NowMs - Last429At >= OnlineResetAfterMs) {
    if (Client.user.presence.status !== PresenceUpdateStatus.Online) {
      const Controller = new AbortController();
      const Timeout = setTimeout(() => Controller.abort(), 3000);
      const GatewayResp = await Client.rest
        .get(Routes.gatewayBot(), { signal: Controller.signal })
        .catch(() => null);

      clearTimeout(Timeout);
      if (!GatewayResp || typeof GatewayResp !== "object") return;

      AppLogger.info({
        message: `No HTTP 429s detected for over ${OnlineResetAfterMs / 1000}s. Resetting status to online.`,
        label: "Jobs:AppWatchdog",
        details: {
          gateway_response: GatewayResp,
        },
      });

      await TriggerAppStatus(Client, "online");
      AppResponse.ratelimited = false;
    }

    HTTP429OccurrencesTracker.delete("http429:first");
    HTTP429OccurrencesTracker.delete("http429:last");
    return;
  }

  if (
    First429At &&
    NowMs - First429At >= IdleTriggerAfterMs &&
    Client.user.presence.status !== PresenceUpdateStatus.Idle
  ) {
    await TriggerAppStatus(Client, "idle");
    AppResponse.ratelimited = true;
  }
}

export default {
  cron_exp: "* * * * *",
  cron_func: AppWatchdog,
  cron_opts: {
    timezone: "America/Los_Angeles",
    noOverlap: true,
    awaitAppOnline: true,
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
