// Dependencies:
// -------------

import {
  time,
  Colors,
  roleMention,
  channelLink,
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Types } from "mongoose";
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
  const Save = IsValidSaveId ? await MSRolesModel.findById(SaveId) : null;

  if (!SelectedMember) {
    return new ErrorEmbed()
      .useErrTemplate("MemberNotFound")
      .replyToInteract(CmdInteraction, true, false);
  } else if (!IsValidSaveId) {
    return new ErrorEmbed()
      .useErrTemplate("InvalidRolesSaveId")
      .replyToInteract(CmdInteraction, true, false);
  } else if (Save && Save.member !== SelectedMember.id) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFoundFSM")
      .replyToInteract(CmdInteraction, true, false);
  } else if (!Save) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFound")
      .replyToInteract(CmdInteraction, true, false);
  }

  const RolesValidated = Save.roles.map((Role) => {
    if (CmdInteraction.guild.roles.cache.has(Role.role_id)) {
      return roleMention(Role.role_id);
    } else {
      return `${roleMention(Role.role_id)} (\`${Role.name}\`)`;
    }
  });

  const RespEmbedDesc = Dedent(`
    - **Save ID:** \`${Save.id}\`
      - **Nickname:** \`${Save.nickname}\`
      - **Username:** \`${Save.username}\`
      - **Saved By:** <@${Save.saved_by}>
      - **Saved On:** ${time(Save.saved_on, "f")}
      - **Save Reason:** \`${Save.reason ?? "N/A"}\`
      - **Backed Up Roles ([${Save.roles.length}](${channelLink(CmdInteraction.channelId)})):** 
        ${RolesValidated.join(", ")}
  `);

  return CmdInteraction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Member Roles Save     @${SelectedMember.user.username}`)
        .setDescription(RespEmbedDesc)
        .setColor(Colors.Greyple),
    ],
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("view")
    .setDescription("Shows a specific member roles save.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to view their roles save.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("save")
        .setMinLength(24)
        .setMaxLength(24)
        .setRequired(true)
        .setAutocomplete(true)
        .setDescription(
          "The save to view. Type a date, nickname, username, or save ID to see autocomplete options."
        )
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
