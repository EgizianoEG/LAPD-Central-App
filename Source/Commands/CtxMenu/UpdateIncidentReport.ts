// Dependencies, Types, and Constants:
// -----------------------------------
import {
  MessageContextMenuCommandInteraction,
  StringSelectMenuInteraction,
  ApplicationIntegrationType,
  ContextMenuCommandBuilder,
  StringSelectMenuBuilder,
  ApplicationCommandType,
  InteractionContextType,
  ModalSubmitInteraction,
  InteractionCollector,
  RepliableInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  ButtonBuilder,
  MessageFlags,
  ModalBuilder,
  ButtonStyle,
  Message,
  Colors,
} from "discord.js";

import {
  IncidentNotesLength,
  IncidentStatusesWithDescriptions,
} from "@Resources/IncidentConstants.js";

import {
  InfoContainer,
  ErrorContainer,
  SuccessContainer,
  BaseExtraContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import { Emojis } from "@Config/Shared.js";
import { GuildIncidents } from "@Typings/Utilities/Database.js";
import { ArraysAreEqual } from "@Utilities/Other/ArraysAreEqual.js";
import { FilterUserInput } from "@Utilities/Strings/Redactor.js";
import { FormatSortRDInputNames } from "@Utilities/Strings/Formatters.js";
import { ErrorEmbed, UnauthorizedEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { SanitizeDiscordAttachmentLink } from "@Utilities/Strings/OtherUtils.js";
import { IncidentReportNumberLineRegex, ListSplitRegex } from "@Resources/RegularExpressions.js";

import IsEqual from "lodash/isEqual.js";
import UserHasPerms from "@Utilities/Database/UserHasPermissions.js";
import IncidentModel from "@Models/Incident.js";
import GetIncidentRecord from "@Utilities/Database/GetIncidentRecord.js";
import GetIncidentReportEmbeds from "@Utilities/Other/GetIncidentReportEmbeds.js";
import DisableMessageComponents from "@Utilities/Other/DisableMsgComps.js";

const ListFormatter = new Intl.ListFormat("en");
const NoneProvidedPlaceholder = "`[None Provided]`";
const CompCollectorTimeout = 12.5 * 60 * 1000;
const CompCollectorIdleTime = 10 * 60 * 1000;

type SelectButtonInteractionCollector =
  | InteractionCollector<StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">>
  | InteractionCollector<StringSelectMenuInteraction<"cached">>;

type ValidationResult = {
  handled: boolean;
  incident: GuildIncidents.IncidentRecord | null;
};

enum IncidentEditOptionIds {
  Notes = "incident-edit-notes",
  Status = "incident-edit-status",
  Officers = "incident-edit-officers",
  Suspects = "incident-edit-suspects",
  Witnesses = "incident-edit-witnesses",
  SaveCancel = "incident-save-cancel",
  SaveConfirm = "incident-save-confirm",
}

enum ModalInputIds {
  Witnesses = "incident-witnesses-input",
  Officers = "incident-officers-input",
  Suspects = "incident-suspects-input",
  Notes = "incident-notes-input",
}

// ---------------------------------------------------------------------------------------
// Component & Utility Helpers:
// ----------------------------
function GetIncidentEditOptionsMenu(
  ModInteract: RepliableInteraction,
  IncRecord: GuildIncidents.IncidentRecord
) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ir-update-options:${ModInteract.user.id}:${IncRecord._id}`)
      .setPlaceholder("Select an option...")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions([
        {
          label: "Update Status",
          value: IncidentEditOptionIds.Status,
          emoji: Emojis.StatusChange,
          description: "Change the incident status.",
        },
        {
          label: "Set Involved Officers",
          emoji: Emojis.PoliceHat,
          value: IncidentEditOptionIds.Officers,
          description: "Add or remove involved officers in the incident.",
        },
        {
          label: "Set Suspects",
          value: IncidentEditOptionIds.Suspects,
          emoji: Emojis.Fingerprint,
          description: "Add or remove incident suspects.",
        },
        {
          label: "Set Witnesses",
          value: IncidentEditOptionIds.Witnesses,
          emoji: Emojis.Eyewitness,
          description: "Add or remove incident witnesses.",
        },
        {
          label: "Set Notes",
          emoji: Emojis.Notes,
          value: IncidentEditOptionIds.Notes,
          description: "Add or update incident notes.",
        },
      ])
  );
}

function GetSaveConfirmationButtons(RecInteract: RepliableInteraction) {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`${IncidentEditOptionIds.SaveConfirm}:${RecInteract.user.id}`)
      .setLabel("Confirm and Update")
      .setEmoji(Emojis.WhiteCheck)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${IncidentEditOptionIds.SaveCancel}:${RecInteract.user.id}`)
      .setLabel("Cancel Modifications")
      .setStyle(ButtonStyle.Danger)
  );
}

