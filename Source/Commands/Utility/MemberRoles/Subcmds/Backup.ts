// Dependencies:
// -------------

import {
  Colors,
  channelLink,
  roleMention,
  userMention,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { BaseExtraContainer } from "@Utilities/Classes/ExtraContainers.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import MSRolesModel from "@Models/MemberRoles.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const SelectedMember = CmdInteraction.options.getMember("member");
  const BackupReason = CmdInteraction.options.getString("reason");
  const MsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

  if (SelectedMember) {
    await CmdInteraction.deferReply({ flags: MsgFlags });
  } else {
    return new ErrorEmbed()
      .useErrTemplate("MemberNotFound")
      .replyToInteract(CmdInteraction, true, false);
  }

  const IsBot = SelectedMember.user.bot;
  const CurrRoles = SelectedMember.roles.cache
    .filter((Role) => Role.id !== CmdInteraction.guildId)
    .sort((R1, R2) => R2.position - R1.position)
    .map((Role) => {
      return { role_id: Role.id, name: Role.name };
    });

  const Save = await MSRolesModel.create({
    guild: CmdInteraction.guildId,
    roles: CurrRoles,
    member: SelectedMember.user.id,
    reason: BackupReason,
    nickname: SelectedMember.nickname ?? SelectedMember.user.displayName,
    username: IsBot ? SelectedMember.user.tag : SelectedMember.user.username,
    saved_by: CmdInteraction.user.id,
    saved_on: CmdInteraction.createdAt,
  });

  const RespEmbed = new BaseExtraContainer()
    .setColor(Colors.Greyple)
    .setTitle("Backup Created")
    .setDescription(
      Dedent(`
        ${userMention(SelectedMember.id)}'s currently assigned roles were successfully saved and backed up with the save ID: \`${Save.id}\`.
        - **Current Nickname:** \`${Save.nickname}\`
        - **Current Username:** \`@${Save.username}\`
        ${Save.reason ? `- **Reason for Backup:** ${Save.reason}\n` : ""}
        **Backed Up Roles ([${CurrRoles.length}](${channelLink(CmdInteraction.channelId)}))**:
        >>> ${CurrRoles.map((Role) => roleMention(Role.role_id)).join(", ")}
      `)
    );

  return CmdInteraction.editReply({ components: [RespEmbed], flags: MsgFlags });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("backup")
    .setDescription("Saves and backups currently assigned roles for a member.")
    .addUserOption((Option) =>
      Option.setName("member").setDescription("The member to backup their roles.").setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("reason")
        .setDescription("The reason for creating the backup. (Optional)")
        .setMinLength(6)
        .setMaxLength(256)
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
