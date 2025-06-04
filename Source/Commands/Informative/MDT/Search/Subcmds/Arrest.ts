// Dependencies:
// -------------

import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import GetFormattedArrestReportEmbed from "@Utilities/Reports/FormatArrestReportEmbed.js";
import GetArrestRecord from "@Utilities/Database/GetArrestRecord.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const BookingNum = CmdInteraction.options.getInteger("booking-num", true);
  const ArrestRecord = await GetArrestRecord(CmdInteraction.guildId, BookingNum);
  if (!ArrestRecord) {
    return new ErrorEmbed()
      .useErrTemplate("ArrestRecordNotFound")
      .replyToInteract(CmdInteraction, true);
  }

  return CmdInteraction.reply({
    embeds: [await GetFormattedArrestReportEmbed(ArrestRecord, true)],
    flags: MessageFlags.Ephemeral,
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("arrest")
    .setDescription("Search for an arrest record.")
    .addIntegerOption((Option) =>
      Option.setName("booking-num")
        .setDescription("The booking number of the arrest.")
        .setMaxValue(999999)
        .setMinValue(100)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