function GetChangeIncidentStatusSelectMenuAR(CurrentStatus: string) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId("incident-status-input")
      .setPlaceholder("Set new status...")
      .setMinValues(0)
      .setMaxValues(1)
      .setOptions(
        IncidentStatusesWithDescriptions.map((Status) => ({
          label: Status.status,
          value: Status.status,
          default: CurrentStatus === Status.status,
          description: Status.description,
        }))
      )
  );
}

function GetChangeIncidentWitnessesOrSuspectsInputModal(
  RecInteract: StringSelectMenuInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord,
  Type: "Witnesses" | "Suspects" | "Officers"
) {
  const InputModal = new ModalBuilder()
    .setCustomId(
      `${IncidentEditOptionIds[Type]}:${RecInteract.user.id}:${RecInteract.createdTimestamp}`
    )
    .setTitle(`Incident Report — Update ${Type}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Paragraph)
          .setCustomId(ModalInputIds[Type])
          .setLabel(`Incident ${Type === "Officers" ? "Involved Officers" : Type}`)
          .setPlaceholder(`Enter the new names of ${Type.toLowerCase()} separated by commas...`)
          .setMinLength(3)
          .setMaxLength(88)
          .setRequired(false)
      )
    );

  const OriginalValue = FormatSortRDInputNames(IncidentRecord[Type.toLowerCase()]).join(", ");
  if (OriginalValue.length >= 3) {
    InputModal.components[0].components[0].setValue(OriginalValue);
  }

  return InputModal;
}

function GetChangeIncidentNotesInputModal(
  RecInteract: StringSelectMenuInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord
) {
  const NotesModal = new ModalBuilder()
    .setCustomId(
      `${IncidentEditOptionIds.Notes}:${RecInteract.user.id}:${RecInteract.createdTimestamp}`
    )
    .setTitle("Incident Report — Update Notes")
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setStyle(TextInputStyle.Paragraph)
          .setCustomId(ModalInputIds.Notes)
          .setLabel("Incident Notes")
          .setPlaceholder("Enter the new notes...")
          .setMinLength(IncidentNotesLength.Min)
          .setMaxLength(IncidentNotesLength.Max)
          .setRequired(false)
      )
    );

  if ((IncidentRecord.notes ?? "").length >= IncidentNotesLength.Min) {
    NotesModal.components[0].components[0].setValue(IncidentRecord.notes!);
  }

  return NotesModal;
}

function GetUpdatePromptContainer(
  RecInteract: RepliableInteraction,
  DatabaseIncRecord: GuildIncidents.IncidentRecord,
  UpdatedIncRecord?: GuildIncidents.IncidentRecord
) {
  const PromptContainer = new BaseExtraContainer()
    .setTitle(`Incident Report Modification — \`INC-${DatabaseIncRecord.num}\``)
    .setColor(Colors.Greyple);

  const UpdatedPromptMsgDesc = [
    "**Please select an option from the drop-down menu below to modify or update the incident report.**",
  ];

  if (UpdatedIncRecord && !IsEqual(DatabaseIncRecord, UpdatedIncRecord)) {
    UpdatedPromptMsgDesc.push("\n\n**Updated Fields:**");
    PromptContainer.setFooter(
      "To confirm the changes, click the 'Confirm and Update' button, or click the 'Cancel Modifications' button to cancel them."
    );

    if (DatabaseIncRecord.status !== UpdatedIncRecord.status) {
      UpdatedPromptMsgDesc.push(`\n- **Status:** \`${UpdatedIncRecord.status}\``);
    }

    if (!ArraysAreEqual(DatabaseIncRecord.officers, UpdatedIncRecord.officers)) {
      UpdatedPromptMsgDesc.push(
        `\n- **Involved Officers:** ${UpdatedIncRecord.officers.length ? ListFormatter.format(FormatSortRDInputNames(UpdatedIncRecord.officers, true)) : NoneProvidedPlaceholder}`
      );
    }

    if (!ArraysAreEqual(DatabaseIncRecord.suspects, UpdatedIncRecord.suspects)) {
      UpdatedPromptMsgDesc.push(
        `\n- **Suspects:** ${UpdatedIncRecord.suspects.length ? ListFormatter.format(UpdatedIncRecord.suspects) : NoneProvidedPlaceholder}`
      );
    }

    if (!ArraysAreEqual(DatabaseIncRecord.witnesses, UpdatedIncRecord.witnesses)) {
      UpdatedPromptMsgDesc.push(
        `\n- **Witnesses:** ${UpdatedIncRecord.witnesses.length ? ListFormatter.format(UpdatedIncRecord.witnesses) : NoneProvidedPlaceholder}`
      );
    }

    if (DatabaseIncRecord.notes !== UpdatedIncRecord.notes) {
      const Notes = UpdatedIncRecord.notes?.length ? `\n  ${UpdatedIncRecord.notes}` : "[Removed]";
      UpdatedPromptMsgDesc.push(`\n- **Notes:** ${Notes}`);
    }

    PromptContainer.attachPromptActionRows([
      GetIncidentEditOptionsMenu(RecInteract, DatabaseIncRecord),
      GetSaveConfirmationButtons(RecInteract),
    ]);
  } else {
    PromptContainer.attachPromptActionRows(
      GetIncidentEditOptionsMenu(RecInteract, DatabaseIncRecord),
      { divider: false }
    );
  }

  return PromptContainer.setDescription(UpdatedPromptMsgDesc.join(""));
}

