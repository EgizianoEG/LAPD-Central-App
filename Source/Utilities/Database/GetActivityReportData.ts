import { add, sub, isAfter, differenceInHours, milliseconds } from "date-fns";
import { Collection, Guild, GuildMember, Role } from "discord.js";
import { AggregateResults } from "#Typings/Utilities/Database.js";
import { ReadableDuration } from "#Utilities/Strings/Formatters.js";
import GetGuildSettings from "./GetGuildSettings.js";
import ShiftModel from "#Models/Shift.js";
import AppError from "#Utilities/Classes/AppError.js";

interface GetActivityReportDataOpts {
  /** The guild to get the activity report data for. */
  guild: Guild;

  /** The users to limit the activity report data to. */
  members: Collection<string, GuildMember>;

  /** The date to return the activity report data after. If not provided, defaults to all the time. */
  after?: Date | null;

  /** The date to return the activity report data until. If not provided, defaults to the current date. */
  until?: Date | null;

  /** The shift type(s) to get the activity report data for. */
  shift_type?: string | string[] | null;

  /** The duration in milliseconds of the quota that must be met. Defaults to 0 seconds, which means no quota. */
  quota_duration?: number | null;

  /** Whether or not to include member nicknames in the activity report data. Defaults to `false`. */
  include_member_nicknames?: boolean;
}

interface UserEnteredValue {
  numberValue?: number;
  stringValue?: string;
  boolValue?: boolean;
}

interface RecordValue {
  userEnteredValue: UserEnteredValue;
}

interface Record {
  values: RecordValue[];
}

interface ActivityReportDataReturn {
  /** The shift time requirement if any. Defaults to `"None"` if the time requirement is not provided or zero seconds. */
  quota: string;

  /** Prepared activity report data to fill the google spreadsheet template. */
  records: Record[];

  /** Prepared statistics for the report's second sheet. */
  statistics: AggregateResults.ActivityReportStatistics<string>;
}

/**
 * Retrieves activity report data for a guild based on the provided options.
 *
 * @param Opts - The options for generating the activity report.
 * @param Opts.guild - The guild object containing the guild ID.
 * @param Opts.members - The list of guild members to include in the report.
 * @param Opts.shift_type - (Optional) The type of shift to filter members by.
 * @param Opts.quota_duration - (Optional) The duration of the quota for the report.
 * @param Opts.include_member_nicknames - (Optional) Whether to include member nicknames in the report.
 *
 * @returns A promise that resolves to the activity report data, including statistics, records, and quota information.
 *
 * @throws {AppError} If the guild configuration is not found.
 * @throws {AppError} If no staff or management roles are identified for the guild.
 * @throws {AppError} If a non-existent shift type is specified.
 * @throws {AppError} If no activity records are found for the specified options.
 *
 * The returned object contains:
 * - `statistics`: An object with total time and total shifts statistics.
 * - `records`: An array of activity records for each member, including details such as time spent, arrests, citations, incidents, and leave status.
 * - `quota`: A string representing the quota duration or "None" if not specified.
 */
