import { EmbedBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import { ListFormatter, ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Shifts } from "@Typings/Utilities/Database.js";

import GetValidTargetShiftTypes from "@Utilities/Other/GetTargetShiftType.js";
import HandlePagePagination from "@Utilities/Other/HandlePagePagination.js";
import ShiftModel from "@Models/Shift.js";
import Chunks from "@Utilities/Other/SliceIntoChunks.js";
import Util from "util";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Returns a formatted body text/description for one page.
 * @param PUDurations - Paginated user durations. An array of user Ids and their total shift durations in milliseconds.
 * @param RSIndex - The index of which the ranking should be started from; defaults to `0`.
 * @returns
 */
function FormatPageText(PUDurations: [string, number][], RSIndex: number = 0) {
  PUDurations = PUDurations || [];
  return Array.from(PUDurations, ([UserId, TotalDuration]) => {
    return `${++RSIndex}. <@${UserId}> \u{1680} ${ReadableDuration(TotalDuration)}`;
  }).join("\n");
}

/**
 * Builds the leaderboard pages for the given paginated shift durations.
 * @param Interaction - A cached user interaction to retrieve both guild name and icon url from.
 * @param PaginatedDurations - Paginated user durations; chunks of 10 entries or less.
 * @param TargetShiftTypes - The shift types that its leaderboard requested for; an empty array will be considered as all shift types.
 * @returns
 */
function BuildLeaderboardPages(
  Interaction: SlashCommandInteraction<"cached">,
  PaginatedDurations: [string, number][][],
  TargetShiftTypes: string[]
) {
  const LeaderboardPages: EmbedBuilder[] = [];
  const FooterText = Util.format(
    "Showing leaderboard for %s duty shift type%s.",
    TargetShiftTypes.length ? ListFormatter.format(TargetShiftTypes) : "all",
    TargetShiftTypes.length === 1 ? "" : "s"
  );

  for (const [PageIndex, PageData] of PaginatedDurations.entries()) {
    const PageEmbed = new InfoEmbed()
      .setThumbnail(null)
      .setTitle("Shift Leaderboard")
      .setDescription(FormatPageText(PageData, PageIndex * 10))
      .setFooter({ text: FooterText })
      .setAuthor({
        name: Interaction.guild.name,
        iconURL: Interaction.guild.iconURL({ size: 64 }) ?? undefined,
      });

    LeaderboardPages.push(PageEmbed);
  }

  return LeaderboardPages;
}

/**
 * Get the paginated durations for the given ShiftsData.
 * @param ShiftsData - An array of shift documents.
 * @returns Array of sorted and paginated durations ready to be formatted as text.
 * Where the first item of the array is the Discord user id and the second is the total on duty duration.
 */
function GetPaginatedDurations(ShiftsData: Shifts.HydratedShiftDocument[]) {
  const UserGroupedDocs = Object.groupBy(ShiftsData, (Doc) => Doc.user);
  const MappedData = new Map<string, number>();

  for (const [User, Shifts] of Object.entries(UserGroupedDocs)) {
    if (!Shifts) continue;
    MappedData.set(
      User,
      Shifts.reduce((OnDutySum, CurrDoc) => {
        OnDutySum += CurrDoc.durations.on_duty;
        return OnDutySum;
      }, 0)
    );
  }

  return Chunks(
    [...MappedData.entries()].sort((a, b) => b[1] - a[1]),
    10
  );
}

async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const [ValidShiftTypes, TargetShiftTypes] = await GetValidTargetShiftTypes(Interaction, false);
  if (TargetShiftTypes.length && !ValidShiftTypes.length) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedShiftTypeName")
      .replyToInteract(Interaction, true, false);
  }

  const PaginatedData = await ShiftModel.find({
    type: ValidShiftTypes?.length ? { $in: ValidShiftTypes } : { $type: "string" },
    guild: Interaction.guildId,
    end_timestamp: { $ne: null },
  }).then((Shifts) => {
    if (Shifts.length === 0) return [];
    return GetPaginatedDurations(Shifts);
  });

  if (PaginatedData.length === 0) {
    const ReplyEmbed = new InfoEmbed().useInfoTemplate("NoShiftsFoundLeaderboard");
    if (ValidShiftTypes.length) {
      const PluralSTT = ValidShiftTypes.length === 1 ? "type" : "types";
      const ShiftTypeText =
        ValidShiftTypes.length > 1
          ? ListFormatter.format(ValidShiftTypes.map((STN) => `\`${STN}\``))
          : `\`${ValidShiftTypes[0]}\``;

      ReplyEmbed.setDescription(
        `There were no shift records with of the ${ShiftTypeText} ${PluralSTT} to display a leaderboard for.`
      );
    }

    return ReplyEmbed.replyToInteract(Interaction, true);
  }

  const BuiltPages = BuildLeaderboardPages(Interaction, PaginatedData, ValidShiftTypes);
  return HandlePagePagination({
    context: "Commands:Miscellaneous:Duty:Leaderboard",
    pages: BuiltPages,
    interact: Interaction,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("leaderboard")
    .setDescription("Lists all recognized members' duty shift durations.")
    .addStringOption((Option) =>
      Option.setName("type")
        .setDescription("The type of duty shift to show leaderboard for.")
        .setMinLength(3)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
