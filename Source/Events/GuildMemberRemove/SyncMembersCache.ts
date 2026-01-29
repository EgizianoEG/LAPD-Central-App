import { GuildMember, PartialGuildMember } from "discord.js";
import { RemoveGuildMemberCacheEntry } from "#Utilities/Helpers/Cache.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
const FileLabel = "Events:GuildMemberRemove:SyncMembersCache";

export default function SyncGuildMembersCacheOnLeave(
  _: DiscordClient,
  Member: GuildMember | PartialGuildMember
) {
  try {
    RemoveGuildMemberCacheEntry(Member);
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to prune guild member cache on leave;",
      label: FileLabel,
      guild_id: Member.guild.id,
      stack: Err.stack,
      error: Err,
    });
  }
}
