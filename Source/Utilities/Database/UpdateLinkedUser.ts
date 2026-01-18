import GuildProfile from "#Models/GuildProfile.js";

/**
 * Updates the linked Roblox user id and puts the given one instead
 * This function is runs knowing that the user and their guild are recorded in the database already
 * @param CmdInteraction - Original command interaction
 * @param RobloxUserId - The user Id to record and put into the database (`0` by default)
 * @returns A promise resolves to the saved user profile document if succeeded
 */
export default async function UpdateLinkedRobloxUser(
  CmdInteraction: SlashCommandInteraction,
  RobloxUserId: string | number | null = 0
) {
  RobloxUserId = Number(RobloxUserId) || 0;
  const Member = await GuildProfile.findOne({
    user: CmdInteraction.user.id,
    guild: CmdInteraction.guildId,
  }).exec();

  if (Member) {
    Member.linked_account.roblox_user_id = RobloxUserId;
    return Member.save();
  } else {
    return GuildProfile.create({
      user: CmdInteraction.user.id,
      guild: CmdInteraction.guildId,
      linked_account: {
        roblox_user_id: RobloxUserId,
      },
    });
  }
}
