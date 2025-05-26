import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { OSMetrics } from "@Typings/Utilities/Generic.js";
import Convert from "convert-units";
import Process from "node:process";
import OSUtils from "node-os-utils";
import OS from "node:os";

type MData<HR extends boolean = false> = OSMetrics.OSMetricsData<HR>;
export default async function GetOSMetrics<Readable extends boolean = false>(
  HumanReadable: Readable
): Promise<MData<Readable>> {
  const PUptime = HumanReadable ? ReadableDuration(Process.uptime() * 1000) : Process.uptime();
  return {
    node_ver: Process.version.slice(1),
    process_uptime: PUptime as any,

    cpu: await GetCPUDetails(),
    system: GetSysDetails(HumanReadable),
    memory: GetMemoryDetails("MB", HumanReadable),
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
  if (global.gc) global.gc();
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
  return {
    model: OSUtils.cpu.model(),
    utilization: await OSUtils.cpu.usage(),
  };
}
