import GuildProfile from "#Models/GuildProfile.js";

/**
 * Sets the linked Roblox user Id for a guild member.
 *
 * The function expects both the guild and user to already be present in the database.
 * If the member's profile doesn't exist, it will be created automatically.
 *
 * @param CmdInteraction - Source of guild and user Ids.
 * @param RobloxUserId - New Roblox Id to link (defaults to `0` if `null`). Passing `null` or `0` will be equivalent to unlinking.
 * @returns The updated or newly created GuildProfile document.
 */
export default async function SetLinkedRobloxAccount(
  CmdInteraction: SlashCommandInteraction<"cached"> | { guildId: string; user: { id: string } },
  RobloxUserId: number | null = 0
) {
  RobloxUserId = RobloxUserId ?? 0;
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
