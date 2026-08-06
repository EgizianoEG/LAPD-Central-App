import { Guild, GuildMember, PartialGuildMember, Collection } from "discord.js";
import { GuildMembersCache, GuildMembersGatewayCooldownMs } from "./Cache.js";
import TTLCache from "@isaacs/ttlcache";

const GuildMembersFetchInFlight = new Map<string, Promise<Collection<string, GuildMember>>>();
const GuildMembersFetchCooldownTracker = new TTLCache<string, number>({
  ttl: GuildMembersGatewayCooldownMs,
  checkAgeOnGet: true,
});

async function WaitFor(DurationMs: number): Promise<void> {
  if (DurationMs <= 0) return;
  await new Promise<void>((Resolve) => setTimeout(Resolve, DurationMs));
}

/**
 * Retrieves a cloned snapshot of all guild members while respecting the RequestGuildMembers cooldown.
 * Uses the cached collection when available, otherwise serializes gateway fetches per guild.
 * @param GuildInstance - The guild whose member list should be retrieved.
 * @param Options.force - Forces a fresh fetch even if the cache already has data.
 * @returns A promise that resolves to a collection of guild members, where the
 *          keys are member IDs and the values are `GuildMember` objects.
 *
 * @remarks
 * - If the `force` option is not set, the function first checks the cache for
 *   existing data. If cached data is found, it is returned immediately.
 * - If no cached data is available, the function ensures that only one fetch
 *   operation is in-flight per guild at any given time.
 * - The function respects a cooldown period between fetches to avoid hitting
 *   gateway rate limits.
 * - The returned collection is a shallow clone of the original data to prevent
 *   unintended *indirect* modifications.
 */
export async function GetGuildMembersSnapshot(
  GuildInstance: Guild,
  Options: { force?: boolean } = {}
): Promise<Collection<string, GuildMember>> {
  const CacheKey = GuildInstance.id;

  if (Options.force) {
    GuildMembersCache.delete(CacheKey);
  } else {
    const CachedMembers = GuildMembersCache.get(CacheKey);
    if (CachedMembers) return CachedMembers.clone();
  }

  const ExistingFetch = GuildMembersFetchInFlight.get(CacheKey);
  if (ExistingFetch) return ExistingFetch;

  const FetchPromise = (async () => {
    const LastFetchAt = GuildMembersFetchCooldownTracker.get(CacheKey);
    if (LastFetchAt) {
      const RemainingDelay = Math.max(
        0,
        GuildMembersGatewayCooldownMs - (Date.now() - LastFetchAt)
      );
      await WaitFor(RemainingDelay);
    }

    try {
      const Members = await GuildInstance.members.fetch();
      GuildMembersCache.set(CacheKey, Members);
      GuildMembersFetchCooldownTracker.set(CacheKey, Date.now());
      return Members.clone();
    } finally {
      GuildMembersFetchInFlight.delete(CacheKey);
    }
  })();

  GuildMembersFetchInFlight.set(CacheKey, FetchPromise);
  return FetchPromise;
}

/**
 * Inserts or updates a cached guild member entry if the guild already has a snapshot cached.
 * @param Member - The guild member whose information should be synced into the cache.
 */
export function UpsertGuildMemberCacheEntry(Member: GuildMember): void {
  const CachedMembers = GuildMembersCache.get(Member.guild.id);
  if (!CachedMembers) return;

  CachedMembers.set(Member.id, Member);
  GuildMembersCache.set(Member.guild.id, CachedMembers);
}

/**
 * Removes a member from the cached snapshot, deleting the cache entirely if it becomes empty.
 * @param Member - The guild member to remove from the cached collection.
 */
export function RemoveGuildMemberCacheEntry(Member: GuildMember | PartialGuildMember): void {
  const CachedMembers = GuildMembersCache.get(Member.guild.id);
  if (!CachedMembers) return;

  CachedMembers.delete(Member.id);
  if (CachedMembers.size === 0) {
    GuildMembersCache.delete(Member.guild.id);
    return;
  }

  GuildMembersCache.set(Member.guild.id, CachedMembers);
}
