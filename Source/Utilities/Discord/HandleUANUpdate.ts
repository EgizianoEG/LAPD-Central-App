import { Guild, GuildMember, GuildMemberEditOptions, PermissionFlagsBits } from "discord.js";
import { Guilds, UserActivityNotice } from "#Typings/Utilities/Database.js";
import { HasSufficientPermissions } from "./HandleShiftRoleAssignment.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

/**
 * Updates user activity notice state (Leave of Absence or Reduced Activity) for guild members.
 * This includes assigning/removing roles and updating nicknames with the configured prefix.
 * @param UserId - The Discord user Id(s) to update.
 * @param Guild - The Discord guild (server) where the changes will occur.
 * @param TypeOfNotice - The type of activity notice ("LeaveOfAbsence" or "ReducedActivity").
 * @param IsNoticeActive - Whether to activate (true) or deactivate (false) the notice.
 * @returns A promise that resolves when all updates are complete, or undefined if no action was taken.
 * @throws This function does not throw errors directly and will log them instead.
 */
export default async function HandleUserActivityNoticeUpdate(
  UserId: string | string[],
  Guild: Guild,
  TypeOfNotice: UserActivityNotice.NoticeType,
  IsNoticeActive: boolean
) {
  try {
    const GuildSettings = await GetGuildSettings(Guild.id);
    const IsLeaveNotice = TypeOfNotice === "LeaveOfAbsence";

    if (!GuildSettings) return;
    if (Array.isArray(UserId) && UserId.length > 0) {
      return Promise.all(
        UserId.map(async (User) => {
          const GuildMember = await Guild.members.fetch(User).catch(() => null);
          if (!GuildMember) return;

          return HandleSingleMemberActivityNoticeUpdate(
            GuildSettings,
            GuildMember,
            IsLeaveNotice,
            IsNoticeActive
          );
        })
      );
    } else if (typeof UserId === "string") {
      const GuildMember = await Guild.members.fetch(UserId).catch(() => null);
      if (!GuildMember) return;

      return HandleSingleMemberActivityNoticeUpdate(
        GuildSettings,
        GuildMember,
        IsLeaveNotice,
        IsNoticeActive
      );
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Error while handling user activity notice member update.",
      stack: Err.stack,
      error: Err,
    });
  }
}

async function HandleSingleMemberActivityNoticeUpdate(
  GSettings: Guilds.GuildSettings,
  TargetMember: GuildMember,
  IsLeaveOfAbsence: boolean,
  IsNoticeActive: boolean
) {
  const AppMember = await TargetMember.guild.members.fetchMe();
  const MemberEditOptions: GuildMemberEditOptions = {};
  const NTText = IsLeaveOfAbsence ? "leave of absence" : "reduced activity";
  const [CanAssignRoles, CanChangeNicknames] = [
    AppMember.permissions.has(PermissionFlagsBits.ManageRoles, true),
    AppMember.permissions.has(PermissionFlagsBits.ManageNicknames, true),
  ];

  if (!CanAssignRoles && !CanChangeNicknames) {
    return;
  }

  const NoticeActiveRole = IsLeaveOfAbsence
    ? GSettings.leave_notices.leave_role
    : GSettings.reduced_activity.ra_role;

  const NoticeActivePrefix = IsLeaveOfAbsence
    ? GSettings.leave_notices.active_prefix
    : GSettings.reduced_activity.active_prefix;

  if (
    CanAssignRoles &&
    NoticeActiveRole &&
    HasSufficientPermissions(AppMember, TargetMember, NoticeActiveRole)
  ) {
    const NewRoles = new Set(TargetMember.roles.cache.keys());
    if (IsNoticeActive) {
      NewRoles.add(NoticeActiveRole);
    } else {
      NewRoles.delete(NoticeActiveRole);
    }

    MemberEditOptions.roles = [...NewRoles];
  }

  if (CanChangeNicknames && NoticeActivePrefix?.length && TargetMember.manageable) {
    const CurrNickname = TargetMember.nickname ?? TargetMember.displayName;
    let NewNicknameName = CurrNickname;

    if (IsNoticeActive && !CurrNickname.startsWith(NoticeActivePrefix)) {
      if (IsLeaveOfAbsence && GSettings.reduced_activity.active_prefix) {
        const RA_Prefix = GSettings.reduced_activity.active_prefix;

        // Handle the case where there is a prefix for an active reduced activity notice.
        // Leave of Absence notice takes precedence, so remove RA prefix if present.
        if (CurrNickname.startsWith(RA_Prefix) || CurrNickname.startsWith(RA_Prefix.trim())) {
          const IsTrimmedMatch = CurrNickname.startsWith(RA_Prefix.trim());
          NewNicknameName =
            NoticeActivePrefix +
            (IsTrimmedMatch
              ? CurrNickname.slice(RA_Prefix.trim().length)
              : CurrNickname.slice(RA_Prefix.length));
        }
      } else {
        NewNicknameName = `${NoticeActivePrefix}${CurrNickname}`;
      }
    } else if (
      !IsNoticeActive &&
      (CurrNickname.startsWith(NoticeActivePrefix) ||
        CurrNickname.startsWith(NoticeActivePrefix.trim()))
    ) {
      const IsTrimmedMatch = CurrNickname.startsWith(NoticeActivePrefix.trim());
      NewNicknameName = IsTrimmedMatch
        ? CurrNickname.slice(NoticeActivePrefix.trim().length)
        : CurrNickname.slice(NoticeActivePrefix.length);
    }

    if (NewNicknameName !== CurrNickname) {
      NewNicknameName = NewNicknameName.slice(0, 32);
      MemberEditOptions.nick = NewNicknameName;
    }
  }

  if (Object.keys(MemberEditOptions).length <= 0) {
    return;
  }

  MemberEditOptions.reason = IsNoticeActive
    ? `Staff member is on an active ${NTText}.`
    : `Staff member is no longer on ${NTText}.`;

  const TimeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Member edit request timed out after 1 minute.")), 60_000)
  );

  return Promise.race([TargetMember.edit(MemberEditOptions), TimeoutPromise]);
}
