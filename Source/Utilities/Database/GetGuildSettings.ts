import { MongoDBCache } from "@Utilities/Helpers/Cache.js";
import { Guilds } from "@Typings/Utilities/Database.js";
import GuildModel from "@Models/Guild.js";

/**
 * Retrieves the settings for a specific guild from the database.
 * @param GuildId - The unique identifier of the guild whose settings are to be retrieved.
 * @returns A promise that resolves to the guild's settings, either as a hydrated document or a lean object, or `null` if not found due to an edge case.
 * @remarks This function will attempt to create a new guild document if it doesn't exist in the database, and it will cache the settings for future use.
 */
export default async function GetGuildSettings(
  GuildId: string
): Promise<Guilds.GuildSettings | null> {
  const GuildDocumentCacheRef = MongoDBCache.Guilds.get(GuildId);
  let GuildDocument = GuildDocumentCacheRef ? structuredClone(GuildDocumentCacheRef) : null;

  if (!MongoDBCache.StreamChangeConnected.Guilds) {
    GuildDocument = (await GuildModel.findById(GuildId).lean().exec()) as Guilds.GuildDocument;
  }

  if (!GuildDocumentCacheRef && !GuildDocument) {
    const CreatedDocument = await GuildModel.create({
      _id: GuildId,
    });

    GuildDocument = CreatedDocument.toObject();
  }

  return GuildDocument ? GuildDocument.settings : null;
}

/**
 * Retrieves the guild settings synchronously from the MongoDB cache.
 * @param GuildId - The ID of the guild to retrieve settings for.
 * @returns The guild settings if found in the cache, otherwise `null`.
 */
export function GetGuildSettingsSync(GuildId: string): Guilds.GuildSettings | null {
  const GuildDocumentCacheRef = MongoDBCache.Guilds.get(GuildId);
  return GuildDocumentCacheRef ? structuredClone(GuildDocumentCacheRef.settings) : null;
}
