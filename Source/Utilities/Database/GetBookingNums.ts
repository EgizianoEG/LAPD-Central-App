import { AutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { AggregateResults } from "#Typings/Utilities/Database.js";
import ArrestModel from "#Models/Arrest.js";

export default async function GetAllBookingNums(
  GuildId: string,
  UseCache: boolean = false
): Promise<AggregateResults.GetBookingNumbers[]> {
  if (UseCache) {
    const Cached = AutocompletionCache.Bookings.get(GuildId);
    if (Cached) return Cached;
  }

  return ArrestModel.aggregate<AggregateResults.GetBookingNumbers>([
    {
      $match: {
        guild: GuildId,
      },
    },
    {
      $project: {
        booking_num: 1,
        arrestee: 1,
        doa: {
          $dateToString: {
            date: "$made_on",
            format: "%B %d, %G at %H:%M",
            timezone: "America/Los_Angeles",
          },
        },
      },
    },
    {
      $project: {
        num: "$booking_num",
        autocomplete_label: {
          $concat: [
            "#",
            {
              $toString: "$booking_num",
            },
            " – ",
            "$arrestee.formatted_name",
            " – ",
            "$doa",
          ],
        },
      },
    },
  ])
    .exec()
    .then((Bookings) => {
      AutocompletionCache.Bookings.set(GuildId, Bookings);
      return Bookings;
    });
}
