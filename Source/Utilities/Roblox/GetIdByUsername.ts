import { APIResponses } from "@Typings/External/Roblox.js";
import { RobloxAPICache } from "../Helpers/Cache.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Axios from "axios";

export type UserIdLookupResult<Input> = Input extends string[]
  ? [number, string, boolean][]
  : [number, string, boolean];

/**
 * Primarily retrieves the Roblox user Id(s) of the given username(s).
 * @param Usernames - The Roblox username(s) to get the Id(s) for. Can be a string or an array of strings.
 * @param ExcludeBanned - Whether to exclude banned users from the response and results. `false` by default.
 * @return An array of tuples or a single tuple (`[string, number, boolean]`), where each tuple contains the user ID, the exact found username, and a boolean indicating whether the user was found.
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

  if (RobloxAPICache.IdByUsername.has(Stringified)) {
    return RobloxAPICache.IdByUsername.get(Stringified) as UserIdLookupResult<Input>;
  }

  try {
    const Resp = await Axios.post<APIResponses.Users.MultiGetByNameResponse>(
      "https://users.roblox.com/v1/usernames/users",
      {
        usernames: RequestArray,
        excludeBannedUsers: ExcludeBanned,
      },
      {
        timeout: 8_000,
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
    AppLogger.error({
      label: "Utils:Roblox:GetIdFromUsername",
      stack: Err.stack,
      message: Err.message,
      details: { ...Err },
    });

    return (Array.isArray(Usernames) ? [] : [0, "", false]) as any;
  }
}
