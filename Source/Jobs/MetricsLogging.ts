import { connections as MongooseConnection, STATES as DBStates } from "mongoose";
import { Other as OtherSecrets } from "@Config/Secrets.js";
import { CronJobFileDefReturn } from "@Typings/Core/System.js";
import GetOSMetrics from "@Utilities/Helpers/GetOSMetrics.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

if (OtherSecrets.IsProdEnv) {
  AppLogger.info({
    label: "Jobs:MetricsLogging",
    message: "Production environment detected. Starting metrics logging cron job; every 5 seconds.",
  });
}

async function MetricsLog(_: any, Client: DiscordClient) {
  GetOSMetrics(false).then((Metrics) => {
    AppLogger.metrics({
      message: "[Metrics Log]",
      metrics: {
        process: Metrics,
        database: {
          status: DBStates[MongooseConnection[0].readyState],
        },
        client: {
          online: Client.isReady(),
          uptime: Client.uptime,
        },
      },
    });
  });
}

export default {
  cron_exp: "*/5 * * * *",
  cron_func: OtherSecrets.IsProdEnv ? MetricsLog : undefined,
  cron_opts: {
    timezone: "America/Los_Angeles",
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
