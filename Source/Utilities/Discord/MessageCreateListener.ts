import { Message } from "discord.js";

/**
 * Creates a promise that resolves when a message matching the filter is received or when the timeout expires.
 *
 * @param Client - The Discord client instance to listen for messages on.
 * @param Filter - A function that determines whether a received message satisfies the conditions.
 * @param Timeout - Maximum time to wait in milliseconds before resolving with `null`.
 *
 * @returns A promise that resolves with the matching message or `null` if timed out.
 *          The promise has an additional `cancel()` method that can be called to
 *          manually stop listening and clean up resources.
 *
 * @example
 * // Wait for a specific message from a user
 * const messageWaiter = AwaitMessageWithTimeout(
 *   client,
 *   (msg) => msg.author.id === userId && msg.content.startsWith('!confirm'),
 *   60000  // 1 minute timeout
 * );
 *
 * // Later, if needed:
 * messageWaiter.cancel();  // Stop listening
 *
 * // Or await the result:
 * const message = await messageWaiter;
 * if (message) {
 *   // Message received
 * } else {
 *   // Timed out or cancelled
 * }
 */
export default function AwaitMessageWithTimeout(
  Client: DiscordClient,
  Filter: (message: Message) => boolean,
  Timeout: number
): Promise<Message | null> & {
  cancel: () => void;
} {
  let TimeoutId: NodeJS.Timeout;
  let Listener: (message: Message) => void;

  const MessagePromise = new Promise<Message | null>((resolve) => {
    Listener = (recMessage: Message) => {
      try {
        if (!Filter(recMessage)) {
          return;
        }

        clearTimeout(TimeoutId);
        Client.removeListener("messageCreate", Listener);
        resolve(recMessage);
      } catch {
        clearTimeout(TimeoutId);
        Client.removeListener("messageCreate", Listener);
        resolve(null);
      }
    };

    TimeoutId = setTimeout(() => {
      Client.removeListener("messageCreate", Listener);
      resolve(null);
    }, Timeout);

    Client.on("messageCreate", Listener);
  });

  const CancelablePromise = MessagePromise as Promise<Message | null> & { cancel: () => void };
  CancelablePromise.cancel = () => {
    clearTimeout(TimeoutId);
    Client.removeListener("messageCreate", Listener);
  };

  return CancelablePromise;
}
