import { MongoDBCache } from "#Utilities/Helpers/Cache.js";
import { Guilds } from "#Typings/Utilities/Database.js";
import GuildModel from "#Models/Guild.js";
import AppError from "../Classes/AppError.js";

/**
 * Retrieves the settings for a specific guild from the database.
 * @param GuildId - The unique identifier of the guild whose settings are to be retrieved.
 * @returns A promise that resolves to the guild's settings as a lean-ed flattened-ids object, or `null` if not found due to an edge case.
 * @remarks This function will attempt to create a new guild document if it doesn't exist in the database, and it will cache the settings for future use.
 */
export default async function GetGuildSettings(GuildId: string): Promise<Guilds.GuildSettings> {
  const GuildDocumentCacheRef = MongoDBCache.Guilds.get(GuildId);
  let GuildDocument: InstanceType<typeof GuildModel> | null;

  if (MongoDBCache.StreamChangeConnected.Guilds === true) {
    GuildDocument = GuildDocumentCacheRef ? new GuildModel(GuildDocumentCacheRef) : null;
  } else {
    GuildDocument = (await GuildModel.findById(GuildId).lean().exec()) as InstanceType<
      typeof GuildModel
    >;
  }

  if (!GuildDocumentCacheRef && !GuildDocument) {
    const CreatedDocument = await GuildModel.create({
      _id: GuildId,
    });

    GuildDocument = CreatedDocument;
  }

  if (!GuildDocument) {
    throw new AppError({
      template: "GuildConfigNotFound",
      showable: true,
      code: 1,
    });
  }

  return ("toObject" in GuildDocument
    ? GuildDocument.toObject({ versionKey: false, flattenObjectIds: true })
    : GuildDocument
  ).settings as unknown as Guilds.GuildSettings;
}

/**
 * Retrieves the guild settings synchronously from the MongoDB cache.
 * @param GuildId - The ID of the guild to retrieve settings for.
 * @returns The guild settings if found in the cache, otherwise `null`.
 */
export function GetGuildSettingsSync(GuildId: string): Guilds.GuildSettings | null {
  const GuildDocumentCacheRef = MongoDBCache.Guilds.get(GuildId);
  return GuildDocumentCacheRef
    ? (new GuildModel(GuildDocumentCacheRef).toObject({
        versionKey: false,
        flattenObjectIds: true,
      }).settings as unknown as Guilds.GuildSettings)
    : null;
}
