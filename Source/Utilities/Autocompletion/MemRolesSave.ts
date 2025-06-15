import { ApplicationCommandOptionChoiceData } from "discord.js";
import { GeneralAutocompletionCache } from "@Utilities/Helpers/Cache.js";
import { IsValidDiscordId } from "@Utilities/Helpers/Validators.js";
import { MemberSavedRoles } from "@Typings/Utilities/Database.js";
import MRolesModel from "@Models/MemberRoles.js";

/**
 * Autocompletes save Id option for member roles command.
 * @param UserId - The target user/member to show saves for.
 * @param GuildId - The guild which the target user is in.
 * @param Typed - The input string value.
 * @returns An array of suggestions.
 */
export default async function AutocompleteMemRolesSave(
  UserId: string,
  GuildId: string,
  Typed: string
): Promise<ApplicationCommandOptionChoiceData[]> {
  if (!IsValidDiscordId(UserId)) return [];

  let Suggestions: ApplicationCommandOptionChoiceData[] = [];
  const IsValidId = Typed.trim().match(/^[a-fA-F0-9]{24}$/);
  if (IsValidId) {
    const Save = await MRolesModel.findOne({
      member: UserId,
      guild: GuildId,
      _id: Typed.trim(),
    }).exec();

    if (Save) {
      return [{ name: Save.autocomplete_text, value: Save.id }];
    }
  }

  const LowerCaseTyped = Typed.trim().toLowerCase();
  const CacheKey = `member-saved-roles:${GuildId}:${UserId}`;
  let Saves =
    GeneralAutocompletionCache.get<MemberSavedRoles.HydratedMemberRolesDocument[]>(CacheKey);

  if (!Saves) {
    Saves = (await MRolesModel.find({ guild: GuildId, member: UserId })
      .sort({ saved_on: -1 })
      .exec()) as unknown as MemberSavedRoles.HydratedMemberRolesDocument[];

    GeneralAutocompletionCache.set(CacheKey, Saves);
  }

  if (!Saves?.length) {
    return [{ name: "[No Saves Found]", value: "0" }];
  }

  if (!Typed || Typed.match(/^\s*$/)) {
    Suggestions = Saves.map((Save) => {
      return { name: Save.autocomplete_text, value: Save.id };
    });
  } else {
    Suggestions = Saves.filter((Save) => {
      const LowerCaseLabel = Save.autocomplete_text.toLowerCase();
      return LowerCaseLabel.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseLabel);
    }).map((Save) => {
      return { name: Save.autocomplete_text, value: Save.id };
    });
  }

  return Suggestions.slice(0, 25);
}
