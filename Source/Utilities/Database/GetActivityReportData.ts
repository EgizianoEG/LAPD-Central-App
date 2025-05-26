import { Collection, Guild, GuildMember } from "discord.js";
import { differenceInHours, isAfter } from "date-fns";
import { AggregateResults } from "@Typings/Utilities/Database.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import GetGuildSettings from "./GetGuildSettings.js";
import ProfileModel from "@Models/GuildProfile.js";
import AppError from "@Utilities/Classes/AppError.js";

interface GetActivityReportDataOpts {
  /** The guild to get the activity report data for. */
  guild: Guild;

  /** The users to limit the activity report data to. */
  members: Collection<string, GuildMember>;

  /** The date to return the activity report data after. If not provided, defaults to all the time. */
  after?: Date | null;

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

  const ShiftStatusRoles = [
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

  const RetrieveDate = new Date();
  const RecordsBaseData = await ProfileModel.aggregate<
    AggregateResults.BaseActivityReportData["records"][number]
  >(CreateActivityReportAggregationPipeline({ ...Opts, shift_type: SpecifiedShiftTypes })).exec();

  if (!RecordsBaseData.length) {
    throw new AppError({
      template: "ActivityReportNoRecordsFound",
      showable: true,
    });
  }

  const ReportStatistics: AggregateResults.ActivityReportStatistics<string> = {
    total_time: ReadableDuration(RecordsBaseData.reduce((Acc, Curr) => Acc + Curr.total_time, 0)),
    total_shifts: RecordsBaseData.reduce((Acc, Curr) => Acc + Curr.total_shifts, 0),
  };

  const ProcessedMemberIds = new Set<string>();
  const MembersById = new Map(Opts.members.map((Member) => [Member.id, Member]));
  const Records = RecordsBaseData.map((Record, Index) => {
    const Member = MembersById.get(Record.id);
    const RecentUAN = Record.recent_activity_notice;
    const TypeAbbr = RecentUAN?.type === "LeaveOfAbsence" ? "leave" : "ra";
    const NoticeTypeDesc =
      RecentUAN?.type === "LeaveOfAbsence" ? "Leave of absence" : "Reduced activity";

    let IsLeaveActive = false;
    const NoticeNotes: { leave: string | null; ra: string | null } = {
      leave: null,
      ra: null,
    };

    if (Member) ProcessedMemberIds.add(Member.user.id);
    else return null;

    // Consider adding leave of absence comments/notes if it has ended, started, or requested recently.
    if (RecentUAN?.status === "Approved" && RecentUAN.reviewed_by) {
      if (
        RecentUAN.review_date !== null &&
        RecentUAN.early_end_date === null &&
        isAfter(RecentUAN.end_date, RetrieveDate)
      ) {
        IsLeaveActive = RecentUAN.type === "LeaveOfAbsence";
        const StartCurrentDatesDifferenceInDays =
          differenceInHours(RetrieveDate, RecentUAN.review_date) / 24;

        if (!Record.quota_met && Opts.quota_duration) {
          const ScaledQuota =
            RecentUAN.type === "ReducedActivity"
              ? (RecentUAN.quota_scale || 1) * Opts.quota_duration
              : Opts.quota_duration;

          Record.quota_met = Record.total_time >= ScaledQuota;
        }

        if (StartCurrentDatesDifferenceInDays <= 2.5) {
          const NewQuotaDeclaration =
            RecentUAN.type === "ReducedActivity"
              ? `\nQuota Reduction: ~${Math.round((1 - (RecentUAN.quota_scale || 0)) * 100)}%`
              : "";

          const RelativeDuration = ReadableDuration(
            RetrieveDate.getTime() - RecentUAN.review_date.getTime(),
            {
              conjunction: " and ",
              largest: 2,
              round: true,
            }
          );

          NoticeNotes[TypeAbbr] =
            `${NoticeTypeDesc} started around ${RelativeDuration} ago. ${NewQuotaDeclaration}\nApproved by: @${RecentUAN.reviewed_by.username}`;
        }
      } else {
        const NoticeEndDate = RecentUAN.early_end_date || RecentUAN.end_date;
        const EndCurrentDatesDifferenceInDays = differenceInHours(RetrieveDate, NoticeEndDate) / 24;

        if (EndCurrentDatesDifferenceInDays <= 2.5) {
          const RelativeDuration = ReadableDuration(
            RetrieveDate.getTime() - NoticeEndDate.getTime(),
            {
              conjunction: " and ",
              largest: 2,
              round: true,
            }
          );

          NoticeNotes[TypeAbbr] = `${NoticeTypeDesc} ended around ${RelativeDuration} ago.`;
        }
      }
    } else if (RecentUAN?.status === "Pending" && RecentUAN.review_date === null) {
      const RequestCurrentDatesDifferenceInDays =
        differenceInHours(RetrieveDate, RecentUAN.request_date) / 24;

      if (RequestCurrentDatesDifferenceInDays <= 3) {
        const RelativeDuration = ReadableDuration(
          RetrieveDate.getTime() - RecentUAN.request_date.getTime(),
          {
            conjunction: " and ",
            largest: 2,
            round: true,
          }
        );

        NoticeNotes[TypeAbbr] =
          `An unapproved ${NoticeTypeDesc.toLowerCase()} request was submitted around ${RelativeDuration} ago.`;
      }
    }

    return {
      values: [
        { userEnteredValue: { numberValue: Index + 1 } },
        {
          userEnteredValue: {
            stringValue: FormatName(Member, Opts.include_member_nicknames),
          },
        },
        { userEnteredValue: { stringValue: HighestHoistedRoleName(Member, ShiftStatusRoles) } },
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
          { userEnteredValue: { numberValue: Records.length + 1 } },
          { userEnteredValue: { stringValue: FormatName(Member, Opts.include_member_nicknames) } },
          { userEnteredValue: { stringValue: HighestHoistedRoleName(Member, ShiftStatusRoles) } },
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

  return {
    statistics: ReportStatistics,
    records: Records,
    quota: Opts.quota_duration ? ReadableDuration(Opts.quota_duration) : "None",
  };
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
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
function HighestHoistedRoleName(Member: GuildMember, DisregardedRoleIds: string[] = []): string {
  if (Member.roles.highest.hoist && !DisregardedRoleIds.includes(Member.roles.highest.id)) {
    return Member.roles.highest.name;
  }

  const TopHoistedRole = [...Member.roles.cache.values()]
    .filter((R) => R.hoist && !DisregardedRoleIds.includes(R.id))
    .sort((A, B) => B.position - A.position)[0];

  return (
    TopHoistedRole?.name ??
    (Member.roles.highest.id === Member.guild.roles.everyone.id ? "N/A" : Member.roles.highest.name)
  );
}

/**
 * Generates an aggregation pipeline for MongoDB to retrieve activity report data
 * for a specific guild and its members. The pipeline includes filtering, projecting,
 * and calculating various metrics such as total shifts, arrests, citations, incidents,
 * and total time on duty.
 *
 * @param Opts - Options for generating the activity report aggregation pipeline.
 * @returns An aggregation pipeline array to be used with the `aggregate` method of the `ProfileModel`.
 */
function CreateActivityReportAggregationPipeline(
  Opts: Exclude<GetActivityReportDataOpts, "shift_type"> & { shift_type: string[] }
): Parameters<typeof ProfileModel.aggregate>[0] {
  return [
    {
      $match: {
        guild: Opts.guild.id,
        ...(Opts.members.size > 0 && { user: { $in: Opts.members.map((U) => U.id) } }),
      },
    },
    {
      $project: {
        guild: 1,
        user: 1,
      },
    },
    {
      $lookup: {
        as: "shifts",
        from: "shifts",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$guild", "$$guild"] },
                  { $eq: ["$user", "$$user"] },
                  { $ne: ["$end_timestamp", null] },
                  {
                    $or: [Opts.after ? { $gte: ["$start_timestamp", Opts.after] } : true],
                  },
                  {
                    $or: [Opts.shift_type.length ? { $in: ["$type", Opts.shift_type] } : true],
                  },
                ],
              },
            },
          },
          {
            $project: {
              events: 1,
              end_timestamp: 1,
              start_timestamp: 1,
              "durations.on_duty_mod": 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        as: "activity_notices",
        from: "activity_notices",
        let: { guild: "$guild", user: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$user"] },
                  { $eq: ["$guild", "$$guild"] },
                  { $in: ["$status", ["Approved", "Pending"]] },
                ],
              },
            },
          },
          {
            $sort: {
              request_date: -1,
            },
          },
          {
            $limit: 1,
          },
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
        recent_activity_notice: { $first: "$activity_notices" },
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
        recent_activity_notice: 1,
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
