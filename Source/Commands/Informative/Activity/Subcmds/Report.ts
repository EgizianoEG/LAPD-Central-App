// Dependencies:
// -------------
import {
  SlashCommandSubcommandBuilder,
  time as FormatTime,
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import { differenceInMilliseconds, isAfter, milliseconds } from "date-fns";
import { Dedent, ListFormatter, ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { ShiftTypeExists } from "@Utilities/Database/ShiftTypeValidators.js";
import { InfoContainer } from "@Utilities/Classes/ExtraContainers.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import * as Chrono from "chrono-node";
import ShiftModel from "@Models/Shift.js";
import ParseDuration from "parse-duration";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import CreateShiftReport from "@Utilities/Other/CreateShiftReport.js";
import GetValidTargetShiftTypes from "@Utilities/Other/GetTargetShiftType.js";

// ---------------------------------------------------------------------------------------
// Command Handling:
// -----------------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const [ValidShiftTypes, TargetShiftTypes] = await GetValidTargetShiftTypes(CmdInteraction, false);
  const InputQuotaDuration = CmdInteraction.options.getString("time-requirement", false);
  const EphemeralResponse = CmdInteraction.options.getBoolean("private", false) ?? false;
  const InputShiftType = CmdInteraction.options.getString("shift-type", false);
  const IMNicknames = CmdInteraction.options.getBoolean("include-nicknames", false);
  const InputSince = CmdInteraction.options.getString("since", true);
  const RespFlags = EphemeralResponse
    ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    : MessageFlags.IsComponentsV2;

  let SinceDate: Date | null = null;
  let QuotaDur: number = 0;

  if (InputQuotaDuration) {
    const ParsedDuration = ParseDuration(InputQuotaDuration, "millisecond");
    if (ParsedDuration) {
      QuotaDur = Math.round(ParsedDuration);
    } else {
      return new ErrorEmbed()
        .useErrTemplate("UnknownDurationExp")
        .replyToInteract(CmdInteraction, true, true);
    }
  }

  if (InputSince) {
    SinceDate = Chrono.parseDate(InputSince, CmdInteraction.createdAt);
    if (!SinceDate && !InputSince.match(/\bago\s*$/i)) {
      SinceDate = Chrono.parseDate(`${InputSince} ago`, CmdInteraction.createdAt);
    }

    if (!SinceDate) {
      return new ErrorEmbed()
        .useErrTemplate("UnknownDateFormat")
        .replyToInteract(CmdInteraction, true, false);
    } else if (isAfter(SinceDate, CmdInteraction.createdAt)) {
      return new ErrorEmbed()
        .useErrTemplate("DateInFuture")
        .replyToInteract(CmdInteraction, true, false);
    } else if (
      differenceInMilliseconds(CmdInteraction.createdAt, SinceDate) + 10_000 <=
      milliseconds({ days: 1 })
    ) {
      return new ErrorEmbed()
        .useErrTemplate("NotEnoughTimePassedAR")
        .replyToInteract(CmdInteraction, true, false);
    }
  }

  if (InputShiftType) {
    if (ValidShiftTypes.length !== TargetShiftTypes.length) {
      return new ErrorEmbed()
        .useErrTemplate("MalformedShiftTypeName")
        .replyToInteract(CmdInteraction, true, false);
    } else if (ValidShiftTypes.length) {
      const HasNonexistentShiftType = await Promise.all(
        TargetShiftTypes.map(
          async (ShiftType) => !(await ShiftTypeExists(CmdInteraction.guildId, ShiftType))
        )
      );

      if (HasNonexistentShiftType.some((Exists) => Exists)) {
        return new ErrorEmbed()
          .useErrTemplate("NonexistentShiftTypeUsage")
          .replyToInteract(CmdInteraction, true, false);
      }
    }
  }

  await CmdInteraction.deferReply({
    flags: RespFlags,
  });

  const EstimatedShiftCount = await ShiftModel.countDocuments({
    guild: CmdInteraction.guild.id,
    type: ValidShiftTypes.length ? { $in: ValidShiftTypes } : { $exists: true },
    start_timestamp: SinceDate ? { $gte: SinceDate } : { $exists: true },
    end_timestamp: { $ne: null },
  });

  if (EstimatedShiftCount === 0) {
    return new InfoContainer()
      .useInfoTemplate("NoShiftsFoundReport")
      .replyToInteract(CmdInteraction, true, false);
  }

  await CmdInteraction.editReply({
    components: [new InfoContainer().useInfoTemplate("CreatingActivityReport")],
    flags: RespFlags,
  });

  const GuildSettings = await GetGuildSettings(CmdInteraction.guildId, true);
  const FetchedGuildMembers = await CmdInteraction.guild.members.fetch();
  const ServerDefaultQuota = GuildSettings?.shift_management.default_quota ?? 0;
  const ReportSpredsheetURL = await CreateShiftReport({
    guild: CmdInteraction.guild,
    after: SinceDate,
    members: FetchedGuildMembers,
    shift_type: ValidShiftTypes,
    quota_duration: QuotaDur || ServerDefaultQuota,
    include_member_nicknames: !!IMNicknames,
  });

  const ShowReportButton = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setLabel("View Activity Report")
      .setStyle(ButtonStyle.Link)
      .setURL(ReportSpredsheetURL)
  );

  const STPluralSuffix = ValidShiftTypes.length > 1 || ValidShiftTypes.length === 0 ? "s" : "";
  const ShiftTimeReqText = QuotaDur
    ? ReadableDuration(QuotaDur)
    : ServerDefaultQuota
      ? `${ReadableDuration(ServerDefaultQuota, { largest: 3 })} (Server Default)`
      : "Disabled (No Quota)";

  const ResponseContainer = new InfoContainer()
    .setTitle("Report Created")
    .setDescription(
      Dedent(`
        **The activity report has been successfully created and is ready to be viewed.**
        **Report Configuration:**
        - **Data Since:** ${SinceDate ? FormatTime(SinceDate, "F") : "Not Specified"}
        - **Shift Type${STPluralSuffix}:** ${ValidShiftTypes.length ? ListFormatter.format(ValidShiftTypes) : "All Shift Types"}
        - **Shift Time Requirement:** ${ShiftTimeReqText}
        - **Member Nicknames Included:** ${IMNicknames ? "Yes" : "No"}
        
        -# *Click the button below to view the report on Google Sheets.*
        -# *To make changes or to use interactive highlighting features, use \
        "File > Make a copy" in Google Sheets.*
      `)
    )
    .attachPromptActionRows(ShowReportButton);

  return CmdInteraction.editReply({
    components: [ResponseContainer],
    flags: RespFlags,
  }).catch(() => null);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandBuilder> = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("report")
    .setDescription("Creates a report detailing officers' activities over a specific time period.")
    .addStringOption((Option) =>
      Option.setName("since")
        .setDescription(
          "A specific date, timeframe, or relative time expression to report on activity since then."
        )
        .setMinLength(2)
        .setMaxLength(40)
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("time-requirement")
        .setDescription(
          "Minimum on-duty time per officer. If not set, falls back to the server's default quota (if any)."
        )
        .setMinLength(2)
        .setMaxLength(20)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("shift-type")
        .setDescription(
          "The shift type to be reported on. If not specified, the report will encompass all types of shifts."
        )
        .setMinLength(3)
        .setMaxLength(40)
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addBooleanOption((Option) =>
      Option.setName("include-nicknames")
        .setRequired(false)
        .setDescription(
          "Include server nicknames in the report along with the usernames. Disabled by default."
        )
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setRequired(false)
        .setDescription("Whether to send the report to you privately.")
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
