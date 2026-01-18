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

  const GuildExists = await GuildModel.exists({ _id: GuildInst.id }).exec();
  if (GuildExists) {
    await GuildModel.updateOne(
      { _id: GuildInst.id, deletion_scheduled_on: { $ne: null } },
      { $set: { deletion_scheduled_on: null } }
    );
  } else {
    await GuildModel.create({
      _id: GuildInst.id,
    });

    AppLogger.debug({
      message: "A new guild record was added to the database. Id: %o",
      label: "Events:GuildCreate:UpdateDB",
      splat: [GuildInst.id],
    });
  }
}
