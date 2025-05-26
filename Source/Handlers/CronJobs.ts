import { CronJobFileDefReturn } from "@Typings/Global.js";
import { GetDirName } from "@Utilities/Other/Paths.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import GetFiles from "@Utilities/Other/GetFilesFrom.js";
import Chalk from "chalk";
import Cron from "node-cron";
import Path from "node:path";
const HandlerLabel = "Handlers:CronJobs";
const ScheduledTasks = new Map<string, Cron.ScheduledTask>();

export default async function CronJobsHandler(Client: DiscordClient) {
  const CronJobPaths = GetFiles(Path.join(GetDirName(import.meta.url), "..", "Jobs"));

  for (const JobPath of CronJobPaths) {
    const JobData = (await import(JobPath)).default as CronJobFileDefReturn;
    const JobFileName = Path.basename(JobPath);
    const ErrorHandlingOpt = JobData.cron_opts?.errorHandlingMechanism;

    if (typeof JobData === "object") {
      if (typeof JobData.cron_func === "function") {
        const CronTask = Cron.schedule(
          JobData.cron_exp,
          async function CSFMask(Now) {
            try {
              await (JobData.cron_func as unknown as (_: any, __: any) => Promise<any>)(
                Now,
                Client
              );
            } catch (Err: any) {
              HandleErrorMechanism(Err, JobFileName, ErrorHandlingOpt);
            }
          },
          JobData.cron_opts
        );

        CronTask.start();
        ScheduledTasks.set(JobFileName, CronTask);
      } else {
        AppLogger.warn({
          label: HandlerLabel,
          splat: [Chalk.bold(JobFileName)],
          message:
            "The cron job object returned from '%s' doesn't include a cron function. Skipping scheduling.",
        });
      }
    } else {
      AppLogger.warn({
        label: HandlerLabel,
        splat: [Chalk.bold(JobFileName)],
        message: "File '%s' does not export a valid cron job object. Skipping scheduling.",
      });
    }
  }

  if (ScheduledTasks.size > 0) {
    AppLogger.info({
      label: HandlerLabel,
      splat: [ScheduledTasks.size],
      message: "Successfully scheduled %o cron job(s).",
    });
  }
}

/**
 * Handles the error mechanism for a scheduled task.
 * @param Err - The error object.
 * @param ScheduledTaskName - The name of the scheduled task.
 * @param ErrorHandlingMechanism - The error handling mechanism for the scheduled task.
 */
function HandleErrorMechanism(
  Err: any,
  ScheduledTaskName: string,
  ErrorHandlingMechanism: NonNullable<CronJobFileDefReturn["cron_opts"]>["errorHandlingMechanism"]
) {
  if (ErrorHandlingMechanism === "silent/log") {
    AppLogger.error({
      stack: Err.stack,
      error: { ...Err },
      label: HandlerLabel,
      splat: [Chalk.bold(ScheduledTaskName)],
      message: "An error occurred while executing the cron job '%s'; see stack trace for details.",
    });
  } else if (ErrorHandlingMechanism === "silent/log/end_job") {
    AppLogger.error({
      stack: Err.stack,
      error: { ...Err },
      label: HandlerLabel,
      splat: [Chalk.bold(ScheduledTaskName)],
      message: "An error occurred while executing the cron job '%s'; see stack trace for details.",
    });

    const Task = ScheduledTasks.get(ScheduledTaskName);
    if (Task) {
      Task.stop();
      ScheduledTasks.delete(ScheduledTaskName);
    }
  } else if (ErrorHandlingMechanism === "silent/ignore/end_job") {
    const Task = ScheduledTasks.get(ScheduledTaskName);
    if (Task) {
      Task.stop();
      ScheduledTasks.delete(ScheduledTaskName);
    }
  } else if (typeof ErrorHandlingMechanism === "function") {
    ErrorHandlingMechanism(Err);
  } else if (ErrorHandlingMechanism === "throw" || ErrorHandlingMechanism === null) {
    throw Err;
  }
}
