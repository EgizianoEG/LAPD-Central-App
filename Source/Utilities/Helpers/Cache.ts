import { secondsInDay } from "date-fns/constants";
import { Collection } from "discord.js";
import { Guilds } from "@Typings/Utilities/Database.js";
import NodeCache from "node-cache";

const DefaultCheckPeriod = 5 * 60;
export const RobloxAPICache = {
  QueryUsernameResultsCache: new NodeCache({
    stdTTL: 60,
    useClones: false,
    checkperiod: DefaultCheckPeriod,
  }),

  IdByUsername: new NodeCache({
    stdTTL: 5 * 60,
    useClones: false,
    checkperiod: DefaultCheckPeriod,
  }),
};

export const MongoDBCache = {
  /**
   * Indicates whether a stream change connection for a cached collection
   * is connected and the data stored is up-to-date or not.
   *  @type {Map<string, Guilds.GuildDocument>}
   */
  StreamChangeConnected: { Guilds: false },
  Guilds: new Collection<string, Guilds.GuildDocument>(),
};

export const BloxlinkDiscordToRobloxUsageChache = new NodeCache({
  stdTTL: secondsInDay,
  useClones: false,
});

export const IncidentAutocompletionCache = new NodeCache({
  stdTTL: 20,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const CitationAutocompletionCache = new NodeCache({
  stdTTL: 20,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const BookingAutocompletionCache = new NodeCache({
  stdTTL: 20,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const GuildMembersCache = new NodeCache({
  stdTTL: 45,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const OngoingServerMemberNicknamesReplaceCache = new NodeCache({
  stdTTL: 6 * 60 * 60,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const UserCommandExecutionsCache = new NodeCache({
  stdTTL: 3600,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const GuildCommandExecutionsCache = new NodeCache({
  stdTTL: 3600,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const GuildAutomodRulesCache = new NodeCache({
  stdTTL: 35,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});

export const GeneralAutocompletionCache = new NodeCache({
  stdTTL: 15,
  useClones: false,
  checkperiod: DefaultCheckPeriod,
});
