import type { AutoModerationRule, GuildMember } from "discord.js";
import type { AggregateResults, Guilds, Shifts } from "#Typings/Utilities/Database.js";
import type { BloxlinkUserLimitInfo } from "#Utilities/Roblox/GetRbxIdBloxLink.js";
import type { UserIdLookupResult } from "#Utilities/Roblox/GetIdByUsername.js";
import type { ThrottleTracker } from "#Utilities/Discord/CommandExecutionGuards.js";
import type NobloxJs from "noblox.js";

import { hoursToMilliseconds } from "date-fns";
import { millisecondsInDay } from "date-fns/constants";
import { Collection } from "discord.js";

import MongoDBDocCollection from "#Utilities/Classes/MongoDBDocCollection.js";
import ShiftModel from "#Models/Shift.js";
import TTLCache from "@isaacs/ttlcache";

// -------------------------------------------------------------------------------------------
// Naming convention:
//   *Cache   - stores a previously-fetched/computed value to avoid redoing the work.
//   *Tracker - stores state, counters, or timestamps (not a fetched value).
// -------------------------------------------------------------------------------------------

// 30 seconds Guild Members request rate limit
export const GuildMembersGatewayCooldownMs = 30 * 1000;
export const RobloxAPICache = {
  /**
   * @purpose Avoids re-issuing the same Roblox `searchUsers` query within its freshness window.
   * @keyedBy `"<query>:<limit>"`.
   * @ttl     3 minutes; Roblox search results don't meaningfully change
   *          faster than this, and it keeps autocomplete calls off the API.
   */
  QueryUsernameResults: new TTLCache<
    `${string}:${10 | 25 | 50 | 100}`,
    Awaited<ReturnType<typeof NobloxJs.searchUsers>>
  >({
    ttl: 3 * 60 * 1000,
    checkAgeOnGet: true,
  }),

  /**
   * @purpose Avoids re-issuing the same Roblox `getIdByUsername` query within its freshness window.
   * @keyedBy `"<username>"`.
   * @ttl     5 minutes; Roblox usernames don't meaningfully change faster than this,
   *          and it keeps autocomplete calls off the API.
   */
  IdByUsername: new TTLCache<string, UserIdLookupResult<string | string[]>>({
    ttl: 5 * 60 * 1000,
    checkAgeOnGet: true,
  }),
};

export const LiveMongoDBCache = {
  /**
   * @purpose Tracks the change stream MongoDB connections and stores its current status.
   *          This is used to determine whether the cached data is up-to-date or not.
   * @keyedBy "StreamChangeConnected:<collectionName>".
   * @ttl     immediate; this is a live tracker of the connection statuses, not a cached value.
   */
  StreamChangeConnected: { Guilds: false, ActiveShifts: false },

  /**
   * @purpose Caches all database guild raw documents mainly for quick, synchronous settings
   *          lookups associated with command executions.
   * @keyedBy Guild Id.
   * @ttl     immediate; this is a live cache of the database state, not a cached value.
   */
  Guilds: new Collection<string, Guilds.GuildDocument>(),

  /**
   * @purpose Caches all active shifts (those with `end_timestamp` as `null`) for quick, synchronous lookups.
   * @keyedBy Shift Id.
   * @ttl     immediate; this is a live cache of the database state, not a cached value.
   */
  ActiveShifts: new MongoDBDocCollection<
    string,
    Shifts.ShiftDocument,
    Shifts.BasicHydratedShiftDocument
  >(ShiftModel as any),
};

export const AutocompletionCache = {
  /**
   * @purpose General-purpose cache for storing the results of various autocompletion queries.
   *          This is used to avoid hitting the database or external APIs too frequently,
   *          especially for repeated queries with the same input.
   *
   * @keyedBy Query string (e.g., user input).
   * @ttl     20 seconds default, since autocompletion results are expected to change frequently,
   *          and this cache is only meant to absorb bursts of repeated calls.
   */
  General: new TTLCache<string, unknown>({ ttl: 20 * 1000, checkAgeOnGet: true }),

  /**
   * @purpose Caches incident number lookups for autocomplete.
   * @keyedBy Guild Id
   * @ttl     20 seconds; absorbs repeated keystrokes during typing.
   */
  Incidents: new TTLCache<string, AggregateResults.GetIncidentNumbers[]>({
    ttl: 20 * 1000,
    checkAgeOnGet: true,
  }),

  /**
   * @purpose Caches citation number lookups for autocomplete.
   * @keyedBy Guild Id
   * @ttl     20 seconds; absorbs repeated keystrokes during typing.
   */
  Citations: new TTLCache<string, AggregateResults.GetCitationNumbers[]>({
    ttl: 20 * 1000,
    checkAgeOnGet: true,
  }),

  /**
   * @purpose Caches booking number lookups for autocomplete.
   * @keyedBy Guild Id
   * @ttl     20 seconds; absorbs repeated keystrokes during typing.
   */
  Bookings: new TTLCache<string, AggregateResults.GetBookingNumbers[]>({
    ttl: 20 * 1000,
    checkAgeOnGet: true,
  }),
};

