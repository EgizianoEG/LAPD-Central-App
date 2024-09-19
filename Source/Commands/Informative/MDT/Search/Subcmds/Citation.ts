// Dependencies:
// -------------

import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { GetFilledCitation } from "@Utilities/Other/GetFilledCitation.js";
import { Colors, EmbedBuilder, SlashCommandSubcommandBuilder, time, userMention } from "discord.js";

import GetCitationRecord from "@Utilities/Database/GetCitRecord.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const CitationNum = CmdInteraction.options.getInteger("citation-num", true);
  const CitationRecord = await GetCitationRecord(CmdInteraction.guildId, CitationNum);
  if (!CitationRecord) {
    return new ErrorEmbed()
      .useErrTemplate("CitRecordNotFound")
      .replyToInteract(CmdInteraction, true);
  } else {
    await CmdInteraction.deferReply({ ephemeral: true });
  }

  const PrintedCitationImg =
    CitationRecord.img_url ??
    (await GetFilledCitation<"Warning" | "Fine", true>(CitationRecord.type, CitationRecord, true));

  const RespEmbedDesc = Dedent(`
    **Citation issued by:** ${userMention(CitationRecord.citing_officer.discord_id)}
    **Issued on:** ${time(CitationRecord.issued_on, "f")}
    **Number:** \`${CitationRecord.num}\`
  `);

  const ResponseEmbed = new EmbedBuilder()
    .setTitle(`Traffic Citation — ${CitationRecord.type}`)
    .setDescription(RespEmbedDesc)
    .setImage(PrintedCitationImg)
    .setColor(Colors.DarkBlue);

  return CmdInteraction.editReply({
    embeds: [ResponseEmbed],
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("citation")
    .setDescription("See a copy of an issued traffic citation.")
    .addIntegerOption((Option) =>
      Option.setName("citation-num")
        .setDescription("The citation number.")
        .setMaxValue(99999)
        .setMinValue(1000)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
