import { connections as MongooseConnection, STATES as DBStates } from "mongoose";
import { ReadableDuration } from "#Utilities/Strings/Formatters.js";
import { OSMetrics } from "#Typings/Utilities/Generic.js";
import { OSUtils } from "node-os-utils";
import { Client } from "discord.js";

import AppLogger from "#Utilities/Classes/AppLogger.js";
import Convert from "convert-units";
import Process from "node:process";
import OS from "node:os";

// -----------------------------------------------------------------------------
// Types, Interfaces, & Constants:
// -------------------------------
type MData<HR extends boolean = false> = OSMetrics.OSMetricsData<HR>;

const OSUtilsInstance = new OSUtils();
const DiscordPingTimeout = 4000;
const DatabasePingTimeout = 5000;

export const AppResponse = {
  /* Indicates whether the application is currently rate-limited by Discord API or Cloudflare. */
  ratelimited: false,
};

export interface HealthMetrics {
  status: "healthy" | "degraded";
  database: {
    status: string;
    latency: number | null;
    healthy: boolean;
  };
  discord: {
    latency: number | null;
    healthy: boolean;
  };
}

// -----------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Returns system details such as type, uptime, version, and platform, with an option to return human-readable values.
 * @param {Readable} HR - Stands for "human readable".
 * @returns
 */
function GetSysDetails<Readable extends boolean = false>(HR: Readable): MData<Readable>["system"] {
  if (globalThis.gc) globalThis.gc();
  if (HR) {
    return {
      type: OS.type(),
      uptime: ReadableDuration(OS.uptime() * 1000) as any,
      version: OS.version(),
      platform: OS.platform() as any,
    };
  } else {
    return {
      type: OS.type(),
      uptime: OS.uptime() as any,
      version: OS.version(),
      platform: OS.platform() as any,
    };
  }
}

/**
 * Get memory details.
 * @param Unit - The unit of measurement.
 * @param HR - Whether to display in human-readable format.
 * @returns Memory details.
 */
function GetMemoryDetails<Readable extends boolean = false>(
  Unit: Convert.Unit,
  HR: Readable
): MData<Readable>["memory"] {
  const PMU = Process.memoryUsage();
  for (const [K, V] of Object.entries(PMU)) {
    PMU[K] = Math.round(Convert(V).from("B").to(Unit));
  }

  const MemoryDetails: Record<keyof MData["memory"], number | string> = {
    total: Math.round(Convert(OS.totalmem()).from("B").to(Unit)),
    available: Math.round(Convert(OS.freemem()).from("B").to(Unit)),
    rss: PMU.rss,
    heap_total: PMU.heapTotal,
    heap_used: PMU.heapUsed,
    used: Math.round(
      Convert(OS.totalmem() - OS.freemem())
        .from("B")
        .to(Unit)
    ),
  };

  if (HR) {
    for (const [K, V] of Object.entries(MemoryDetails)) {
      MemoryDetails[K] = `${V} ${Unit}`;
    }
  }

  return MemoryDetails as MData<Readable>["memory"];
}

/**
 * Basic CPU details.
 * @returns
 */
async function GetCPUDetails(): Promise<MData["cpu"]> {
  const CPUUsage = await OSUtilsInstance.cpu.usage();
  return {
    model: OSUtilsInstance.cpu.model(),
    utilization: CPUUsage.success ? CPUUsage.data : null,
  };
}

// -----------------------------------------------------------------------------
// Main Functions:
// ---------------
/**
 * Retrieves comprehensive operating system and process metrics.
 *
 * @template Readable - Boolean type parameter that determines if the output should be human-readable
 * @param {Readable} HumanReadable - If true, formats durations and sizes for human readability; otherwise returns raw values
 * @returns {Promise<MData<Readable>>} A promise that resolves to an object containing:
 *   - `node_ver`: Node.js version (without the 'v' prefix)
 *   - `package_ver`: Package version from environment variables
 *   - `process_uptime`: Process uptime in seconds or human-readable format
 *   - `cpu`: CPU details from GetCPUDetails()
 *   - `system`: System details from GetSysDetails()
 *   - `memory`: Memory details in MB from GetMemoryDetails()
 */
