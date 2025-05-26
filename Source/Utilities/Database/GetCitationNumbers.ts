import { CitationAutocompletionCache } from "@Utilities/Other/Cache.js";
import { AggregateResults } from "@Typings/Utilities/Database.js";
import CitationModel from "@Models/Citation.js";

export default async function GetAllCitationNums(
  GuildId: string,
  UseCache: boolean = false
): Promise<AggregateResults.GetCitationNumbers[]> {
  if (UseCache) {
    const Cached = CitationAutocompletionCache.get<AggregateResults.GetCitationNumbers[]>(GuildId);
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
      CitationAutocompletionCache.set(GuildId, Cits);
      return Cits;
    });
}
