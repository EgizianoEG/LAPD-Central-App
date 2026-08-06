import type { BaseInteraction } from "discord.js";
import { ActiveUsersTracker } from "#Utilities/Helpers/Cache.js";

/**
 * Marks a user as active in the ActiveUsersTracker cache when they interact with the app.
 *
 * @param {DiscordClient} _ - The Discord client instance (not used in this function).
 * @param {BaseInteraction} Interaction - The interaction object representing the user's action.
 *
 * @remarks
 * Even though this file and function are named "TrackUserActivity," it's essentially only intended to mark users as active in the cache.
 * It does not perform any additional tracking or logging of user activity beyond this. Used in conjunction with the Client
 * member and user sweepers to prevent sweeping of active users from the its cache.
 */
export default async function TrackUserActivity(_: DiscordClient, Interaction: BaseInteraction) {
  ActiveUsersTracker.set(Interaction.user.id, true);
}
