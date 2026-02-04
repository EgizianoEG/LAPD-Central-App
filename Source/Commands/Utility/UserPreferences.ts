// Dependencies:
// -------------
import {
  StringSelectMenuOptionBuilder,
  ApplicationIntegrationType,
  StringSelectMenuBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ButtonInteraction,
  SeparatorBuilder,
  ContainerBuilder,
  TextInputBuilder,
  TextInputStyle,
  SectionBuilder,
  ComponentType,
  ButtonBuilder,
  ModalBuilder,
  LabelBuilder,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

import { Other } from "#Config/Secrets.js";
import { Dedent } from "#Utilities/Strings/Formatters.js";
import { RandomString } from "#Utilities/Strings/Random.js";
import { GuildProfiles } from "#Typings/Utilities/Database.js";
import {
  InfoContainer,
  WarnContainer,
  ErrorContainer,
  SuccessContainer,
} from "#Utilities/Classes/ExtraContainers.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import DeleteAndAnonymizeUser from "#Utilities/Database/AnonymizeUser.js";
import GuildProfile from "#Models/GuildProfile.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
function GetPreferencesContainer(
  UserPrefs?: GuildProfiles.ProfileDocument["preferences"],
  WithinServerContext: boolean = false
): ContainerBuilder {
  const DMShiftReportButton = new ButtonBuilder()
    .setCustomId("server-prefs-dsr")
    .setLabel(
      WithinServerContext
        ? UserPrefs?.dm_shift_reports
          ? "Enabled"
          : "Disabled"
        : "Run in Target Server"
    )
    .setStyle(
      WithinServerContext
        ? UserPrefs?.dm_shift_reports
          ? ButtonStyle.Success
          : ButtonStyle.Danger
        : ButtonStyle.Secondary
    )
    .setDisabled(!WithinServerContext);

  const DataDeletionButton = new ButtonBuilder()
    .setCustomId("data-deletion-options")
    .setLabel("Select Option")
    .setStyle(ButtonStyle.Secondary);

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
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2))
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            Dedent(`
              **Manage Your Data**
              Have your profile records deleted immediately or delete your profile and anonymize your history. These actions are irreversible.
            `)
          )
        )
        .setButtonAccessory(DataDeletionButton)
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(1))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        WithinServerContext
          ? "-# Per-server preferences. Your choices here only apply in this server."
          : "-# Global preferences. Options here apply to all servers you're in."
      )
    );
}