async function EditIncidentReportLogMessageBasedOnRecordAndInteraction(
  ReceivedInteract: ButtonInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord
) {
  const [ChannelId, MessageId] = (IncidentRecord.log_message ?? "").split(":");
  if (!ChannelId || !MessageId) return;

  const Channel = await ReceivedInteract.client.channels.fetch(ChannelId);
  if (!Channel?.isTextBased()) return;

  const Message = await Channel.messages.fetch(MessageId);
  if (!Message?.editable) return;

  const UpdatedAttachmentURLs = Message.embeds.flatMap((Embed) =>
    Embed.image?.url ? [SanitizeDiscordAttachmentLink(Embed.image.url)] : []
  );

  const IncidentReportEmbeds = GetIncidentReportEmbeds(
    { ...IncidentRecord, attachments: UpdatedAttachmentURLs },
    {
      guild_id: ReceivedInteract.guildId,
      channel_id: ChannelId,
    }
  );

  return Message.edit({
    embeds: IncidentReportEmbeds,
    files: [],
  });
}

// ---------------------------------------------------------------------------------------
// Handlers and Validation:
// ------------------------
export async function HandleCommandValidationAndPossiblyGetIncident(
  RecInteract: MessageContextMenuCommandInteraction<"cached">
): Promise<ValidationResult> {
  const ReportEmbeds = RecInteract.targetMessage.embeds;
  const HandledValResult: ValidationResult = { handled: true, incident: null };
  let ReportNumber: Nullable<string> = null;
  let IncidentReport: GuildIncidents.IncidentRecord | null = null;

  if (ReportEmbeds[0]?.description?.length) {
    ReportNumber = ReportEmbeds[0].description.match(IncidentReportNumberLineRegex)?.[1];
  }

  if (ReportNumber) {
    IncidentReport = await GetIncidentRecord(RecInteract.guildId, ReportNumber);
  }

  if (RecInteract.targetMessage.author.id !== RecInteract.client.user.id) {
    return new ErrorEmbed()
      .useErrTemplate("UpdateIncidentReportAppNotAuthor")
      .replyToInteract(RecInteract, true)
      .then(() => HandledValResult);
  } else if (!ReportNumber) {
    return new ErrorEmbed()
      .useErrTemplate("UpdateIncidentReportNoIncNum")
      .replyToInteract(RecInteract, true)
      .then(() => HandledValResult);
  } else if (!IncidentReport) {
    return new ErrorEmbed()
      .useErrTemplate("UpdateIncidentReportIncNotFound")
      .replyToInteract(RecInteract, true)
      .then(() => HandledValResult);
  } else if (IncidentReport.reporter.discord_id !== RecInteract.user.id) {
    const CanUpdateWithManagement = await UserHasPerms(RecInteract, { management: true });
    if (CanUpdateWithManagement === false) {
      return new UnauthorizedEmbed()
        .useErrTemplate("UpdateIncidentReportNoMgmtPerms")
        .replyToInteract(RecInteract, true)
        .then(() => HandledValResult);
    }
  }

  return { handled: false, incident: IncidentReport };
}

