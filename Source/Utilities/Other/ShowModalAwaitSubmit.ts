import {
  CacheType,
  ModalBuilder,
  ModalSubmitInteraction,
  MessageComponentInteraction,
} from "discord.js";

/**
 * Shows a modal to the user and awaits for their submission.
 * @param Interaction - The interaction that triggered the modal. Also used to filter the submission based on user Id.
 * @param Modal - The modal to be shown to the user.
 * @param Timeout - The time in milliseconds to wait for a submission before timing out (defaults to 5 minutes).
 * @param [ThrowOnError=false] - If `true`, the function will throw an error if the modal submission is not received within the timeout period
 *                       or if there is an error while awaiting the modal submission; otherwise, as default, it will return `null`.
 * @returns A promise that resolves to the modal submit interaction or null if the timeout is reached.
 */
export default async function ShowModalAndAwaitSubmission<Cached extends CacheType = CacheType>(
  Interaction: SlashCommandInteraction<Cached> | MessageComponentInteraction<Cached>,
  Modal: ModalBuilder,
  Timeout: number = 5 * 60 * 1000,
  ThrowOnError: boolean = false
): Promise<ModalSubmitInteraction<Cached> | null> {
  await Interaction.showModal(Modal);
  return Interaction.awaitModalSubmit({
    filter: (MS) => MS.user.id === Interaction.user.id && MS.customId === Modal.data.custom_id,
    time: Timeout,
  }).catch((Err: unknown) => (ThrowOnError ? Promise.reject(Err as Error) : null));
}
