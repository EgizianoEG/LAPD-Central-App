import { IsValidRobloxUsername } from "../Helpers/Validators.js";
import { RobloxAPICache } from "../Helpers/Cache.js";
import { APIResponses } from "@Typings/External/Roblox.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Axios from "axios";

export type UserIdLookupResult<Input> = Input extends string[]
  ? [number, string, boolean][]
  : [number, string, boolean];

/**
 * Fallback method to get a user Id by using profile URL redirects.
 * @param Username - The Roblox username to get the Id for.
 * @returns A tuple containing the user Id, username, and success status.
 */
async function GetIdByProfileRedirect(Username: string): Promise<[number, string, boolean]> {
  try {
    const Response = await Axios.get(
      `https://www.roblox.com/users/profile?username=${encodeURIComponent(Username)}`,
      {
        validateStatus: (status) => status === 302 || status === 301,
        maxRedirects: 0,
        timeout: 8000,
      }
    );

    const LocationHeader = Response.headers.location as string | undefined;
    if (!LocationHeader) {
      return [0, "", false];
    }

    // Extract user Id from the redirect URL
    // Expected format: https://www.roblox.com/users/{userId}/profile
    const UrlParts = LocationHeader.split("/");
    const UserIdIndex = UrlParts.indexOf("users") + 1;

    if (UserIdIndex === 0 || UserIdIndex >= UrlParts.length) {
      return [0, "", false];
    }

    const UserId = Number.parseInt(UrlParts[UserIdIndex], 10);
    if (Number.isNaN(UserId) || UserId <= 0) {
      return [0, "", false];
    }

    // We don't have the exact username from this method, so we'll use the input.
    return [UserId, Username, true];
  } catch (Err: any) {
    AppLogger.error({
      label: "Utils:Roblox:GetIdByProfileRedirect",
      stack: Err.stack,
      error: Err,
    });

    return [0, "", false];
  }
}

/**
 * Primarily retrieves the Roblox user Id(s) of the given username(s).
 * @param Usernames - The Roblox username(s) to get the Id(s) for. Can be a string or an array of strings.
 * @param ExcludeBanned - Whether to exclude banned users from the response and results. `false` by default.
 * @return An array of tuples or a single tuple (`[number, string, boolean]`), where each tuple contains the user Id, the exact found username, and a boolean indicating whether the user was found.
 *
 * @notice The returned tuple(s) value can be `[0, "", false]` indicating that the user was not found.
 * This can be a result of: input username wasn't found, the user is banned (optional parameter), or the HTTP request returned an error.
 *
 * @example
 * // Get the user Id of a single username.
 * // Expected result: `[1, "Roblox", true]`
 * const [ UserId, Name, IsFound ] = await GetIdByUsername("ROBLOX");
 *
 * // Get the Ids of multiple usernames.
 * // Expected result: [[6974173, "RobloxDev", true], [156, "BuilderMan", true]]
 * const Results = await GetIdByUsername(["robloxdev", "builderman"]);
 *
 * // Exclude banned users from the results.
 * // Expected result: [[0, "", false], [156, "builderman", true], [0, "", false]]
 * const Results = await GetIdByUsername(["Admin", "BuilderMan", "Gamer3D"], true);
 */
export default async function GetIdByUsername<Input extends string | string[]>(
  Usernames: Input,
  ExcludeBanned: boolean = true
): Promise<UserIdLookupResult<Input>> {
  const RequestArray: string[] = Array.isArray(Usernames) ? Usernames : [Usernames];
  const Stringified: string = RequestArray.toString();
  const LogLabel = "Utils:Roblox:GetIdFromUsername";

  if (RobloxAPICache.IdByUsername.has(Stringified)) {
    return RobloxAPICache.IdByUsername.get(Stringified) as UserIdLookupResult<Input>;
  }

  if (RequestArray.every((Username) => IsValidRobloxUsername(Username) === false)) {
    return (
      Array.isArray(Usernames)
        ? RequestArray.map((Username) => [0, Username, false] as const)
        : [0, RequestArray[0], false]
    ) as UserIdLookupResult<Input>;
  }

  try {
    const Resp = await Axios.post<APIResponses.Users.MultiGetByNameResponse>(
      "https://users.roblox.com/v1/usernames/users",
      {
        usernames: RequestArray,
        excludeBannedUsers: ExcludeBanned,
      },
      {
        timeout: 8000,
      }
    );

    const Results = RequestArray.map((Username) => {
      return Resp.data.data.find((UserObject) => UserObject.requestedUsername === Username) ?? null;
    }).map((UserObject) => {
      if (!UserObject) return [0, "", false] as const;
      return [UserObject.id, UserObject.name, true] as const;
    });

    const FinalResults = Array.isArray(Usernames) ? Results : Results[0];
    RobloxAPICache.IdByUsername.set(Stringified, FinalResults as UserIdLookupResult<Input>);

    return FinalResults as UserIdLookupResult<Input>;
  } catch (Err: any) {
    // Fallback approach: try using profile redirect for each username:
    AppLogger.error({
      label: LogLabel,
      message: "Primary API request failed, initiating fallback method using profile redirects.",
      stack: Err.stack,
      error: Err,
    });

    try {
      const FallbackResults = await Promise.all(
        RequestArray.map(async (Username) => {
          return GetIdByProfileRedirect(Username);
        })
      );

      const FinalResults = Array.isArray(Usernames) ? FallbackResults : FallbackResults[0];
      const HasSuccessfulResults = Array.isArray(Usernames)
        ? FallbackResults.some(([, , success]) => success)
        : FallbackResults[0][2];

      if (HasSuccessfulResults) {
        RobloxAPICache.IdByUsername.set(Stringified, FinalResults as UserIdLookupResult<Input>);
      }

      return FinalResults as UserIdLookupResult<Input>;
    } catch (FallbackErr: any) {
      AppLogger.error({
        message: "Fallback method also failed.",
        stack: FallbackErr.stack,
        error: FallbackErr,
        label: LogLabel,
      });

      return (Array.isArray(Usernames) ? [] : [0, "", false]) as any;
    }
  }
}