async function HandlePromptUpdateBasedOnModifiedRecord(
  PromptMessage: Message<true>,
  ChangeInteract:
    | StringSelectMenuInteraction<"cached">
    | ButtonInteraction<"cached">
    | ModalSubmitInteraction<"cached">,
  DatabaseIncRecord: GuildIncidents.IncidentRecord,
  UpdatedIncRecord: GuildIncidents.IncidentRecord
) {
  const UpdatedPromptContainer = GetUpdatePromptContainer(
    ChangeInteract,
    DatabaseIncRecord,
    UpdatedIncRecord
  );

  const UpdatedPromptMessage = await ChangeInteract.editReply({
    message: PromptMessage,
    components: [UpdatedPromptContainer],
  }).catch(() => null);

  if (!UpdatedPromptMessage) {
    return;
  }

  const NewComponentCollector = UpdatedPromptMessage.createMessageComponentCollector({
    filter: (Interact) => Interact.user.id === ChangeInteract.user.id,
    time: CompCollectorTimeout,
    idle: CompCollectorIdleTime,
  });

  return HandleComponentCollectorInteracts(
    ChangeInteract,
    NewComponentCollector as SelectButtonInteractionCollector,
    UpdatedPromptMessage,
    DatabaseIncRecord,
    UpdatedIncRecord
  );
}

async function HandleIncidentRecordEditWithHandler<
  T extends StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">,
  U extends
    | ModalSubmitInteraction<"cached">
    | ButtonInteraction<"cached">
    | StringSelectMenuInteraction<"cached">
    | null,
>(
  RecInteract: T,
  DatabaseIncRecord: GuildIncidents.IncidentRecord,
  UpdatedIncRecord: GuildIncidents.IncidentRecord,
  PromptMessage: Message<true>,
  ComponentCollector: SelectButtonInteractionCollector,
  EditHandler: (
    interaction: T,
    dbRecord: GuildIncidents.IncidentRecord,
    updatedRecord: GuildIncidents.IncidentRecord
  ) => Promise<U>
) {
  const Interaction = await EditHandler(RecInteract, DatabaseIncRecord, UpdatedIncRecord);
  if (!Interaction) {
    return;
  }

  ComponentCollector.stop("PromptUpdated");
  DatabaseIncRecord =
    (await GetIncidentRecord(RecInteract.guildId, DatabaseIncRecord._id)) ?? DatabaseIncRecord;

  return HandlePromptUpdateBasedOnModifiedRecord(
    PromptMessage,
    Interaction,
    DatabaseIncRecord,
    UpdatedIncRecord
  );
}

