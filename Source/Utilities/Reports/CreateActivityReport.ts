import { SheetsAPI, DriveAPI } from "#Handlers/GoogleAPIs.js";
import { ListFormatter } from "#Utilities/Strings/Formatters.js";
import { GoogleAPI } from "#Config/Secrets.js";
import { format } from "date-fns";

import Util from "node:util";
import AppError from "#Utilities/Classes/AppError.js";
import GetActivityReportData from "#Utilities/Database/GetActivityReportData.js";

export default async function CreateActivityReport(
  Opts: Parameters<typeof GetActivityReportData>[0]
): Promise<string> {
  const ReportData = await GetActivityReportData(Opts);
  const Copy = await GetARSTemplateCopy();
  const ShiftTypes = Array.isArray(Opts.shift_type)
    ? Opts.shift_type
    : Opts.shift_type
      ? [Opts.shift_type]
      : [];

  const ShiftTypeText = ShiftTypes.length > 0 ? ` — ${ListFormatter.format(ShiftTypes)}` : "";
  const SpreadsheetTitle = "LAPD Central — Activity Report";
  const SheetOneTableTitle = Util.format("%s\nActivity Report%s", Opts.guild.name, ShiftTypeText);

  const FirstSheetName = GetFirstSheetName(Opts.until ?? new Date(), Opts.after);
  const RowStartIndex = 11;
  const RowEndIndex = Math.max(
    ReportData.records.length === 1 ? 13 : ReportData.records.length + 10,
    RowStartIndex + 1
  );

  const CSpreadsheet = await SheetsAPI.spreadsheets.get({
    spreadsheetId: Copy.data.id!,
  });

  const RecordsSheetId = CSpreadsheet.data.sheets?.[0]?.properties?.sheetId;
  const StatisticsSheetId = CSpreadsheet.data.sheets?.[1]?.properties?.sheetId;

  if (RecordsSheetId == null || StatisticsSheetId == null) {
    throw new AppError({
      title: "Sheet ID Retrieval Error",
      stack: new Error("<<stack trace>>").stack,
      message: "Failed to retrieve sheet IDs from the copied spreadsheet.",
      showable: false,
      code: 2,
    });
  }

  await SheetsAPI.spreadsheets.batchUpdate({
    spreadsheetId: Copy.data.id!,
    requestBody: {
      requests: [
        // Set the spreadsheet title:
        {
          updateSpreadsheetProperties: {
            fields: "title",
            properties: {
              title: SpreadsheetTitle,
            },
          },
        },

        // Sheet 1: Detailed Report
        // 1.1. Set the guild name:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: RecordsSheetId,
              ...CreateGridRange("C", 2),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: SheetOneTableTitle,
                    },
                  },
                ],
              },
            ],
          },
        },

        // 1.2. Set name column width if necessary; dependent on the include member nicknames option:
        {
          updateDimensionProperties: {
            fields: "pixelSize",
            range: {
              sheetId: RecordsSheetId,
              dimension: "COLUMNS",
              startIndex: 2,
              endIndex: 3,
            },
            properties: {
              pixelSize: Opts.include_member_nicknames ? 380 : 210,
            },
          },
        },

        // 1.3. Add minimal necessary rows to insert report rows:
        {
          insertDimension: {
            inheritFromBefore: true,
            range: {
              sheetId: RecordsSheetId,
              dimension: "ROWS",
              startIndex: RowStartIndex,
              endIndex: RowEndIndex,
            },
          },
        },

        // 1.4. Set the data for the report, including any notes on cells:
        {
          updateCells: {
            fields: "userEnteredValue,note",
            rows: ReportData.records,
            start: {
              sheetId: RecordsSheetId,
              rowIndex: 10,
              columnIndex: 1,
            },
          },
        },

        // 1.5. Set the quota field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: RecordsSheetId,
              ...CreateGridRange("L", 8),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: ReportData.quota,
                    },
                  },
                ],
              },
            ],
          },
        },

        // 1.6. Optional highlighting:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: RecordsSheetId,
              ...CreateGridRange("N", 2, 4, 1),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: Opts.highlight_on_leave ? "Yes" : "No",
                    },
                  },
                ],
              },
              {},
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: Opts.highlight_below_quota ? "Yes" : "No",
                    },
                  },
                ],
              },
              {},
            ],
          },
        },

        // 1.7. Set the first sheet's title:
        {
          updateSheetProperties: {
            fields: "title",
            properties: {
              sheetId: RecordsSheetId,
              title: FirstSheetName,
            },
          },
        },

        // Sheet 2: Statistics
        // 2.1. Set the total time field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: StatisticsSheetId,
              ...CreateGridRange("C", 4),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: ReportData.statistics.total_time,
                    },
                  },
                ],
              },
            ],
          },
        },

        // 2.2. Set the total shifts field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: StatisticsSheetId,
              ...CreateGridRange("B", 4),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      numberValue: ReportData.statistics.total_shifts,
                    },
                  },
                ],
              },
            ],
          },
        },

        // 2.3. Set the average time field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: StatisticsSheetId,
              ...CreateGridRange("D", 7),
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: ReportData.statistics.average_time,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  });

  await DriveAPI.permissions.create({
    fileId: Copy.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return (
    CSpreadsheet.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${Copy.data.id}`
  );
}

/**
 * Copies the activity report spreadsheet template from Google Drive.
 * @returns
 */
async function GetARSTemplateCopy() {
  return DriveAPI.files.copy({
    fileId: GoogleAPI.ActivityReportTempSpreadsheetID,
  });
}

/**
 * Returns the name for the first sheet in a report based on the start and end dates.
 * @param EndDate - The end date of the report.
 * @param StartDate - The start date of data in the report.
 * @returns a formmatted string for the first sheet name.
 */
function GetFirstSheetName(EndDate: Date, StartDate?: Date | null): string {
  if (!StartDate) {
    const SPortion = format(EndDate, "MMMM do 'at' p O, yyyy");
    return `Report: Until ${SPortion}`;
  }

  const IsDifferentYear = StartDate.getFullYear() !== EndDate.getFullYear();
  const FPortion = format(StartDate, `MMMM do${IsDifferentYear ? ", yyyy" : ""}`);
  const SPortion = format(EndDate, "MMMM do 'at' p O");
  return `Report: ${FPortion} — ${SPortion}`;
}

/**
 * Converts a spreadsheet column name or 1-indexed column number to a
 * zero-based Google Sheets column index. String columns are case-insensitive.
 *
 * Numeric columns:
 * - `1` = column A
 * - `26` = column Z
 * - `27` = column AA
 *
 * @param Column - The spreadsheet column name or 1-indexed column number.
 * @returns The zero-based column index for Google Sheets.
 */
function GetColumnIndex(Column: number | string): number {
  if (typeof Column === "number") {
    if (!Number.isInteger(Column) || Column < 1) {
      throw new RangeError("Column numbers must be positive integers.");
    }

    return Column - 1;
  }

  const NormalizedColumn = Column.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(NormalizedColumn)) {
    throw new RangeError(`Invalid spreadsheet column name: "${Column}".`);
  }

  let ColumnIndex = 0;
  for (const Character of NormalizedColumn) {
    ColumnIndex = ColumnIndex * 26 + Character.charCodeAt(0) - 64;
  }

  return ColumnIndex - 1;
}

/**
 * Creates a Google Sheets grid range.
 *
 * @param Column - The 1-indexed starting (inclusive) column number or spreadsheet column name.
 * @param Row - The 1-indexed starting (inclusive) row number.
 * @param RowCount - The number of rows to include in the range. Defaults to `1`.
 * @param ColumnCount - The number of columns to include in the range. Defaults to `1`.
 * @returns An object representing the grid range for Google Sheets.
 */
function CreateGridRange(Column: number | string, Row: number, RowCount = 1, ColumnCount = 1) {
  if (!Number.isInteger(Row) || Row < 1) {
    throw new RangeError("Row numbers must be positive integers.");
  }

  if (!Number.isInteger(RowCount) || RowCount < 1) {
    throw new RangeError("Row counts must be positive integers.");
  }

  if (!Number.isInteger(ColumnCount) || ColumnCount < 1) {
    throw new RangeError("Column counts must be positive integers.");
  }

  const StartColumnIndex = GetColumnIndex(Column);
  return {
    startRowIndex: Row - 1,
    endRowIndex: Row - 1 + RowCount,
    startColumnIndex: StartColumnIndex,
    endColumnIndex: StartColumnIndex + ColumnCount,
  };
}
