import { FormatDutyActivitiesLogSignature, FormatUsername } from "#Utilities/Strings/Formatters.js";
import { AggregateResults, Shifts } from "#Typings/Utilities/Database.js";
import { IncrementShiftEvent } from "#Utilities/Database/Shift.js";
import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { ButtonInteraction } from "discord.js";
import { SendGuildMessages } from "#Utilities/Discord/GuildMessages.js";
import { CmdOptionsType } from "#Cmds/Miscellaneous/Log/Deps/Arrest.js";
import { GuildArrests } from "#Source/Typings/Utilities/Database.js";
import { Images } from "#Config/Shared.js";
import { Types } from "mongoose";

import AppError from "#Utilities/Classes/AppError.js";
import ArrestModel from "#Models/Arrest.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import GetFormattedArrestReportEmbed from "../Reports/FormatArrestReportEmbed.js";

export type ReportInfoType = {
  /** Shift currently active for the reporting officer. */
  shift_active: Shifts.HydratedShiftDocument | null;

  evidence: string | null;
  detail_arresting: string | null;
  arrest_loc: string | null;

  arresting_officer: {
    discord_id: string;
    roblox_user: {
      display_name: string;
      name: string;
      id: string | number;
    } | null;
  };

  reporting_officer?: null | {
    discord_id: string;
    roblox_user: {
      display_name: string;
      name: string;
      id: string | number;
    } | null;
  };

  /** Discord Ids and Roblox usernames of the arrest assisting officers if applicable. */
  asst_officers?: string[];

  /** The date of the report/arrest; defaults to the CMD interaction created at date. */
  report_date?: Date;
};

export type ArresteeInfoType = Omit<
  CmdOptionsType,
  "ArrestLocation" | "DetailArresting" | "Arrestee" | "PrimaryOfficer"
> & {
  notes?: string | null;
  formatted_charges: string[];
  booking_mugshot: string;
  booking_num: number;
  roblox_user: {
    display_name: string;
    name: string;
    id: string | number;
  };
};

/**
 * Retrieves an arrest record from the database based on the provided parameters.
 * @param GuildId - The identifier of the guild to which the arrest record belongs.
 * @param Identifier - The booking number, Id, or ObjectId of the arrest record to retrieve.
 *                          If a number is provided, it is treated as a booking number.
 *                          If a string or ObjectId is provided, it is treated as the record's Id.
 * @returns A promise that resolves to the arrest record if found, or `null` if no record matches the provided inputs.
 */
export async function GetArrest(
  GuildId: string,
  Identifier: number | string | Types.ObjectId
): Promise<GuildArrests.ArrestRecord | null> {
  const IsValidObjectId = !!Types.ObjectId.isValid(Identifier.toString());
  const SearchField = IsValidObjectId ? "_id" : "num";

  return ArrestModel.findOne({
    guild: GuildId,
    [SearchField]: Identifier,
  }).lean(true);
}

/**
 * Fetches all booking numbers for a specific guild, optionally using a cache for performance.
 * @param GuildId - Specific guild Id to limit results to.
 * @param Cache - Whether to use the cache for results. If `true`, will return cached results if available.
 * @returns
 */
export async function GetBookingAutocompleteEntries(
  GuildId: string,
  Cache: boolean = false
): Promise<AggregateResults.BookingAutocompleteEntries[]> {
  if (Cache) {
    const Cached = AutocompletionCache.Bookings.get(GuildId);
    if (Cached) return Cached;
  }

  return ArrestModel.aggregate<AggregateResults.BookingAutocompleteEntries>([
    {
      $match: {
        guild: GuildId,
      },
    },
    {
      $project: {
        booking_num: 1,
        arrestee: 1,
        doa: {
          $dateToString: {
            date: "$made_on",
            format: "%B %d, %G at %H:%M",
            timezone: "America/Los_Angeles",
          },
        },
      },
    },
    {
      $project: {
        num: "$booking_num",
        autocomplete_label: {
          $concat: [
            "#",
            {
              $toString: "$booking_num",
            },
            " – ",
            "$arrestee.formatted_name",
            " – ",
            "$doa",
          ],
        },
      },
    },
  ])
    .exec()
    .then((Bookings) => {
      AutocompletionCache.Bookings.set(GuildId, Bookings);
      return Bookings;
    });
}

