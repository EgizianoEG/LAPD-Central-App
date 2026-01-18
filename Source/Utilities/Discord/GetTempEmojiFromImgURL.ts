import { ApplicationEmoji, Client as DiscordClient, Events } from "discord.js";
import { App as DiscordApp } from "#DiscordApp";
import { milliseconds } from "date-fns";
import AppLogger from "#Utilities/Classes/AppLogger.js";

interface GetTempEmojiFromImgURLOptions {
  /** The URL of the image to use for the emoji. */
  ImgURLOrBuffer: string | Buffer;

  /** The duration in milliseconds until the emoji is considered "expired". This is appended to the emoji name as a timestamp. Default is 1 hour. */
  Expires?: number;

  /** The base name for the emoji; a maximum of 11 characters. Default is "unknown". */
  EmojiName?: string;
}

/**
 * Creates a temporary emoji in the application's guild from a given image URL.
 * The emoji's name is suffixed with `_temp_` and an expiration timestamp,
 * which can be used to identify and clean up temporary emojis later.
 *
 * @param Options - The options for creating the temporary emoji.
 * @returns A promise that resolves with the created emoji object on success, or `null` if an error occurs during creation.
 */
export default async function GetTempEmojiFromImgURL({
  ImgURLOrBuffer,
  Expires = milliseconds({ hours: 1 }),
  EmojiName = "unknown",
}: GetTempEmojiFromImgURLOptions): Promise<ApplicationEmoji | null> {
  await DelayUntilReady(DiscordApp);
  try {
    return await DiscordApp.application!.emojis.create({
      attachment: ImgURLOrBuffer,
      name: `${EmojiName.slice(0, 11)}_temp_${Date.now() + Expires}`,
    });
  } catch (Err: unknown) {
    AppLogger.error({
      message: "Failed to create temporary emoji from image URL",
      label: "Utilities:Discord:GetTempEmojiFromImgURL",
      error: Err as Error,
      stack: (Err as Error)?.stack,
    });

    return null;
  }
}

function DelayUntilReady(Client: DiscordClient): Promise<void> {
  return new Promise<void>((resolve) => {
    if (Client.isReady()) return resolve();
    Client.once(Events.ClientReady, () => resolve());
  });
}
