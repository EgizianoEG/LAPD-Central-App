import { Collection, Guild } from "discord.js";
import { GetGuildMembersSnapshot, GuildMembersCache } from "../Helpers/Cache.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
const FileLabel = "Utilities:ResolveDiscordUsernames";

/**
 * Resolves a list of Discord usernames to their corresponding user IDs within a specified guild.
 * @param GuildInstance - The Discord guild instance where the usernames are to be resolved.
 * @param Usernames - An array of Discord usernames to resolve to user IDs.
 * @param MaxTimeMs - The maximum time in milliseconds to spend resolving usernames. Defaults to 5000ms (5 seconds).
 * @returns A promise that resolves to a `Map` where the keys are usernames and the values are user IDs.
 *
 * @throws This function does not throw directly but logs errors internally if member fetching or searching fails as debug logs.
 *         Callers should handle the possibility of unresolved usernames in the returned `Collection`.
 *
 * @example
 * ```typescript
 * const GuildInst = Client.guilds.cache.get('guild_id');
 * const Usernames = ['User1', 'User2', 'User3'];
 * const UsernameToIdMap = await ResolveUsernamesToIds(GuildInst, Usernames);
 * console.log(UsernameToIdMap);
 * ```
 */
export default async function ResolveUsernamesToIds(
  GuildInstance: Guild,
  Usernames: string[],
  MaxTimeMs: number = 10_000
): Promise<Collection<string, string>> {
  const UsernameToUserIdMap = new Collection<string, string>();
  const MembersCached = GuildMembersCache.get(GuildInstance.id);

  try {
    if (Usernames.length === 0) {
      return UsernameToUserIdMap;
    } else if (Usernames.length === 1) {
      const SingleMember = MembersCached?.get(Usernames[0]);

      if (SingleMember) {
        UsernameToUserIdMap.set(SingleMember.user.username, SingleMember.user.id);
        return UsernameToUserIdMap;
      }

      const QueryResult = await GuildInstance.members.search({
        query: Usernames[0],
        limit: 1,
      });

      if (!QueryResult.first()) return UsernameToUserIdMap;
      return UsernameToUserIdMap.set(
        QueryResult.first()!.user.username,
        QueryResult.first()!.user.id
      );
    }

    let GuildMembers = MembersCached;
    if (!GuildMembers) {
      try {
        GuildMembers = await GetGuildMembersSnapshot(GuildInstance);
      } catch (Err: any) {
        AppLogger.debug({
          message: "Failed to fetch guild members snapshot.",
          guild_id: GuildInstance.id,
          label: FileLabel,
          max_time_ms: MaxTimeMs,
          stack: Err.stack,
          error: Err,
        });
      }
    }

    if (GuildMembers) {
      for (const Member of GuildMembers.values()) {
        if (Usernames.includes(Member.user.username)) {
          UsernameToUserIdMap.set(Member.user.username, Member.user.id);
        }
      }
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Unexpected error occurred while resolving usernames.",
      guild_id: GuildInstance.id,
      label: FileLabel,
      stack: Err.stack,
      error: Err,
    });
  }

  return UsernameToUserIdMap;
}
