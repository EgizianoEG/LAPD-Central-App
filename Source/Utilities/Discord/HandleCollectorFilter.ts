import { type RepliableInteraction, MessageFlags } from "discord.js";
import { UnauthorizedEmbed } from "../Classes/ExtraEmbeds.js";

/**
 * Filters component collector interactions to enforce user authorization.
 * Ensures only the user who initiated the original interaction can continue it.
 * If an unauthorized user attempts to interact, the function responds accordingly.
 * @param OriginalInteract - The initial user command interaction.
 * @param ReceivedInteract - The interaction received from the collector.
 * @returns Boolean indicating whether the interaction is authorized.
 */
export default function HandleCollectorFiltering(
  OriginalInteract: RepliableInteraction,
  ReceivedInteract: RepliableInteraction
): boolean {
  if (OriginalInteract.user.id === ReceivedInteract.user.id) return true;

  ReceivedInteract.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [
      new UnauthorizedEmbed().setDescription(
        "You are not permitted to interact with a prompt that somebody else has initiated."
      ),
    ],
  }).catch(() => null);

  return false;
}
