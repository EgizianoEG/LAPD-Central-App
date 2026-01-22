// Dependencies:
// -------------
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  SectionBuilder,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import { Dedent } from "#Source/Utilities/Strings/Formatters.js";
import { GuildProfiles } from "#Source/Typings/Utilities/Database.js";
import { ErrorContainer } from "#Source/Utilities/Classes/ExtraContainers.js";
import DisableMessageComponents from "#Source/Utilities/Discord/DisableMsgComps.js";
import GuildProfile from "#Models/GuildProfile.js";
import AppLogger from "#Source/Utilities/Classes/AppLogger.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
function GetPreferencesContainer(
  UserPrefs: GuildProfiles.ProfileDocument["preferences"]
): ContainerBuilder {
  const DMShiftReportButton = new ButtonBuilder()
    .setCustomId("server-prefs-dsr")
    .setLabel(UserPrefs.dm_shift_reports ? "Enabled" : "Disabled")
    .setStyle(UserPrefs.dm_shift_reports ? ButtonStyle.Success : ButtonStyle.Danger);

  return new ContainerBuilder()
    .setAccentColor(0x5f9ea0)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### Server Preferences"))
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
            **End-of-Shift DM Reports**
            When a shift ends, I’ll DM you a summary of your shift for this server. Delivery depends on your Discord privacy settings.
          `)
          )
        )
        .setButtonAccessory(DMShiftReportButton)
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Per-server preferences. Your choices here only apply in this server."
      )
    );
}

async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  let ProfileDoc = await GuildProfile.findOneAndUpdate(
    {
      user: CmdInteract.user.id,
      guild: CmdInteract.guildId,
    },
    {},
    {
      setDefaultsOnInsert: true,
      upsert: true,
      new: true,
    }
  );

  if (!ProfileDoc) {
    return new ErrorContainer()
      .useErrTemplate("DatabaseError")
      .replyToInteract(CmdInteract, true, true);
  }

  const PreferencesContainer = GetPreferencesContainer(ProfileDoc.preferences);
  const PromptMsg = await CmdInteract.reply({
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [PreferencesContainer],
    withResponse: true,
  }).then((IR) => IR.resource!.message!);

  const InteractCollector = PromptMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 10 * 60 * 1000,
    idle: 3 * 60 * 1000,
  });

  InteractCollector.on("collect", async (BtnInteract) => {
    if (BtnInteract.user.id !== CmdInteract.user.id) return;
    if (BtnInteract.customId !== "server-prefs-dsr") {
      return;
    }

    try {
      const UpdatedDoc = await GuildProfile.findOneAndUpdate(
        {
          user: CmdInteract.user.id,
          guild: CmdInteract.guildId,
        },
        [
          {
            $set: {
              "preferences.dm_shift_reports": {
                $not: [{ $ifNull: ["$preferences.dm_shift_reports", false] }],
              },
            },
          },
        ],
        {
          new: true,
        }
      );

      if (UpdatedDoc) ProfileDoc = UpdatedDoc;
      const UpdatedContainer = GetPreferencesContainer(ProfileDoc.preferences);

      await BtnInteract.update({
        components: [UpdatedContainer],
      });
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while updating user preferences;",
        label: "Commands:Utility:UserPreferences",
        stack: Err.stack,
        error: Err,
      });
    }
  });

  InteractCollector.on("end", async (Interacts, EndReason) => {
    if (EndReason.match(/^\w+Delete/)) return;
    (Interacts.last() ?? CmdInteract)
      .editReply({
        message: PromptMsg.id,
        components: DisableMessageComponents(PromptMsg.components.map((C) => C.toJSON())),
      })
      .catch(() => null);
  });
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("preferences")
    .setDescription("Manage your notification and profile preferences in this server.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