async function HandleDataDeletionModal(BtnInteract: ButtonInteraction): Promise<any> {
  const Pl = BtnInteract.inCachedGuild() ? "" : "s";
  const DeletionStrategySelect = new StringSelectMenuBuilder()
    .setCustomId("deletion_strategy")
    .setPlaceholder("Choose your deletion strategy...")
    .setRequired(true)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Profile Only")
        .setValue("profile_only")
        .setDescription(`Delete server profile${Pl}, keep all history.`),
      new StringSelectMenuOptionBuilder()
        .setLabel("Profile + Anonymize History")
        .setValue("profile_and_anonymize")
        .setDescription(`Delete server profile${Pl} and anonymize all server history.`)
    );

  const ConfirmationInput = new TextInputBuilder()
    .setCustomId("confirmation")
    .setPlaceholder("Type 'I UNDERSTAND' to confirm...")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(12)
    .setMinLength(12);

  const DeletionModal = new ModalBuilder()
    .setTitle("Data Deletion Options")
    .setCustomId(`data-deletion-modal:${BtnInteract.user.id}:${RandomString(4)}`)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        Dedent(`
          ### Deletion Strategy
          **Option 1:** Delete profile only (keeps operational history)
          - Removes your profile settings and preferences
          - Preserves all shift logs, arrests, citations, incidents
          - Your history remains linked to your Discord ID

          **Option 2:** Delete profile + anonymize all history
          - Deletes your profile completely
          - Anonymizes all operational records (shifts, arrests, etc.)
          - Cannot be reversed - your history becomes anonymous

          **This action is irreversible and your full responsibility. By proceeding, you acknowledge that:**
          - You have read our [Privacy Policy](${Other.AppDocumentationLink}/legal-section/privacy-policy)
          - You understand our [Data Deletion Policy](${Other.AppDocumentationLink}/legal-section/data-deletion-policy)
          - You agree to our [Terms of Service](${Other.AppDocumentationLink}/legal-section/terms-of-service)
          ${BtnInteract.guildId ? "" : "- You understand this will apply to ***all*** servers you're in."}
        `)
      )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Select Deletion Strategy")
        .setDescription(
          "Choose your option from the drop-down menu. See the data deletion policy above for more details."
        )
        .setStringSelectMenuComponent(DeletionStrategySelect),
      new LabelBuilder()
        .setLabel("Confirm Irreversible Action")
        .setDescription(Dedent("Type 'I UNDERSTAND' below to proceed."))
        .setTextInputComponent(ConfirmationInput)
    );

  const Submission = await ShowModalAndAwaitSubmission(BtnInteract, DeletionModal, 8 * 60 * 1000);
  if (!Submission) return;

  const DeletionStrategy = Submission.fields.getStringSelectValues("deletion_strategy")[0];
  const ConfirmationText = Submission.fields.getTextInputValue("confirmation").trim().toUpperCase();

  if (ConfirmationText !== "I UNDERSTAND") {
    return new InfoContainer()
      .useInfoTemplate("UPNoConfirmDeletionCancelled")
      .replyToInteract(Submission, true, true);
  }

  try {
    if (DeletionStrategy === "profile_only") {
      await Submission.deferReply({ flags: MessageFlags.Ephemeral });
      const DeleteResult = BtnInteract.guildId
        ? await GuildProfile.deleteOne({
            guild: BtnInteract.guildId,
            user: BtnInteract.user.id,
          })
        : await GuildProfile.deleteMany({
            user: BtnInteract.user.id,
            guild: { $exists: true },
          });

      if (DeleteResult.deletedCount > 0) {
        return await new InfoContainer()
          .useInfoTemplate(
            BtnInteract.inCachedGuild() ? "UPServerProfileDeletedOnly" : "UPProfilesDeletedOnly"
          )
          .replyToInteract(Submission, true, true);
      }

      return await new InfoContainer()
        .useInfoTemplate(
          BtnInteract.inCachedGuild()
            ? "UPNoServerProfileFoundToDelete"
            : "UPNoProfilesFoundToDelete"
        )
        .replyToInteract(Submission, true, true);
    }

    await new WarnContainer()
      .useInfoTemplate("UDDeletionAndAnonymizationInProgress")
      .replyToInteract(Submission, true, false);

    const AnonymizationResult = await DeleteAndAnonymizeUser(
      BtnInteract.user.id,
      BtnInteract.user.username,
      BtnInteract.guildId
    );

    const AffectedRecordsCount = Object.entries(AnonymizationResult.records_affected)
      .filter(([Key]) => Key !== "profiles")
      .reduce((Acc, [, Val]) => Acc + Val, 0);

    const GhostInfo =
      AffectedRecordsCount > 0
        ? Dedent(`
            **Your Anonymous Identifiers**
            These identifiers are generated only once for your reference. \
            To protect your privacy, we do not store the link between your \
            account and this ID—meaning you are the only one who possesses this information:
            - Ghost ID: ||\`${AnonymizationResult.ghost_id}\`||
            - Ghost Username: ||\`${AnonymizationResult.ghost_username}\`||
          `)
        : "";

    return await new SuccessContainer()
      .setTitle("Data Anonymization Complete")
      .setDescription(
        `Your profile${Pl} and ${AffectedRecordsCount} associated history records ` +
          "(Shifts, Arrests, Reports, etc.) have been successfully anonymized and scrubbed.\n\n" +
          GhostInfo
      )
      .replyToInteract(Submission, true, false, "editReply");
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to process data deletion request;",
      label: "Commands:Utility:UserPreferences",
      stack: Err.stack,
      error: Err,
    });

    return new ErrorContainer()
      .useErrTemplate("DatabaseError")
      .replyToInteract(Submission, true, true, "editReply");
  }
}

// ---------------------------------------------------------------------------------------
// Cmd Handling:
// -------------
async function Callback(CmdInteract: SlashCommandInteraction) {
  const TGuildId = CmdInteract.guildId;
  let ProfileDoc = TGuildId
    ? await GuildProfile.findOneAndUpdate(
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
      )
    : null;

  if (TGuildId && !ProfileDoc) {
    return new ErrorContainer()
      .useErrTemplate("DatabaseError")
      .replyToInteract(CmdInteract, true, true);
  }

  const PreferencesContainer = GetPreferencesContainer(ProfileDoc?.preferences, !!TGuildId);
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
    const CustomId = BtnInteract.customId;

    if (CustomId.startsWith("server-prefs-") && !BtnInteract.inCachedGuild()) {
      return new ErrorContainer()
        .useErrTemplate("UserPrefsChangeRequiresServerContext")
        .replyToInteract(BtnInteract, true, true);
    }

    if (CustomId === "data-deletion-options") {
      return HandleDataDeletionModal(BtnInteract);
    }

    if (BtnInteract.customId.includes("dsr") && TGuildId) {
      try {
        const UpdatedDoc = await GuildProfile.findOneAndUpdate(
          {
            user: CmdInteract.user.id,
            guild: TGuildId,
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
            upsert: true,
            updatePipeline: true,
            setDefaultsOnInsert: true,
          }
        );

        if (UpdatedDoc) ProfileDoc = UpdatedDoc;
        const UpdatedContainer = GetPreferencesContainer(ProfileDoc?.preferences, !!TGuildId);

        await BtnInteract.update({
          components: [UpdatedContainer],
        });
      } catch (Err: any) {
        new ErrorContainer()
          .useErrTemplate("DatabaseError")
          .replyToInteract(BtnInteract, true, true);

        AppLogger.error({
          message: "An error occurred while updating user preferences;",
          label: "Commands:Utility:UserPreferences",
          stack: Err.stack,
          error: Err,
        });
      }
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
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("preferences")
    .setDescription(
      "Manage your notifications, profile settings, and manage your data across this server or all servers."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