async function HandleComponentCollectorInteracts(
  InitialInteract: RepliableInteraction<"cached">,
  ComponentCollector: SelectButtonInteractionCollector,
  PromptMessage: Message<true>,
  DatabaseIncRecord: GuildIncidents.IncidentRecord,
  UpdatedIncRecord: GuildIncidents.IncidentRecord
) {
  (
    ComponentCollector as InteractionCollector<
      StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">
    >
  ).on("collect", async (RecInteract) => {
    if (RecInteract.isStringSelectMenu()) {
      const ChosenOption = RecInteract.values[0];
      if (ChosenOption === IncidentEditOptionIds.Status) {
        await HandleIncidentRecordEditWithHandler(
          RecInteract,
          DatabaseIncRecord,
          UpdatedIncRecord,
          PromptMessage,
          ComponentCollector,
          HandleIncidentStatusEdit
        );
      } else if (
        ChosenOption === IncidentEditOptionIds.Suspects ||
        ChosenOption === IncidentEditOptionIds.Witnesses ||
        ChosenOption === IncidentEditOptionIds.Officers
      ) {
        await HandleIncidentRecordEditWithHandler(
          RecInteract,
          DatabaseIncRecord,
          UpdatedIncRecord,
          PromptMessage,
          ComponentCollector,
          (
            _RecInteract: StringSelectMenuInteraction<"cached">,
            _DBRecord: GuildIncidents.IncidentRecord,
            _UpdatedRecord: GuildIncidents.IncidentRecord
          ) =>
            HandleIncidentSuspectsOrWitnessesEdit(
              _RecInteract,
              _DBRecord,
              _UpdatedRecord,
              ChosenOption === IncidentEditOptionIds.Suspects
                ? "Suspects"
                : ChosenOption === IncidentEditOptionIds.Officers
                  ? "Officers"
                  : "Witnesses"
            )
        );
      } else if (ChosenOption === IncidentEditOptionIds.Notes) {
        await HandleIncidentRecordEditWithHandler(
          RecInteract,
          DatabaseIncRecord,
          UpdatedIncRecord,
          PromptMessage,
          ComponentCollector,
          HandleIncidentNotesEdit
        );
      }
    } else if (RecInteract.isButton()) {
      if (RecInteract.customId.includes(IncidentEditOptionIds.SaveConfirm)) {
        await HandleIncidentRecordUpdateConfirm(RecInteract, DatabaseIncRecord, UpdatedIncRecord);
        ComponentCollector.stop("PromptUpdated");
      } else if (RecInteract.customId.includes(IncidentEditOptionIds.SaveCancel)) {
        await HandleIncidentRecordUpdateDismiss(RecInteract);
        ComponentCollector.stop("PromptUpdated");
      }
    }

    if (!RecInteract.deferred || !RecInteract.replied) {
      RecInteract.deferUpdate().catch(() => null);
    }
  });

  ComponentCollector.on("end", async (Interacts, EndReason) => {
    if (EndReason.match(/reason: \w+Delete/) || EndReason === "PromptUpdated") return;
    const LastInteract = Interacts.last() ?? InitialInteract;
    const UpdatedComps = DisableMessageComponents(
      PromptMessage.components.map((Comp) => Comp.toJSON())
    );

    return LastInteract.editReply({
      message: PromptMessage,
      components: UpdatedComps,
    }).catch(() => null);
  });
}

async function HandleIncidentRecordUpdateDismiss(BtnInteract: ButtonInteraction<"cached">) {
  return BtnInteract.deferUpdate()
    .then(() => BtnInteract.deleteReply())
    .catch(() => null);
}

