import * as v8 from "node:v8";
import TTLCache from "@isaacs/ttlcache";
import { Collection } from "discord.js";

export interface CacheMemoryUsage {
  entries: number;
  bytes: number;
  human_readable: string;
  process_memory_percentage?: number;
  sampled: boolean;
  sample_size?: number;
}

interface CalculateOptions {
  sample_threshold?: number;
  sample_size?: number;
  relative_to?: "heapUsed" | "rss" | "external";
  process_memory_snapshot?: NodeJS.MemoryUsage;
}

const OBJECT_OVERHEAD_BYTES = 48;

function EstimateEntrySize(Key: unknown, Value: unknown): number {
  try {
    return v8.serialize(Key).byteLength + v8.serialize(Value).byteLength;
  } catch {
    return FallbackSizeOf(Key) + FallbackSizeOf(Value);
  }
}

function FallbackSizeOf(Value: unknown, Seen = new WeakSet<object>()): number {
  if (Value == null) return 0;
  const T = typeof Value;

  if (T === "boolean") return 4;
  if (T === "number") return 8;
  if (T === "bigint") return 8;
  if (T === "string") return (Value as string).length * 2;
  if (T === "symbol" || T === "function") return 0;

  if (T === "object") {
    const Obj = Value as object;
    if (Seen.has(Obj)) return 0;
    Seen.add(Obj);

    if (Buffer.isBuffer(Obj)) return Obj.byteLength;
    if (ArrayBuffer.isView(Obj)) return (Obj as any).byteLength ?? 0;
    if (Array.isArray(Obj)) return Obj.reduce((s, v) => s + FallbackSizeOf(v, Seen), 0);
    if (Obj instanceof Map) {
      let s = 0;
      for (const [k, v] of Obj) s += FallbackSizeOf(k, Seen) + FallbackSizeOf(v, Seen);
      return s;
    }

    if (Obj instanceof Set) {
      let s = 0;
      for (const v of Obj) s += FallbackSizeOf(v, Seen);
      return s;
    }

    if (Obj instanceof Date) return 8;

    let s = 0;
    for (const k of Object.keys(Obj)) {
      s += k.length * 2 + FallbackSizeOf((Obj as any)[k], Seen);
    }

    return s;
  }

  return 0;
}

function HumanReadableBytes(Bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = Bytes;
  let i = 0;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }

  return `${v.toFixed(2)} ${units[i]}`;
}

export function CalculateCacheMemoryUsage(
  Cache: TTLCache<any, any> | Map<any, any> | Collection<any, any>,
  Options: CalculateOptions = {}
): CacheMemoryUsage {
  const {
    sample_threshold: sampleThreshold = 5000,
    sample_size: sampleSize = 500,
    relative_to: RelativeTo,
  } = Options;

  const Entries = Cache.size;
  if (typeof (Cache as any).entries !== "function") {
    throw new TypeError("Unsupported cache type: no entries() iterator");
  }

  let TotalBytes = 0;
  let Sampled = false;
  let ActualSampleSize: number | undefined;

  if (Entries > sampleThreshold) {
    Sampled = true;
    ActualSampleSize = Math.min(sampleSize, Entries);
    const SkipStart = Math.floor(Math.random() * Math.max(Entries - ActualSampleSize, 1));

    let Seen = 0;
    let Collected = 0;
    let SampleBytes = 0;

    for (const [key, value] of (Cache as any).entries()) {
      if (Seen++ < SkipStart) continue;
      if (Collected >= ActualSampleSize) break;
      SampleBytes += EstimateEntrySize(key, value) + OBJECT_OVERHEAD_BYTES;
      Collected++;
    }

    TotalBytes = (SampleBytes / Math.max(Collected, 1)) * Entries;
  } else {
    for (const [key, value] of (Cache as any).entries()) {
      TotalBytes += EstimateEntrySize(key, value) + OBJECT_OVERHEAD_BYTES;
    }
  }

  const Result: CacheMemoryUsage = {
    entries: Entries,
    bytes: Math.round(TotalBytes),
    human_readable: HumanReadableBytes(TotalBytes),
    sampled: Sampled,
    sample_size: ActualSampleSize,
  };

  if (RelativeTo) {
    const Denom = (Options.process_memory_snapshot ?? process.memoryUsage())[RelativeTo];
    Result.process_memory_percentage = (TotalBytes / Denom) * 100;
  }

  return Result;
}
