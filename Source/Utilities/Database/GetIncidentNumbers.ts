/* eslint-disable sonarjs/no-duplicate-string */
import IncidentModel from "#Models/Incident.js";
import { AggregateResults } from "#Typings/Utilities/Database.js";
import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";

export default async function GetAllIncidentNums(
  GuildId: string,
  UseCache: boolean = false
): Promise<AggregateResults.GetIncidentNumbers[]> {
  if (UseCache) {
    const Cached = AutocompletionCache.Incidents.get(GuildId);
    if (Cached) return Cached;
  }

  return IncidentModel.aggregate<AggregateResults.GetIncidentNumbers>([
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
          $concat: ["INC-", "$num", " - ", "$type", " – Reported on ", "$reported_on"],
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