export async function LogArrestReport(
  CachedInteract: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  ArresteeInfo: ArresteeInfoType,
  ReportInfo: ReportInfoType
) {
  ReportInfo.report_date = ReportInfo.report_date ?? CachedInteract.createdAt;
  ReportInfo.asst_officers = ReportInfo.asst_officers ?? [];

  const FArresteeName = FormatUsername(ArresteeInfo.roblox_user);
  const GuildSettings = await GetGuildSettings(CachedInteract.guildId);
  const ArrOfficerMember = await CachedInteract.guild.members.fetch(
    ReportInfo.arresting_officer.discord_id
  );

  if (!GuildSettings) {
    throw new AppError({ template: "GuildConfigNotFound", showable: true });
  }

  const ArrestRecord = await ArrestModel.create({
    guild: CachedInteract.guildId,
    made_on: ReportInfo.report_date,
    notes: ArresteeInfo.notes ?? null,
    evidence: ReportInfo.evidence,
    booking_num: ArresteeInfo.booking_num,
    assisting_officers: ReportInfo.asst_officers,
    detail_arresting: ReportInfo.detail_arresting,
    arrest_loc: ReportInfo.arrest_loc,

    arrestee: {
      roblox_id: Number(ArresteeInfo.roblox_user.id),
      formatted_name: FArresteeName,
      charges: ArresteeInfo.formatted_charges,
      gender: ArresteeInfo.Gender,
      height: ArresteeInfo.Height,
      weight: ArresteeInfo.Weight,
      age_group: ArresteeInfo.AgeGroup,
      mugshot_url: ArresteeInfo.booking_mugshot,
    },

    arresting_officer: {
      discord_id: ReportInfo.arresting_officer.discord_id,

      formatted_name: ReportInfo.arresting_officer.roblox_user
        ? FormatUsername(ReportInfo.arresting_officer.roblox_user)
        : undefined,

      roblox_id: ReportInfo.arresting_officer.roblox_user
        ? Number(ReportInfo.arresting_officer.roblox_user.id)
        : undefined,

      signature: ReportInfo.arresting_officer.roblox_user
        ? FormatDutyActivitiesLogSignature(
            ArrOfficerMember,
            ReportInfo.arresting_officer.roblox_user,
            GuildSettings.duty_activities.signature_format
          )
        : ArrOfficerMember.displayName || ArrOfficerMember.user.username,
    },

    ...(ReportInfo.reporting_officer && {
      reporting_officer: {
        discord_id: ReportInfo.reporting_officer.discord_id,

        formatted_name: ReportInfo.reporting_officer.roblox_user
          ? FormatUsername(ReportInfo.reporting_officer.roblox_user)
          : undefined,

        roblox_id: ReportInfo.reporting_officer.roblox_user
          ? Number(ReportInfo.reporting_officer.roblox_user.id)
          : undefined,

        signature: await (async () => {
          const RepOfficerMember = await CachedInteract.guild.members.fetch(
            ReportInfo.reporting_officer!.discord_id
          );

          return ReportInfo.reporting_officer!.roblox_user
            ? FormatDutyActivitiesLogSignature(
                RepOfficerMember,
                ReportInfo.reporting_officer!.roblox_user,
                GuildSettings.duty_activities.signature_format
              )
            : RepOfficerMember.displayName || RepOfficerMember.user.username;
        })(),
      },
    }),
  });

  if (!ArrestRecord) {
    throw new AppError({ template: "DatabaseError", showable: true });
  }

  IncrementShiftEvent(CachedInteract.guildId, CachedInteract.user.id, "arrests").catch(() => null);
  const FormattedReport = await GetFormattedArrestReportEmbed(ArrestRecord, false);

  if (GuildSettings.duty_activities.arrest_reports.show_header_img) {
    FormattedReport.setImage(Images.LAPD_Header);
  }

  const MainMsgLink = await SendGuildMessages(
    CachedInteract,
    GuildSettings.duty_activities.log_channels.arrests,
    { embeds: [FormattedReport], nonce: ArrestRecord._id.toString() }
  ).then((SentMessage) => SentMessage?.url ?? null);

  if (MainMsgLink) {
    ArrestRecord.report_msg = MainMsgLink.split(/[/\\]/).slice(-2).join(":");
    ArrestRecord.save().catch(() => null);
  }

  return {
    main_msg_link: MainMsgLink,
    booking_number: ArresteeInfo.booking_num,
  };
}
