import { ModalSubmitInteraction, ButtonInteraction, MessageFlags } from "discord.js";
import { TemplateDimensions } from "@Utilities/ImageRendering/GetFilledNTAForm.js";
import { SendGuildMessages } from "@Utilities/Other/GuildMessages.js";
import { APIResponses } from "@Typings/Utilities/Roblox.js";

import AppError from "@Utilities/Classes/AppError.js";
import CitationModel from "@Models/Citation.js";
import UploadToImgBB from "../Other/ImgBBUpload.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import GetPlaceholderImgURL from "../Other/GetPlaceholderImg.js";
import ConstructNTAContainer from "@Utilities/Other/ConstructNTAContainer.js";
import IncrementActiveShiftEvent from "@Utilities/Database/IncrementActiveShiftEvent.js";

/**
 * Creates a traffic citation record on a specific guild.
 * @param CachedInteract - The interaction invoked the logging process.
 * @param CitationData - The citation data to be logged.
 * @param CitationImg - The filled citation as an image. A buffer to be uploaded or the image URL itself (if already uploaded.)
 * @returns - The logged citation message link (the main one) if successful.
 */
export default async function LogTrafficCitation(
  CachedInteract:
    | SlashCommandInteraction<"cached">
    | ButtonInteraction<"cached">
    | ModalSubmitInteraction<"cached">,
  CitationData: InstanceType<typeof CitationModel>,
  CitationImg: string | Buffer,
  AdditionalViolatorInfo: APIResponses.Users.GetUserResponse
): Promise<string | null> {
  let CitationImgURL: string;
  const CurrentYearSuffix = CachedInteract.createdAt.getFullYear().toString().slice(-2);
  const NTAFullNumber = `${CurrentYearSuffix}-${CitationData.num}`;

  if (typeof CitationImg === "string") {
    CitationImgURL = CitationImg;
  } else {
    const NTATypeLowered = CitationData.nta_type.toLowerCase();
    CitationImgURL =
      (await UploadToImgBB(CitationImg, `nta_${NTATypeLowered}_#${NTAFullNumber}`)) ??
      GetPlaceholderImgURL(`${TemplateDimensions.width}x${TemplateDimensions.height}`, "?");
  }

  const GuildSettings = await GetGuildSettings(CachedInteract.guildId);
  const RecordedCitation = await CitationModel.create({
    ...CitationData.toObject(),
    img_url: CitationImgURL,
  })
    .then((RecCit) => {
      IncrementActiveShiftEvent("citations", CachedInteract.user.id, CachedInteract.guildId).catch(
        () => null
      );

      return RecCit;
    })
    .catch((Err) => {
      throw new AppError({ template: "DatabaseError", stack: Err.stack, showable: true });
    });

  const NTAContainer = ConstructNTAContainer(
    RecordedCitation,
    AdditionalViolatorInfo,
    CitationImgURL
  );

  if (GuildSettings?.duty_activities.log_channels.citations) {
    return SendGuildMessages(CachedInteract, GuildSettings.duty_activities.log_channels.citations, {
      components: [NTAContainer],
      flags: MessageFlags.IsComponentsV2,
    }).then((SentMessage) => SentMessage?.url ?? null);
  }

  return null;
}
