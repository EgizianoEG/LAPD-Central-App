import { FormatSortRDInputNames, FormatUsername } from "@Utilities/Strings/Formatters.js";
import { Colors, EmbedBuilder, userMention } from "discord.js";
import { IsValidDiscordId } from "@Utilities/Helpers/Validators.js";
import { GuildArrests } from "@Typings/Utilities/Database.js";
import { Icons } from "@Config/Shared.js";

import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";
import Dedent from "dedent";
const ListFormatter = new Intl.ListFormat("en");

export default async function GetFormattedArrestReportEmbed(
  ArrestInfo: GuildArrests.ArrestRecord,
  RefetchUsernames: boolean = true
) {
  let FArresteeName = ArrestInfo.arrestee.formatted_name;
  if (RefetchUsernames) {
    const ArresteeUserInfo = await GetUserInfo(ArrestInfo.arrestee.roblox_id);
    FArresteeName = FormatUsername(ArresteeUserInfo, false, true);
  }

  const FAsstOfficers = ArrestInfo.assisting_officers.length
    ? ListFormatter.format(
        FormatSortRDInputNames(
          ArrestInfo.assisting_officers.filter((ID) =>
            IsValidDiscordId(ID) && ArrestInfo.reporting_officer
              ? ID !== ArrestInfo.reporting_officer.discord_id
              : true
          ),
          true
        )
      )
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

  return new EmbedBuilder()
    .setTitle("LAPD — Arrest Report")
    .setDescription(ReportDescription)
    .setTimestamp(ArrestInfo.made_on)
    .setThumbnail(ArrestInfo.arrestee.mugshot_url)
    .setColor(Colors.DarkBlue)
    .setFooter({
      iconURL: Icons.Signature,
      text: `Report signed by ${ArrestInfo.arresting_officer.signature}`,
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
}
