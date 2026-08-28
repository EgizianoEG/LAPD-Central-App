import { ModalSubmitInteraction, ButtonInteraction, MessageFlags } from "discord.js";
import { ComposeIdentifier, ParseIdentifier } from "#Utilities/Helpers/Identifiers.js";
import { AggregateResults, GuildCitations } from "#Typings/Utilities/Database.js";
import { APIResponses, OpenCloud } from "#Typings/External/Roblox.js";
import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { IncrementShiftEvent } from "#Utilities/Database/Shift.js";
import { TemplateDimensions } from "#Utilities/ImageRendering/GetFilledNTAForm.js";
import { SendGuildMessages } from "#Utilities/Discord/GuildMessages.js";
import { Types } from "mongoose";

import AppError from "#Utilities/Classes/AppError.js";
import CitationModel from "#Models/Citation.js";
import UploadToImgBB from "#Utilities/External/ImgBBUpload.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import GetPlaceholderImgURL from "#Utilities/Helpers/GetPlaceholderImg.js";
import ConstructNTAContainer from "#Utilities/Reports/ConstructNTAContainer.js";
// ---------------------------------------------------------------------------------------

/**
 * Retrieves a citation record from the database based on the provided parameters.
 * @param GuildId - The Id of the guild to which the citation belongs.
 * @param Identifier - The citation identifier, which can be a number (`num` field), string, or a MongoDB ObjectId.
 * @returns A promise that resolves to the citation record if found, or `null` if no record matches the query.
 */
export async function GetCitation(
  GuildId: string,
  Identifier: number | string | Types.ObjectId
): Promise<GuildCitations.AnyCitationData | null> {
  const IsValidObjectId = !!Types.ObjectId.isValid(Identifier.toString());
  const SearchField = IsValidObjectId ? "_id" : "num";

  return CitationModel.findOne({
    guild: GuildId,
    [SearchField]: Identifier,
  }).lean(true);
}

/**
 * Fetches all citation numbers for a specific guild, optionally using a cache for performance.
 * @param GuildId - Specific guild Id to limit results to.
 * @param [Cache=false] - Whether to use the cache for results. If `true`, will return cached results if available.
 * @returns An array of citation autocomplete entries, each containing the citation number and a formatted label (<=100 characters each) for autocompletion.
 */
export async function GetCitationAutocompleteEntries(
  GuildId: string,
  Cache: boolean = false
): Promise<AggregateResults.CitationAutocompleteEntries[]> {
  if (Cache) {
    const Cached = AutocompletionCache.Citations.get(GuildId);
    if (Cached) return Cached;
  }

  return CitationModel.aggregate<AggregateResults.CitationAutocompleteEntries>([
    {
      $match: {
        guild: GuildId,
      },
    },
    {
      $sort: {
        issued_on: -1,
      },
    },
    {
      $project: {
        num: "$num",
        autocomplete_label: {
          $concat: [
            "#",
            { $toString: "$num" },
            " – ",
            "$nta_type",
            " ",
            "$cit_type",
            " – ",
            "$dov",
            " at ",
            "$tov",
            " ",
            "$ampm",
            " [PDT]",
          ],
        },
      },
    },
  ])
    .exec()
    .then((Cits) => {
      AutocompletionCache.Citations.set(GuildId, Cits);
      return Cits;
    });
}

/**
 * Creates a traffic citation record on a specific guild.
 * @param CachedInteract - The interaction invoked the logging process.
 * @param CitationData - The citation data to be logged.
 * @param CitationImg - The filled citation as an image. A buffer to be uploaded or the image URL itself (if already uploaded.)
 * @returns - The logged citation message link (the main one) if successful.
 */
export async function LogTrafficCitation(
  CachedInteract:
    | SlashCommandInteraction<"cached">
    | ButtonInteraction<"cached">
    | ModalSubmitInteraction<"cached">,
  CitationData: InstanceType<typeof CitationModel>,
  CitationImg: string | Buffer,
  AdditionalViolatorInfo: APIResponses.Users.GetUserResponse | OpenCloud.V2.Users.GetUserResponse
): Promise<string | null> {
  let CitationImgURL: string;
  const NTAIdentifier = ComposeIdentifier(ParseIdentifier(CitationData.num), "citation");

  if (typeof CitationImg === "string") {
    CitationImgURL = CitationImg;
  } else {
    const NTATypeLowered = CitationData.nta_type.toLowerCase();
    CitationImgURL =
      (await UploadToImgBB(CitationImg, `nta_${NTATypeLowered}_#${NTAIdentifier}`)) ??
      GetPlaceholderImgURL(`${TemplateDimensions.width}x${TemplateDimensions.height}`, "?");
  }

  const GuildSettings = await GetGuildSettings(CachedInteract.guildId);
  const RecordedCitation = await CitationModel.create({
    ...CitationData.toObject(),
    img_url: CitationImgURL,
  })
    .then((RecCit) => {
      IncrementShiftEvent(CachedInteract.guildId, CachedInteract.user.id, "citations").catch(
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
      nonce: RecordedCitation._id.toString(),
    }).then((SentMessage) => SentMessage?.url ?? null);
  }

  return null;
}
