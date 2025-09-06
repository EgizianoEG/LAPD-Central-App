import { MongoDBCache } from "@Utilities/Helpers/Cache.js";
import { Guilds } from "@Typings/Utilities/Database.js";
import GuildModel from "@Models/Guild.js";

/**
 * Generates a new sequential incident number for a guild in the format `YY-NNNNNN`.
 * @param GuildId - The Id of the guild to generate the number for.
 * @returns A formatted incident number string (e.g., "25-00007").
 */
export default async function GenerateNextSequentialIncidentNumber(
  GuildId: string
): Promise<string> {
  const CurrentYearSuffix = new Date().getFullYear().toString().slice(-2);
  let GuildDocument: Guilds.GuildDocument | null;

  if (MongoDBCache.StreamChangeConnected.Guilds === true)
    GuildDocument = MongoDBCache.Guilds.get(GuildId) ?? null;

  GuildDocument ??= await GuildModel.findById(GuildId).lean();
  const MostRecentIncNum = GuildDocument?.logs.incidents.most_recent_num;

  if (MostRecentIncNum?.startsWith(CurrentYearSuffix)) {
    const NextSequence = parseInt(MostRecentIncNum.split("-")[1], 10) + 1;
    return `${CurrentYearSuffix}-${NextSequence.toString().padStart(5, "0")}`;
  } else {
    return `${CurrentYearSuffix}-00001`;
  }
}
