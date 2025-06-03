import AppLogger from "@Utilities/Classes/AppLogger.js";
import {
  type Message,
  type Interaction,
  type MessagePayload,
  type MessageCreateOptions,
  PermissionFlagsBits,
  DiscordAPIError,
} from "discord.js";

/**
 * Sends a message payload to one or more specified guild channels or threads.
 * @param Interact - The cached interaction object.
 * @param FormattedIds - A single formatted channel/thread identifier or an array of such identifiers. Each identifier can be in the format:
 *   - "GuildId:ChannelId"
 *   - "ChannelId" or "ThreadId" (uses the guild Id from the interaction)
 * @param MessagePayload - The message payload to send, which can be a MessagePayload or MessageCreateOptions object.
 * @returns A promise that resolves to the main sent message (if any was sent in the interaction's guild), or null if no message was sent.
 * @remarks
 * - The function sanitizes and normalizes the list of IDs before processing.
 * - For each ID, it attempts to fetch the corresponding guild, channel, and optionally thread.
 * - It checks for appropriate permissions before sending messages.
 * - If a thread ID is provided, it attempts to send the message to the thread if possible.
 * - If not a thread or thread is not sendable, it attempts to send the message to the channel.
 * - Only the URL of the message sent in the interaction's guild is returned.
 * - Errors related to missing access or unknown channels/threads are silently ignored; other errors are logged.
 */
export async function SendGuildMessages(
  Interact: Interaction<"cached">,
  FormattedIds: string | string[],
  MessagePayload: MessagePayload | MessageCreateOptions
): Promise<Message<true> | null> {
  FormattedIds = SanitizeList(Array.isArray(FormattedIds) ? FormattedIds : [FormattedIds]);

  const SendPromises = FormattedIds.map(async (FormattedId) => {
    let GuildId: string;
    let ChanneOrThreadlId: string;
    const Split = FormattedId.split(":");

    if (Split.length === 2) {
      [GuildId, ChanneOrThreadlId] = Split;
    } else if (Split.length === 1) {
      GuildId = Interact.guildId;
      ChanneOrThreadlId = FormattedId;
    } else {
      return null;
    }

    try {
      const Guild = Interact.client.guilds.cache.get(GuildId);
      if (!Guild) return null;

      const ChannelOrThread = Guild.channels.cache.get(ChanneOrThreadlId);
      if (!ChannelOrThread) return null;

      const IsAbleToSendMsgs =
        ChannelOrThread?.viewable &&
        ChannelOrThread.isTextBased() &&
        ChannelOrThread.permissionsFor(Interact.client.user.id)?.has([
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ViewChannel,
        ]);

      if (IsAbleToSendMsgs) {
        const SentMsg = await ChannelOrThread.send(MessagePayload);
        if (SentMsg && SentMsg.guildId === Interact.guildId) {
          return SentMsg;
        }
      }

      return null;
    } catch (Err: any) {
      if (Err instanceof DiscordAPIError && (Err.code === 10_003 || Err.code === 10_004))
        return null;

      AppLogger.error({
        message: "An error occurred while bulk-sending messages; ignoring..",
        label: "Utilities:Other:SendGuildMessages",
        stack: Err.stack,
      });

      return null;
    }
  });

  const SendResults = await Promise.allSettled(SendPromises);
  if (SendResults[0]?.status === "fulfilled" && SendResults[0]?.value) {
    return SendResults[0].value;
  }

  return null;
}

/**
 * Removes duplicate strings from the input list and filters the list to include only valid Id patterns.
 * @param StrList - The array of strings to sanitize.
 * @returns A new array containing only unique and valid strings according to the specified rules.
 */
function SanitizeList(StrList: string[]): string[] {
  StrList = [...new Set(StrList)];
  return StrList.filter((Str) => Str?.match(/^(?:\d{15,22})(?::\d{15,22})?$/)).sort((A, B) => {
    const AColons = (A.match(/:/g) || []).length;
    const BColons = (B.match(/:/g) || []).length;

    if (AColons !== BColons) {
      return AColons - BColons;
    }

    return A.localeCompare(B);
  });
}
