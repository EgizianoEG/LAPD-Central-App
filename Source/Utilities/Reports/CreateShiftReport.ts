import { SheetsAPI, DriveAPI } from "@Handlers/GoogleAPIs.js";
import { ListFormatter } from "@Utilities/Strings/Formatters.js";
import { GoogleAPI } from "@Config/Secrets.js";
import { format } from "date-fns";

import Util from "node:util";
import GetActivityReportData from "@Utilities/Database/GetActivityReportData.js";

export default async function CreateShiftReport(
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

  const FirstSheetName = GetFirstSheetName(new Date(), Opts.after);
  const RowEndIndex = ReportData.records.length === 1 ? 13 : ReportData.records.length + 10;
  const CSpreadsheet = await SheetsAPI.spreadsheets.get({
    spreadsheetId: Copy.data.id!,
  });

  await SheetsAPI.spreadsheets.batchUpdate({
    spreadsheetId: Copy.data.id!,
    requestBody: {
      requests: [
        // Sheet 1: Detailed Report
        // 1. Set the guild name:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              startRowIndex: 1, // Refers to row 2
              endRowIndex: 2, // Up to row 3
              startColumnIndex: 2, // Column 'C'
              endColumnIndex: 3, // Up to column 'D'
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

        // 1.5. Set name column width if necessary depending on whether or not to include member nicknames:
        {
          updateDimensionProperties: {
            fields: "pixelSize",
            range: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              dimension: "COLUMNS",
              startIndex: 2,
              endIndex: 3,
            },
            properties: {
              pixelSize: Opts.include_member_nicknames ? 380 : 210,
            },
          },
        },

        // 2. Add necessary rows to insert data properly:
        {
          insertDimension: {
            inheritFromBefore: true,
            range: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              dimension: "ROWS",
              startIndex: 11, // Insert after the 11th row (0-based index)
              endIndex: RowEndIndex,
            },
          },
        },

        // 3. Set the data for the report, including any notes on cells:
        {
          updateCells: {
            rows: ReportData.records,
            fields: "userEnteredValue,note",
            start: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              rowIndex: 10,
              columnIndex: 1,
            },
          },
        },

        // 4. Set the quota field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              startRowIndex: 7, // Refers to row 8
              endRowIndex: 8, // Up to row 9
              startColumnIndex: 12, // Column 'L'
              endColumnIndex: 13, // Up to column 'M'
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

        // 5. Set the first sheet title:
        {
          updateSheetProperties: {
            fields: "title",
            properties: {
              sheetId: CSpreadsheet.data.sheets![0].properties!.sheetId,
              title: FirstSheetName,
            },
          },
        },

        // 6. Set the spreadsheet title:
        {
          updateSpreadsheetProperties: {
            fields: "title",
            properties: {
              title: SpreadsheetTitle,
            },
          },
        },

        // Sheet 2: Statistics
        // 1. Set the total time field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: CSpreadsheet.data.sheets![1].properties!.sheetId,
              startRowIndex: 3, // Refers to row 4
              endRowIndex: 5, // Up to row 6
              startColumnIndex: 2, // Column 'C'
              endColumnIndex: 5, // Up to column 'F'
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

        // 2. Set the total shifts field:
        {
          updateCells: {
            fields: "userEnteredValue",
            range: {
              sheetId: CSpreadsheet.data.sheets![1].properties!.sheetId,
              startRowIndex: 3, // Refers to row 4
              endRowIndex: 5, // Refers to up to row 6
              startColumnIndex: 1, // Refers to column B
              endColumnIndex: 2, // Up to column C
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
      ],
    },
  });

  // Set the permission for public access.
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
    const SPortion = format(EndDate, "MMMM do");
    return `Report: Until ${SPortion}`;
  }

  const IsDifferentYear = StartDate.getFullYear() !== EndDate.getFullYear();
  const FPortion = format(StartDate, `MMMM do${IsDifferentYear ? ", yyyy" : ""}`);
  const SPortion = format(EndDate, "MMMM do 'at' p O");
  return `Report: ${FPortion} — ${SPortion}`;
}