export default async function GetActivityReportData(
  Opts: GetActivityReportDataOpts
): Promise<ActivityReportDataReturn> {
  const GuildConfig = await GetGuildSettings(Opts.guild.id);
  const GuildStaffMgmtRoles = [
    ...(GuildConfig?.role_perms.staff ?? []),
    ...(GuildConfig?.role_perms.management ?? []),
  ];

  const ShiftOrUANStatusRoles = [
    ...[GuildConfig?.leave_notices.leave_role].filter((R): R is string => !!R),
    ...[GuildConfig?.reduced_activity.ra_role].filter((R): R is string => !!R),
    ...(GuildConfig?.shift_management.role_assignment.on_duty ?? []),
    ...(GuildConfig?.shift_management.role_assignment.on_break ?? []),
  ];

  const SpecifiedShiftTypes = Array.isArray(Opts.shift_type)
    ? Opts.shift_type
    : Opts.shift_type
      ? [Opts.shift_type]
      : [];

  if (!GuildConfig) throw new AppError({ template: "GuildConfigNotFound", showable: true });
  if (!GuildStaffMgmtRoles.length)
    throw new AppError({ template: "ActivityReportNoIdentifiedStaff", showable: true });

  if (SpecifiedShiftTypes && SpecifiedShiftTypes.length > 0) {
    const GuildShiftTypes = GuildConfig.shift_management.shift_types;
    const ValidShiftTypes = SpecifiedShiftTypes.map((ST) => {
      const ShiftType = GuildShiftTypes.find((Type) => Type.name === ST);
      if (!ShiftType && ST.toLowerCase() === "default") {
        return {
          name: "Default",
          access_roles: GuildStaffMgmtRoles,
        };
      }

      if (!ShiftType) throw new AppError({ template: "NonexistentShiftTypeUsage", showable: true });
      return ShiftType;
    });

    Opts.members = Opts.members.filter((Member) => {
      const HasStaffMgmtRoles = Member.roles.cache.hasAny(...GuildStaffMgmtRoles);
      const HasShiftTypeRoles = ValidShiftTypes.some((ShiftType) =>
        Member.roles.cache.hasAny(...ShiftType.access_roles)
      );

      return HasStaffMgmtRoles && HasShiftTypeRoles && !Member.user.bot;
    });
  } else {
    Opts.members = Opts.members.filter(
      (Member) => Member.roles.cache.hasAny(...GuildStaffMgmtRoles) && !Member.user.bot
    );
  }

  const RetrieveDate = Opts.until ?? new Date();
  const RecordsBaseData = (await ShiftModel.aggregate(
    CreateActivityReportAggregationPipeline({ ...Opts, shift_type: SpecifiedShiftTypes }) as any[]
  ).exec()) as AggregateResults.BaseActivityReportData["records"];

  if (!RecordsBaseData.length) {
    throw new AppError({
      template: "ActivityReportNoRecordsFound",
      showable: true,
    });
  }

  const TotalShiftTimeCombined = RecordsBaseData.reduce((Acc, Curr) => Acc + Curr.total_time, 0);
  const ReportStatistics: AggregateResults.ActivityReportStatistics<string> = {
    total_time: ReadableDuration(TotalShiftTimeCombined),
    total_shifts: RecordsBaseData.reduce((Acc, Curr) => Acc + Curr.total_shifts, 0),
    average_time:
      RecordsBaseData.length > 2 && TotalShiftTimeCombined > milliseconds({ minutes: 30 })
        ? ReadableDuration(TotalShiftTimeCombined / RecordsBaseData.length)
        : "Insufficient Data",
  };

  const ProcessedMemberIds = new Set<string>();
  const MembersById = new Map(Opts.members.map((Member) => [Member.id, Member]));
  const Records = RecordsBaseData.map((Record) => {
    const Member = MembersById.get(Record.id);

    let IsLeaveActive = false;
    const NoticeNotes: { leave: string | null; ra: string | null } = {
      leave: null,
      ra: null,
    };

    if (Member) ProcessedMemberIds.add(Member.user.id);
    else return null;

    // Process all activity notices with priority: Active LOA > Active RA > Pending LOA > Pending RA
    const PrioritizedNotices = ProcessActivityNotices(Record.activity_notices, RetrieveDate);
    const LOANotice = PrioritizedNotices.loa;
    const RANotice = PrioritizedNotices.ra;

    // Process LOA notice (highest priority)
    if (LOANotice) {
      if (LOANotice.status === "Approved" && LOANotice.reviewed_by) {
        if (
          LOANotice.review_date !== null &&
          LOANotice.early_end_date === null &&
          isAfter(LOANotice.end_date, RetrieveDate)
        ) {
          IsLeaveActive = true;
        } else {
          const NoticeEndDate = LOANotice.early_end_date || LOANotice.end_date;
          const EndCurrentDatesDifferenceInDays =
            differenceInHours(RetrieveDate, NoticeEndDate) / 24;

          if (EndCurrentDatesDifferenceInDays <= 2.5) {
            const RelativeDuration = ReadableDuration(
              RetrieveDate.getTime() - NoticeEndDate.getTime(),
              {
                conjunction: " and ",
                largest: 2,
                round: true,
              }
            );

            NoticeNotes.leave = `Leave of absence ended around ${RelativeDuration} ago.`;
          }
        }
      } else if (LOANotice.status === "Pending" && LOANotice.review_date === null) {
        const RelativeDuration = ReadableDuration(
          RetrieveDate.getTime() - LOANotice.request_date.getTime(),
          {
            conjunction: " and ",
            largest: 2,
            round: true,
          }
        );

        NoticeNotes.leave = `An unapproved leave of absence request was submitted around ${RelativeDuration} ago.`;
      }
    }

    // Process RA notice (only if no active LOA exists)
    if (RANotice) {
      if (RANotice.status === "Approved" && RANotice.reviewed_by) {
        if (
          RANotice.review_date !== null &&
          RANotice.early_end_date === null &&
          isAfter(RANotice.end_date, RetrieveDate)
        ) {
          const StartCurrentDatesDifferenceInDays =
            differenceInHours(RetrieveDate, RANotice.review_date) / 24;

          // Apply quota scaling for active RA (only if no active LOA)
          if (!Record.quota_met && Opts.quota_duration && !IsLeaveActive) {
            const ScaledQuota = (1 - (RANotice.quota_scale || 0)) * Opts.quota_duration;
            Record.quota_met = Record.total_time >= ScaledQuota;
          }

          if (StartCurrentDatesDifferenceInDays <= 2 || RANotice.type === "ReducedActivity") {
            const QuotaReductionString = `\nQuota Reduction: ~${Math.round((RANotice.quota_scale || 0) * 100)}%`;

            const RelativeDuration = ReadableDuration(
              RetrieveDate.getTime() - RANotice.review_date.getTime(),
              {
                conjunction: " and ",
                largest: 2,
                round: true,
              }
            );

            NoticeNotes.ra = `Reduced activity started around ${RelativeDuration} ago. ${QuotaReductionString}\nApproved by: @${RANotice.reviewed_by.username}`;
          }
        } else {
          const NoticeEndDate = RANotice.early_end_date || RANotice.end_date;
          const EndCurrentDatesDifferenceInDays =
            differenceInHours(RetrieveDate, NoticeEndDate) / 24;

          if (EndCurrentDatesDifferenceInDays <= 2.5) {
            const RelativeDuration = ReadableDuration(
              RetrieveDate.getTime() - NoticeEndDate.getTime(),
              {
                conjunction: " and ",
                largest: 2,
                round: true,
              }
            );

            NoticeNotes.ra = `Reduced activity ended around ${RelativeDuration} ago.`;
          }
        }
      } else if (RANotice.status === "Pending" && RANotice.review_date === null) {
        const RelativeDuration = ReadableDuration(
          RetrieveDate.getTime() - RANotice.request_date.getTime(),
          {
            conjunction: " and ",
            largest: 2,
            round: true,
          }
        );

        NoticeNotes.ra = `An unapproved reduced activity request was submitted around ${RelativeDuration} ago.`;
      }
    }

    return {
      values: [
        { userEnteredValue: { numberValue: Record.total_time, member: Member } },
        { userEnteredValue: { numberValue: 0 } },
        {
          userEnteredValue: {
            stringValue: FormatName(Member, Opts.include_member_nicknames),
          },
        },
        {
          userEnteredValue: {
            stringValue: GetHighestHoistedRole(Member, ShiftOrUANStatusRoles) as
              | Role
              | string
              | null,
          },
        },
        { userEnteredValue: { stringValue: ReadableDuration(Record.total_time) } },
        { userEnteredValue: { numberValue: Record.arrests } },
        { userEnteredValue: { numberValue: Record.arrests_assisted } },
        { userEnteredValue: { numberValue: Record.citations } },
        { userEnteredValue: { numberValue: Record.incidents } },
        {
          userEnteredValue: { stringValue: Record.quota_met ? "Yes" : "No" },
          note: NoticeNotes.ra,
        },
        {
          userEnteredValue: { stringValue: IsLeaveActive ? "Yes" : "No" },
          note: NoticeNotes.leave,
        },
      ],
    };
  }).filter((R) => R !== null);

  // Add remaining members whose data was not available on the database.
  Opts.members
    .filter((Member) => !ProcessedMemberIds.has(Member.id))
    .forEach((Member) => {
      Records.push({
        values: [
          { userEnteredValue: { numberValue: 0, member: Member } },
          { userEnteredValue: { numberValue: 0 } },
          { userEnteredValue: { stringValue: FormatName(Member, Opts.include_member_nicknames) } },
          {
            userEnteredValue: { stringValue: GetHighestHoistedRole(Member, ShiftOrUANStatusRoles) },
          },
          { userEnteredValue: { stringValue: ReadableDuration(0) } },
          { userEnteredValue: { numberValue: 0 } },
          { userEnteredValue: { numberValue: 0 } },
          { userEnteredValue: { numberValue: 0 } },
          { userEnteredValue: { numberValue: 0 } },
          { userEnteredValue: { stringValue: Opts.quota_duration ? "No" : "Yes" } },
          { userEnteredValue: { stringValue: "No" } },
        ],
      });
    });

  Records.sort((A, B) => {
    const ATotalTime = A.values[0].userEnteredValue.numberValue ?? 0;
    const BTotalTime = B.values[0].userEnteredValue.numberValue ?? 0;
    if (BTotalTime !== ATotalTime) return BTotalTime - ATotalTime;

    // Secondary sort: Role position descending (higher roles first).
    const MemberAHHRole = A.values[3].userEnteredValue.stringValue as Role | null;
    const MemberBHHRole = B.values[3].userEnteredValue.stringValue as Role | null;
    if (MemberAHHRole && MemberBHHRole) {
      const RoleComparison = MemberBHHRole.comparePositionTo(MemberAHHRole);
      if (RoleComparison !== 0) return RoleComparison;
    }

    // Tertiary sort: Alphabetical by name when time and roles are equal.
    const AName = A.values[2].userEnteredValue.stringValue! as string;
    const BName = B.values[2].userEnteredValue.stringValue! as string;
    return AName.localeCompare(BName, undefined, {
      ignorePunctuation: true,
      sensitivity: "base",
      numeric: true,
    });
  });

  for (const [Index, Record] of Records.entries()) {
    Record.values[1].userEnteredValue.numberValue = Index + 1;
  }

  return {
    quota: Opts.quota_duration ? ReadableDuration(Opts.quota_duration) : "None",
    statistics: ReportStatistics,
    records: Records.map((Record) => ({
      values: Record.values.slice(1).map((Value) => {
        const UserEnteredValue = Value.userEnteredValue;
        if (UserEnteredValue.stringValue instanceof Role) {
          UserEnteredValue.stringValue = UserEnteredValue.stringValue.name;
        } else if (UserEnteredValue.stringValue === null) {
          UserEnteredValue.stringValue = "N/A";
        }

        return { userEnteredValue: UserEnteredValue, ...(Value.note ? { note: Value.note } : {}) };
      }),
    })) as ActivityReportDataReturn["records"],
  };
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Processes multiple activity notices and returns the prioritized notices for display.
 * Priority order: Active LOA > Active RA > Pending LOA > Pending RA
 *
 * @param ActivityNotices - Array of activity notices from the database
 * @param RetrieveDate - The date used to determine if notices are still active
 * @returns An object containing the prioritized LOA and RA notices
 */
function ProcessActivityNotices(
  ActivityNotices: AggregateResults.BaseActivityReportData["records"][number]["activity_notices"],
  RetrieveDate: Date
): {
  loa:
    | AggregateResults.BaseActivityReportData["records"][number]["activity_notices"][number]
    | null;
  ra: AggregateResults.BaseActivityReportData["records"][number]["activity_notices"][number] | null;
} {
  if (!ActivityNotices || ActivityNotices.length === 0) {
    return { loa: null, ra: null };
  }

  type NoticeType =
    AggregateResults.BaseActivityReportData["records"][number]["activity_notices"][number];
  let ActiveLOA: NoticeType | null = null;
  let ActiveRA: NoticeType | null = null;
  let PendingLOA: NoticeType | null = null;
  let PendingRA: NoticeType | null = null;

  for (const Notice of ActivityNotices) {
    const IsActive =
      Notice.status === "Approved" &&
      Notice.review_date !== null &&
      Notice.early_end_date === null &&
      isAfter(Notice.end_date, RetrieveDate);

    const IsPending = Notice.status === "Pending" && Notice.review_date === null;

    if (Notice.type === "LeaveOfAbsence") {
      if (IsActive && !ActiveLOA) {
        ActiveLOA = Notice;
      } else if (IsPending && !PendingLOA) {
        PendingLOA = Notice;
      }
    } else if (Notice.type === "ReducedActivity") {
      if (IsActive && !ActiveRA) {
        ActiveRA = Notice;
      } else if (IsPending && !PendingRA) {
        PendingRA = Notice;
      }
    }
  }

  // Priority: Active LOA > Active RA > Pending LOA > Pending RA
  // LOA takes precedence; if active LOA exists, don't show any pending notices
  const PrioritizedLOA = ActiveLOA || PendingLOA;
  const PrioritizedRA = ActiveLOA ? null : ActiveRA || PendingRA;

  return { loa: PrioritizedLOA, ra: PrioritizedRA };
}

/**
 * Formats the name of a guild member or a string representation of a name.
 * @param Member - The guild member or string to format. If a string is provided, it is returned as-is.
 * @param IncludeNickname - Optional. If `true`, includes the member's nickname or display name
 *                          along with their username in the format: "[Nickname] (@[Username])". Defaults to `false`.
 * @returns
 */
function FormatName(Member: GuildMember | string, IncludeNickname?: boolean) {
  if (typeof Member === "string") return Member;
  return IncludeNickname && (Member.nickname || Member.displayName)
    ? `${Member.nickname ?? Member.displayName} (@${Member.user.username})`
    : `${Member.user.username}`;
}

/**
 * Determines the name of the highest hoisted role for a given guild member, optionally disregarding specific role IDs.
 * @param Member - The guild member whose roles are being evaluated.
 * @param DisregardedRoleIds - An optional array of role IDs to exclude from consideration.
 * @returns The name of the highest hoisted role, or "N/A" if no valid hoisted role is found.
 */
function GetHighestHoistedRole(
  Member: GuildMember,
  DisregardedRoleIds: string[] = []
): Role | null {
  if (Member.roles.highest.hoist && !DisregardedRoleIds.includes(Member.roles.highest.id)) {
    return Member.roles.highest;
  }

  const TopHoistedRole = [...Member.roles.cache.values()]
    .filter((R) => R.hoist && !DisregardedRoleIds.includes(R.id))
    .sort((A, B) => B.position - A.position)[0];

  return (
    TopHoistedRole ??
    (Member.roles.highest.id === Member.guild.roles.everyone.id ? null : Member.roles.highest)
  );
}

/**
 * Generates an aggregation pipeline for MongoDB to retrieve activity report data
 * for a specific guild and its members. The pipeline starts from the shifts collection
 * to ensure users with shift records but no profile records are included.
 *
 * @param Opts - Options for generating the activity report aggregation pipeline.
 * @returns An aggregation pipeline array to be used with the `aggregate` method of the Shift collection.
 */
function CreateActivityReportAggregationPipeline(
  Opts: Exclude<GetActivityReportDataOpts, "shift_type"> & { shift_type: string[] }
) {
  return [
    {
      $match: {
        guild: Opts.guild.id,
        end_timestamp: { $ne: null },
        ...(Opts.members.size > 0 && { user: { $in: Opts.members.map((U) => U.id) } }),
        ...(Opts.after && { start_timestamp: { $gte: Opts.after } }),
        ...(Opts.until && { end_timestamp: { $lte: Opts.until } }),
        ...(Opts.shift_type.length && { type: { $in: Opts.shift_type } }),
      },
    },
    {
      $project: {
        guild: 1,
        user: 1,
        events: 1,
        end_timestamp: 1,
        start_timestamp: 1,
        "durations.on_duty_mod": 1,
      },
    },
    {
      $group: {
        _id: { guild: "$guild", user: "$user" },
        shifts: {
          $push: {
            events: "$events",
            end_timestamp: "$end_timestamp",
            start_timestamp: "$start_timestamp",
            durations: { on_duty_mod: "$durations.on_duty_mod" },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        guild: "$_id.guild",
        user: "$_id.user",
        shifts: 1,
      },
    },
    {
      $lookup: {
        as: "activity_notices",
        from: "activity_notices",
        let: { guild: "$guild", user: "$user", retrieve_date: Opts.until || new Date() },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$user"] },
                  { $eq: ["$guild", "$$guild"] },
                  { $in: ["$status", ["Approved", "Pending"]] },
                  {
                    $or: [
                      {
                        $and: [
                          Opts.after
                            ? { $gte: ["$request_date", sub(Opts.after, { days: 3 })] }
                            : true,
                          Opts.until
                            ? { $lte: ["$request_date", add(Opts.until, { days: 3 })] }
                            : true,
                        ],
                      },
                      {
                        $and: [
                          { $ne: ["$end_date", null] },
                          Opts.after ? { $gte: ["$end_date", Opts.after] } : true,
                          Opts.until ? { $lte: ["$end_date", Opts.until] } : true,
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $facet: {
              active_loa: [
                {
                  $match: {
                    type: "LeaveOfAbsence",
                    status: "Approved",
                    early_end_date: null,
                    $expr: {
                      $and: [
                        { $ne: ["$review_date", null] },
                        { $gt: ["$end_date", "$$retrieve_date"] },
                      ],
                    },
                  },
                },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
              ],
              active_ra: [
                {
                  $match: {
                    type: "ReducedActivity",
                    status: "Approved",
                    early_end_date: null,
                    $expr: {
                      $and: [
                        { $ne: ["$review_date", null] },
                        { $gt: ["$end_date", "$$retrieve_date"] },
                      ],
                    },
                  },
                },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
              ],
              pending_loa: [
                {
                  $match: {
                    type: "LeaveOfAbsence",
                    status: "Pending",
                    review_date: null,
                  },
                },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
              ],
              pending_ra: [
                {
                  $match: {
                    type: "ReducedActivity",
                    status: "Pending",
                    review_date: null,
                  },
                },
                { $sort: { request_date: -1 } },
                { $limit: 1 },
              ],
            },
          },
          {
            $project: {
              notices: {
                $concatArrays: ["$active_loa", "$active_ra", "$pending_loa", "$pending_ra"],
              },
            },
          },
          { $unwind: { path: "$notices", preserveNullAndEmptyArrays: false } },
          { $replaceRoot: { newRoot: "$notices" } },
          {
            $project: {
              type: 1,
              quota_scale: 1,
              reviewed_by: 1,
              early_end_date: 1,
              extension_request: 1,
              request_date: 1,
              review_date: 1,
              end_date: 1,
              status: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        as: "arrests",
        from: "arrests",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild"] },
                  { $eq: ["$arresting_officer.discord_id", "$$user"] },
                  {
                    $cond: { if: Opts.after, then: { $gte: ["$made_on", Opts.after] }, else: true },
                  },
                  {
                    $cond: { if: Opts.until, then: { $lte: ["$made_on", Opts.until] }, else: true },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        as: "arrests_assisted",
        from: "arrests",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild"] },
                  { $in: ["$$user", "$assisting_officers"] },
                  {
                    $cond: { if: Opts.after, then: { $gte: ["$made_on", Opts.after] }, else: true },
                  },
                  {
                    $cond: { if: Opts.until, then: { $lte: ["$made_on", Opts.until] }, else: true },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        as: "citations",
        from: "citations",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild"] },
                  { $eq: ["$citing_officer.discord_id", "$$user"] },
                  {
                    $cond: {
                      if: Opts.after,
                      then: { $gte: ["$issued_on", Opts.after] },
                      else: true,
                    },
                  },
                  {
                    $cond: {
                      if: Opts.until,
                      then: { $lte: ["$issued_on", Opts.until] },
                      else: true,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        as: "incidents",
        from: "incidents",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild"] },
                  { $eq: ["$reporter.discord_id", "$$user"] },
                  {
                    $cond: {
                      if: Opts.after,
                      then: { $gte: ["$reported_on", Opts.after] },
                      else: true,
                    },
                  },
                  {
                    $cond: {
                      if: Opts.until,
                      then: { $lte: ["$reported_on", Opts.until] },
                      else: true,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $set: {
        total_shifts: { $size: "$shifts" },
        activity_notices: "$activity_notices",
        total_on_duty_mod: { $sum: "$shifts.durations.on_duty_mod" },
        total_duration: {
          $sum: {
            $map: {
              input: "$shifts",
              as: "shift",
              in: { $subtract: ["$$shift.end_timestamp", "$$shift.start_timestamp"] },
            },
          },
        },
        break_duration: {
          $sum: {
            $map: {
              input: "$shifts",
              as: "shift",
              in: {
                $sum: {
                  $map: {
                    input: "$$shift.events.breaks",
                    as: "break",
                    in: {
                      $subtract: [
                        { $arrayElemAt: ["$$break", 1] },
                        { $arrayElemAt: ["$$break", 0] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $set: {
        arrests: { $size: "$arrests" },
        arrests_assisted: { $size: "$arrests_assisted" },
        citations: { $size: "$citations" },
        incidents: { $size: "$incidents" },
        total_time: {
          $max: [
            { $add: [{ $subtract: ["$total_duration", "$break_duration"] }, "$total_on_duty_mod"] },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        id: "$user",
        total_time: 1,
        total_shifts: 1,
        arrests_assisted: 1,
        activity_notices: 1,
        citations: 1,
        incidents: 1,
        arrests: 1,
        quota_met: { $gte: ["$total_time", Opts.quota_duration ?? 0] },
      },
    },
    {
      $sort: { total_time: -1 },
    },
  ];
}
