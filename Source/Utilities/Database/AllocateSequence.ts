import GuildModel from "#Models/Guild.js";
import { SequenceLimits } from "#Config/Constants.js";

export type SequenceRecordType = "arrest" | "citation" | "incident";
export type AllocatedSequence = {
  /** The year suffix, not all four digits. */
  year: number;
  sequence: number;
};

const MaxAllocationAttempts = 5;
const CounterPaths = {
  arrest: "counters.arrests",
  citation: "counters.citations",
  incident: "counters.incidents",
} as const satisfies Record<SequenceRecordType, `counters.${string}`>;

export default async function AllocateSequenceNumber(
  GuildId: string,
  RecordType: SequenceRecordType
): Promise<AllocatedSequence> {
  const CounterPath = CounterPaths[RecordType];
  const CurrentYear = new Date().getFullYear() % 100;

  for (let Attempt = 0; Attempt < MaxAllocationAttempts; Attempt++) {
    const Incremented = await GuildModel.findOneAndUpdate(
      { _id: GuildId, [`${CounterPath}.year`]: CurrentYear },
      { $inc: { [`${CounterPath}.value`]: 1 } },
      { returnDocument: "after", projection: { _id: 0, [CounterPath]: 1 } }
    ).lean();

    if (Incremented) {
      const Counter = GetCounterFromResult(Incremented, RecordType);
      return { year: Counter.year, sequence: Counter.value };
    }

    const RolledOver = await GuildModel.findOneAndUpdate(
      { _id: GuildId, [`${CounterPath}.year`]: { $ne: CurrentYear } },
      {
        $set: {
          [`${CounterPath}.year`]: CurrentYear,
          [`${CounterPath}.value`]: GenerateInitialSequenceNumber(RecordType),
        },
      },
      { returnDocument: "after", projection: { _id: 0, [CounterPath]: 1 } }
    ).lean();

    if (RolledOver) {
      const Counter = GetCounterFromResult(RolledOver, RecordType);
      return { year: Counter.year, sequence: Counter.value };
    }

    // Neither matched;
    // Either another invocation succeeded (loop again and retry) or the guild doesn't exist.
  }

  const GuildExists = await GuildModel.exists({ _id: GuildId });
  if (!GuildExists) {
    throw new Error(`Guild ${GuildId} does not exist — cannot allocate a ${RecordType} sequence.`);
  }

  throw new Error(
    `Failed to allocate a ${RecordType} sequence for guild ${GuildId} after ${MaxAllocationAttempts} attempts.`
  );
}

/**
 * Retrieves the counter for a specific record type from the result of a database query.
 * @param Result - The result object from a database query that contains the counter data.
 * @param RecordType - The type of record for which the counter is being retrieved (e.g., "arrest", "citation", or "incident").
 * @returns Gauranteed object containing the year and value of the counter for the specified record type.
 * @throws Will throw an error if the counter data is missing or invalid for the specified record type.
 */
function GetCounterFromResult(
  Result: Record<string, any>,
  RecordType: SequenceRecordType
): { year: number; value: number } {
  const Counter = CounterPaths[RecordType].split(".").reduce<any>((obj, key) => obj?.[key], Result);
  if (!Counter || typeof Counter.year !== "number" || typeof Counter.value !== "number") {
    throw new Error(`Invalid counter data for ${RecordType}: ${JSON.stringify(Counter)}`);
  }

  return Counter;
}

/**
 * Generates an initial sequence number for a given record type based on predefined limits.
 * Useful for initializing counters when rolling over to a new year, instead of starting from 1, to avoid the artificial "brand-new database" appearance.
 * @param RecordType
 * @returns
 */
function GenerateInitialSequenceNumber(RecordType: SequenceRecordType): number {
  const Limits = SequenceLimits[RecordType];
  return (
    Math.floor(Math.random() * (Limits.initial_max - Limits.initial_min + 1)) + Limits.initial_min
  );
}
