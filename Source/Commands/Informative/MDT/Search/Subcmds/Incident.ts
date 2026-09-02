import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { IsFormattedIncidentNumber } from "#Utilities/Helpers/Validators.js";
import { GetIncident } from "#Utilities/Database/Incident.js";
import { ErrorEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import GetIncidentReportEmbeds from "#Utilities/Reports/GetIncidentReportEmbeds.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const IncidentNum = CmdInteraction.options.getInteger("incident-num", true);
  const IncidentRecord = await GetIncident(CmdInteraction.guildId, IncidentNum);

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
    .addIntegerOption((Option) =>
      Option.setName("incident-num")
        .setDescription("The incident number to get information about.")
        .setMinValue(2_500_000)
        .setMaxValue(99_999_999)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
