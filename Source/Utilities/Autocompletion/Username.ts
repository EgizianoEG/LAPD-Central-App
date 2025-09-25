import { ApplicationCommandOptionChoiceData } from "discord.js";
import { FormatUsername } from "@Utilities/Strings/Formatters.js";
import QueryUsername from "../Roblox/QueryUsername.js";

/**
 * Autocompletes an input Roblox username.
 * @param Username The username to query and search for its user.
 * @param [ValueAsEnclosedId=false] Whether to return the value as an enclosed user id (e.g., `<123456>`).
 *                          Defaults to `false`, which returns the actual username.
 * @returns An array of suggestions.
 */
export default async function AutocompleteUsername(
  Username: string,
  ValueAsEnclosedId: boolean = false
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  Username = Username.match(/\w{3,20} \(@(\w{3,20})\)/i)?.[1] ?? Username;
  const QueryResults = await QueryUsername(Username.trim(), 25);
  if (QueryResults.length === 0) return [];

  return QueryResults.map((Result) => {
    return {
      name: FormatUsername(Result),
      value: ValueAsEnclosedId ? `<${Result.id}>` : Result.name,
    };
  });
}
