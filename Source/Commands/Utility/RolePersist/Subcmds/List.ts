import {
  time,
  Colors,
  RoleManager,
  userMention,
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
import { BaseExtraContainer } from "@Utilities/Classes/ExtraContainers.js";
import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";

import HandlePagePagination from "@Utilities/Discord/HandlePagePagination.js";
import RolePersistenceModel from "@Models/RolePersist.js";
import Chunks from "@Utilities/Helpers/SliceIntoChunks.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Returns an array of container pages containing information about the role persistence records.
 * @param Records - An array of hydrated documents from the RolePersistenceModel schema.
 * @param CmdInteraction - The slash command interaction.
 * @param SelectedUser - The target user if specified, null for all records.
 * @returns an array of `ContainerBuilder` objects.
 */
function GetRecordPages(
  Records: InstanceType<typeof RolePersistenceModel>[],
  CmdInteraction: SlashCommandInteraction<"cached">,
  SelectedUser?: { id: string; username: string } | null
): ContainerBuilder[] {
  const FormattedPages: ContainerBuilder[] = [];
  const RecordChunks = Chunks(Records, 3);

  for (const RecordChunk of RecordChunks) {
    const Data: [string, string][] = [];
    const DataContainer = new ContainerBuilder()
      .setAccentColor(Colors.Greyple)
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: SelectedUser
            ? `### ${userMention(SelectedUser.id)}'s Role Persistence Records\n-# Displaying \`${Records.length}\` records as of ${time(CmdInteraction.createdAt, "f")}`
            : `### All Role Persistence Records\n-# Displaying \`${Records.length}\` records as of ${time(CmdInteraction.createdAt, "f")}`,
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 2 }));

    RecordChunk.forEach((Record) => {
      const ExpiryText = Record.expiry
        ? `**Expires:** ${time(Record.expiry, "f")}`
        : "**Expires:** Never";

      const PersistedRolesText =
        Record.roles.length <= 2
          ? Record.roles_mentioned.join(" and ")
          : `${Record.roles_mentioned.slice(0, 2).join(", ")} and ${Record.roles.length - 2} more...`;

      const RecordHeader = SelectedUser
        ? `**ID:** \`${Record.id}\``
        : `**ID:** \`${Record.id}\`; **user:** ${Record.user_mention}`;

      Data.push([
        Record._id.toString(),
        Dedent(`
          - ${RecordHeader}
            - **Created By:** <@${Record.saved_by.user_id}>
            - **Created On:** ${Record.saved_on_timestamp}
            - ${ExpiryText}
            - **Persisted Roles:** ${PersistedRolesText}
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
              .setCustomId(`rp-view:${CmdInteraction.user.id}:${DataItem[0]}`)
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

/**
 * Generates a `ContainerBuilder` instance displaying the details of a role persistence record.
 * @param Record - An instance of `RolePersistenceModel` containing the data for the role persistence record.
 * @returns A `ContainerBuilder` instance.
 */
function GetRecordDetailsContainer(
  Record: InstanceType<typeof RolePersistenceModel>,
  GRManager: RoleManager
): ContainerBuilder {
  const ReasonText = Record.reason ? `**Reason:** ${Record.reason}` : "**Reason:** *None provided*";
  const ExpiryText = Record.expiry
    ? `**Expires:** ${Record.expiration_timestamp}`
    : "**Expires:** Never";

  const RolesMentioned = Record.roles
    .map((Role) => {
      const Resolved = GRManager.cache.get(Role.role_id);
      return Resolved ? `<@&${Resolved.id}>` : `<@&${Role.role_id}> (${Role.name})`;
    })
    .sort((a, b) => {
      const IsDeletedA = a.includes("(");
      const IsDeletedB = b.includes("(");
      if (IsDeletedA !== IsDeletedB) {
        return IsDeletedA ? 1 : -1;
      }
      return a.localeCompare(b);
    });

  const RolesText =
    RolesMentioned.length > 0 ? Record.roles_mentioned.join(", ") : "*No roles persisted*";

  const RespDescription = Dedent(`
      - **Record ID:** \`${Record.id}\`
        - **User:** ${Record.user_mention}
        - **Created By:** <@${Record.saved_by.user_id}> (@${Record.saved_by.username})
        - **Created On:** ${Record.saved_on_timestamp}
        - ${ExpiryText}
        - ${ReasonText}
        - **Persisted Roles (${Record.roles.length}):**
          >>> ${RolesText}
    `);

  return new BaseExtraContainer()
    .setTitle(`Role Persistence Record     ${Record.user_mention}`)
    .setDescription(RespDescription)
    .setColor(Colors.Greyple);
}

async function HandleRolePersistRecordDetailsShow(BtnInteract: MessageComponentInteraction) {
  if (!BtnInteract.isButton() || !BtnInteract.inCachedGuild()) return;

  const RecordId = BtnInteract.customId.split(":")[2];
  const RecordDocument = isValidObjectId(RecordId)
    ? await RolePersistenceModel.findOne({
        guild: BtnInteract.guildId,
        _id: RecordId,
      }).exec()
    : null;

  if (!RecordDocument) {
    return new ErrorEmbed()
      .useErrTemplate("RolePersistRecordNotFound")
      .replyToInteract(BtnInteract, true, false);
  }

  const DetailsContainer = GetRecordDetailsContainer(RecordDocument, BtnInteract.guild.roles);
  return BtnInteract.reply({
    components: [DetailsContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

async function CmdCallback(CmdInteract: SlashCommandInteraction<"cached">) {
  const SelectedUser = CmdInteract.options.getUser("user", false);
  const PrivateResponse = CmdInteract.options.getBoolean("private", false) ?? false;
  const QueryFilter: any = { guild: CmdInteract.guildId };

  if (SelectedUser) {
    QueryFilter.user = SelectedUser.id;
  }

  const Records = await RolePersistenceModel.find(QueryFilter).sort({ saved_on: -1 }).exec();
  if (Records.length === 0) {
    const ErrorTemplate = SelectedUser
      ? "RolePersistSavesNotFoundFSM"
      : "RolePersistNoRecordsFound";

    return new InfoEmbed().useInfoTemplate(ErrorTemplate).replyToInteract(CmdInteract, true, false);
  }

  return HandlePagePagination({
    pages: GetRecordPages(Records, CmdInteract, SelectedUser),
    interact: CmdInteract,
    ephemeral: PrivateResponse,
    context: "Commands:RolePersist:List",
    cv2_comp_listener: HandleRolePersistRecordDetailsShow,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("list")
    .setDescription("Shows role persistence records for a specific person or for everyone.")
    .addUserOption((Option) =>
      Option.setName("user")
        .setDescription("The person whose persistence records you want to view.")
        .setRequired(false)
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setDescription("Show results privately; otherwise, show them publicly. Default is public.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
