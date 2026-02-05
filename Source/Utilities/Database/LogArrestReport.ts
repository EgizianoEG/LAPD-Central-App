import { FormatDutyActivitiesLogSignature, FormatUsername } from "#Utilities/Strings/Formatters.js";
import { ButtonInteraction } from "discord.js";
import { SendGuildMessages } from "#Utilities/Discord/GuildMessages.js";
import { CmdOptionsType } from "#Cmds/Miscellaneous/Log/Deps/Arrest.js";
import { Shifts } from "#Typings/Utilities/Database.js";
import { Images } from "#Config/Shared.js";

import AppError from "#Utilities/Classes/AppError.js";
import ArrestModel from "#Models/Arrest.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import IncrementActiveShiftEvent from "#Utilities/Database/IncrementActiveShiftEvent.js";
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

export default async function LogArrestReport(
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

  IncrementActiveShiftEvent("arrests", CachedInteract.user.id, CachedInteract.guildId).catch(
    () => null
  );

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
