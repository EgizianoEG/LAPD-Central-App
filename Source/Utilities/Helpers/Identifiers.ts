import type { AllocatedSequence, SequenceRecordType } from "../Database/AllocateSequence.js";

export const SequenceWidths: Record<SequenceRecordType, number> = {
  arrest: 6,
  citation: 5,
  incident: 5,
};

/**
 * Combines an allocated year and sequence into a numeric identifier.
 *
 * @param Allocated The allocated year and sequence.
 * @param RecordType The record type used to determine sequence width.
 * @returns The composed numeric identifier.
 */
export function ComposeIdentifier(
  Allocated: AllocatedSequence,
  RecordType: SequenceRecordType
): number {
  const width = SequenceWidths[RecordType];
  return Number(`${Allocated.year}${String(Allocated.sequence).padStart(width, "0")}`);
}

/**
 * Parses a formatted identifier into its two-digit year and sequence number.
 *
 * Identifiers may be provided as numbers or strings, with an optional hyphen
 * between the year and sequence portions.
 *
 * @param Formatted The identifier to parse, such as `24-00001` or `2400001`.
 * @returns The year and sequence represented by the identifier.
 * @throws If the identifier is not seven or eight digits after the optional hyphen is removed.
 */
export function ParseIdentifier(Formatted: string | number): AllocatedSequence {
  if (typeof Formatted === "number") {
    Formatted = String(Formatted);
  }

  const Normalized = Formatted.replace("-", "");
  if (!/^\d{7,8}$/.test(Normalized)) {
    throw new Error(`Invalid identifier: ${Formatted}`);
  }

  return {
    year: +Normalized.slice(0, 2),
    sequence: +Normalized.slice(2),
  };
}

/**
 * Formats an allocated year and sequence into a string with a hyphen separator.
 * @param Allocated The allocated year and sequence.
 * @param RecordType The record type used to determine sequence width.
 * @returns A string in the format `YY-XXXXX`, where `YY` is the two-digit year and `XXXXX` is the zero-padded sequence number.
 */
export function DashFormatIdentifier(
  Allocated: AllocatedSequence | string | number,
  RecordType: SequenceRecordType
): string {
  const Width = SequenceWidths[RecordType];
  if (typeof Allocated === "string" || typeof Allocated === "number") {
    Allocated = ParseIdentifier(Allocated);
  }

  return `${Allocated.year.toString().padStart(2, "0")}-${Allocated.sequence.toString().padStart(Width, "0")}`;
}
