import { ApplicationCommandOptionChoiceData } from "discord.js";
import { GeneralAutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { IsValidDiscordId } from "#Utilities/Helpers/Validators.js";
import { type RolePersist } from "#Typings/Utilities/Database.js";
import RolePersistenceModel from "#Models/RolePersist.js";

/**
 * Autocompletes a persist record Id option for role persist commands.
 * @param UserId - The target user/member to show records for.
 * @param GuildId - The guild which the target user is in.
 * @param Typed - The input string value.
 * @returns An array of suggestions.
 */
export default async function AutocompleteRolePersistRecord(
  UserId: string,
  GuildId: string,
  Typed: string
): Promise<ApplicationCommandOptionChoiceData[]> {
  if (!IsValidDiscordId(UserId)) return [];

  let Suggestions: ApplicationCommandOptionChoiceData[] = [];
  const IsValidId = Typed.trim().match(/^[a-fA-F0-9]{24}$/);
  if (IsValidId) {
    const Record = await RolePersistenceModel.findOne({
      user: UserId,
      guild: GuildId,
      _id: Typed.trim(),
    }).exec();

    if (Record) {
      return [{ name: Record.autocomplete_text, value: Record.id }];
    }
  }

  const LowerCaseTyped = Typed.trim().toLowerCase();
  const CacheKey = `role-persist:${GuildId}:${UserId}`;
  let Records = GeneralAutocompletionCache.get<RolePersist.HydratedRolePersistDocument[]>(CacheKey);

  if (!Records) {
    Records = (await RolePersistenceModel.find({
      guild: GuildId,
      user: UserId,
      $or: [{ expiry: { $gte: new Date() } }, { expiry: null }],
    })
      .sort([
        ["expiry", -1],
        ["saved_on", -1],
      ])
      .exec()) as unknown as RolePersist.HydratedRolePersistDocument[];

    GeneralAutocompletionCache.set(CacheKey, Records);
  }

  if (!Records?.length) {
    return [{ name: "[No Records Found]", value: "0" }];
  }

  if (!Typed || Typed.match(/^\s*$/)) {
    Suggestions = Records.map((Record) => {
      return { name: Record.autocomplete_text, value: Record.id };
    });
  } else {
    Suggestions = Records.filter((Record) => {
      const LowerCaseLabel = Record.autocomplete_text.toLowerCase();
      return LowerCaseLabel.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseLabel);
    }).map((Record) => {
      return { name: Record.autocomplete_text, value: Record.id };
    });
  }

  return Suggestions.slice(0, 25);
}
