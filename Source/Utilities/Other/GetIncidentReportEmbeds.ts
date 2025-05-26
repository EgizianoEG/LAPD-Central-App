import {
  Colors,
  Collection,
  inlineCode,
  messageLink,
  userMention,
  channelLink,
  EmbedBuilder,
  AttachmentBuilder,
  time as FormatTime,
} from "discord.js";

import { IsValidDiscordAttachmentLink } from "./Validators.js";
import { FormatSortRDInputNames } from "@Utilities/Strings/Formatters.js";
import { GuildIncidents } from "@Typings/Utilities/Database.js";
import Dedent from "dedent";
const ListFormatter = new Intl.ListFormat("en");

/**
 * Generates an array of embeds to display an incident report.
 * @param IncidentRecord - The incident record to generate the embed for.
 * @param Options - The channel which the report will be sent to. Used to for the embed(s) title URL and gallray view feature.
 *                              If not provided, a dummy URL will be used that won't redirect user to any destination.
 *
 * @returns An array of embeds or single embed if attachments were provided with only one element.
 */
export default function GetIncidentReportEmbeds(
  IncidentRecord: GuildIncidents.IncidentRecord,
  Options?: {
    /**
     * The channel which the report will be sent to. Used to for the embed(s) title URL and gallray view feature.
     * If not provided, a dummy URL will be used that shouldn't redirect user to any destination.
     */
    guild_id?: string;

    /**
     * The channel which the report will be sent to. Used to for the embed(s) title URL and gallray view feature.
     * If not provided, a dummy URL will be used that shouldn't redirect user to any destination.
     */
    channel_id?: string;

    /**
     * Override the attachments to be used in the embed.
     * This is useful for when you want to display a different set of attachments than the ones in the incident record
     * or when there is a need to display a set of attachments that are yet to be uploaded in a message.
     * @default undefined
     */
    attachments_override?: Collection<string, AttachmentBuilder>;
  }
) {
  const AttachmentDistributerEmbeds: EmbedBuilder[] = [];
  const IIOfficersFormatted = IncidentRecord.officers.length
    ? ListFormatter.format(FormatSortRDInputNames(IncidentRecord.officers, true))
    : "None";

  const IWitnessesFormatted = IncidentRecord.witnesses.length
    ? ListFormatter.format(FormatSortRDInputNames(IncidentRecord.witnesses, true, false))
    : "N/A";

  const IVictimsFormatted = IncidentRecord.victims.length
    ? ListFormatter.format(FormatSortRDInputNames(IncidentRecord.victims, true, false))
    : "N/A";

  const ISuspectsFormatted = IncidentRecord.suspects.length
    ? ListFormatter.format(FormatSortRDInputNames(IncidentRecord.suspects, true, false))
    : "N/A";

  const LogMessageDetails = IncidentRecord.log_message?.split(":");
  const LogMessageURL =
    LogMessageDetails && LogMessageDetails[0] !== Options?.channel_id
      ? messageLink(LogMessageDetails[0], LogMessageDetails[1])
      : null;

  const IncidentNumber = LogMessageURL
    ? `[${inlineCode(IncidentRecord.num)}](${LogMessageURL})`
    : inlineCode(IncidentRecord.num);

  const IncidentReportEmbed = new EmbedBuilder()
    .setTitle("LAPD — Incident Report")
    .setColor(Colors.DarkBlue)
    .setDescription(
      Dedent(`
        **Incident Number:** ${IncidentNumber}
        **Incident Reported By:** ${userMention(IncidentRecord.reporter.discord_id)}
        **Incident Reported On:** ${FormatTime(IncidentRecord.reported_on, "f")}
        **Involved Officers:** ${IIOfficersFormatted}
      `)
    )
    .setFields([
      {
        inline: true,
        name: "Incident Type",
        value: IncidentRecord.type,
      },
      {
        inline: true,
        name: "Status",
        value: IncidentRecord.status,
      },
      {
        inline: true,
        name: "Location",
        value: IncidentRecord.location,
      },
      {
        inline: true,
        name: "Suspects",
        value: ISuspectsFormatted,
      },
      {
        inline: true,
        name: "Victims",
        value: IVictimsFormatted,
      },
      {
        inline: true,
        name: "Witnesses",
        value: IWitnessesFormatted,
      },
      {
        inline: false,
        name: "Incident Description",
        value: IncidentRecord.description,
      },
    ]);

  if (IncidentRecord.notes) {
    IncidentReportEmbed.addFields({
      inline: false,
      name: "Notes",
      value: IncidentRecord.notes,
    });
  }

  if (IncidentRecord.last_updated && IncidentRecord.last_updated_by) {
    IncidentReportEmbed.setTimestamp(IncidentRecord.last_updated).setFooter({
      text: `Last updated by @${IncidentRecord.last_updated_by.discord_username} on`,
    });
  }

  const IncidentAttachments =
    Options?.attachments_override ??
    new Collection(
      IncidentRecord.attachments
        .filter((AttachmentLink) => IsValidDiscordAttachmentLink(AttachmentLink, false, "image"))
        .map((AttachmentLink) => [AttachmentLink, AttachmentLink])
    );

  const GetAttachmentURL = (Attachment: string | { name: string; url: string }) => {
    if (typeof Attachment === "string") {
      return Attachment;
    }

    return `attachment://${Attachment.name}`;
  };

  if (IncidentAttachments.size) {
    const First = IncidentAttachments.first();
    const FirstKey = IncidentAttachments.keys().next().value;

    IncidentReportEmbed.setImage(
      typeof First === "string"
        ? First
        : GetAttachmentURL({
            name: First!.name!,
            url: FirstKey!,
          })
    );

    if (IncidentAttachments.size > 1) {
      const GrouppingURL =
        LogMessageURL ??
        (Options?.channel_id
          ? channelLink(Options.channel_id)
          : `https://discord.com/channels/${Options?.guild_id || IncidentRecord.guild}/`);

      IncidentReportEmbed.setURL(GrouppingURL);
      for (const [AttachmentLink, Value] of IncidentAttachments.entries().drop(1)) {
        AttachmentDistributerEmbeds.push(
          new EmbedBuilder()
            .setURL(LogMessageURL ?? GrouppingURL)
            .setColor(Colors.DarkBlue)
            .setImage(
              typeof Value === "string"
                ? Value
                : GetAttachmentURL({
                    name: Value.name!,
                    url: AttachmentLink,
                  })
            )
        );
      }
    }
  }

  return [IncidentReportEmbed, ...AttachmentDistributerEmbeds].slice(0, 10);
}
