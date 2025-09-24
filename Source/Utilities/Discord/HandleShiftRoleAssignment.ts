import type { Guilds } from "@Typings/Utilities/Database.js";
import { Guild, GuildMember, PermissionFlagsBits, Role } from "discord.js";
import { RiskyRolePermissions } from "@Config/Constants.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

/**
 * Handles shift role(s) assignment based on the current shift status of the user.
 * @param CurrentStatus - The current status of the shift ("on-duty", "on-break", or "off-duty").
 * @param Client - The Discord client.
 * @param GuildId - The Id of the user's guild/shift's guild.
 * @param UserId - The Id of the user whose shift status is being handled. Could be an array to handle multiple users at once.
 * @returns A promise that resolves to the updated `GuildMember` object if successful, or `void` if the operation terminates or fails.
 * @throws This function does not throw errors directly and will log them instead.
 */
export default async function HandleShiftRoleAssignment(
  CurrentStatus: "on-duty" | "on-break" | "off-duty",
  Client: DiscordClient,
  Guild: Guild | string,
  UserId: string | string[]
) {
  try {
    const TargetGuild = typeof Guild === "string" ? await Client.guilds.fetch(Guild) : Guild;

    if (!TargetGuild) return;
    const RASettings = await GetGuildSettings(TargetGuild.id).then((Settings) => {
      if (!Settings) return null;
      return Settings.shift_management.role_assignment;
    });

    if (!RASettings || (RASettings.on_duty.length === 0 && RASettings.on_break.length === 0)) {
      return;
    }

    if (Array.isArray(UserId) && UserId.length > 0) {
      return await Promise.all(
        UserId.map(async (User) => {
          const GuildMember = await TargetGuild.members.fetch(User);
          if (!GuildMember) return;
          return HandleSingleUserRoleAssignment(RASettings, GuildMember, CurrentStatus);
        })
      );
    } else if (typeof UserId === "string") {
      const GuildMember = await TargetGuild.members.fetch(UserId);
      if (!GuildMember) return;
      return await HandleSingleUserRoleAssignment(RASettings, GuildMember, CurrentStatus);
    }
  } catch (Err: unknown) {
    AppLogger.error({
      message: "Unexpected error occurred while handling shift role assignment.",
      error: Err,
      stack: (Err as Error).stack,
    });
  }
}

/**
 * Handles the role assignment for a single guild member based on their current shift status.
 * @param RASettings - The role assignment settings from the guild's shift management configuration.
 * @param GuildMember - The guild member whose roles are to be updated.
 * @param CurrentStatus - The current shift status of the member. Can be "on-duty", "on-break", or "off-duty".
 * @returns A promise that resolves to the updated `GuildMember` object if successful, or `void` if the operation fails.
 * @throws This function does not throw errors directly but may fail silently if the app lacks permissions or if the member or app member cannot be fetched.
 */
async function HandleSingleUserRoleAssignment(
  RASettings: Guilds.GuildSettings["shift_management"]["role_assignment"],
  GuildMember: GuildMember,
  CurrentStatus: "on-duty" | "on-break" | "off-duty"
): Promise<GuildMember | void> {
  const AppMember = await GuildMember.guild.members.fetchMe().catch(() => null);
  if (!GuildMember || !AppMember) return;

  const OnDutyRoles: Role[] = RASettings.on_duty
    .map((Role) => GuildMember.guild.roles.cache.get(Role))
    .filter(
      (Role): Role is Role => !!Role && HasSufficientPermissions(AppMember, GuildMember, Role)
    );

  const OnBreakRoles: Role[] = RASettings.on_break
    .map((Role) => GuildMember.guild.roles.cache.get(Role))
    .filter(
      (Role): Role is Role => !!Role && HasSufficientPermissions(AppMember, GuildMember, Role)
    );

  let ModReason: string;
  const ModifiedRoles = GuildMember.roles.cache
    .filter((Role) => ![...OnDutyRoles, ...OnBreakRoles].some((R) => R.id === Role.id))
    .map((Role) => Role);

  if (CurrentStatus === "on-duty" && OnDutyRoles.length !== 0) {
    ModifiedRoles.push(...OnDutyRoles);
    ModReason = "Member is on an active shift and on duty.";
  } else if (CurrentStatus === "on-break") {
    ModifiedRoles.push(...OnBreakRoles);
    ModReason = "Member has started a shift break.";
  } else {
    ModReason = "Member is now off duty and no longer on shift.";
  }

  if (OnBreakRoles.length === 0 && OnDutyRoles.length === 0) return;
  return GuildMember.roles.set(ModifiedRoles, ModReason);
}

/**
 * Validates whether the bot application member and target member have the necessary
 * permissions to assign a specific role to a target member within a guild.
 * @param AppMember - The client in guild performing the role assignment.
 * @param TargetMember - The target guild member to whom the role is being assigned.
 * @param TargetRole - The role being assigned.
 * @returns `true` if the app and member have the required permissions and conditions are met; otherwise, `false`.
 */
export function HasSufficientPermissions(
  AppMember: GuildMember,
  TargetMember: GuildMember,
  TargetRole?: Role | string
) {
  TargetRole =
    typeof TargetRole === "string" ? AppMember.guild.roles.cache.get(TargetRole) : TargetRole;
  if (!TargetRole || TargetRole.managed) return false;

  const AppHasRoleMgmt = AppMember.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!AppHasRoleMgmt) return false;

  const HasGreaterRoleThanTarget = AppMember.roles.highest.comparePositionTo(TargetRole) > 0;
  if (!HasGreaterRoleThanTarget) return false;

  const RoleRiskyPerms = TargetRole.permissions
    .toArray()
    .filter((Perm) => RiskyRolePermissions.includes(PermissionFlagsBits[Perm]));

  // Only return true if the role has risky permissions and the member has those permissions already.
  return RoleRiskyPerms.every((Perm) => TargetMember.permissions.has(PermissionFlagsBits[Perm]));
}
