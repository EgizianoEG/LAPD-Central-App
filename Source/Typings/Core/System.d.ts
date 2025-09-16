import type { TaskOptions as ScheduleOptions } from "node-cron";

/**
 * @note Each cron job will be automatically started even if not specified in cron options.
 **/
export interface CronJobFileDefReturn {
  cron_exp: string;

  /**
   * The function to be executed on each scheduled occurrence of the cron job.
   * This property is optional, and if not provided, the con job scheduling will be skipped (not registered and will not be executed at any time).
   *
   * - `arg0?: Date | "manual" | "init"`: The first argument is either a `Date` object representing
   *   the exact time when the cron job was triggered, or a string (`"manual"` or `"init"`) that
   *   indicates if the function was invoked manually or on the initial run after the application
   *   starts.
   *   - `Date`: The actual date and time when the cron job is triggered.
   *   - `"manual"`: Indicates the function was manually triggered outside of the scheduled time.
   *   - `"init"`: Indicates that the cron job was executed upon initialization, usually due to a
   *     configuration setting like `runOnInit`.
   *
   * - `arg1?: DiscordClient`: The second argument is the `DiscordClient` instance, allowing the cron
   *   job to interact with Discord, send messages, update statuses, or perform other operations
   *   within the Discord client.
   *
   * @returns The function can return either a value of any type or a promise that resolves to any value,
   * allowing it to perform asynchronous operations as needed.
   */
  cron_func?: (arg0?: Date | "manual" | "init", arg1?: DiscordClient) => any | Promise<any>;

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
