import NobloxJs, { UserSearchResult } from "noblox.js";
import { IsValidRobloxUsername } from "../Helpers/Validators.js";
import { RobloxAPICache } from "#Utilities/Helpers/Cache.js";
import { APIResponses } from "#Typings/External/Roblox.js";
import Axios from "axios";

/**
 * Queries Roblox for users matching the provided username keyword.
 * @param Typed - The username keyword to search for. Must be a valid Roblox username.
 * @param Limit - The maximum number of results to return. Defaults to 10.
 *                Accepted values are 10, 25, 50, or 100.
 * @returns A promise that resolves to an array of user search results.
 *          Returns an empty array if the provided username is invalid.
 */
export default async function QueryUsername(
  Typed: string,
  Limit: 10 | 25 | 50 | 100 = 10
): Promise<UserSearchResult[]> {
  if (!IsValidRobloxUsername(Typed)) return [];
  const CachedResults = RobloxAPICache.QueryUsernameResultsCache.get(`${Typed}:${Limit}`);

  if (CachedResults) return CachedResults;
  return OmniSearchUsers(Typed, Limit).catch(() =>
    NobloxJs.searchUsers(Typed, Limit, undefined as any).then((Res) => {
      RobloxAPICache.QueryUsernameResultsCache.set(`${Typed}:${Limit}`, Res);
      return Res;
    })
  );
}

async function OmniSearchUsers(
  Typed: string,
  Limit: 10 | 25 | 50 | 100 = 25,
  NextPageCursor?: string,
  AccumulatedResults: UserSearchResult[] = []
): Promise<UserSearchResult[]> {
  if (!IsValidRobloxUsername(Typed)) return [];
  const CacheKey = `${Typed}:${Limit}` as const;
  const CachedResults = RobloxAPICache.QueryUsernameResultsCache.get(CacheKey);
  if (CachedResults) return CachedResults;

  const SessionId = crypto.randomUUID();
  const Response = await Axios.get<APIResponses.OmniSearch.UserSearchResponse>(
    "https://apis.roblox.com/search-api/omni-search",
    {
      params: {
        limit: 25,
        verticalType: "user",
        searchQuery: Typed,
        sessionId: SessionId,
        pageToken: NextPageCursor,
        globalSessionId: SessionId,
      },
    }
  );

  const NewResults = Response.data.searchResults[0].contents.map((User) => ({
    id: User.contentId,
    name: User.username,
    displayName: User.displayName,
    hasVerifiedBadge: User.hasVerifiedBadge,
    previousUsernames: User.previousUsernames ?? [],
  }));

  const AllResults = AccumulatedResults.concat(NewResults);
  if (AllResults.length >= Limit || !Response.data.nextPageToken?.length) {
    const FinalResults = AllResults.slice(0, Limit);
    RobloxAPICache.QueryUsernameResultsCache.set(CacheKey, FinalResults);
    return FinalResults;
  } else {
    return OmniSearchUsers(Typed, Limit, Response.data.nextPageToken, AllResults);
  }
}
