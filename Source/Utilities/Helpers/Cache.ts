import type { AutoModerationRule, GuildMember } from "discord.js";
import type { AggregateResults, Guilds, Shifts } from "@Typings/Utilities/Database.js";
import type { BloxlinkUserLimitInfo } from "@Utilities/Roblox/GetRbxIdBloxLink.js";
import type { UserIdLookupResult } from "@Utilities/Roblox/GetIdByUsername.js";
import type { ThrottleTracker } from "@Utilities/Discord/CommandExecutionGuards.js";
import type NobloxJs from "noblox.js";

import { Collection } from "discord.js";
import { millisecondsInDay } from "date-fns/constants";
import { hoursToMilliseconds } from "date-fns";

import MongoDBDocCollection from "@Utilities/Classes/MongoDBDocCollection.js";
import ShiftModel from "@Models/Shift.js";
import TTLCache from "@isaacs/ttlcache";

export const RobloxAPICache = {
  QueryUsernameResultsCache: new TTLCache<
    `${string}:${10 | 25 | 50 | 100}`,
    Awaited<ReturnType<typeof NobloxJs.searchUsers>>
  >({
    ttl: 5 * 60 * 1000,
    checkAgeOnGet: true,
  }),

  IdByUsername: new TTLCache<string, UserIdLookupResult<string | string[]>>({
    ttl: 5 * 60 * 1000,
    checkAgeOnGet: true,
  }),
};

export const MongoDBCache = {
  /**
   * Indicates whether a stream change connection for a cached collection
   * is connected and the data stored is up-to-date or not.
   *  @type {Map<string, Guilds.GuildDocument>}
   */
  StreamChangeConnected: { Guilds: false, ActiveShifts: false },
  Guilds: new Collection<string, Guilds.GuildDocument>(),
  ActiveShifts: new MongoDBDocCollection<
    string,
    Shifts.ShiftDocument,
    Shifts.HydratedShiftDocument
  >(ShiftModel),
};

export const BloxlinkDiscordToRobloxUsageChache = new TTLCache<string, BloxlinkUserLimitInfo>({
  ttl: millisecondsInDay,
  checkAgeOnGet: true,
});

export const IncidentAutocompletionCache = new TTLCache<
  string,
  AggregateResults.GetIncidentNumbers[]
>({
  ttl: 20 * 1000,
  checkAgeOnGet: true,
});

export const CitationAutocompletionCache = new TTLCache<
  string,
  AggregateResults.GetCitationNumbers[]
>({
  ttl: 20 * 1000,
  checkAgeOnGet: true,
});

export const BookingAutocompletionCache = new TTLCache<
  string,
  AggregateResults.GetBookingNumbers[]
>({
  ttl: 20 * 1000,
  checkAgeOnGet: true,
});

export const GuildMembersCache = new TTLCache<string, Collection<string, GuildMember>>({
  ttl: 45 * 1000,
  checkAgeOnGet: true,
});

export const OngoingServerMemberNicknamesReplaceCache = new TTLCache<string, boolean>({
  ttl: hoursToMilliseconds(6),
  checkAgeOnGet: true,
});

export const UserCommandExecutionsCache = new TTLCache<string, number | ThrottleTracker>({
  ttl: hoursToMilliseconds(1),
  checkAgeOnGet: true,
});

export const GuildCommandExecutionsCache = new TTLCache<string, number | ThrottleTracker>({
  ttl: hoursToMilliseconds(1),
  checkAgeOnGet: true,
});

export const GuildAutomodRulesCache = new TTLCache<string, Collection<string, AutoModerationRule>>({
  ttl: 35 * 1000,
  checkAgeOnGet: true,
});

export const GeneralAutocompletionCache = new TTLCache<string, unknown>({
  ttl: 15 * 1000,
  checkAgeOnGet: true,
});
