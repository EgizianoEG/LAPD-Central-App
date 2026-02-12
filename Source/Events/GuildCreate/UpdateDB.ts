import { Discord } from "#Config/Secrets.js";
import { Guild } from "discord.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

/**
 * Updates the database by adding/updating/verifying guild data.
 * @param _ - The client instance, unused in this function.
 * @param GuildInst - The guild instance to be added/updated in the database.
 */
export default async function UpdateDatabase(_: DiscordClient, GuildInst: Guild) {
  if (
    Discord.WLGuilds &&
    !Discord.WLGuilds.includes(GuildInst.id) &&
    Discord.TestGuildId !== GuildInst.id &&
    Discord.SupportGuildId !== GuildInst.id
  ) {
    await GuildInst.leave();
    return;
  }

  const Result = await GuildModel.findOneAndUpdate(
    { _id: GuildInst.id },
    { $set: { deletion_scheduled_on: null } },
    { upsert: true, new: true }
  )
    .exec()
    .catch((Err: any) => {
      AppLogger.error({
        message: "Failed to update the guild record in the database;",
        label: "Events:GuildCreate:UpdateDB",
        guild_id: GuildInst.id,
        stack: Err.stack,
        error: Err,
      });
    });

  if (Result && !Result.isNew) {
    AppLogger.debug({
      message: "A new guild record was added to the database. Id: %o",
      label: "Events:GuildCreate:UpdateDB",
      splat: [GuildInst.id],
    });
  }
}