export async function GetOSMetrics<Readable extends boolean = false>(
  HumanReadable: Readable
): Promise<MData<Readable>> {
  const PUptime = HumanReadable ? ReadableDuration(Process.uptime() * 1000) : Process.uptime();
  return {
    node_ver: Process.version.slice(1),
    package_ver: process.env.version ?? process.env.npm_package_version ?? "N/A",
    process_uptime: PUptime as any,

    cpu: await GetCPUDetails(),
    system: GetSysDetails(HumanReadable),
    memory: GetMemoryDetails("MB", HumanReadable),
  };
}

/**
 * Get database ping latency via MongoDB.
 * @returns Latency in milliseconds, `-1` if failed, or `null` if disconnected.
 */
export async function GetDatabaseLatency(): Promise<number | null> {
  if (MongooseConnection[0].readyState !== 1 || !MongooseConnection[0].db) {
    return null;
  }

  try {
    const Start = Date.now();
    const TimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Discord ping timed out after ${(DatabasePingTimeout / 60).toFixed(1)}s.`)
          ),
        DatabasePingTimeout
      )
    );

    await Promise.race([MongooseConnection[0].db.admin().ping(), TimeoutPromise]);
    return Date.now() - Start;
  } catch (Err: any) {
    AppLogger.warn({
      message: "Database ping check failed.",
      label: "MetricsCollector.ts",
      stack: Err?.stack,
      error: Err.message ?? String(Err),
    });
    return -1;
  }
}

/**
 * Get Discord API roundtrip latency.
 * @param DiscordApp - The Discord client instance.
 * @returns Latency in milliseconds, `-1` if failed, or `null` if not ready.
 */
export async function GetDiscordAPILatency(DiscordApp: Client): Promise<number | null> {
  if (!DiscordApp.isReady()) {
    return null;
  }

  try {
    const Start = Date.now();
    const TimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Discord ping timed out after ${(DiscordPingTimeout / 60).toFixed(1)}s.`)
          ),
        DiscordPingTimeout
      )
    );

    await Promise.race([DiscordApp.user.fetch(), TimeoutPromise]);
    return Date.now() - Start;
  } catch (Err: any) {
    AppLogger.warn({
      label: "MetricsCollector.ts",
      message: "Discord health check failed.",
      stack: Err?.stack,
      error: Err.message ?? String(Err),
    });
    return -1;
  }
}

/**
 * Collect comprehensive health metrics for the application.
 * @param DiscordApp - The Discord client instance.
 * @returns Health metrics object including status and individual health checks.
 */
export async function CollectHealthMetrics(DiscordApp: Client): Promise<HealthMetrics> {
  const [DBLatency, DiscordApiLatency] = await Promise.all([
    GetDatabaseLatency(),
    GetDiscordAPILatency(DiscordApp),
  ]);

  const IsHealthy =
    DiscordApp.isReady() &&
    MongooseConnection[0].readyState === 1 &&
    DBLatency !== null &&
    DBLatency >= 0 &&
    DiscordApiLatency !== null &&
    DiscordApiLatency >= 0 &&
    !AppResponse.ratelimited;

  return {
    status: IsHealthy ? "healthy" : "degraded",
    database: {
      status: DBStates[MongooseConnection[0].readyState],
      latency: DBLatency,
      healthy: DBLatency !== null && DBLatency >= 0 && DBLatency < 1000,
    },
    discord: {
      latency: DiscordApiLatency,
      healthy: DiscordApiLatency !== null && DiscordApiLatency >= 0 && DiscordApiLatency < 2500,
    },
  };
}
