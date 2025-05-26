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

import { format, formatDistance, isAfter } from "date-fns";
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
/**
 * Officer activity show command.
 * @param Interaction
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const InputSince = Interaction.options.getString("since");
  const PrivateResponse = Interaction.options.getBoolean("private") ?? false;
  let OfficerSelected = Interaction.options.getMember("officer");
  let SinceDate: Date | null = null;

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

  if (InputSince) {
    SinceDate = Chrono.parseDate(InputSince, Interaction.createdAt);
    if (!SinceDate && !InputSince.match(/\bago\s*$/i)) {
      SinceDate = Chrono.parseDate(`${InputSince} ago`, Interaction.createdAt);
    }

    if (!SinceDate) {
      return new ErrorEmbed()
        .useErrTemplate("UnknownDateFormat")
        .replyToInteract(Interaction, true, false);
    } else if (isAfter(SinceDate, Interaction.createdAt)) {
      return new ErrorEmbed()
        .useErrTemplate("DateInFuture")
        .replyToInteract(Interaction, true, false);
    }
  }

  await Interaction.deferReply({ flags: PrivateResponse ? MessageFlags.Ephemeral : undefined });
  const CurrServerNickname = OfficerSelected.nickname ?? OfficerSelected.user.displayName;
  const LinkedRobloxUserId = await IsLoggedIn({
    guildId: Interaction.guildId,
    user: OfficerSelected,
  });

  const [TargetRUserInfo, FieldActivityData, TargetRUserThumb, ShiftsData] = await Promise.all([
    LinkedRobloxUserId === 0 ? null : GetUserInfo(LinkedRobloxUserId),
    GetStaffFieldActivity(OfficerSelected, SinceDate),
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
      start_timestamp: SinceDate ? { $gte: SinceDate } : { $exists: true },
    }),
  ]);

  const QuotaMetYesNo = ShiftsData.quota_met ? "Yes" : "No";
  const QuotaMetText =
    typeof ShiftsData.quota_met === "boolean" ? `- Quota Met: ${QuotaMetYesNo}` : "";

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
          - Frequent Shift: \`${ShiftsData.frequent_shift_type}\`
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

  if (SinceDate) {
    ResponseEmbed.setFooter({
      text: `Showing activity since ${formatDistance(SinceDate, Interaction.createdAt, { addSuffix: true })}`,
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
      Option.setName("since")
        .setDescription(
          "A specific date, timeframe, or relative time expression to view activity since then."
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
