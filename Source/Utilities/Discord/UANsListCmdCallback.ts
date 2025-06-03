import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Colors } from "@Config/Shared.js";
import {
  time as FormatTime,
  TimestampStylesString,
  TextDisplayBuilder,
  ContainerBuilder,
  resolveColor,
} from "discord.js";

import Chunks from "@Utilities/Helpers/SliceIntoChunks.js";
import LeaveOfAbsenceModel from "@Models/UserActivityNotice.js";
import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";

/**
 * Handles the User Activity Notice list command, displaying active or pending notices.
 * @param Interaction - The slash command interaction that triggered this callback.
 * @param RecordsType - The type of UAN records to display ("LeaveOfAbsence" or "ReducedActivity").
 * @returns A Promise resolving after sending the paginated list of notices or an info message if no records found.
 */
export default async function UANListCmdCallback(
  Interaction: SlashCommandInteraction<"cached">,
  RecordsType: UserActivityNotice.NoticeType
) {
  const RecordTypeText =
    RecordsType === "ReducedActivity" ? "reduced activity" : "leave of absence";
  const QueryFilter = { guild: Interaction.guildId, type: RecordsType, status: "Pending" };
  const DesiredStatus = (Interaction.options.getString("status", false) ?? "Active") as
    | "Active"
    | "Pending";

  if (DesiredStatus === "Active") {
    QueryFilter.status = "Approved";
    Object.assign(QueryFilter, { end_date: { $gt: Interaction.createdAt }, early_end_date: null });
  }

  const NoticeRecords = await LeaveOfAbsenceModel.find(QueryFilter, {
    user: 1,
    end_date: 1,
    request_date: 1,
  })
    .lean()
    .exec();

  if (NoticeRecords.length === 0) {
    if (DesiredStatus === "Active") {
      return new InfoEmbed()
        .useInfoTemplate("NoUANsWithActiveStatus", RecordTypeText)
        .replyToInteract(Interaction, true);
    }
    return new InfoEmbed()
      .useInfoTemplate("NoUANsWithSpecifiedStatus", RecordTypeText)
      .replyToInteract(Interaction, true);
  }

  const LOAsChunks = Chunks(NoticeRecords, 8);
  const Pages = BuildUserActivityNoticesPages(
    LOAsChunks,
    DesiredStatus,
    NoticeRecords.length,
    RecordsType
  );

  return HandlePagePagination({
    pages: Pages,
    interact: Interaction,
    cv2_footer: `*Displaying all ${DesiredStatus.toLowerCase()} ${RecordTypeText} records in an ascending order of ${DesiredStatus === "Active" ? "end" : "request"} dates.*`,
  });
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Formats a date using Discord's time formatting, with fallback for invalid dates.
 * @param InputDate - The date to format.
 * @param Style - The Discord timestamp style to apply.
 * @returns A formatted time string or "[Unknown Date]" if the input date is invalid.
 */
function SafeFormatTime<TStyle extends TimestampStylesString>(InputDate: Date, Style: TStyle) {
  return InputDate instanceof Date && !isNaN(InputDate.getTime())
    ? FormatTime(InputDate, Style)
    : "[Unknown Date]";
}

/**
 * Creates paginated embeds for UAN records.
 * @param UANRecords - Chunked arrays of UAN documents to display.
 * @param UANStatus - The status of notices being displayed ("Active" or "Pending").
 * @param RecordsTotal - The total number of records found.
 * @param RecordsType - The type of notices being displayed ("LeaveOfAbsence" or "ReducedActivity").
 * @returns An array of InfoEmbed objects ready for pagination.
 */
function BuildUserActivityNoticesPages(
  UANRecords: UserActivityNotice.UserActivityNoticeDocument[][],
  UANStatus: "Active" | "Pending",
  RecordsTotal: number,
  RecordsType: UserActivityNotice.NoticeType
) {
  const Pages: ContainerBuilder[] = [];
  const RecordTypeStrinAbbr = RecordsType === "ReducedActivity" ? "RA" : "Leave";

  for (const Chunk of UANRecords) {
    const PageContainer = new ContainerBuilder()
      .setAccentColor(resolveColor(Colors.Info))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${UANStatus} ${RecordTypeStrinAbbr} Notices — ${RecordsTotal}`
        )
      );

    Pages.push(
      PageContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          Chunk.map((Notice) => {
            return `<@${Notice.user}> \u{1680} ${SafeFormatTime(Notice[UANStatus === "Active" ? "end_date" : "request_date"], "F")}`;
          }).join("\n")
        )
      )
    );
  }

  return Pages;
}
