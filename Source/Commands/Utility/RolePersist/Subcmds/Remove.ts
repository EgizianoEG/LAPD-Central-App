import { userMention, SlashCommandSubcommandBuilder, MessageFlags, GuildMember } from "discord.js";
import { SuccessContainer } from "@Utilities/Classes/ExtraContainers.js";
import { RolePersist } from "@Typings/Utilities/Database.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Dedent } from "@Utilities/Strings/Formatters.js";
import { Types } from "mongoose";
import RolePersistenceModel from "@Models/RolePersist.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function HandlePersistanceRolesRemoval(
  CmdInteract: SlashCommandInteraction<"cached">,
  TargetMember: GuildMember,
  DeletedRecord: RolePersist.RolePersistDocument
) {
  const HasPersistentRoles = DeletedRecord.roles.some(({ role_id }) =>
    TargetMember.roles.cache.has(role_id)
  );

  if (HasPersistentRoles) {
    const ConflictingRoleRecords = await RolePersistenceModel.find({
      guild: CmdInteract.guildId,
      user: TargetMember.user.id,
      _id: { $ne: DeletedRecord._id },
      $or: [{ expiry: { $gte: CmdInteract.createdAt } }, { expiry: null }],
      "roles.role_id": { $in: DeletedRecord.roles.map(({ role_id }) => role_id) },
    }).exec();

    if (ConflictingRoleRecords.length) {
      const RolesToRemove = DeletedRecord.roles.filter(
        ({ role_id: MainID }) =>
          TargetMember.roles.cache.has(MainID) &&
          !ConflictingRoleRecords.some(({ roles }) =>
            roles.some(({ role_id }) => MainID === role_id)
          )
      );

      if (RolesToRemove.length) {
        TargetMember.roles
          .remove(
            RolesToRemove.map(({ role_id: id }) => id),
            `Role persistence record removed by @${CmdInteract.user.username}.`
          )
          .catch(() => null);
      }
    } else {
      TargetMember.roles
        .remove(
          DeletedRecord.roles.map(({ role_id: id }) => id),
          `Role persistence record removed by @${CmdInteract.user.username}.`
        )
        .catch(() => null);
    }
  }
}

async function CmdCallback(CmdInteract: SlashCommandInteraction<"cached">) {
  const SelectedUser = CmdInteract.options.getUser("user", true);
  const RecordId = CmdInteract.options.getString("id", true).trim();
  const IsValidRecordId = Types.ObjectId.isValid(RecordId);

  if (!IsValidRecordId) {
    return new ErrorEmbed()
      .useErrTemplate("InvalidRolesSaveId")
      .setDescription(
        "The role persist record ID provided is malformed. Please ensure it's a valid 24-character hexadecimal ID."
      )
      .replyToInteract(CmdInteract, true, true);
  }

  const TargetRecord = await RolePersistenceModel.findOne({
    guild: CmdInteract.guildId,
    user: SelectedUser.id,
    _id: RecordId,
  });

  if (!TargetRecord) {
    return new ErrorEmbed()
      .useErrTemplate("RolePersistRecordNotFound")
      .replyToInteract(CmdInteract, true, true);
  }

  const DeleteResp = await TargetRecord.deleteOne();
  if (!DeleteResp.acknowledged || DeleteResp.deletedCount === 0) {
    return new ErrorEmbed()
      .useErrTemplate("DBFailedToDeleteRolesSave")
      .replyToInteract(CmdInteract, true, true);
  }

  const MemberResolved = await CmdInteract.guild.members.fetch(SelectedUser.id).catch(() => null);
  if (MemberResolved) {
    HandlePersistanceRolesRemoval(
      CmdInteract,
      MemberResolved,
      TargetRecord as unknown as RolePersist.RolePersistDocument
    ).catch(() => null);
  }

  const RespContainer = new SuccessContainer()
    .setTitle("Role Persistence Record Removed")
    .setDescription(
      Dedent(`
        The role persistence record with ID \`${TargetRecord._id}\` for ${TargetRecord.user_mention} has been successfully removed.

        **Summary of Removed Record:**
        - **Persisted Roles:** ${TargetRecord.roles_mentioned.length > 0 ? TargetRecord.roles_mentioned.join(", ") : "*None*"}
        - **Originally Saved By:** ${userMention(TargetRecord.saved_by.user_id)} (@${TargetRecord.saved_by.username})
        - **Originally Saved On:** ${TargetRecord.saved_on_timestamp}
        ${TargetRecord.expiry !== null ? `- **Original Expiry Date:** ${TargetRecord.expiration_timestamp}` : "- **No Expiration Date Set**"}
        ${TargetRecord.reason ? `- **Original Reason:** ${TargetRecord.reason}` : ""}
      `)
    );

  return CmdInteract.reply({
    components: [RespContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("remove")
    .setDescription("Removes a specific role persistence record for a person.")
    .addUserOption((Option) =>
      Option.setName("user")
        .setDescription("The person whose role persistence record will be removed.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("id")
        .setDescription("The unique ID of the role persistence record to remove.")
        .setMinLength(24)
        .setMaxLength(24)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
