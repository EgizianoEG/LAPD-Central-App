// Dependencies:
// -------------

import {
  time,
  Colors,
  roleMention,
  channelLink,
  MessageFlags,
  MessageComponentInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { BaseExtraContainer } from "#Utilities/Classes/ExtraContainers.js";
import { ErrorEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import { Types } from "mongoose";
import MSRolesModel from "#Models/MemberRoles.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
export function GetSaveDetailsContainer(
  Save: InstanceType<typeof MSRolesModel>,
  CachedInteract: MessageComponentInteraction<"cached"> | SlashCommandInteraction<"cached">
) {
  const RolesValidated = Save.roles.map((Role) => {
    if (CachedInteract.guild.roles.cache.has(Role.role_id)) {
      return roleMention(Role.role_id);
    } else {
      return `${roleMention(Role.role_id)} (\`${Role.name}\`)`;
    }
  });

  const RespDescription = Dedent(`
    - **Save ID:** \`${Save.id}\`
      - **Nickname:** \`${Save.nickname}\`
      - **Username:** \`${Save.username}\`
      - **Saved By:** <@${Save.saved_by}>
      - **Saved On:** ${time(Save.saved_on, "f")}
      - **Save Reason:** \`${Save.reason ?? "N/A"}\`
      - **Backed Up Roles ([${Save.roles.length}](${channelLink(CachedInteract.channelId)})):** 
        ${RolesValidated.join(", ")}
  `);

  return new BaseExtraContainer()
    .setTitle(`Member Roles Save     <@${Save.member}>`)
    .setDescription(RespDescription)
    .setColor(Colors.Greyple);
}

async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const PrivateResponse = CmdInteraction.options.getBoolean("private", false) ?? false;
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

  return CmdInteraction.reply({
    components: [GetSaveDetailsContainer(Save, CmdInteraction)],
    flags: PrivateResponse
      ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      : MessageFlags.IsComponentsV2,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
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
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setRequired(false)
        .setDescription("Whether to show the response only to you. Defaults to false.")
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
