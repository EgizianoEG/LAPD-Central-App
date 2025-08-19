import {
  SlashCommandSubcommandBuilder,
  ModalSubmitInteraction,
  time as FormatTime,
  MessageFlags,
} from "discord.js";

import { LeaveOfAbsenceEventLogger } from "@Utilities/Classes/UANEventLogger.js";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { differenceInHours } from "date-fns";
import { milliseconds } from "date-fns/milliseconds";

import UserActivityNoticeModel from "@Models/UserActivityNotice.js";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import ParseDuration from "parse-duration";

const MaxLeaveDuration = milliseconds({ months: 3 });
const MinLeaveDuration = milliseconds({ days: 1 });
const MaxRADuration = milliseconds({ months: 1 });
const MinRADuration = MinLeaveDuration;
const LOAEventLogger = new LeaveOfAbsenceEventLogger();

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Validates the duration provided for a request and sends an appropriate error response
 * if the duration is invalid. Returns `false` if the duration is valid.
 * @param Interaction - The interaction object.
 * @param NoticeType - The type of notice.
 * @param DurationParsed - The parsed duration value to validate.
 * @returns A promise resolving to `true` if an error response is sent due to invalid duration,
 *          or `false` if the duration is valid.
 */
export function HandleDurationValidation(
  Interaction: SlashCommandInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  NoticeType: UserActivityNotice.NoticeType,
  DurationParsed?: number
) {
  const NTShortened = NoticeType === "LeaveOfAbsence" ? "LOA" : "RA";
  const MaxDuration = NTShortened === "LOA" ? MaxLeaveDuration : MaxRADuration;
  const MinDuration = NTShortened === "LOA" ? MinLeaveDuration : MinRADuration;

  if (!DurationParsed) {
    return new ErrorEmbed()
      .useErrTemplate("UnknownDurationExp")
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (DurationParsed > MaxDuration) {
    return new ErrorEmbed()
      .useErrTemplate(`${NTShortened}DurationTooLong`)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (DurationParsed < MinDuration) {
    return new ErrorEmbed()
      .useErrTemplate(`${NTShortened}DurationTooShort`)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }
  return false;
}

/**
 * Checks if a user has recently had a Denied or Cancelled user activity notice,
 * or if a previous LOA/RA has recently ended, and responds with an appropriate error message if so.
 * @param Interaction - The interaction object containing details about the command invocation.
 * @param ContextModule - The context module for the user activity notice (either "LeaveOfAbsence" or "ReducedActivity").
 * @returns A promise that resolves to `false` if no recent Denied/Cancelled LOA/RA or recently ended LOA/RA is found,
 *          or `true` if an error message is sent due to a recent Denied/Cancelled notice or recently ended one.
 *
 * The function performs the following checks:
 * - If the user's most recent UAN request was Denied within the last 3 hours, an error message is sent.
 * - If the user's most recent UAN request was Cancelled within the last 1 hour, an error message is sent.
 * - If the user's most recent UAN has ended early or naturally within the last 1 hour, an error message is sent.
 *
 * The function uses the `UserActivityNoticeModel` to query the database for the user's most recent LOA/RA request
 * and determines the appropriate response based on the status and timestamps of the request.
 */
export async function HasRecentlyEndedDeniedCancelledUAN(
  Interaction: SlashCommandInteraction<"cached">,
  ContextModule: UserActivityNotice.NoticeType
) {
  const NTShortened = ContextModule === "LeaveOfAbsence" ? "LOA" : "RA";
  const MostRecentUANotice = await UserActivityNoticeModel.find(
    {
      user: Interaction.user.id,
      guild: Interaction.guildId,
      status: { $in: ["Approved", "Denied", "Cancelled"] },
    },
    null,
    { sort: { request_date: -1 }, limit: 1 }
  ).then((Results) => Results[0]);

  if (!MostRecentUANotice) return false;
  if (
    MostRecentUANotice.status === "Denied" &&
    differenceInHours(Interaction.createdAt, MostRecentUANotice.request_date) < 3
  ) {
    return new ErrorEmbed()
      .useErrTemplate(`${NTShortened}PreviouslyDenied`)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (
    MostRecentUANotice.status === "Cancelled" &&
    differenceInHours(
      Interaction.createdAt,
      MostRecentUANotice.review_date || MostRecentUANotice.request_date
    ) < 1
  ) {
    return new ErrorEmbed()
      .useErrTemplate(`${NTShortened}PreviouslyCancelled`)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (
    MostRecentUANotice.is_over() &&
    differenceInHours(
      Interaction.createdAt,
      MostRecentUANotice.early_end_date || MostRecentUANotice.end_date
    ) < 1
  ) {
    return new ErrorEmbed()
      .useErrTemplate(`${NTShortened}RecentlyEnded`)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

export async function EvaluatePendingOrActiveNotices(
  Interaction: SlashCommandInteraction<"cached">
): Promise<{
  loa: { active: boolean; pending: boolean };
  ra: { active: boolean; pending: boolean };
}> {
  const ActiveOrPendingNotices = await UserActivityNoticeModel.find(
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
    {
      status: 1,
      type: 1,
    }
  )
    .lean()
    .exec();

  const Statuses = {
    loa: { active: false, pending: false },
    ra: { active: false, pending: false },
  };

  for (const Notice of ActiveOrPendingNotices) {
    if (Notice.type === "LeaveOfAbsence") {
      if (Notice.status === "Pending") {
        Statuses.loa.pending = true;
      } else {
        Statuses.loa.active = true;
      }
    } else if (Notice.type === "ReducedActivity") {
      if (Notice.status === "Pending") {
        Statuses.ra.pending = true;
      } else {
        Statuses.ra.active = true;
      }
    }
  }

  return Statuses;
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const RequestReason = Interaction.options.getString("reason", true);
  const RequestDuration = Interaction.options.getString("duration", true);
  const DurationParsed = Math.round(Math.abs(ParseDuration(RequestDuration, "millisecond") ?? 0));
  if (await HandleDurationValidation(Interaction, "LeaveOfAbsence", DurationParsed)) return;
  if (await HasRecentlyEndedDeniedCancelledUAN(Interaction, "LeaveOfAbsence")) return;

  const PendingOrActiveNoticeStatuses = await EvaluatePendingOrActiveNotices(Interaction);
  if (PendingOrActiveNoticeStatuses.loa.active || PendingOrActiveNoticeStatuses.loa.pending) {
    return new ErrorEmbed()
      .useErrTemplate("LOARequestNoticeAlreadyExists")
      .replyToInteract(Interaction, true, true);
  } else if (PendingOrActiveNoticeStatuses.ra.pending) {
    return new ErrorEmbed()
      .useErrTemplate("LOARequestRANoticeIsPending")
      .replyToInteract(Interaction, true, true);
  }

  const PendingLeave = await UserActivityNoticeModel.create({
    type: "LeaveOfAbsence",
    user: Interaction.user.id,
    guild: Interaction.guildId,
    status: "Pending",
    reason: RequestReason,
    duration: DurationParsed,
    request_date: Interaction.createdAt,
  });

  const RequestMsg = await LOAEventLogger.SendRequest(Interaction, PendingLeave);
  if (RequestMsg) {
    PendingLeave.request_msg = `${RequestMsg.channelId}:${RequestMsg.id}`;
  }

  return Promise.all([
    PendingLeave.save(),
    new InfoEmbed()
      .setTitle("Leave of Absence Requested")
      .setDescription(
        "Your request for leave of absence has been forwarded to the management staff for approval. If approved within the same day, " +
          `your LOA will expire around ${FormatTime(PendingLeave.end_date, "D")} and you will be notified via DMs (if possible) whenever there is an update regarding its status.\n` +
          `-# To cancel the pending request, you may use the ${MentionCmdByName("loa manage")} command.`
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
    .setDescription("Request a leave of absence for a certain duration.")
    .addStringOption((Option) =>
      Option.setName("duration")
        .setDescription(
          "Specify the LOA duration from the approval date (e.g., '1 week'). Maximum duration is 3 months."
        )
        .setMinLength(2)
        .setMaxLength(32)
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("reason")
        .setDescription("Reason for the leave of absence request.")
        .setMinLength(5)
        .setMaxLength(312)
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
