import { addDays } from "date-fns";
import { Collection } from "discord.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import GuildModel from "@Models/Guild.js";
const FileLabel = "Events:Ready:VerifyDatabase";
const GuildDataDeletionScheduleDays = 7;

/**
 * Verifies the bot database for any joined guild that is not recorded on it.
 * @param Client - The Discord client instance used to interact with the Discord API.
 */
export default async function VerifyDatabase(Client: DiscordClient): Promise<void> {
  try {
    const Guilds = await Client.guilds.fetch();
    const NewGuilds: (typeof GuildModel.schema.obj)[] = [];
    const DSGToCancel = new Set<string>();
    const GuildsInDB = new Collection(
      (await GuildModel.find().select({ _id: 1, deletion_scheduled_on: 1 }).lean().exec()).map(
        (GuildDoc) => [GuildDoc._id, GuildDoc.deletion_scheduled_on] as [string, Date | null]
      )
    );

    for (const JoinedGuild of Guilds.values()) {
      const GuildFound = GuildsInDB.get(JoinedGuild.id);
      if (GuildFound !== undefined) {
        if (GuildFound) DSGToCancel.add(JoinedGuild.id);
        NewGuilds.push({ _id: JoinedGuild.id });
      }
    }

    if (NewGuilds.length > 0) {
      await GuildModel.insertMany(NewGuilds);
      AppLogger.debug({
        message: "New guilds were added to the database; added %i records.",
        label: FileLabel,
        splat: [NewGuilds.length],
      });
    }

    // Schedule guild data deletion for guilds that are no longer registered on the application (the application is not in them).
    const LeftGuilds = GuildsInDB.difference(Guilds);
    if (LeftGuilds.size > 0) {
      const UpdateManyResult = await GuildModel.updateMany(
        {
          _id: { $in: Array.from(LeftGuilds.keys()) },
          deletion_scheduled_on: null,
        },
        {
          $set: {
            deletion_scheduled_on: addDays(new Date(), GuildDataDeletionScheduleDays),
          },
        }
      ).exec();

      if (UpdateManyResult.modifiedCount > 0) {
        AppLogger.debug({
          message: "Scheduled data deletion for %i guild(s) that the application is no longer in.",
          label: FileLabel,
          splat: [UpdateManyResult.modifiedCount],
        });
      }
    }

    // Cancel scheduled deletion for guilds that the application is in them at the moment.
    if (DSGToCancel.size > 0) {
      const UpdateManyResult = await GuildModel.updateMany(
        {
          _id: { $in: Array.from(DSGToCancel) },
          deletion_scheduled_on: { $ne: null },
        },
        {
          $set: {
            deletion_scheduled_on: null,
          },
        }
      ).exec();

      if (UpdateManyResult.modifiedCount > 0) {
        AppLogger.debug({
          message: "Cancelled scheduled data deletion for %i guild(s).",
          label: FileLabel,
          splat: [UpdateManyResult.modifiedCount],
        });
      }
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to verify the database records.",
      label: FileLabel,
      stack: Err.stack,
    });
  }
}
