// Dependencies:
// -------------

import { Types } from "mongoose";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { SuccessContainer } from "@Utilities/Classes/ExtraContainers.js";
import { SlashCommandSubcommandBuilder, channelLink, time } from "discord.js";
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
  } else if (Save && Save.member !== SelectedMember.id) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFoundFSM")
      .replyToInteract(CmdInteraction, true, false);
  } else if (!Save) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFound")
      .replyToInteract(CmdInteraction, true, false);
  }

  const DeleteResp = await Save.deleteOne();
  if (!DeleteResp.acknowledged) {
    return new ErrorEmbed()
      .useErrTemplate("DBFailedToDeleteRolesSave")
      .replyToInteract(CmdInteraction, true, false);
  }

  const RespEmbedDesc = Dedent(`
    The save with ID \`${SaveId}\` was successfully deleted. Here is a summary of the deleted save:
    - **Save For:** <@${Save.member}>
    - **Saved By:** <@${Save.saved_by}>
    - **Saved On:** ${time(Save.saved_on, "f")}
    - **Role Count:** [${Save.roles?.length}](${channelLink(CmdInteraction.channelId)})
  `);

  return new SuccessContainer()
    .setTitle("Roles Backup Deleted")
    .setDescription(RespEmbedDesc)
    .replyToInteract(CmdInteraction, false);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("delete")
    .setDescription("Removes and deletes a backup of member roles.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to remove roles backup for.")
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("save")
        .setMinLength(24)
        .setMaxLength(24)
        .setRequired(true)
        .setAutocomplete(true)
        .setDescription(
          "The save to delete. Type a date, nickname, username, or save ID to see autocomplete options."
        )
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
