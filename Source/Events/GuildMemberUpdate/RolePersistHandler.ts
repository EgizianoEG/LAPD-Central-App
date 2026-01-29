import TTLCache from "@isaacs/ttlcache";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import RolePersistenceModel from "#Models/RolePersist.js";
import { differenceInMilliseconds } from "date-fns";
import { RiskyRolePermissions } from "#Config/Constants.js";
import {
  Role,
  GuildMember,
  GuildFeature,
  GuildMemberFlags,
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
 * 1. If onboarding is enabled (with or without screening):
 *    - Wait until BOTH screening is complete (if enabled) AND onboarding is complete.
 *    - Only proceed if either one JUST completed in this event.
 * 2. If only screening is enabled:
 *    - Wait for pending: true → false transition.
 * 3. If neither is enabled:
 *    - Proceed if not pending, or check for role changes.
 * 4. For old members (not recently joined):
 *    - If partial: always check DB (indeterminate state).
 *    - If cached: only check DB if roles changed.
 * 5. Query DB for active role persistence records.
 * 6. Filter and assign eligible roles.
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
  const IsScreeningEnabled = UpdatedMember.guild.features.includes(
    GuildFeature.MemberVerificationGateEnabled
  );

  const IsOnboardingEnabled = OnboardingFeaturesModifiers.every((Feature) =>
    UpdatedMember.guild.features.includes(Feature)
  );

  const IsScreeningComplete = !IsScreeningEnabled || UpdatedMember.pending === false;
  const HasJustCompletedScreening =
    OutdatedMember.pending === true && UpdatedMember.pending === false;

  const IsOnboardingComplete =
    !IsOnboardingEnabled || UpdatedMember.flags.has(GuildMemberFlags.CompletedOnboarding);
  const HasJustCompletedOnboarding =
    !OutdatedMember.flags?.has(GuildMemberFlags.CompletedOnboarding) &&
    UpdatedMember.flags.has(GuildMemberFlags.CompletedOnboarding);

  // Recently joined: within 1 minutes of joining.
  // Note: Recently joined members are always cached via `GUILD_MEMBER_ADD`, never partial.
  const HasRecentlyJoined = !!(
    UpdatedMember.joinedTimestamp &&
    differenceInMilliseconds(Date.now(), UpdatedMember.joinedTimestamp) <= 60_000
  );

  // Case 1:
  // Recently joined member
  if (IsOnboardingEnabled) {
    if (!IsScreeningComplete || !IsOnboardingComplete) {
      return;
    }

    const IsRelevantTransition = HasJustCompletedScreening || HasJustCompletedOnboarding;
    if (!IsRelevantTransition && !OutdatedMember.partial) {
      const HasRolesChanged =
        OutdatedMember.roles.cache.size !== UpdatedMember.roles.cache.size ||
        OutdatedMember.roles.cache.some((Role) => !UpdatedMember.roles.cache.has(Role.id)) ||
        UpdatedMember.roles.cache.some((Role) => !OutdatedMember.roles.cache.has(Role.id));

      if (!HasRolesChanged) {
        return;
      }
    }
  }
  // Case 2:
  // Only screening is enabled
  else if (IsScreeningEnabled) {
    if (UpdatedMember.pending) return;
    if (!HasJustCompletedScreening && !OutdatedMember.partial) {
      const HasRolesChanged =
        OutdatedMember.roles.cache.size !== UpdatedMember.roles.cache.size ||
        OutdatedMember.roles.cache.some((Role) => !UpdatedMember.roles.cache.has(Role.id)) ||
        UpdatedMember.roles.cache.some((Role) => !OutdatedMember.roles.cache.has(Role.id));

      if (!HasRolesChanged) {
        return;
      }
    }
  }
  // Case 3:
  // Neither onboarding nor screening is enabled
  else {
    if (UpdatedMember.pending) return;
    if (!HasRecentlyJoined && !OutdatedMember.partial) {
      const HasRolesChanged =
        OutdatedMember.roles.cache.size !== UpdatedMember.roles.cache.size ||
        OutdatedMember.roles.cache.some((Role) => !UpdatedMember.roles.cache.has(Role.id)) ||
        UpdatedMember.roles.cache.some((Role) => !OutdatedMember.roles.cache.has(Role.id));

      if (!HasRolesChanged) {
        return;
      }
    }
  }

  // Common:
  // Query database and restore roles as needed
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

    const IsJoinRelatedEvent =
      HasJustCompletedScreening || HasJustCompletedOnboarding || HasRecentlyJoined;

    const RestorationReason = IsJoinRelatedEvent
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
    if (IsJoinRelatedEvent) {
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
