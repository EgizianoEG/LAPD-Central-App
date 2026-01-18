import { compareDesc } from "date-fns";
import { UserActivityNotice } from "#Typings/Utilities/Database.js";
import UserActivityNoticeModel from "#Models/UserActivityNotice.js";

interface GetUANDataOptions {
  guild_id: string;
  user_id?: string;
  now?: Date | number;
  type: UserActivityNotice.NoticeType | UserActivityNotice.NoticeType[];
}

interface GetUANDataReturn {
  /* The most recent activity notice (leave of absence or reduced activity) that has ended. */
  recent_notice: UserActivityNotice.ActivityNoticeHydratedDocument | null;

  /* The currently active activity notice (leave of absence or reduced activity). */
  active_notice: UserActivityNotice.ActivityNoticeHydratedDocument | null;

  /* The currently pending activity notice (leave of absence or reduced activity). */
  pending_notice: UserActivityNotice.ActivityNoticeHydratedDocument | null;

  /* All activity notices that have been approved and ended. Sorted by [early] end dates. */
  completed_notices: UserActivityNotice.ActivityNoticeHydratedDocument[];

  /* All activity notices, including those that have been denied or cancelled or are still
   * pending, sorted by request dates from most recent to oldest.
   */
  notice_history: UserActivityNotice.ActivityNoticeHydratedDocument[];
}

/**
 * Retrieves an object representing the activity notice data for the given user.
 * This can be used for displaying statistics or managing activity notices.
 * @param Opts - The options for this function.
 * @returns An object containing categorized activity notices.
 */
export default async function GetUANData(Opts: GetUANDataOptions): Promise<GetUANDataReturn> {
  const Now = typeof Opts.now === "number" ? new Date(Opts.now) : Opts.now ? Opts.now : new Date();
  const Notices = await UserActivityNoticeModel.find({
    guild: Opts.guild_id,
    user: Opts.user_id,
    type: typeof Opts.type === "string" ? Opts.type : { $in: Opts.type },
  })
    .sort({ request_date: -1 })
    .exec();

  const ActiveOrPendingNotice = Notices.find((Notice) => Notice.is_active || Notice.is_pending);
  const PreviouslyEndedNotices = Notices.filter((Notice) => Notice.is_over(Now)).sort((a, b) =>
    compareDesc(a.early_end_date ?? a.end_date, b.early_end_date ?? b.end_date)
  );

  return {
    recent_notice: PreviouslyEndedNotices[0] || null,
    active_notice: ActiveOrPendingNotice?.status === "Approved" ? ActiveOrPendingNotice : null,
    pending_notice: ActiveOrPendingNotice?.status === "Pending" ? ActiveOrPendingNotice : null,
    completed_notices: PreviouslyEndedNotices,
    notice_history: Notices,
  };
}
