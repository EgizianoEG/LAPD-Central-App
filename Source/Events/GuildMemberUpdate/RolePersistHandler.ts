import { GuildMember, Role, PermissionFlagsBits, GuildFeature } from "discord.js";
import { differenceInMilliseconds } from "date-fns";
import { RiskyRolePermissions } from "@Config/Constants.js";
import RolePersistenceModel from "@Models/RolePersist.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import TTLCache from "@isaacs/ttlcache";

const PRCooldownMultiplier = new TTLCache<
  string,
  { last_reassigned: Date; assignment_count: number; current_op: null | Promise<any> }
>({ checkAgeOnGet: true, ttl: 60_000 });

const OnboardingFeaturesModifiers = [
  GuildFeature.Community,
  "GUILD_ONBOARDING",
] as `${GuildFeature}`[];

/**
 * Handles and restores persistent roles to a guild member when their membership status changes.
 * It works for both cases: when a user completes onboarding/screening for join/rejoin cases, and when member roles are updated.
 *
 * @remarks
 * For partial OutdatedMember objects (uncached members), screening detection won't work
 * since `pending` is null. However, recently joined members are always cached via `GUILD_MEMBER_ADD` events,
 * so this only affects long-standing members whose roles are being updated — for those,
 * the handler still proceeds and restores roles if persistent records exist.
 *
 * @param _ - The Discord client instance (not used).
 * @param OutdatedMember - The member's state before the update (used to detect screening completion).
 * @param UpdatedMember - The member's state after the update (used for role assignment and guild info).
 */
export default async function OnMemberUpdateRolePersistHandler(
  _: DiscordClient,
  OutdatedMember: GuildMember,
  UpdatedMember: GuildMember
) {
  const HasUserCompletedScreening =
    OutdatedMember.pending === true && UpdatedMember.pending === false;

  const IsOnboardingFeaturesEnabled = OnboardingFeaturesModifiers.every((Feature) =>
    UpdatedMember.guild.features.includes(Feature)
  );

  const HasRecentlyJoined =
    HasUserCompletedScreening ||
    (UpdatedMember.joinedTimestamp &&
      differenceInMilliseconds(Date.now(), UpdatedMember.joinedTimestamp) <= 60 * 1000);

  // Case 1: If the guild uses onboarding features, only continue if the user has
  // just finished the screening process.
  if (IsOnboardingFeaturesEnabled && !HasUserCompletedScreening) {
    return;
  }

  // Case 2: Only continue if
  // - The member is already in the guild for enough time, has roles changed, and has persistent roles,
  // - The member has joined very recently, completed the screening if any, and is not in a pending state
  if (
    (!HasUserCompletedScreening && !IsOnboardingFeaturesEnabled && UpdatedMember.pending) ||
    (!HasRecentlyJoined &&
      OutdatedMember.roles.cache.difference(UpdatedMember.roles.cache).size === 0)
  ) {
    return;
  }

  AppLogger.debug({
    message: "Processing member update for role persistence restoration;",
    old: OutdatedMember.toJSON(),
    new: UpdatedMember.toJSON(),
    label: "Events:GuildMemberUpdate:OnMemberRejoinRolePersistHandler",
  });

  const ActiveRolePersistRecords = await RolePersistenceModel.find({
    guild: UpdatedMember.guild.id,
    user: UpdatedMember.user.id,
    $or: [{ expiry: null }, { expiry: { $gt: new Date() } }],
  })
    .sort({ saved_on: -1, expiry: -1 })
    .lean()
    .exec();

  try {
    if (!ActiveRolePersistRecords.length) return;
    const AppMember = await UpdatedMember.guild.members.fetchMe();
    if (!AppMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return;

    const RestorationReason = HasRecentlyJoined
      ? "user (re)joined"
      : "a persistent role was manually removed";

    const RolesToAssignSet = new Set<Role>(
      ActiveRolePersistRecords.flatMap((Record) =>
        Record.roles.map((Role) => UpdatedMember.guild.roles.cache.get(Role.role_id))
      ).filter((Role): Role is Role => Role !== undefined)
    );

    if (!RolesToAssignSet.size) return;
    const RecordIdsProcessed = ActiveRolePersistRecords.map((Record) => Record._id);
    const RolesToAssign = [...RolesToAssignSet.values()].filter(
      (Role) =>
        !Role.managed &&
        !Role.permissions.any(RiskyRolePermissions) &&
        !UpdatedMember.roles.cache.has(Role.id) &&
        Role.comparePositionTo(AppMember.roles.highest) < 0
    );

    if (!RolesToAssign.length) return;
    if (HasRecentlyJoined) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    } else {
      const CooldownInfo = PRCooldownMultiplier.get(UpdatedMember.id) ?? {
        current_op: null,
        assignment_count: 0,
        last_reassigned: new Date(),
      };

      const CooldownDuration = Math.min(
        CooldownInfo.assignment_count * 1000 * (2 * Math.min(Math.random(), 0.7)),
        20_000
      );

      CooldownInfo.assignment_count += 1;
      PRCooldownMultiplier.set(UpdatedMember.id, CooldownInfo);
      await new Promise((resolve) => setTimeout(resolve, CooldownDuration));
    }

    await UpdatedMember.roles.add(
      RolesToAssign,
      `Role persistence restoration; ${RestorationReason}. Record${RecordIdsProcessed.length > 1 ? "s" : ""}: ${RecordIdsProcessed.join(", ")}.`
    );
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to persist roles on member update;",
      label: "Events:GuildMemberUpdate:OnMemberRejoinRolePersistHandler",
      stack: Err.stack,
      error: Err,
    });
  }
}
