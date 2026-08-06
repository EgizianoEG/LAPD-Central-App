import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { AggregateResults } from "#Typings/Utilities/Database.js";
import CitationModel from "#Models/Citation.js";

export default async function GetAllCitationNums(
  GuildId: string,
  UseCache: boolean = false
): Promise<AggregateResults.GetCitationNumbers[]> {
  if (UseCache) {
    const Cached = AutocompletionCache.Citations.get(GuildId);
    if (Cached) return Cached;
  }

  return CitationModel.aggregate<AggregateResults.GetCitationNumbers>([
    {
      $match: {
        guild: GuildId,
      },
    },
    {
      $sort: {
        issued_on: -1,
      },
    },
    {
      $project: {
        num: "$num",
        autocomplete_label: {
          $concat: [
            "#",
            { $toString: "$num" },
            " – ",
            "$nta_type",
            " ",
            "$cit_type",
            " – ",
            "$dov",
            " at ",
            "$tov",
            " ",
            "$ampm",
            " [PDT]",
          ],
        },
      },
    },
  ])
    .exec()
    .then((Cits) => {
      AutocompletionCache.Citations.set(GuildId, Cits);
      return Cits;
    });
}
