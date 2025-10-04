import { Discord } from "@Config/Secrets.js";

/**
 * Verifies the guilds the bot is currently a member of and ensures they are in the whitelist.
 * If a guild is not in the whitelist (`Discord.WLGuilds`) and is not the test guild (`Discord.TestGuildId`), the bot will leave that guild.
 * If the `Discord.WLGuilds` is not defined, the function will return without performing any actions (i.e. all guilds are whitelisted).
 *
 * @param Client - The Discord client instance used to access the bot's guilds.
 * @returns {void}
 */
export default async function VerifyGuilds(Client: DiscordClient) {
  if (!Discord.WLGuilds) return;
  for (const JoinedGuild of Client.guilds.cache.values()) {
    if (!Discord.WLGuilds.includes(JoinedGuild.id) && JoinedGuild.id !== Discord.TestGuildId) {
      await JoinedGuild.leave();
    }
  }
}
