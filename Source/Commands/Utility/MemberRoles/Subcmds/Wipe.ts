// Dependencies:
// -------------

import {
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  SnowflakeUtil,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import {
  WarnContainer,
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import Dedent from "dedent";
import MSRolesModel from "#Models/MemberRoles.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import HandleCollectorFiltering from "#Utilities/Discord/HandleCollectorFilter.js";
import HandleActionCollectorExceptions from "#Utilities/Discord/HandleCompCollectorExceptions.js";
import { IsValidDiscordId, IsGhostDiscordId } from "#Utilities/Helpers/Validators.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteraction: SlashCommandInteraction<"cached">) {
  const TargetInput = CmdInteraction.options.getString("user", true).trim();
  const TargetMatch = TargetInput.match(/^<@!?(\d{15,25})>$|^(\d{15,25})$/);
  const TargetId = TargetMatch?.[1] ?? TargetMatch?.[2] ?? null;

  if (!TargetMatch || !TargetId) {
    return new ErrorContainer()
      .useErrTemplate("InvalidMemberRolesWipeUserId")
      .replyToInteract(CmdInteraction, true, false);
  }

  const IsValidId = IsValidDiscordId(TargetId) || IsGhostDiscordId(TargetId);
  if (!IsValidId) {
    return new ErrorContainer()
      .useErrTemplate("InvalidMemberRolesWipeUserId")
      .replyToInteract(CmdInteraction, true, false);
  }

  const SavesCount = await MSRolesModel.countDocuments({
    guild: CmdInteraction.guildId,
    member: TargetId,
  }).exec();

  if (SavesCount === 0) {
    return new InfoContainer()
      .useInfoTemplate("NoMemberRoleSavesForWipe")
      .replyToInteract(CmdInteraction, true, false);
  }

  const PanelNonce = SnowflakeUtil.generate().toString();
  const MsgFlags = MessageFlags.IsComponentsV2;
  const WipeButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mrs-wipe-confirm:${CmdInteraction.user.id}:${PanelNonce}`)
      .setLabel("Confirm Wipe")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`mrs-wipe-cancel:${CmdInteraction.user.id}:${PanelNonce}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  const PromptDescription = Dedent(`
    You are about to permanently delete all role saves for <@${TargetId}> in this server.
    Confirm to wipe every backup for this user, or cancel to keep them.
    - Total saves to delete: **${SavesCount}**
    - This action cannot be undone.
  `);

  const PromptContainer = new WarnContainer()
    .setTitle("Confirm Member Role Wipe")
    .setDescription(PromptDescription)
    .setFooter("*This prompt will automatically cancel after five minutes of inactivity.*");

  const PromptResponse = await CmdInteraction.reply({
    components: [PromptContainer.attachPromptActionRows(WipeButtons)],
    flags: MsgFlags,
    withResponse: true,
  });

  const PromptMessage = PromptResponse.resource!.message!;
  const DisablePrompt = () => {
    const DisabledComponents = DisableMessageComponents(
      PromptMessage.components.map((Comp) => Comp.toJSON())
    );

    return PromptMessage.edit({ components: DisabledComponents });
  };

  return PromptMessage.awaitMessageComponent({
    time: 5 * 60 * 1000,
    componentType: ComponentType.Button,
    filter: (BI) =>
      BI.customId.endsWith(PanelNonce) && HandleCollectorFiltering(CmdInteraction, BI),
  })
    .then(async (ButtonInteract) => {
      await ButtonInteract.deferUpdate();

      if (ButtonInteract.customId.includes("confirm")) {
        const DeleteResp = await MSRolesModel.deleteMany({
          guild: ButtonInteract.guildId,
          member: TargetId,
        }).exec();

        if (!DeleteResp.acknowledged) {
          return new ErrorContainer()
            .useErrTemplate("DBFailedToWipeMemberRolesSaves")
            .replyToInteract(ButtonInteract, false, false, "editReply");
        }

        const DeletedCount = DeleteResp.deletedCount ?? 0;
        const SuccessDescription = Dedent(`
          Deleted **${DeletedCount}** role backup${DeletedCount === 1 ? "" : "s"} for <@${TargetId}> in this server.
        `);

        return new SuccessContainer()
          .setTitle("Member Role Backups Wiped")
          .setDescription(SuccessDescription)
          .replyToInteract(ButtonInteract, false, false, "editReply");
      } else {
        return new InfoContainer()
          .setTitle("Wipe Cancelled")
          .setDescription("No role backups were removed. The wipe request has been cancelled.")
          .replyToInteract(ButtonInteract, false, false, "editReply");
      }
    })
    .catch((Err) => HandleActionCollectorExceptions(Err, DisablePrompt));
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("wipe")
    .setDescription("Wipes all saved role backups for a user in this server.")
    .addStringOption((Option) =>
      Option.setName("user")
        .setDescription("User mention or ID to wipe all saved roles for.")
        .setMinLength(15)
        .setMaxLength(32)
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
