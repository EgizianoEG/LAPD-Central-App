import {
  SlashCommandSubcommandBuilder,
  MessageFlags,
  roleMention,
  userMention,
  Colors,
  Role,
  time,
} from "discord.js";

import * as Chrono from "chrono-node";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import RolePersistenceModel from "@Models/RolePersist.js";
import { differenceInMilliseconds, isBefore, milliseconds } from "date-fns";
import { RiskyRolePermissions } from "@Config/Constants.js";
import { BaseExtraContainer } from "@Utilities/Classes/ExtraContainers.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Dedent } from "@Utilities/Strings/Formatters.js";

const ExtractRoleId = (RoleMention: string) => {
  const Match = RoleMention.match(/^<@&(\d{15,22})>$/);
  return Match ? Match[1] : null;
};

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function CmdCallback(CmdInteract: SlashCommandInteraction<"cached">) {
  const MsgFlags = MessageFlags.IsComponentsV2;
  const SelectedUser = CmdInteract.options.getUser("user", true);
  const PersistReason = CmdInteract.options.getString("reason");
  const PersistExpiry = CmdInteract.options.getString("expiry") || null;
  const AppMember = await CmdInteract.guild.members.fetch(CmdInteract.client.user.id);
  let RolesProvided = CmdInteract.options.getString("roles", true).trim().split(",");
  let ExpiryDate: Date | null = null;

  if (!CmdInteract.member.permissions.has("ManageRoles")) {
    return new ErrorEmbed()
      .useErrTemplate("MemberMissingPermission", "`Manage Roles`")
      .replyToInteract(CmdInteract, true);
  }

  if (PersistExpiry) {
    ExpiryDate = Chrono.parseDate(PersistExpiry, CmdInteract.createdAt, {
      forwardDate: true,
    });

    if (!ExpiryDate) {
      ExpiryDate = Chrono.parseDate(`${PersistExpiry} from now`, CmdInteract.createdAt, {
        forwardDate: true,
      });

      if (!ExpiryDate) {
        return new ErrorEmbed()
          .useErrTemplate("UnknownDateFormat")
          .replyToInteract(CmdInteract, true);
      }
    } else if (isBefore(ExpiryDate, CmdInteract.createdAt)) {
      return new ErrorEmbed().useErrTemplate("DateInPast").replyToInteract(CmdInteract, true);
    } else if (
      differenceInMilliseconds(ExpiryDate, CmdInteract.createdAt) < milliseconds({ hours: 3 })
    ) {
      return new ErrorEmbed()
        .useErrTemplate("RolePersistExpiryTooSoon")
        .replyToInteract(CmdInteract, true);
    }
  }

  RolesProvided = RolesProvided.map((RMention) => ExtractRoleId(RMention.trim())).filter(
    (RoleId): RoleId is string => {
      return RoleId !== null && CmdInteract.guild.roles.cache.has(RoleId);
    }
  );

  const PersistableRolesResolved: Role[] = [];
  const RolesProvidedResolved = RolesProvided.map((RoleId) =>
    CmdInteract.guild.roles.cache.get(RoleId)
  );

  if (!RolesProvided.length) {
    return new ErrorEmbed()
      .useErrTemplate("RolePersistNoValidRolesProvided")
      .replyToInteract(CmdInteract, true);
  }

  RolesProvidedResolved.forEach((Role) => {
    if (!Role) return;
    const IsRoleManaged = Role.managed;
    const IsRoleHigherThanApp = Role.comparePositionTo(AppMember.roles.highest) > 0;
    const RoleHasRiskyPermissions = Role.permissions.any(RiskyRolePermissions);
    if (!IsRoleManaged && !IsRoleHigherThanApp && !RoleHasRiskyPermissions) {
      PersistableRolesResolved.push(Role);
    }
  });

  if (!PersistableRolesResolved.length) {
    return new ErrorEmbed()
      .useErrTemplate("RolePersistCannotPersistProvidedRoles")
      .replyToInteract(CmdInteract, true, false);
  } else if (PersistableRolesResolved.length !== RolesProvidedResolved.length) {
    return new ErrorEmbed()
      .useErrTemplate("RolePersistSomeRolesNotPersistable")
      .replyToInteract(CmdInteract, true, false);
  }

  await CmdInteract.deferReply();
  const CreatedRecord = await RolePersistenceModel.create({
    guild: CmdInteract.guildId,
    user: SelectedUser.id,
    roles: PersistableRolesResolved.map((Role) => ({ role_id: Role.id, name: Role.name })),
    expiry: ExpiryDate,
    reason: PersistReason,
    saved_on: CmdInteract.createdAt,
    saved_by: {
      user_id: CmdInteract.user.id,
      username: CmdInteract.user.username,
    },
  });

  const TargetMember = await CmdInteract.guild.members.fetch(SelectedUser.id).catch(() => null);
  if (TargetMember) {
    const RoleIdsToAdd = PersistableRolesResolved.map((Role) => Role.id).filter(
      (RoleId) => !TargetMember.roles.cache.has(RoleId)
    );

    if (RoleIdsToAdd.length) {
      TargetMember.roles
        .add(
          RoleIdsToAdd,
          `Role persistence added by @${CmdInteract.user.username} (${CmdInteract.user.id}); ID: ${CreatedRecord.id}.`
        )
        .catch(() => null);
    }
  }

  const PersistUntilText = CreatedRecord.expiry
    ? `until ${time(CreatedRecord.expiry, "f")}`
    : "indefinitely";

  const RespContainer = new BaseExtraContainer()
    .setColor(Colors.Greyple)
    .setTitle("Role Persist Added")
    .setDescription(
      Dedent(`
        Successfully added role persistence for ${userMention(SelectedUser.id)}.
        The specified roles will be persisted ${PersistUntilText} and automatically restored if the member rejoins. \
        To remove this persistence, use ${MentionCmdByName("role-persist remove")} with ID \`${CreatedRecord.id}\`.
        ${CreatedRecord.reason ? `\n**Reason:** ${CreatedRecord.reason}` : ""}
        **Persisted Roles (${PersistableRolesResolved.length}):**
        >>> ${PersistableRolesResolved.map((Role) => roleMention(Role.id)).join(", ")}
      `)
    );

  return CmdInteract.editReply({ components: [RespContainer], flags: MsgFlags });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("add")
    .setDescription("Persists specified roles for a person, reapplying them upon rejoin.")
    .addUserOption((Option) =>
      Option.setName("user")
        .setDescription("The person for whom to persist roles.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("roles")
        .setDescription("Comma-separated list of role mentions to persist (e.g., @Role1, @Role2).")
        .setRequired(true)
        .setMinLength(18)
    )
    .addStringOption((Option) =>
      Option.setName("expiry")
        .setDescription(
          "Optional: Duration (e.g., '30 days') or date for expiry. Leave blank for indefinite."
        )
        .setAutocomplete(true)
        .setMinLength(2)
        .setMaxLength(40)
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("reason")
        .setDescription("Optional: The reason for persisting these roles.")
        .setMinLength(6)
        .setMaxLength(256)
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