/**
 * @purpose Caches the results of Bloxlink API calls to avoid hitting the API too frequently, especially for repeated user logins/logouts.
 * @keyedBy Discord User Id.
 * @ttl     1 day, since the Bloxlink API is rate-limited and this cache is meant to absorb bursts of repeated calls.
 */
export const BloxlinkDiscordToRobloxUsageCache = new TTLCache<string, BloxlinkUserLimitInfo>({
  ttl: millisecondsInDay,
  checkAgeOnGet: true,
});

/**
 * @purpose Caches the results of `guild.members.fetch()` calls to avoid hitting
 *          the Discord API too frequently and to respect the `RequestGuildMembers` cooldown.
 * @keyedBy Guild Id.
 * @ttl     90 seconds, since the RequestGuildMembers cooldown is 30 seconds,
 *          and this cache is meant to absorb bursts of repeated calls.
 */
export const GuildMembersCache = new TTLCache<string, Collection<string, GuildMember>>({
  ttl: GuildMembersGatewayCooldownMs * 3, // 90 seconds
  checkAgeOnGet: true,
  noUpdateTTL: true,
});

/**
 * A lightweight sliding-window tracker for recently active users.
 *
 * @purpose
 * Acts as an "activity whitelist" for the Client cache sweepers.
 * Instead of the sweepers blindly deleting all users every 15-30 minutes,
 * this tracker ensures that anyone who has triggered an event or interaction
 * within the last 30 minutes is kept in the main RAM cache.
 *
 * @prevents
 * 1. Cache-misses during multi-step interactions (e.g., chained buttons or modals).
 * 2. Unnecessary database I/O caused by the `guildMemberUpdate` event generating
 *    partial members for users who were actually just active.
 *
 * @keyedBy Discord User Id.
 * @ttl     30 minutes, since the sweepers run every 15-30 minutes.
 *          This is a sliding window, so any activity within the last 30 minutes will keep the user in the cache.
 */
export const ActiveUsersTracker = new TTLCache<string, boolean>({
  ttl: 30 * 60 * 1000,
  checkAgeOnGet: true,
});

/**
 * @purpose Caches whether a guild is currently undergoing a nickname replacement operation.
 *          This prevents multiple concurrent invocations of the same command from
 *          interfering with each other and causing unexpected behavior.
 * @keyedBy Guild Id.
 * @ttl     6 hours, since nickname replacement operations are expected to complete under this time frame,
 *          and this cache is only meant to prevent concurrent invocations.
 */
export const OngoingServerMemberNicknamesReplaceCache = new TTLCache<string, boolean>({
  ttl: hoursToMilliseconds(6),
  checkAgeOnGet: true,
});

/**
 * @purpose Caches the number of times a command has been executed by a user
 *          within the last hour, to enforce a per-user throttle limit.
 * @keyedBy User Id.
 * @ttl     1 hour, since the throttle is based on a rolling 1-hour window and
 *          is additionally verified by command execution guards.
 */
export const UserCommandExecutionsCache = new TTLCache<string, number | ThrottleTracker>({
  ttl: hoursToMilliseconds(1),
  checkAgeOnGet: true,
});

/**
 * @purpose Caches the number of times a command has been executed in a guild
 *          within the last hour, to enforce a guild-wide throttle limit.
 *
 * @keyedBy Guild Id.
 * @ttl     1 hour, since the throttle is based on a rolling 1-hour window.
 *          Additional throttling/verification is done in the command execution guards.
 */
export const GuildCommandExecutionsCache = new TTLCache<string, number | ThrottleTracker>({
  ttl: hoursToMilliseconds(1),
  checkAgeOnGet: true,
});

/**
 * @purpose Caches Discord AutoMod rules per guild so slash commands that
 *          list/check rules don't hit the Discord API on every invocation.
 *          This also accounts for concurrent invocations of the same command across multiple users,
 *          which would otherwise result in multiple API calls for the same guild.
 *
 * @keyedBy Guild Id.
 * @ttl     35 seconds, short, since rule edits should propagate to command
 *          behavior quickly; this mainly absorbs bursts of repeated calls.
 */
export const GuildAutomodRulesCache = new TTLCache<string, Collection<string, AutoModerationRule>>({
  ttl: 35 * 1000,
  checkAgeOnGet: true,
});

/**
 * @purpose Tracks the first and last occurrence of HTTP 429 responses from Discord's API.
 *          This is used to determine when to set the app/bot's status to "idle" or "online" and
 *          to update the `AppResponse.ratelimited` health endpoint flag accordingly.
 *
 * @keyedBy "http429:first" and "http429:last".
 * @ttl     1 minute, short, since we only care about recent occurrences.
 */
export const HTTP429OccurrencesTracker = new TTLCache<string, number>({
  ttl: 1 * 60 * 1000,
  checkAgeOnGet: true,
});
