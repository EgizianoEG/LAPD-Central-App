import { UpsertGuildMemberCacheEntry } from "#Utilities/Helpers/Cache.js";
import { GuildMember } from "discord.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
const FileLabel = "Events:GuildMemberAdd:SyncMembersCache";

export default function SyncGuildMembersCacheOnJoin(_: DiscordClient, Member: GuildMember) {
  try {
    UpsertGuildMemberCacheEntry(Member);
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to sync guild member cache on join;",
      label: FileLabel,
      guild_id: Member.guild.id,
      stack: Err.stack,
      error: Err,
    });
  }
}
