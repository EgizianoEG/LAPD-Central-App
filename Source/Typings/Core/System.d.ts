import type { TaskOptions as ScheduleOptions } from "node-cron";

/**
 * @note Each cron job will be automatically started even if not specified in cron options.
 **/
export interface CronJobFileDefReturn {
  cron_exp: string;

  /**
   * The callback function executed at each scheduled occurrence of the cron job.
   * When omitted or undefined, the cron job will not be registered or executed.
   * Setting this to `null` explicitly disables the cron job without logging warnings.
   *
   * @param arg0 - The trigger context:
   *   - `Date`: The exact time the cron job was triggered.
   *   - `"manual"`: The function was manually invoked outside the schedule.
   *   - `"init"`: The function ran during application initialization (e.g., `runOnInit` setting).
   *
   * @param arg1 - The `DiscordClient` instance, enabling interaction with Discord
   *   (sending messages, updating statuses, etc.).
   *
   * @returns Any value or a Promise, supporting both synchronous and asynchronous operations.
   */
  cron_func?:
    | ((arg0?: Date | "manual" | "init", arg1?: DiscordClient) => any | Promise<any> | null)
    | null;

  cron_opts?: ScheduleOptions & {
    /**
     * If set to `true`, the cron job will be running only after the Discord client is fully online and ready.
     * This ensures that any operations dependent on the Discord client can be executed without issues.
     * If set to `false` or omitted, the cron job may run even if the Discord client is not yet ready.
     */
    awaitAppOnline?: boolean;

    /**
     * Defines how unhandled errors in the cron function should be managed.
     *
     * - `"silent/log"`: The error will be caught and logged using the application's logging system,
     *   but the cron job will continue running as normal.
     *
     * - `"silent/ignore"`: The error will be caught and completely suppressed without any logging.
     *   The cron job will continue running.
     *
     * - `"silent/ignore/end_job"`: The error will be caught and completely suppressed with logging.
     *   The cron job will be stopped afterwards.
     *
     * - `"silent/ignore/end_job"`: The error will be caught and completely suppressed without any logging.
     *   The cron job will be stopped afterwards.
     *
     * - `"throw"`: The error will be thrown as an exception, causing the cron job to stop and potentially
     *   propagating the error up the stack, which could stop the application if unhandled.
     *
     * - `(error: any) => any`: A custom error handling function that receives the error as an argument
     *   and allows you to implement custom logic to manage it. This provides the most flexibility
     *   and control over how errors are handled.
     *
     * - `null` or `undefined`: Equivalent to "throw". The error will be thrown as an exception, adhering to the
     *   strictest error handling mode by default.
     */
    errorHandlingMechanism?:
      | "silent/log"
      | "silent/ignore"
      | "silent/log/end_job"
      | "silent/ignore/end_job"
      | "throw"
      | ((error: any) => any)
      | null;
  };
}
