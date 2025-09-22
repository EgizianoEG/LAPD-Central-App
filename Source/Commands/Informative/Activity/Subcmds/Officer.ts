// Dependencies:
// -------------
import {
  Colors,
  userMention,
  EmbedBuilder,
  MessageFlags,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { format, formatDistance, isAfter, isBefore } from "date-fns";
import { FormatUsername } from "@Utilities/Strings/Formatters.js";
import { UserHasPermsV2 } from "@Utilities/Database/UserHasPermissions.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import * as Chrono from "chrono-node";
import GetStaffFieldActivity from "@Utilities/Database/GetFieldActivity.js";
import GetMainShiftsData from "@Utilities/Database/GetShiftsData.js";
import GetUserThumbnail from "@Utilities/Roblox/GetUserThumb.js";
import GeneratePortrait from "@Utilities/ImageRendering/ThumbToPortrait.js";
import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";
import IsLoggedIn from "@Utilities/Database/IsUserLoggedIn.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Parses and validates date inputs from a slash command interaction.
 * @param ReceivedInteract - The cached slash command interaction containing date input options.
 * @returns A promise that resolves to either:
 *   - An object containing parsed `since` and `until` dates (or null if not provided).
 *   - `true` if an error occurred during parsing or validation (error response sent to user).
 */
export async function ParseDateInputs(ReceivedInteract: SlashCommandInteraction<"cached">): Promise<
  | {
      since: Date | null;
      until: Date | null;
    }
  | true
> {
  const InputSince = ReceivedInteract.options.getString("since");
  const InputUntil = ReceivedInteract.options.getString("to");
  const ParsedDates: { since: Date | null; until: Date | null } = {
    since: null,
    until: null,
  };

  ParsedDates.since = InputSince ? Chrono.parseDate(InputSince, ReceivedInteract.createdAt) : null;
  ParsedDates.until = InputUntil ? Chrono.parseDate(InputUntil, ReceivedInteract.createdAt) : null;

  if (!ParsedDates.since && !ParsedDates.until) {
    return Promise.resolve(ParsedDates);
  }

  if (!ParsedDates.since && InputSince && !InputSince.match(/\bago\s*$/i)) {
    ParsedDates.since = Chrono.parseDate(`${InputSince} ago`, ReceivedInteract.createdAt);
    if (!ParsedDates.since) {
      await new ErrorEmbed()
        .useErrTemplate("UnknownDateFormat")
        .replyToInteract(ReceivedInteract, true, false);
      return true;
    } else if (isAfter(ParsedDates.since, ReceivedInteract.createdAt)) {
      await new ErrorEmbed()
        .useErrTemplate("DateInFuture")
        .replyToInteract(ReceivedInteract, true, false);
      return true;
    }
  }

  if (!ParsedDates.until && InputUntil && !InputUntil.match(/\bago\s*$/i)) {
    ParsedDates.until = Chrono.parseDate(`${InputSince} ago`, ReceivedInteract.createdAt);
    if (!ParsedDates.until) {
      await new ErrorEmbed()
        .useErrTemplate("UnknownDateFormat")
        .replyToInteract(ReceivedInteract, true, false);
      return true;
    } else if (isAfter(ParsedDates.until, ReceivedInteract.createdAt)) {
      await new ErrorEmbed()
        .useErrTemplate("DateInFuture")
        .replyToInteract(ReceivedInteract, true, false);
      return true;
    }
  }

  if (ParsedDates.since && ParsedDates.until && isBefore(ParsedDates.until, ParsedDates.since)) {
    await new ErrorEmbed()
      .useErrTemplate("SinceUntilDatesOutOfOrder")
      .replyToInteract(ReceivedInteract, true, false);
    return true;
  }

  return Promise.resolve(ParsedDates);
}

async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ShiftTypeFilter = Interaction.options.getString("shift-type", false);
  const PrivateResponse = Interaction.options.getBoolean("private") ?? false;
  const DateFiltering = await ParseDateInputs(Interaction);
  let OfficerSelected = Interaction.options.getMember("officer");

  if (DateFiltering === true) return;
  if (OfficerSelected) {
    if (OfficerSelected.user.bot) {
      return new ErrorEmbed()
        .useErrTemplate("BotMemberSelected")
        .replyToInteract(Interaction, true);
    } else if (!(await UserHasPermsV2(OfficerSelected.id, Interaction.guildId, { staff: true }))) {
      return new ErrorEmbed()
        .useErrTemplate("AOTargetMemberMustBeStaff")
        .replyToInteract(Interaction, true);
    }
  } else {
    OfficerSelected = Interaction.member;
  }

  await Interaction.deferReply({ flags: PrivateResponse ? MessageFlags.Ephemeral : undefined });
  const CurrServerNickname = OfficerSelected.nickname ?? OfficerSelected.user.displayName;
  const LinkedRobloxUserId = await IsLoggedIn({
    guildId: Interaction.guildId,
    user: OfficerSelected,
  });

  const [TargetRUserInfo, FieldActivityData, TargetRUserThumb, ShiftsData] = await Promise.all([
    LinkedRobloxUserId === 0 ? null : GetUserInfo(LinkedRobloxUserId),
    GetStaffFieldActivity(OfficerSelected, DateFiltering.since, DateFiltering.until),
    GetUserThumbnail({
      UserIds: LinkedRobloxUserId,
      Size: "420x420",
      Format: "png",
      CropType: "bust",
    }).then(async (ImgURL) => {
      if (ImgURL.includes("placehold")) return ImgURL;
      return GeneratePortrait<false>({
        thumb_img: ImgURL,
        return_url: false,
      });
    }),
    GetMainShiftsData({
      user: OfficerSelected.id,
      guild: Interaction.guildId,
      type: ShiftTypeFilter || { $exists: true },
      start_timestamp: DateFiltering.since ? { $gte: DateFiltering.since } : { $exists: true },
      end_timestamp: DateFiltering.until ? { $lte: DateFiltering.until } : { $exists: true },
    }),
  ]);

  const QuotaMetYesNo = ShiftsData.quota_met ? "Yes" : "No";
  const QuotaMetText =
    typeof ShiftsData.quota_met === "boolean" ? `- Quota Met: ${QuotaMetYesNo}` : "";

  const FrequentShiftText = ShiftTypeFilter?.length
    ? ""
    : `- Frequent Shift: \`${ShiftsData.frequent_shift_type}\``;

  const FormattedRobloxName = TargetRUserInfo
    ? FormatUsername(TargetRUserInfo, false, true)
    : "*Not Linked*";

  const ResponseEmbed = new EmbedBuilder()
    .setTitle(`Officer Activity — @${OfficerSelected.user.username}`)
    .setColor(Colors.DarkBlue)
    .setFields(
      {
        name: "**Basic Information:**",
        value: Dedent(`
          - Officer: ${userMention(OfficerSelected.id)}
          - Linked Account: ${FormattedRobloxName}
          - Current Nickname: \`${CurrServerNickname}\`
        `),
      },
      {
        inline: true,
        name: "**Shift Statistics**",
        value: Dedent(`
          ${QuotaMetText}
          ${FrequentShiftText}
          - Shifts Completed: \`${ShiftsData.shift_count}\`
          - On-Duty Duration
            - Total: ${ShiftsData.total_onduty}
            - Avg: ${ShiftsData.avg_onduty}
        `),
      },
      {
        inline: true,
        name: "**Field Activity:**",
        value: Dedent(`
          - Arrests Made: \`${FieldActivityData.arrests_made}\`
          - Arrests Assisted: \`${FieldActivityData.arrests_assisted}\`
          - Incidents Reported: \`${FieldActivityData.incidents_reported}\`
          - Citations Issued:
            - Warnings: \`${FieldActivityData.citations_issued.warnings}\`
            - Fines: \`${FieldActivityData.citations_issued.fines}\`
        `),
      }
    );

  if (DateFiltering.since) {
    ResponseEmbed.setFooter({
      text: `Showing activity from ${formatDistance(DateFiltering.since, Interaction.createdAt, { addSuffix: true })}`,
    });
  }

  if (DateFiltering.until) {
    ResponseEmbed.setFooter({
      text: `${ResponseEmbed.data.footer?.text ?? ""} ${ResponseEmbed.data.footer?.text?.length ? "to" : "Showing activity until"} ${formatDistance(DateFiltering.until, Interaction.createdAt, { addSuffix: true })}`,
    });
  }

  if (TargetRUserThumb.includes("placehold")) {
    return Interaction.editReply({ embeds: [ResponseEmbed] });
  } else {
    const DateText = format(Interaction.createdAt, "yy-MM-dd-'T'-HH-mm");
    const RThumbAttachment = new AttachmentBuilder(TargetRUserThumb, {
      name: `official-portrait-${TargetRUserInfo?.name.toLowerCase() ?? "000"}-${DateText}.jpg`,
    });

    ResponseEmbed.setThumbnail(`attachment://${RThumbAttachment.name}`);
    return Interaction.editReply({
      embeds: [ResponseEmbed],
      files: [RThumbAttachment],
    });
  }
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandBuilder> = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("for")
    .setDescription("View general activity statistics for an officer.")
    .addUserOption((Option) =>
      Option.setName("officer")
        .setDescription(
          "The officer to inspect and show activity information for. Defaults to yourself."
        )
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("shift-type")
        .setDescription("A specific shift type to filter by.")
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("since")
        .setDescription(
          "A specific date, timeframe, or relative time expression to view activity since then."
        )
        .setMinLength(2)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("to")
        .setDescription(
          "A specific date, timeframe, or relative time expression to view activity until then."
        )
        .setMinLength(2)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setDescription("Whether to show the response only to you.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
