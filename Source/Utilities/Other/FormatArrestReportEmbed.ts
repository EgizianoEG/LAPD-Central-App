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
) {
  let FArresteeName = ArrestInfo.arrestee.formatted_name;
  let FOfficerName = ArrestInfo.arresting_officer.formatted_name;

  if (RefetchUsernames) {
    const ArresteeUserInfo = await GetUserInfo(ArrestInfo.arrestee.roblox_id);
    const OfficerRobloxInfo = await GetUserInfo(ArrestInfo.arresting_officer.roblox_id);
    FArresteeName = FormatUsername(ArresteeUserInfo, false, true);
    FOfficerName = FormatUsername(OfficerRobloxInfo);
  }

  const FAsstOfficers = ArrestInfo.assisting_officers.length
    ? ListFormatter.format(FormatSortRDInputNames(ArrestInfo.assisting_officers, true))
    : "N/A";

  const ReportDescription = Dedent(`
    Arrest report submitted by: ${userMention(ArrestInfo.arresting_officer.discord_id)}
    Arrest assisting officers: ${FAsstOfficers}
    Booking number: \`${ArrestInfo.booking_num.toString().padStart(4, "0")}\`
  `);

  return new EmbedBuilder()
    .setTitle("LAPD — Arrest Report")
    .setDescription(ReportDescription)
    .setTimestamp(ArrestInfo.made_on)
    .setThumbnail(ArrestInfo.arrestee.mugshot_url)
    .setColor(Colors.DarkBlue)
    .setFooter({
      iconURL: Icons.Signature,
      text: `Report signed by: ${FOfficerName}`,
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