async function HandleIncidentRecordUpdateConfirm(
  BtnInteract: ButtonInteraction<"cached">,
  DatabaseIncRecord: GuildIncidents.IncidentRecord,
  UpdatedIncRecord: GuildIncidents.IncidentRecord
) {
  const RecordSetMap: { [key: string]: any } = {};
  await BtnInteract.deferUpdate().catch(() => null);

  if (DatabaseIncRecord.status !== UpdatedIncRecord.status) {
    RecordSetMap.status = UpdatedIncRecord.status;
  }

  if (DatabaseIncRecord.notes !== UpdatedIncRecord.notes) {
    RecordSetMap.notes = UpdatedIncRecord.notes;
  }

  if (!ArraysAreEqual(DatabaseIncRecord.officers, UpdatedIncRecord.officers)) {
    RecordSetMap.officers = UpdatedIncRecord.officers;
  }

  if (!ArraysAreEqual(DatabaseIncRecord.suspects, UpdatedIncRecord.suspects)) {
    RecordSetMap.suspects = UpdatedIncRecord.suspects;
  }

  if (!ArraysAreEqual(DatabaseIncRecord.witnesses, UpdatedIncRecord.witnesses)) {
    RecordSetMap.witnesses = UpdatedIncRecord.witnesses;
  }

  if (Object.keys(RecordSetMap).length === 0) {
    return BtnInteract.editReply({
      components: [
        new InfoContainer()
          .setTitle("Unnecessary Update")
          .setDescription("There were no changes made to the incident report to update."),
      ],
    });
  }

  const UpdatedDatabaseIncRecord = await IncidentModel.findOneAndUpdate(
    {
      guild: BtnInteract.guildId,
      _id: DatabaseIncRecord._id,
    },
    {
      $set: {
        ...RecordSetMap,
        last_updated: BtnInteract.createdAt,
        last_updated_by: {
          discord_id: BtnInteract.user.id,
          discord_username: BtnInteract.user.username,
        },
      },
    },
    {
      new: true,
    }
  )
    .lean()
    .exec();

  if (!UpdatedDatabaseIncRecord) {
    return new ErrorContainer()
      .useErrTemplate("UpdateIncidentReportDBFailed")
      .replyToInteract(BtnInteract, true, true, "editReply");
  }

  return Promise.allSettled([
    EditIncidentReportLogMessageBasedOnRecordAndInteraction(BtnInteract, UpdatedDatabaseIncRecord),
    BtnInteract.editReply({
      components: [
        new SuccessContainer()
          .setTitle("Incident Report Updated")
          .setDescription(
            `The incident report \`${UpdatedDatabaseIncRecord.num}\` was successfully updated.`
          ),
      ],
    }),
  ]);
}

async function HandleIncidentStatusEdit(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  DBIncidentRecord: GuildIncidents.IncidentRecord,
  IRUpdatesCopy: GuildIncidents.IncidentRecord
) {
  const StatusPromptContainer = new BaseExtraContainer()
    .setColor(Colors.Greyple)
    .setTitle("Incident Status Update")
    .setDescription(
      "**What would you like to change the status to?**\n" +
        "Select a new status from the menu below. To maintain the current report status, close or clear the current selection."
    );

  await SelectInteract.update({
    components: [GetUpdatePromptContainer(SelectInteract, DBIncidentRecord, IRUpdatesCopy)],
  }).catch(() => null);

  const StatusPromptMsg = await SelectInteract.followUp({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [
      StatusPromptContainer.attachPromptActionRows(
        GetChangeIncidentStatusSelectMenuAR(DBIncidentRecord.status)
      ),
    ],
  });

  const RecInteract = await StatusPromptMsg.awaitMessageComponent({
    filter: (Interact) => Interact.user.id === SelectInteract.user.id,
    componentType: ComponentType.StringSelect,
    time: CompCollectorIdleTime,
  }).catch(() => null);

  if (RecInteract) {
    const ChosenStatus = RecInteract.values[0];
    IRUpdatesCopy.status = ChosenStatus || DBIncidentRecord.status;

    await RecInteract.deferUpdate().catch(() => null);
    RecInteract.deleteReply().catch(() => null);
    return RecInteract;
  }

  return null;
}

