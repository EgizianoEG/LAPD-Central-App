export namespace GeneralTypings {
  /** Bot (application) or guild management/staff permissions.
   * If a boolean value given to a parent property, it acts like logical OR
   * meaning that if the object is `{ management: true }`; then the check will succeed
   * if the user has one of the permissions for management (guild scope or app scope); otherwise it will fail.
   */
  interface UserPermissionsConfig extends Pick<LogicalOperations, "$and" | "$or"> {
    management:
      | boolean
      | ({
          guild: boolean;
          app: boolean;
        } & Pick<LogicalOperations, "$and" | "$or">);

    staff: boolean;
    // | ({
    //     guild?: boolean;
    //     app?: boolean;
    //   } & Pick<LogicalOperations, "$and" | "$or">);
  }
}

export namespace OSMetrics {
  interface OSMetricsData<HR extends boolean = false> {
    /** Running node version */
    node_ver: string;

    /** Process uptime in seconds or in a human-readable format if specified. */
    process_uptime: HR extends true ? string : number;

    /** Package or application version. */
    package_ver: string;

    system: {
      /** Running OS type. See {@link https://en.wikipedia.org/wiki/Uname#Examples}. */
      type: string;

      /** Running OS platform */
      platform: "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "win32";

      /** Running OS version */
      version: string;

      /** System uptime in seconds or in a human-readable format if specified. */
      uptime: HR extends true ? string : number;
    };

    /** Process CPU usage */
    cpu: {
      /** CPU utilization in general */
      utilization: number;

      /** CPU model */
      model: string;
    };

    memory: {
      /** OS memory size in Megabytes */
      total: HR extends true ? string : number;

      /** Free OS memory in Bytes Megabytes */
      available: HR extends true ? string : number;

      /** OS memory usage in Megabytes */
      used: HR extends true ? string : number;

      /** Process memory rss in Megabytes */
      rss: HR extends true ? string : number;

      heap_total: HR extends true ? string : number;
      heap_used: HR extends true ? string : number;
    };
  }
}
