import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import { HTTP429OccurrencesTracker } from "#Utilities/Helpers/Cache.js";
import TriggerAppStatus from "#Utilities/Discord/TriggerAppStatus.js";
import { AppResponse } from "#Source/Utilities/Helpers/GetOSMetrics.js";

const IdleTriggerAfterMs = 30 * 1000;
const OnlineResetAfterMs = 60 * 1000;
let CurrentRateLimitStatus: "online" | "idle" | null = null;

async function AppWatchdog(_Now: Date | "init" | "manual", Client: DiscordClient) {
  const NowMs = Date.now();
  const First429At = HTTP429OccurrencesTracker.get("http429:first");
  const Last429At = HTTP429OccurrencesTracker.get("http429:last");

  if (!Last429At || NowMs - Last429At >= OnlineResetAfterMs) {
    HTTP429OccurrencesTracker.delete("http429:first");
    if (CurrentRateLimitStatus !== "online") {
      await TriggerAppStatus(Client, "online");
      CurrentRateLimitStatus = "online";
      AppResponse.ratelimited = false;
    }
    return;
  }

  if (First429At && NowMs - First429At >= IdleTriggerAfterMs && CurrentRateLimitStatus !== "idle") {
    await TriggerAppStatus(Client, "idle");
    CurrentRateLimitStatus = "idle";
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
