import { GuildMember, PartialGuildMember, PermissionFlagsBits } from "discord.js";
import { GenericRequestStatuses } from "@Source/Config/Constants.js";
import { UserHasPermsV2 } from "@Source/Utilities/Database/UserHasPermissions.js";
import { addHours } from "date-fns";

import AppLogger from "@Source/Utilities/Classes/AppLogger.js";
import CallsignModel from "@Source/Models/Callsign.js";
import GetGuildSettings from "@Source/Utilities/Database/GetGuildSettings.js";
const FileLabel = "Events:GuildMemberUpdate:CallsignReleaseScheduler";

/**
 * Handles the scheduling of call sign releases when a guild member's roles are updated.
 * If the member loses all staff or management roles, their active call sign (if any) is scheduled for release.
 * @param Client - The Discord client instance (not used).
 * @param OutdatedMember - The member's state before the update.
 * @param UpdatedMember - The member's state after the update.
 */
export default async function OnMemberUpdateCallsignReleaseScheduler(
  _: DiscordClient,
  OutdatedMember: GuildMember | PartialGuildMember,
  UpdatedMember: GuildMember
) {
  const UpdatedRoles = UpdatedMember.roles.cache;
  const OutdatedRoles = OutdatedMember.roles.cache;

  if (!OutdatedMember.partial && UpdatedRoles.size === OutdatedRoles.size) return;
  const GuildSettings = await GetGuildSettings(UpdatedMember.guild.id);

  if (
    !GuildSettings?.callsigns_module.release_on_inactivity ||
    (!GuildSettings?.role_perms.management.length && !GuildSettings?.role_perms.staff.length)
  ) {
    return;
  }

  const RelevantRoles = [...GuildSettings.role_perms.staff, ...GuildSettings.role_perms.management];
  const IsRoleRelatedToStaffOrManagement =
    UpdatedRoles.some((Role) => RelevantRoles.includes(Role.id)) ||
    OutdatedRoles.some((Role) => RelevantRoles.includes(Role.id));

  if (!IsRoleRelatedToStaffOrManagement) return;
  const HadStaffPerm =
    OutdatedMember.permissions.has(PermissionFlagsBits.ManageGuild, true) ||
    OutdatedRoles.some(
      (Role) =>
        GuildSettings.role_perms.staff.includes(Role.id) ||
        GuildSettings.role_perms.management.includes(Role.id)
    );

  const HasStaffPerm = await UserHasPermsV2(UpdatedMember.user.id, UpdatedMember.guild.id, {
    staff: true,
  });

  if (!HadStaffPerm && HasStaffPerm) {
    // User gained staff/management roles. Cancel scheduled call sign release, if any.
    try {
      await CallsignModel.findOneAndUpdate(
        {
          requester: UpdatedMember.id,
          guild: UpdatedMember.guild.id,
          request_status: GenericRequestStatuses.Approved,
          scheduled_release_date: { $ne: null },
          $or: [{ expiry: null }, { expiry: { $gt: new Date() } }],
        },
        {
          $set: {
            scheduled_release_date: null,
          },
        }
      ).exec();
    } catch (Err: any) {
      AppLogger.error({
        message: "Failed to cancel scheduled call sign release upon user gaining staff roles;",
        label: FileLabel,
        stack: Err.stack,
        error: Err,
      });
    }
  } else if ((HadStaffPerm || OutdatedMember.partial) && !HasStaffPerm) {
    // User lost all staff/management roles, or partial member currently lacks staff perms.
    // Schedule call sign release if they have an active call sign.
    try {
      const DateNow = new Date();
      await CallsignModel.findOneAndUpdate(
        {
          requester: UpdatedMember.id,
          guild: UpdatedMember.guild.id,
          request_status: GenericRequestStatuses.Approved,
          scheduled_release_date: null,
          $or: [{ expiry: null }, { expiry: { $gt: DateNow } }],
        },
        {
          $set: {
            scheduled_release_date: addHours(DateNow, 12),
          },
        }
      ).exec();
    } catch (Err: any) {
      AppLogger.error({
        message: "Failed to schedule call sign release upon user losing staff roles;",
        label: FileLabel,
        stack: Err.stack,
        error: Err,
      });
    }
  } else {
    // No relevant permission change detected.
    return;
  }
}
