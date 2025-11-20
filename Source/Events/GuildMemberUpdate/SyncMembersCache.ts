import { UpsertGuildMemberCacheEntry } from "@Utilities/Helpers/Cache.js";
import { GuildMember } from "discord.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
const FileLabel = "Events:GuildMemberUpdate:SyncMembersCache";

export default function SyncGuildMembersCacheOnMemberUpdate(
  _: DiscordClient,
  _OutdatedMember: GuildMember,
  UpdatedMember: GuildMember
) {
  try {
    UpsertGuildMemberCacheEntry(UpdatedMember);
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to sync guild member cache on update;",
      label: FileLabel,
      guild_id: UpdatedMember.guild.id,
      stack: Err.stack,
      error: Err,
    });
  }
}
