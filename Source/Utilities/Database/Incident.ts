/* eslint-disable sonarjs/no-duplicate-string */
import { Types } from "mongoose";
import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { AggregateResults, GuildIncidents } from "#Typings/Utilities/Database.js";
import IncidentModel from "#Models/Incident.js";

/**
 * Retrieves an incident record from the database based on the provided parameters.
 * @param GuildId - The Id of the guild to which the incident belongs.
 * @param Identifier - The incident identifier, which can be a number (`num` field), string, or a MongoDB ObjectId.
 * @returns A promise that resolves to the incident record if found, or `null` if no record matches the query.
 */
export async function GetIncident(
  GuildId: string,
  Identifier: number | string | Types.ObjectId
): Promise<GuildIncidents.IncidentRecord | null> {
  const IsValidObjectId = !!Types.ObjectId.isValid(Identifier.toString());
  const SearchField = IsValidObjectId ? "_id" : "num";

  return IncidentModel.findOne({
    guild: GuildId,
    [SearchField]: IsValidObjectId ? Identifier : Number(Identifier),
  }).lean(true);
}

/**
 * Fetches all incident numbers for a specific guild, optionally using a cache for performance.
 * @param GuildId - Specific guild Id to limit results to.
 * @param Cache - Whether to use the cache for results. If `true`, will return cached results if available.
 * @returns An array of incident autocomplete entries, each containing the incident number and a formatted label (<=100 characters each) for autocompletion.
 */
export async function GetIncidentAutocompleteEntries(
  GuildId: string,
  Cache: boolean = false
): Promise<AggregateResults.IncidentAutocompleteEntries[]> {
  if (Cache) {
    const Cached = AutocompletionCache.Incidents.get(GuildId);
    if (Cached) return Cached;
  }

  return IncidentModel.aggregate<AggregateResults.IncidentAutocompleteEntries>([
    {
      $match: {
        guild: GuildId,
      },
    },
    {
      $set: {
        reported_on: {
          $dateToString: {
            date: "$reported_on",
            timezone: "America/Los_Angeles",
            format: "%B %d, %G at %H:%M",
          },
        },
      },
    },
    {
      $project: {
        num: "$num",
        reported_on: "$reported_on",
        autocomplete_label: {
          $concat: [
            "INC-",
            { $toString: "$num" },
            " - ",
            "$type",
            " – Reported on ",
            "$reported_on",
          ],
        },
      },
    },
    {
      $sort: {
        reported_on: 1,
      },
    },
  ])
    .exec()
    .then((Incidents) => {
      AutocompletionCache.Incidents.set(GuildId, Incidents);
      return Incidents;
    });
}
