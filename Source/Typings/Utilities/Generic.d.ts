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
  /**
   * Represents a set of metrics and information about the running Node.js process and the underlying operating system.
   *
   * @template HR - If `true`, certain numeric fields are returned in a human-readable string format instead of as numbers.
   */
  interface OSMetricsData<HR extends boolean = false> {
    /** The version of Node.js currently running. */
    node_ver: string;

    /** The uptime of the Node.js process, in seconds or as a human-readable string if `HR` is `true`. */
    process_uptime: HR extends true ? string : number;

    /** The version of the package or application. */
    package_ver: string;

    system: {
      /** The type of operating system (see https://en.wikipedia.org/wiki/Uname#Examples). */
      type: string;

      /** The platform of the operating system (e.g., "win32", "linux"). */
      platform: "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "win32";

      /** The version of the operating system. */
      version: string;

      /** The uptime of the operating system, in seconds or as a human-readable string if `HR` is `true`. */
      uptime: HR extends true ? string : number;
    };

    cpu: {
      /** The overall CPU utilization, or `null` if unavailable. */
      utilization: number | null;

      /** The model of the CPU, or `null` if unavailable. */
      model: string | null;
    };

    memory: {
      /** The total memory size of the OS, in megabytes or as a human-readable string if `HR` is `true`. */
      total: HR extends true ? string : number;

      /** The available/free memory of the OS, in megabytes or as a human-readable string if `HR` is `true`. */
      available: HR extends true ? string : number;

      /** The used memory of the OS, in megabytes or as a human-readable string if `HR` is `true`. */
      used: HR extends true ? string : number;

      /** The resident set size (RSS) of the process, in megabytes or as a human-readable string if `HR` is `true`. */
      rss: HR extends true ? string : number;

      /** The total heap memory allocated, in megabytes or as a human-readable string if `HR` is `true`. */
      heap_total: HR extends true ? string : number;

      /** The heap memory currently used, in megabytes or as a human-readable string if `HR` is `true`. */
      heap_used: HR extends true ? string : number;
    };
  }
}
