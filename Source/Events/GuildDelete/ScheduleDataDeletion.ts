import { Client, Guild } from "discord.js";
import { addDays } from "date-fns";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import GuildModel from "#Models/Guild.js";

/**
 * Schedules the guild data deletion from the database after **7 days** of the client not being in it.
 * @param _ - The client instance, unused in this function.
 * @param GuildInst - The guild instance to be scheduled for deletion.
 */
export default async function ScheduleGuildDataDeletion(_: Client<true>, GuildInst: Guild) {
  const UpdatedGuildDocument = await GuildModel.findOneAndUpdate(
    {
      _id: GuildInst.id,
      deletion_scheduled_on: null,
    },
    {
      $set: {
        deletion_scheduled_on: addDays(new Date(), 7),
      },
    },
    { new: true, lean: true, projection: { _id: 1 } }
  ).exec();

  if (UpdatedGuildDocument) {
    AppLogger.debug({
      message: "Scheduled data deletion for the guild with the id: %s",
      label: "Events:GuildDelete:ScheduleDataDeletion",
      splat: [GuildInst.id],
    });
  } else {
    AppLogger.debug({
      message: "Guild with id '%s' not found in the database. Data deletion scheduling skipped.",
      label: "Events:GuildDelete:ScheduleDataDeletion",
      splat: [GuildInst.id],
    });
  }
}
