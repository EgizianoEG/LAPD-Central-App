// Dependencies:
// -------------

import {
  time,
  Colors,
  userMention,
  channelLink,
  GuildMember,
  ButtonStyle,
  MessageFlags,
  ButtonBuilder,
  SectionBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageComponentInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Emojis } from "@Config/Shared.js";
import { isValidObjectId } from "mongoose";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { GetSaveDetailsContainer } from "./View.js";

import HandlePagePagination from "@Utilities/Other/HandlePagePagination.js";
import MSRolesModel from "@Models/MemberRoles.js";
import Chunks from "@Utilities/Other/SliceIntoChunks.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Returns an array of container pages containing information about the role backups for a specified user.
 * @param RoleSaves - An array of hydrated documents from the MSRolesModel schema. Each document represents a role save.
 * @param InteractDate - A `Date` that represents the date when the interaction was made. For clarifying when was this data fetched.
 * @param Member - The target/selected member.
 * @returns an array of `ContainerBuilder` objects.
 */
function GetSavePages(
  RoleSaves: InstanceType<typeof MSRolesModel>[],
  CmdInteraction: SlashCommandInteraction<"cached">,
  Member: GuildMember
): ContainerBuilder[] {
  const FormattedPages: ContainerBuilder[] = [];
  const SaveChunks = Chunks(RoleSaves, 3);

  for (const SaveChunk of SaveChunks) {
    const Data: [string, string][] = [];
    const DataContainer = new ContainerBuilder()
      .setAccentColor(Colors.Greyple)
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: `### ${userMention(Member.id)}'s Role Backups\n-# Displaying \`${RoleSaves.length}\` backups as of ${time(CmdInteraction.createdAt, "f")}`,
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));

    SaveChunk.forEach((Save) => {
      Data.push([
        Save._id.toString(),
        Dedent(`
          - **Save ID:** \`${Save.id}\`
            - **Saved By:** <@${Save.saved_by}>
            - **Saved On:** ${time(Save.saved_on, "f")}
            - **Save Role Count:** [${Save.roles.length}](${channelLink(CmdInteraction.channelId)})
        `),
      ]);
    });

    Data.forEach((DataItem, Index) => {
      DataContainer.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder({ content: DataItem[1] }))
          .setButtonAccessory(
            new ButtonBuilder()
              .setLabel(" ")
              .setEmoji(Emojis.WhiteInfo)
              .setCustomId(`mrs-view:${CmdInteraction.user.id}:${DataItem[0]}`)
              .setStyle(ButtonStyle.Secondary)
          )
      );

      if (Index !== Data.length - 1) {
        DataContainer.addSeparatorComponents(new SeparatorBuilder({ divider: true }));
      }
    });

    FormattedPages.push(DataContainer);
  }

  return FormattedPages;
}

async function HandleSaveDetailsView(DetailsInteract: MessageComponentInteraction) {
  if (!DetailsInteract.isButton() || !DetailsInteract.inCachedGuild()) return;
  const SaveId = DetailsInteract.customId.split(":")[2];
  const SaveDocument = isValidObjectId(SaveId) ? await MSRolesModel.findById(SaveId).exec() : null;

  if (!SaveDocument) {
    return new ErrorEmbed()
      .useErrTemplate("RolesSaveNotFound")
      .replyToInteract(DetailsInteract, true, false);
  }

  const SaveDetailsContainer = GetSaveDetailsContainer(SaveDocument, DetailsInteract);
  return DetailsInteract.reply({
    components: [SaveDetailsContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const SelectedMember = CmdInteraction.options.getMember("member");
  const PrivateResponse = CmdInteraction.options.getBoolean("private", false) ?? false;

  if (!SelectedMember) {
    return new ErrorEmbed()
      .useErrTemplate("MemberNotFound")
      .replyToInteract(CmdInteraction, true, false);
  }

  const Saves = await MSRolesModel.find({
    guild: CmdInteraction.guildId,
    member: SelectedMember.id,
  })
    .sort({ saved_at: "desc" })
    .exec();

  if (Saves.length === 0) {
    return new InfoEmbed()
      .useInfoTemplate("RoleSavesNotFoundFSM")
      .replyToInteract(CmdInteraction, true, false);
  } else {
    return HandlePagePagination({
      pages: GetSavePages(Saves, CmdInteraction, SelectedMember),
      interact: CmdInteraction,
      ephemeral: PrivateResponse,
      context: "Commands:MemberRoles:List",
      cv2_comp_listener: HandleSaveDetailsView,
    });
  }
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("list")
    .setDescription("Lists all saves for a member's roles.")
    .addUserOption((Option) =>
      Option.setName("member")
        .setDescription("The member to list their role saves.")
        .setRequired(true)
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setDescription("Whether to show the response only to you. Defaults to false.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