async function HandleIncidentSuspectsOrWitnessesEdit(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord,
  IRUpdatesCopy: GuildIncidents.IncidentRecord,
  InputType: "Suspects" | "Witnesses" | "Officers"
) {
  const TextInputModal = GetChangeIncidentWitnessesOrSuspectsInputModal(
    SelectInteract,
    IncidentRecord,
    InputType
  );

  await SelectInteract.showModal(TextInputModal);
  await SelectInteract.editReply({
    components: [GetUpdatePromptContainer(SelectInteract, IncidentRecord, IRUpdatesCopy)],
  });

  const InputSubmission = await SelectInteract.awaitModalSubmit({
    filter: (Submision) => Submision.customId === TextInputModal.data.custom_id,
    time: CompCollectorIdleTime,
  }).catch(() => null);

  if (!InputSubmission) return null;
  else await InputSubmission.deferUpdate().catch(() => null);

  const NewlySetNames = InputSubmission.fields
    .getTextInputValue(ModalInputIds[InputType])
    .split(ListSplitRegex)
    .filter((Name) => Name.length >= 2);

  if (InputType === "Suspects") IRUpdatesCopy.suspects = NewlySetNames;
  else if (InputType === "Witnesses") IRUpdatesCopy.witnesses = NewlySetNames;
  else if (InputType === "Officers") IRUpdatesCopy.officers = NewlySetNames;
  return InputSubmission;
}

async function HandleIncidentNotesEdit(
  SelectInteract: StringSelectMenuInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord,
  IRUpdatesCopy: GuildIncidents.IncidentRecord
) {
  const NotesInputModal = GetChangeIncidentNotesInputModal(SelectInteract, IncidentRecord);

  await SelectInteract.showModal(NotesInputModal);
  await SelectInteract.editReply({
    components: [GetUpdatePromptContainer(SelectInteract, IncidentRecord, IRUpdatesCopy)],
  });

  const InputSubmission = await SelectInteract.awaitModalSubmit({
    filter: (Submision) => Submision.customId === NotesInputModal.data.custom_id,
    time: CompCollectorIdleTime,
  }).catch(() => null);

  if (!InputSubmission) return null;
  else await InputSubmission.deferUpdate().catch(() => null);
  const NotesInput =
    InputSubmission.fields.getTextInputValue(ModalInputIds.Notes).replace(/\s+/g, " ") || null;

  if (NotesInput) {
    IRUpdatesCopy.notes = await FilterUserInput(NotesInput, {
      replacement: "#",
      replacement_type: "Character",
      filter_links_emails: true,
      guild_instance: SelectInteract.guild,
      target_channel: IncidentRecord.log_message?.split(":")?.[0],
    });
  } else {
    IRUpdatesCopy.notes = null;
  }

  return InputSubmission;
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(Interaction: MessageContextMenuCommandInteraction<"cached">) {
  const ValidationResult = await HandleCommandValidationAndPossiblyGetIncident(Interaction);
  const PromptMsgFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  if (ValidationResult.handled && !ValidationResult.incident) return;
  await Interaction.deferReply({ flags: PromptMsgFlags });

  const IncidentRecord = ValidationResult.incident!;
  const IncidentRecordModified = { ...IncidentRecord };
  const UpdatePromptContainer = GetUpdatePromptContainer(Interaction, IncidentRecord);
  const UpdatePromptMessage = await Interaction.editReply({
    components: [UpdatePromptContainer],
    flags: PromptMsgFlags,
  });

  const PromptInteractsCollector = UpdatePromptMessage.createMessageComponentCollector({
    filter: (ButtonInteract) => ButtonInteract.user.id === Interaction.user.id,
    componentType: ComponentType.StringSelect,
    time: CompCollectorTimeout,
    idle: CompCollectorIdleTime,
  });

  HandleComponentCollectorInteracts(
    Interaction,
    PromptInteractsCollector,
    UpdatePromptMessage,
    IncidentRecord,
    IncidentRecordModified
  );
}

// ---------------------------------------------------------------------------------------
// Command Definition:
// -------------------
const CommandObject: ContextMenuCommandObject = {
  callback: Callback,
  options: { user_perms: { staff: true }, cooldown: 5 },
  data: new ContextMenuCommandBuilder()
    .setName("Update Incident Report")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .setType(ApplicationCommandType.Message),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
