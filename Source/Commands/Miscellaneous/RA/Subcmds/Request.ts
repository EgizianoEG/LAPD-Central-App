import { SlashCommandSubcommandBuilder, time as FormatTime, MessageFlags } from "discord.js";
import { ReducedActivityEventLogger } from "@Utilities/Classes/UANEventLogger.js";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  HandleDurationValidation,
  HasRecentlyEndedDeniedCancelledUAN,
} from "@Cmds/Miscellaneous/LOA/Subcmds/Request.js";

import UserActivityNoticeModel from "@Models/UserActivityNotice.js";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import ParseDuration from "parse-duration";
const RAEventLogger = new ReducedActivityEventLogger();

// ---------------------------------------------------------------------------------------
// Command Handling:
// -----------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const ActiveOrPendingNotice = await UserActivityNoticeModel.findOne(
    {
      user: Interaction.user.id,
      guild: Interaction.guildId,
      $or: [
        { status: "Pending", review_date: null },
        {
          status: "Approved",
          early_end_date: null,
          end_date: { $gt: Interaction.createdAt },
        },
      ],
    },
    { status: 1 }
  )
    .lean()
    .exec();

  if (ActiveOrPendingNotice) {
    return new ErrorEmbed()
      .useErrTemplate("UANoticeAlreadyExists", "reduced activity")
      .replyToInteract(Interaction, true, true);
  }

  const RequestReason = Interaction.options.getString("reason", true);
  const RequestDuration = Interaction.options.getString("duration", true);
  const DurationParsed = Math.round(ParseDuration(RequestDuration, "millisecond") ?? 0);
  if (await HandleDurationValidation(Interaction, "ReducedActivity", DurationParsed)) return;
  if (await HasRecentlyEndedDeniedCancelledUAN(Interaction, "ReducedActivity")) return;

  const PendingRA = await UserActivityNoticeModel.create({
    type: "ReducedActivity",
    user: Interaction.user.id,
    guild: Interaction.guildId,
    status: "Pending",
    reason: RequestReason,
    duration: DurationParsed,
    request_date: Interaction.createdAt,
    quota_scale: Interaction.options.getInteger("quota_reduction", true) / 100,
  });

  const RequestMsg = await RAEventLogger.SendRequest(Interaction, PendingRA);
  if (RequestMsg) {
    PendingRA.request_msg = `${RequestMsg.channelId}:${RequestMsg.id}`;
  }

  return Promise.all([
    PendingRA.save(),
    new InfoEmbed()
      .setTitle("Reduced Activity Requested")
      .setDescription(
        "Your request for reduced activity has been forwarded to the management staff for approval. If approved within the same day, " +
          `your RA will expire around ${FormatTime(PendingRA.end_date, "D")} and you will be notified via DMs (if possible) whenever there is an update regarding its status.\n` +
          `-# To cancel the pending request, you may use the ${MentionCmdByName("ra manage")} command.`
      )
      .replyToInteract(Interaction, true),
  ]);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("request")
    .setDescription("Request reduced activity for a certain duration.")
    .addStringOption((Option) =>
      Option.setName("duration")
        .setDescription(
          "Specify the RA duration from the approval date (e.g., '1 week'). Maximum duration is 1 month."
        )
        .setMinLength(2)
        .setMaxLength(32)
        .setRequired(true)
    )
    .addIntegerOption((Option) =>
      Option.setName("quota_reduction")
        .setDescription("The percentage of quota reduction requested, ranging from 20% to 75%.")
        .setMinValue(20)
        .setMaxValue(75)
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("reason")
        .setDescription("Reason for the reduced activity request.")
        .setMinLength(5)
        .setMaxLength(312)
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
