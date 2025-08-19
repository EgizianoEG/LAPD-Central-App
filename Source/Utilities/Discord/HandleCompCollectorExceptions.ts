import DisableMessageComponents from "./DisableMsgComps.js";
import {
  InteractionCallbackResponse,
  MessageComponentInteraction,
  InteractionResponse,
  MessageFlags,
  Message,
} from "discord.js";

export default async function HandleActionCollectorExceptions(
  Err: unknown,
  Disabler?:
    | MessageComponentInteraction
    | Message
    | InteractionResponse
    | InteractionCallbackResponse
    | (() => Promise<any>)
) {
  if (Err instanceof Error) {
    if (Err.message.match(/reason: (?:time|idle)/)) {
      try {
        if (typeof Disabler === "function") {
          await Disabler();
        } else if (Disabler instanceof MessageComponentInteraction && Disabler.message) {
          await Disabler.editReply({
            components: DisableMessageComponents(
              Disabler.message.components.map((Comp) => Comp.toJSON())
            ),
          });
        } else if (Disabler instanceof Message && !Disabler.flags.has(MessageFlags.Ephemeral)) {
          await Disabler.edit({
            components: DisableMessageComponents(Disabler.components.map((Comp) => Comp.toJSON())),
          });
        } else if (
          Disabler instanceof InteractionResponse ||
          Disabler instanceof InteractionCallbackResponse
        ) {
          const Message =
            Disabler instanceof InteractionResponse
              ? await Disabler.fetch().catch(() => null)
              : Disabler.resource?.message;

          if (!Message || Message.flags.has(MessageFlags.Ephemeral)) return null;
          await Message.edit({
            components: DisableMessageComponents(Message.components.map((Comp) => Comp.toJSON())),
          });
        }
      } catch {
        // Ignored.
      }

      return null;
    } else if (Err.message.match(/reason: \w+Delete/)) {
      /* Ignore message/channel/guild deletion */
      return null;
    } else {
      throw Err;
    }
  }
}
