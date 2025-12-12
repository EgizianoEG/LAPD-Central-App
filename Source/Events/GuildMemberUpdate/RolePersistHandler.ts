import TTLCache from "@isaacs/ttlcache";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import RolePersistenceModel from "@Models/RolePersist.js";
import { differenceInMilliseconds } from "date-fns";
import { RiskyRolePermissions } from "@Config/Constants.js";
import {
  Role,
  GuildMember,
  GuildFeature,
  PartialGuildMember,
  PermissionFlagsBits,
} from "discord.js";

const FileLabel = "Events:GuildMemberUpdate:OnMemberRejoinRolePersistHandler";
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
 * It works for both cases: when a user completes onboarding/screening for join/rejoin cases,
 * and when member roles are updated.
 *
 * @remarks
 * ### Logic flow:
 * 1. Recently joined members (cached, not partial):
 *    - If onboarding enabled: wait for pending: true → false transition
 *    - If no onboarding: proceed if not pending
 * 2. Old members (may be partial):
 *    - If partial: always check DB (indeterminate state)
 *    - If cached: only check DB if roles changed
 * 3. Query DB for active role persistence records
 * 4. Filter roles to assign (non-managed, non-risky, not already assigned, below bot's highest role).
 * 5. Assign roles with appropriate delays to avoid rate limits and ensure proper sequencing.
 *
 * @param _ - The Discord client instance (not used).
 * @param OutdatedMember - The member's state before the update.
 * @param UpdatedMember - The member's state after the update.
 * @returns A promise that resolves when the role persistence handling is complete.
 */
export default async function OnMemberUpdateRolePersistHandler(
  _: DiscordClient,
  OutdatedMember: PartialGuildMember | GuildMember,
  UpdatedMember: GuildMember
): Promise<void> {
  const HasCompletedScreening = OutdatedMember.pending === true && UpdatedMember.pending === false;
  const IsOnboardingEnabled = OnboardingFeaturesModifiers.every((Feature) =>
    UpdatedMember.guild.features.includes(Feature)
  );

  // Recently joined: within 60 seconds of joining.
  // Note: Recently joined members are always cached via `GUILD_MEMBER_ADD`, never partial.
  const HasRecentlyJoined = !!(
    UpdatedMember.joinedTimestamp &&
    differenceInMilliseconds(Date.now(), UpdatedMember.joinedTimestamp) <= 60_000
  );

  // Case 1:
  // Recently joined member
  if (HasRecentlyJoined) {
    if (IsOnboardingEnabled) {
      if (!HasCompletedScreening) {
        AppLogger.debug({
          message: "Skipping role persistence; recently joined but awaiting screening completion.",
          label: FileLabel,
          user_id: UpdatedMember.id,
          guild_id: UpdatedMember.guild.id,
        });
        return;
      }
    } else if (UpdatedMember.pending) {
      AppLogger.debug({
        message: "Skipping role persistence; recently joined but still pending.",
        label: FileLabel,
        user_id: UpdatedMember.id,
        guild_id: UpdatedMember.guild.id,
      });
      return;
    }
  }

  // Case 2:
  // Old member (not recently joined)
  if (!OutdatedMember.partial) {
    const HasRolesChanged =
      OutdatedMember.roles.cache.size !== UpdatedMember.roles.cache.size ||
      OutdatedMember.roles.cache.some((Role) => !UpdatedMember.roles.cache.has(Role.id)) ||
      UpdatedMember.roles.cache.some((Role) => !OutdatedMember.roles.cache.has(Role.id));

    if (!HasRolesChanged) {
      return;
    }
  }

  // Common:
  // Query database and restore roles
  const ActiveRolePersistRecords = await RolePersistenceModel.find({
    guild: UpdatedMember.guild.id,
    user: UpdatedMember.user.id,
    $or: [{ expiry: null }, { expiry: { $gt: new Date() } }],
  })
    .sort({ saved_on: -1, expiry: -1 })
    .lean()
    .exec();

  AppLogger.debug({
    message: "Processing member update for role persistence restoration;",
    active_records: ActiveRolePersistRecords.map((R) => R._id),
    label: FileLabel,
    user_id: UpdatedMember.id,
    guild_id: UpdatedMember.guild.id,
  });

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

    AppLogger.debug({
      message: "Roles identified for assignment during role persistence restoration;",
      label: FileLabel,
      user_id: UpdatedMember.user.id,
      guild_id: UpdatedMember.guild.id,
      roles_count: RolesToAssign.length,
    });

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
      label: FileLabel,
      stack: Err.stack,
      error: Err,
    });
  }
}
