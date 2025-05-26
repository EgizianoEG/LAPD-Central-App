// Dependencies:
// -------------

import {
  Role,
  Colors,
  channelLink,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Types } from "mongoose";
import { Emojis } from "@Config/Shared.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import MSRolesModel from "@Models/MemberRoles.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const SelectedMember = CmdInteraction.options.getMember("member");
  const SaveId = CmdInteraction.options.getString("save", true);
  const IsValidSaveId = Types.ObjectId.isValid(SaveId);
  const Save = IsValidSaveId
    ? await MSRolesModel.findOne({
        guild: CmdInteraction.guildId,
        _id: SaveId,
      })
    : null;

  if (!SelectedMember) {
    return new ErrorEmbed()
      .useErrTemplate("MemberNotFound")
      .replyToInteract(CmdInteraction, true, false);
  } else if (!IsValidSaveId) {
    return new ErrorEmbed()
      .useErrTemplate("InvalidRolesSaveId")
      .replyToInteract(CmdInteraction, true, false);
  } else if (!Save || (Save && Save.member !== SelectedMember.id)) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFoundFSM")
      .replyToInteract(CmdInteraction, true, false);
  }

  await CmdInteraction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          `${Emojis.LoadingGrey}\u{2000}Member Roles Load     @${SelectedMember.user.username}`
        )
        .setDescription("Assigning saved roles...")
        .setColor(Colors.Greyple),
    ],
  });

  const AssignerIsAdmin = CmdInteraction.member.permissions.has(PermissionFlagsBits.Administrator);
  const CurrentRoles = SelectedMember.roles.cache;
  const GuildRoles = CmdInteraction.guild.roles;
  const FilteredRoles = Save.roles
    .map((Role) => GuildRoles.cache.get(Role.role_id))
    .filter((Role): Role is Role => {
      if (!Role || Role.managed) return false;
      if (Role.permissions.has(PermissionFlagsBits.Administrator) && !AssignerIsAdmin) {
        return false;
      }

      return GuildRoles.comparePositions(CmdInteraction.guild.members.me!.roles.highest, Role) >= 0;
    });

  if (FilteredRoles.length === 0) {
    return new ErrorEmbed()
      .useErrTemplate("NoAssignableRolesToLoad")
      .replyToInteract(CmdInteraction, true, false);
  }

  const RolesAfter = (
    await SelectedMember.roles.add(
      FilteredRoles,
      `Loaded role backup: ${Save.id}; initiated by @${CmdInteraction.user.username}`
    )
  ).roles.cache;

  const AssignedRoles = Math.max(RolesAfter.size - CurrentRoles.size, 0);
  const UnassignedRoles = Save.roles.filter((Role) => {
    const GuildRole = GuildRoles.cache.get(Role.role_id);
    return GuildRole && !RolesAfter.has(Role.role_id);
  }).length;

  const RespEmbedDesc = Dedent(`
    - **Save Loaded:** \`${Save.id}\`
      - **Save Roles:** **[${Save.roles.length}](${channelLink(CmdInteraction.channelId)})**
      - **Assigned Roles:** **[${AssignedRoles}](${channelLink(CmdInteraction.channelId)})**
      - **Unassigned Roles:** **[${UnassignedRoles}](${channelLink(CmdInteraction.channelId)})**
  `);

  return CmdInteraction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Member Roles Reassigned     @${SelectedMember.user.username}`)
        .setDescription(RespEmbedDesc)
        .setColor(Colors.Greyple),
    ],
  }).catch(() => null);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("load")
    .setDescription(
      "Assigns previously saved roles to a member. This action doesn't delete any of the current roles."
    )
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to save their roles for.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("save")
        .setMinLength(24)
        .setMaxLength(24)
        .setRequired(true)
        .setAutocomplete(true)
        .setDescription(
          "The save to load. Type a date, nickname, username, or save ID to see autocomplete options."
        )
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
