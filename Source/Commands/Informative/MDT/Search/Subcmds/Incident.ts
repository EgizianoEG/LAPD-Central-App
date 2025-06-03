import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import GetIncidentRecord from "@Utilities/Database/GetIncidentRecord.js";
import GetIncidentReportEmbeds from "@Utilities/Reports/GetIncidentReportEmbeds.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const IncidentNum = CmdInteraction.options.getString("incident-num", true);
  const IncidentRecord = await GetIncidentRecord(CmdInteraction.guildId, IncidentNum);

  if (IncidentRecord) {
    await CmdInteraction.deferReply({ flags: MessageFlags.Ephemeral });
  } else {
    return new ErrorEmbed()
      .useErrTemplate("IncidentRecordNotFound")
      .replyToInteract(CmdInteraction, true);
  }

  const ReportEmbeds = GetIncidentReportEmbeds(IncidentRecord, {
    channel_id: CmdInteraction.channelId,
  });

  return CmdInteraction.editReply({
    embeds: ReportEmbeds,
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("incident")
    .setDescription("Get information about a logged incident.")
    .addStringOption((Option) =>
      Option.setName("incident-num")
        .setDescription("The incident number to get information about.")
        .setMinLength(7)
        .setMaxLength(9)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
