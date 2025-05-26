import { Collection, Guild, GuildMember } from "discord.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import { GuildMembersCache } from "./Cache.js";
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
  MaxTimeMs: number = 5_000
): Promise<Collection<string, string>> {
  const UsernameToUserIdMap = new Collection<string, string>();
  const MembersCached = GuildMembersCache.get<Collection<string, GuildMember>>(GuildInstance.id);

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

    const StartTime = Date.now();
    let GuildMembers = MembersCached;
    let FetchAttempts = 0;

    while (!GuildMembers && FetchAttempts < 3 && Date.now() - StartTime < MaxTimeMs) {
      try {
        GuildMembers = await GuildInstance.members.fetch({ time: MaxTimeMs });
        if (!MembersCached) GuildMembersCache.set(GuildInstance.id, GuildMembers);
      } catch (Err: any) {
        FetchAttempts++;
        if (FetchAttempts >= 3 || Date.now() - StartTime >= MaxTimeMs) {
          AppLogger.debug({
            message: "Failed to fetch guild members after multiple attempts.",
            guild_id: GuildInstance.id,
            label: FileLabel,
            stack: Err.stack,
            error: { ...Err },
          });
          break;
        }

        const BufferTime = Math.min(1000, MaxTimeMs - (Date.now() - StartTime));
        if (BufferTime > 0) await new Promise((resolve) => setTimeout(resolve, BufferTime));
      }
    }

    if (GuildMembers) {
      GuildMembers.forEach((member) => {
        if (Usernames.includes(member.user.username)) {
          UsernameToUserIdMap.set(member.user.username, member.user.id);
        }
      });
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Unexpected error occurred while resolving usernames.",
      guild_id: GuildInstance.id,
      label: FileLabel,
      stack: Err.stack,
      error: { ...Err },
    });
  }

  return UsernameToUserIdMap;
}
