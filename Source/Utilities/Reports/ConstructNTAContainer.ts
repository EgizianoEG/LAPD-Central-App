import { Dedent, FormatUsername } from "@Utilities/Strings/Formatters.js";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import { APIResponses } from "@Typings/Utilities/Roblox.js";
import { UpperFirst } from "@Utilities/Strings/Converters.js";
import {
  time,
  Colors,
  userMention,
  SeparatorBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";

export default function ConstructNTAContainer(
  CitationData: Omit<GuildCitations.AnyCitationData, "img_url">,
  AdditionalViolatorInfo: APIResponses.Users.GetUserResponse | string,
  CitationImgURL: string
) {
  const IssuedOnYearSuffix = new Date(CitationData.issued_on).getFullYear().toString().slice(-2);
  const NTAFullNumber = `${IssuedOnYearSuffix}-${CitationData.num}`;
  const CitationDescription = Dedent(`
      **Citation issued by:** ${userMention(CitationData.citing_officer.discord_id)}
      **Issued on:** ${time(CitationData.issued_on, "f")}
      **Violator:** ${typeof AdditionalViolatorInfo === "string" ? AdditionalViolatorInfo : FormatUsername(AdditionalViolatorInfo, false, true)}
      **Number:** \`${NTAFullNumber}\`
    `);

  return new ContainerBuilder()
    .setAccentColor(Colors.DarkBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### Notice to Appear — ${UpperFirst(CitationData.nta_type, true)} ${CitationData.cit_type}`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(CitationDescription))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(CitationImgURL)
          .setDescription(
            `Notice to Appear - ${UpperFirst(CitationData.nta_type, true)} ${CitationData.cit_type} #${NTAFullNumber}`
          )
      )
    );
}
