import { GuildMember, Role, PermissionFlagsBits, GuildFeature } from "discord.js";
import { differenceInMilliseconds } from "date-fns";
import { RiskyRolePermissions } from "@Config/Constants.js";
import RolePersistenceModel from "@Models/RolePersist.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

const OnboardingFeaturesModifiers = [
  GuildFeature.Community,
  "GUILD_ONBOARDING",
] as `${GuildFeature}`[];

/**
 * Handles role persistence for a guild member when their membership status changes.
 * Supports both onboarding completion and direct joins for guilds without onboarding.
 * @param Client - The Discord client instance.
 * @param OutdatedMember - The member's previous state.
 * @param UpdatedMember - The member's current state.
 */
export default async function OnMemberRejoinRolePersistHandler(
  Client: DiscordClient,
  OutdatedMember: GuildMember,
  UpdatedMember: GuildMember
) {
  const HasUserCompletedScreening =
    OutdatedMember.pending === true && UpdatedMember.pending === false;

  const IsOnboardingFeaturesEnabled = OnboardingFeaturesModifiers.every((Feature) =>
    UpdatedMember.guild.features.includes(Feature)
  );

  const IsMemberRecentlyJoined =
    UpdatedMember.joinedTimestamp &&
    differenceInMilliseconds(Date.now(), UpdatedMember.joinedTimestamp) < 3 * 1000;

  // Case 1: Guild has onboarding - only proceed if user just completed screening.
  if (IsOnboardingFeaturesEnabled && !HasUserCompletedScreening) {
    return;
  }

  // Case 2: Guild has no onboarding - only proceed if member recently joined and is
  // not pending and the user has not completed any screening (pending: true -> false).
  if (
    !HasUserCompletedScreening &&
    !IsOnboardingFeaturesEnabled &&
    (UpdatedMember.pending || !IsMemberRecentlyJoined)
  ) {
    return;
  }

  try {
    const AppMember = await UpdatedMember.guild.members.fetch(Client.user.id);
    if (!AppMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return;

    const ActiveRolePersistRecords = await RolePersistenceModel.find({
      guild: UpdatedMember.guild.id,
      user: UpdatedMember.id,
      $or: [{ expiry: { $gte: new Date() } }, { expiry: null }],
    })
      .sort({ saved_on: -1, expiry: -1 })
      .exec();

    if (!ActiveRolePersistRecords.length) return;
    const RolesToAssignSet = new Set<Role>(
      ActiveRolePersistRecords.map((Record) =>
        Record.roles.map((Role) => UpdatedMember.guild.roles.cache.get(Role.role_id))
      )
        .flat()
        .filter((Role): Role is Role => Role !== undefined)
    );

    if (!RolesToAssignSet.size) return;
    const RecordIdsProcessed = ActiveRolePersistRecords.map((Record) => `${Record._id.toString()}`);

    const RolesToAssign = [...RolesToAssignSet.values()].filter(
      (Role) =>
        !Role.managed &&
        !Role.permissions.any(RiskyRolePermissions) &&
        !UpdatedMember.roles.cache.has(Role.id) &&
        Role.comparePositionTo(AppMember.roles.highest) < 0
    );

    if (!RolesToAssign.length) return;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await UpdatedMember.roles.add(
      RolesToAssign,
      `Role persistence restoration, user rejoined; record${RecordIdsProcessed.length > 1 ? "s" : ""}: ${RecordIdsProcessed.join(", ")}.`
    );
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to persist roles on member update;",
      label: "Events:GuildMemberUpdate:OnMemberRejoinRolePersistHandler",
      stack: Err.stack,
      error: { ...Err },
      splat: [UpdatedMember.id, UpdatedMember.guild.id],
    });
  }
}
