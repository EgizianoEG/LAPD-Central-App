import { FormatSortRDInputNames, FormatUsername } from "@Utilities/Strings/Formatters.js";
import { Colors, EmbedBuilder, userMention } from "discord.js";
import { GuildArrests } from "@Typings/Utilities/Database.js";
import { Icons } from "@Config/Shared.js";

import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";
import Dedent from "dedent";
const ListFormatter = new Intl.ListFormat("en");

export default async function GetFormattedArrestReportEmbed(
  ArrestInfo: GuildArrests.ArrestRecord,
  RefetchUsernames: boolean = true
): Promise<EmbedBuilder> {
  let FArresteeName = ArrestInfo.arrestee.formatted_name;
  if (RefetchUsernames) {
    const ArresteeUserInfo = await GetUserInfo(ArrestInfo.arrestee.roblox_id);
    FArresteeName = FormatUsername(ArresteeUserInfo, false, true);
  }

  const FAsstOfficers = ArrestInfo.assisting_officers.length
    ? ListFormatter.format(FormatSortRDInputNames(ArrestInfo.assisting_officers, true))
    : "N/A";

  const ReportSubmittingAndArresstingOfficerText = ArrestInfo.reporting_officer
    ? `Arrest report submitted by: ${userMention(ArrestInfo.reporting_officer.discord_id)}\n` +
      `Arresting officer: ${userMention(ArrestInfo.arresting_officer.discord_id)}`
    : `Arresting and report submitting officer: ${userMention(ArrestInfo.arresting_officer.discord_id)}`;

  const ReportDescription = Dedent(`
    ${ReportSubmittingAndArresstingOfficerText}
    Assisting officers: ${FAsstOfficers}
    Booking number: \`${ArrestInfo.booking_num.toString().padStart(4, "0")}\`
  `).trim();

  const AREmbed = new EmbedBuilder()
    .setTitle("LAPD — Arrest Report")
    .setDescription(ReportDescription)
    .setTimestamp(ArrestInfo.made_on)
    .setThumbnail(ArrestInfo.arrestee.mugshot_url)
    .setColor(Colors.DarkBlue)
    .setFooter({
      iconURL: Icons.Signature,
      text: `Report signed by ${ArrestInfo.arresting_officer.signature || ArrestInfo.arresting_officer.formatted_name}`,
    })
    .setFields([
      {
        name: "Arrestee",
        value: FArresteeName,
        inline: true,
      },
      {
        name: "Gender",
        value: ArrestInfo.arrestee.gender,
        inline: true,
      },
      {
        name: "Arrest Age",
        value: ArrestInfo.arrestee.age_group,
        inline: true,
      },
      {
        name: "Height",
        value: ArrestInfo.arrestee.height,
        inline: true,
      },
      {
        name: "Weight",
        value: ArrestInfo.arrestee.weight + " lbs",
        inline: true,
      },
      {
        name: "Charges",
        value: ArrestInfo.arrestee.charges.join("\n"),
        inline: false,
      },
    ]);

  if (ArrestInfo.arrest_loc?.length) {
    AREmbed.spliceFields(-1, 0, {
      name: "Loc. of Arrest",
      value: ArrestInfo.arrest_loc,
      inline: true,
    });
  }

  if (ArrestInfo.detail_arresting?.length) {
    AREmbed.spliceFields(-1, 0, {
      name: "Detail/Div. Arresting",
      value: ArrestInfo.detail_arresting,
      inline: false,
    });
  }

  if (ArrestInfo.evidence?.length) {
    AREmbed.spliceFields(-1, 0, {
      name: "Evidence",
      value: ArrestInfo.evidence,
      inline: false,
    });
  }

  return AREmbed;
}
