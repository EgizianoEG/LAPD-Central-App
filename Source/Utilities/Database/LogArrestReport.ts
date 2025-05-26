import { ButtonInteraction } from "discord.js";
import { SendGuildMessages } from "@Utilities/Other/GuildMessages.js";
import { CmdOptionsType } from "@Cmds/Miscellaneous/Log/Deps/Arrest.js";
import { FormatUsername } from "@Utilities/Strings/Formatters.js";
import { Shifts } from "@Typings/Utilities/Database.js";
import { Images } from "@Config/Shared.js";

import AppError from "@Utilities/Classes/AppError.js";
import ArrestModel from "@Models/Arrest.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import IncrementActiveShiftEvent from "@Utilities/Database/IncrementActiveShiftEvent.js";
import GetFormattedArrestReportEmbed from "../Other/FormatArrestReportEmbed.js";

export type ReporterInfoType = {
  /** Shift currently active for the reporting officer */
  shift_active: Shifts.HydratedShiftDocument | null;

  /** Arresting/Reporting officer's Discord Id */
  discord_user_id: string;

  /** Discord Ids of the arrest assisting officers if applicable */
  asst_officers?: string[];

  /** The date of the report/arrest; defaults to the CMD interaction created at date */
  report_date?: Date;

  /** Arresting/Reporting officer's roblox user details */
  roblox_user: {
    display_name: string;
    name: string;
    id: string | number;
  };
};

export type ArresteeInfoType = Omit<CmdOptionsType, "Arrestee"> & {
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
  ReporterInfo: ReporterInfoType
) {
  ReporterInfo.report_date = ReporterInfo.report_date ?? CachedInteract.createdAt;
  ReporterInfo.asst_officers = ReporterInfo.asst_officers ?? [];

  const FArresteeName = FormatUsername(ArresteeInfo.roblox_user);
  const FReporterName = FormatUsername(ReporterInfo.roblox_user);
  const GuildSettings = await GetGuildSettings(CachedInteract.guildId);

  if (!GuildSettings) {
    throw new AppError({ template: "GuildConfigNotFound", showable: true });
  }

  const ArrestRecord = await ArrestModel.create({
    guild: CachedInteract.guildId,
    made_on: ReporterInfo.report_date,
    notes: ArresteeInfo.notes ?? null,
    booking_num: ArresteeInfo.booking_num,

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

    assisting_officers: ReporterInfo.asst_officers,
    arresting_officer: {
      formatted_name: FReporterName,
      discord_id: ReporterInfo.discord_user_id,
      roblox_id: Number(ReporterInfo.roblox_user.id),
    },
  });

  if (!ArrestRecord) {
    throw new AppError({ template: "DatabaseError", showable: true });
  }

  IncrementActiveShiftEvent("arrests", CachedInteract.user.id, CachedInteract.guildId).catch(
    () => null
  );

  const FormattedReport = (await GetFormattedArrestReportEmbed(ArrestRecord, false)).setImage(
    Images.LAPD_Header
  );

  const MainMsgLink = await SendGuildMessages(
    CachedInteract,
    GuildSettings.duty_activities.log_channels.arrests,
    { embeds: [FormattedReport] }
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
