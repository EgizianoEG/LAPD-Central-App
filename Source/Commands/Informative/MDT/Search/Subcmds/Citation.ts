import { SlashCommandSubcommandBuilder, MessageFlags } from "discord.js";
import { RenderFilledNTAForm } from "@Utilities/ImageRendering/GetFilledNTAForm.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import ConstructNTAContainer from "@Utilities/Reports/ConstructNTAContainer.js";
import GetCitationRecord from "@Utilities/Database/GetCitRecord.js";
import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const CitationNum = CmdInteraction.options.getInteger("citation-num", true);
  const CitationRecord = await GetCitationRecord(CmdInteraction.guildId, CitationNum);
  if (CitationRecord) {
    await CmdInteraction.deferReply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  } else {
    return new ErrorEmbed()
      .useErrTemplate("CitRecordNotFound")
      .replyToInteract(CmdInteraction, true);
  }

  const ViolatorUpdatedInfo = await GetUserInfo(CitationRecord.violator.id).catch(() => null);
  const PrintedCitationImg =
    CitationRecord.img_url ?? (await RenderFilledNTAForm(CitationRecord, true));

  const RespContainer = ConstructNTAContainer(
    CitationRecord,
    ViolatorUpdatedInfo ?? CitationRecord.violator.name,
    PrintedCitationImg
  );

  return CmdInteraction.editReply({
    components: [RespContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("citation")
    .setDescription("See a copy of an issued notice to appear or citation record.")
    .addIntegerOption((Option) =>
      Option.setName("citation-num")
        .setDescription("The nta or citation number.")
        .setMaxValue(999999)
        .setMinValue(1000)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
