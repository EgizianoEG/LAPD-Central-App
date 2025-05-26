import { GuildSettingsCache } from "@Utilities/Other/Cache.js";
import { Guilds } from "@Typings/Utilities/Database.js";
import GuildModel from "@Models/Guild.js";
type HydratedGuildSettings = Mongoose.HydratedSingleSubdocument<Guilds.GuildSettings>;

/**
 * Retrieves the settings for a specific guild from the database, with optional caching and lean query support.
 * @template ReturnLeaned - Determines if the returned data should be a lean object or a hydrated document.
 * @param GuildId - The unique identifier of the guild whose settings are to be retrieved.
 * @param [Lean=true] - If true, returns a plain JavaScript object (lean); if false, returns a Mongoose document. Defaults to `true`.
 * @param [UseCache=true] - Whether to use the cache for retrieving guild settings. Defaults to `true`.
 * @returns A promise that resolves to the guild's settings, either as a hydrated document or a lean object, or `null` if not found due to an edge case.
 * @remarks This function will attempt to create a new guild document if it doesn't exist in the database, and it will cache the settings for future use.
 */
export default async function GetGuildSettings<ReturnLeaned extends boolean | undefined = true>(
  GuildId: string,
  Lean: ReturnLeaned = true as ReturnLeaned,
  UseCache: boolean = true
): Promise<ReturnLeaned extends true ? HydratedGuildSettings | null : Guilds.GuildSettings | null> {
  if (UseCache) {
    const CachedSettings = GuildSettingsCache.get<HydratedGuildSettings | Guilds.GuildSettings>(
      `${GuildId}:${Lean}`
    );

    if (CachedSettings) return CachedSettings as any;
  }

  let GuildDocument = await GuildModel.findById(GuildId, { settings: 1 }, { lean: Lean }).exec();
  if (!GuildDocument) {
    GuildDocument = await GuildModel.create({
      _id: GuildId,
    });

    if (Lean) {
      GuildDocument = GuildDocument.toObject() as any;
    }
  }

  if (GuildDocument) {
    GuildSettingsCache.set(`${GuildId}:${Lean}`, GuildDocument.settings);
    return GuildDocument.settings as any;
  } else {
    return null;
  }
}
