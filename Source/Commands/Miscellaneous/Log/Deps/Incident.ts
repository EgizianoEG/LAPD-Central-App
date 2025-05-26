import {
  Colors,
  Message,
  Collection,
  inlineCode,
  userMention,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  ButtonBuilder,
  ComponentType,
  TextInputStyle,
  ActionRowBuilder,
  TextInputBuilder,
  AttachmentBuilder,
  ButtonInteraction,
  time as FormatTime,
  ModalSubmitInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  IncidentTypes,
  IncidentTypesType,
  IncidentNotesLength,
  IncidentStatusesFlattened,
  IncidentDescriptionLength,
} from "@Resources/IncidentConstants.js";

import { Types } from "mongoose";
import { TitleCase } from "@Utilities/Strings/Converters.js";
import { ReporterInfo } from "../Log.js";
import { milliseconds } from "date-fns";
import { ArraysAreEqual } from "@Utilities/Other/ArraysAreEqual.js";
import { ListSplitRegex } from "@Resources/RegularExpressions.js";
import { SendGuildMessages } from "@Utilities/Other/GuildMessages.js";
import { GuildIncidents, Guilds } from "@Typings/Utilities/Database.js";
import { FormatSortRDInputNames } from "@Utilities/Strings/Formatters.js";
import { GetDiscordAttachmentExtension } from "@Utilities/Strings/OtherUtils.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { FilterUserInput, FilterUserInputOptions } from "@Utilities/Strings/Redactor.js";
import IncidentModel, { GenerateNextIncidentNumber } from "@Models/Incident.js";

import IncrementActiveShiftEvent from "@Utilities/Database/IncrementActiveShiftEvent.js";
import DisableMessageComponents from "@Utilities/Other/DisableMsgComps.js";
import GetIncidentReportEmbeds from "@Utilities/Other/GetIncidentReportEmbeds.js";
import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";
import GuildModel from "@Models/Guild.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";
import Dedent from "dedent";

const CmdFileLabel = "Commands:Miscellaneous:Log:Incident";
const ListFormatter = new Intl.ListFormat("en");
type CmdProvidedDetailsType = Omit<Partial<GuildIncidents.IncidentRecord>, "attachments"> &
  Pick<GuildIncidents.IncidentRecord, "type" | "location" | "status"> & {
    attachments: string[];
  };

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
function GetIncidentInformationModal(
  CmdInteract: SlashCommandInteraction<"cached">,
  IncidentType: string
): ModalBuilder {
  return new ModalBuilder()
    .setTitle(`Incident Report — ${IncidentType}`)
    .setCustomId(`incident-info:${CmdInteract.createdTimestamp}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("incident-desc")
          .setLabel("Incident Description")
          .setPlaceholder(
            "Narrative incident in detail, including the sequence of events, injuries, damage, and actions taken."
          )
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(IncidentDescriptionLength.Min)
          .setMaxLength(IncidentDescriptionLength.Max)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("suspects")
          .setLabel("Suspects")
          .setPlaceholder("The names of the suspects involved, separated by commas.")
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(88)
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("victims")
          .setLabel("Victims")
          .setPlaceholder("The names of the victims, separated by commas.")
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(88)
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("notes")
          .setLabel("Additional Notes")
          .setPlaceholder(
            "Anything else you would like to add or mention about the incident like its updates."
          )
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(IncidentNotesLength.Min)
          .setMaxLength(IncidentNotesLength.Max)
          .setRequired(false)
      )
    );
}

function GetWitnessesInvolvedOfficersInputModal(
  Interact: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  InputType: "Officers" | "Witnesses",
  IncidentReport: GuildIncidents.IncidentRecord
): ModalBuilder {
  const Modal = new ModalBuilder()
    .setTitle(`Add ${InputType} to Incident Report`)
    .setCustomId(
      `incident-add-${InputType.toLowerCase()}:${Interact.user.id}:${Interact.createdTimestamp}`
    )
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId(InputType.toLowerCase())
          .setLabel(InputType === "Officers" ? "Involved Officers" : "Witnesses")
          .setPlaceholder(
            `The names or Discord IDs of the ${InputType.toLowerCase()} involved, separated by commas.`
          )
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(3)
          .setMaxLength(88)
          .setRequired(false)
      )
    );

  const PrefilledInput =
    IncidentReport[InputType.toLowerCase() as "officers" | "witnesses"].join(", ");

  if (PrefilledInput.length >= 3) {
    Modal.components[0].components[0].setValue(PrefilledInput);
  }

  return Modal;
}

function GetIOAndWitnessesButtons(
  CmdInteract: SlashCommandInteraction<"cached">
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`incident-add-io:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Set Involved Officers")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`incident-add-wit:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Set Incident Witnesses")
      .setStyle(ButtonStyle.Secondary)
  );
}

function GetConfirmationButtons(
  CmdInteract: SlashCommandInteraction<"cached">
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`incident-confirm:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Confirm Report and Submit")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`incident-cancel:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Cancel Incident Report")
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Updates the description of a field in an EmbedBuilder object. If the field
 * with the specified name exists, its value is updated. Otherwise, a new field is added to the embed.
 * @param Embed - The EmbedBuilder object to update.
 * @param FieldName - The name of the field to update or add.
 * @param FieldValue - The new value for the field.
 */
function UpdateEmbedFieldDescription(
  Embed: EmbedBuilder,
  FieldName: string,
  FieldValue: string
): void {
  const ExistingField = Embed.data.fields?.find((Field) => Field.name === FieldName);
  if (ExistingField) {
    ExistingField.value = FieldValue;
  } else {
    Embed.addFields({ name: FieldName, value: FieldValue });
  }
}

/**
 * Retrieves and processes details provided by a slash command interaction.
 * @param CmdInteract - The slash command interaction object with a "cached" type.
 * @returns A promise that resolves to an object containing the provided details
 *          (type, location, status, and filtered attachments) or `null` if invalid
 *          attachments are detected and an error response is sent.
 * @throws This function does not throw errors directly but may return `null` if an error response is sent.
 */
async function GetCmdProvidedDetails(
  CmdInteract: SlashCommandInteraction<"cached">
): Promise<CmdProvidedDetailsType | null> {
  let IncidentType = CmdInteract.options.getString("type", true);
  const MatchedType = IncidentTypes.find((type) => {
    const LCType = type.toLowerCase();
    const LCProvidedType = IncidentType.toLowerCase();
    return LCType === LCProvidedType || LCProvidedType.split(/[–-]/)[1]?.trim() === LCType;
  });

  if (!MatchedType) {
    return new ErrorEmbed()
      .useErrTemplate("LogIncidentInvalidType")
      .replyToInteract(CmdInteract, true)
      .then(() => null);
  }

  IncidentType = MatchedType;
  const ProvidedAttachments =
    CmdInteract.options.resolved?.attachments?.map((Attachment) => Attachment) || [];

  const FilteredAttachments = ProvidedAttachments.filter((Attachment) =>
    Attachment.contentType?.match(/^image[/\\](?:png|jpg|jpeg)/i)
  )
    .map((Attachment) => Attachment.url)
    .reverse();

  if (FilteredAttachments.length === 0 && ProvidedAttachments.length > 0) {
    return new ErrorEmbed()
      .useErrTemplate("LogIncidentInvalidAttachments")
      .replyToInteract(CmdInteract, true)
      .then(() => null);
  }

  return {
    type: IncidentType as IncidentTypesType,
    location: TitleCase(CmdInteract.options.getString("location", true), true),
    status: CmdInteract.options.getString("status", true),
    attachments: FilteredAttachments,
  } as CmdProvidedDetailsType;
}

/**
 * Awaits the submission of an incident details modal.
 * @param CmdInteract - The slash command interaction object.
 * @param IncidentType - The type of incident for which details are being collected. Used for modal title.
 * @returns A promise that resolves to the modal submission or `null` if the submission times out (10 minutes) or errors.
 */
async function AwaitIncidentDetailsModalSubmission(
  CmdInteract: SlashCommandInteraction<"cached">,
  IncidentType: string
) {
  const IncidentInfoModal = GetIncidentInformationModal(CmdInteract, IncidentType);
  return CmdInteract.showModal(IncidentInfoModal).then(() =>
    CmdInteract.awaitModalSubmit({
      time: milliseconds({ minutes: 12.5 }),
      filter: (Modal) =>
        Modal.user.id === CmdInteract.user.id &&
        Modal.customId === IncidentInfoModal.data.custom_id!,
    }).catch(() => null)
  );
}

/**
 * Prepares incident data for logging based on provided command interaction, API details, and modal submission.
 * @param CmdInteract - The slash command interaction object.
 * @param CmdProvidedDetails - Partial incident record details provided by the command, including mandatory fields: type, location, and status.
 * @param ModalSubmission - The modal submission interaction object.
 * @param GuildDocument - The current list of incident records in the guild.
 * @param ReportingOfficer - Information about the officer reporting the incident.
 * @returns A promise that resolves to the prepared incident data object or `null` if attachment validation fails.
 */
async function PrepareIncidentData(
  CmdInteract: SlashCommandInteraction<"cached">,
  CmdProvidedDetails: CmdProvidedDetailsType,
  ModalSubmission: ModalSubmitInteraction<"cached">,
  GuildDocument: Guilds.GuildDocument,
  ReportingOfficer: ReporterInfo
): Promise<GuildIncidents.IncidentRecord> {
  const UTIFOpts: FilterUserInputOptions = {
    replacement: "#",
    guild_instance: CmdInteract.guild,
    replacement_type: "Character",
    filter_links_emails: true,
    utif_setting_enabled: GuildDocument.settings.utif_enabled,
  };

  const InputNotes = ModalSubmission.fields.getTextInputValue("notes").replace(/\s+/g, " ") || null;
  const ReporterRobloxInfo = await GetUserInfo(ReportingOfficer.RobloxUserId);
  const IncidentNumber = await GenerateNextIncidentNumber(CmdInteract.guild.id);

  const IncidentNotes = InputNotes ? await FilterUserInput(InputNotes, UTIFOpts) : null;
  const IncidentLoc = await FilterUserInput(CmdProvidedDetails.location, UTIFOpts);
  const IncidentDesc = await FilterUserInput(
    ModalSubmission.fields
      .getTextInputValue("incident-desc")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
    UTIFOpts
  );

  const IncidentRecordInst: GuildIncidents.IncidentRecord = {
    ...CmdProvidedDetails,

    _id: new Types.ObjectId(),
    num: IncidentNumber,
    guild: CmdInteract.guildId,
    notes: IncidentNotes,
    location: IncidentLoc,
    description: IncidentDesc,
    last_updated: new Date(),
    last_updated_by: null,

    officers: [],
    witnesses: [],

    suspects: ModalSubmission.fields
      .getTextInputValue("suspects")
      .split(ListSplitRegex)
      .filter(Boolean),

    victims: ModalSubmission.fields
      .getTextInputValue("victims")
      .split(ListSplitRegex)
      .filter(Boolean),

    reported_on: ModalSubmission.createdAt,
    reporter: {
      discord_id: CmdInteract.user.id,
      discord_username: CmdInteract.user.username,
      roblox_id: ReportingOfficer.RobloxUserId,
      roblox_display_name: ReporterRobloxInfo?.displayName || "[Unknown]",
      roblox_username: ReporterRobloxInfo?.name || "[Unknown]",
    },
  };

  return IncidentRecordInst;
}

async function InsertIncidentRecord(
  Interact: ButtonInteraction<"cached"> | SlashCommandInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord
) {
  IncidentRecord = { ...IncidentRecord, num: await GenerateNextIncidentNumber(Interact.guild.id) };
  return IncidentModel.create(IncidentRecord);
}

// ---------------------------------------------------------------------------------------
// Confirmation Handling:
// ----------------------
async function OnReportConfirmation(
  BtnInteract: ButtonInteraction<"cached">,
  ConfirmationMsgComponents: ActionRowBuilder<ButtonBuilder>[],
  IncidentReport: GuildIncidents.IncidentRecord,
  IRChannelIds?: null | string | string[]
) {
  let InsertedRecord: GuildIncidents.IncidentRecord | null = null;
  await BtnInteract.update({
    components: DisableMessageComponents(ConfirmationMsgComponents.map((Comp) => Comp.toJSON())),
  }).catch(() => null);

  try {
    InsertedRecord = await InsertIncidentRecord(BtnInteract, IncidentReport).then((Res) => {
      IncrementActiveShiftEvent("incidents", BtnInteract.user.id, BtnInteract.guildId).catch(
        () => null
      );
      return Res;
    });
  } catch (Err: any) {
    AppLogger.error({
      message: Err.message,
      label: CmdFileLabel,
      stack: Err.stack,
    });

    return new ErrorEmbed()
      .useErrTemplate("LogIncidentDatabaseInsertFailed")
      .replyToInteract(BtnInteract, true, true, "followUp");
  }

  let ReportSentMessage: Message<true> | null = null;
  const Attachments = new Collection<string, AttachmentBuilder>(
    IncidentReport.attachments.map((Attachment, I) => [
      Attachment,
      new AttachmentBuilder(Attachment, {
        name: `inc-${IncidentReport.num}-attachment_${I + 1}.${GetDiscordAttachmentExtension(Attachment)}`,
      }),
    ])
  );

  if (IRChannelIds) {
    ReportSentMessage = await SendGuildMessages(BtnInteract, IRChannelIds, {
      files: Attachments.values().toArray(),
      embeds: GetIncidentReportEmbeds(IncidentReport, {
        channel_id: Array.isArray(IRChannelIds) ? IRChannelIds[0] : IRChannelIds,
        attachments_override: Attachments,
      }),
    });
  }

  const REDescription = Dedent(`
    The incident report has been successfully submitted and logged.
    - Incident Number: \`${IncidentReport.num}\`
    - Logged Report: ${ReportSentMessage?.url ?? "N/A"} 
  `);

  if (ReportSentMessage) {
    const MsgAttachmentURLs = ReportSentMessage.embeds
      .map((Embed) => Embed.data.image?.url)
      .filter((URL) => URL !== undefined);

    IncidentModel.updateOne(
      {
        guild: BtnInteract.guildId,
        _id: InsertedRecord!._id,
      },
      {
        $set: {
          attachments: MsgAttachmentURLs,
          log_message: `${ReportSentMessage.channelId}:${ReportSentMessage.id}`,
        },
      }
    )
      .exec()
      .catch((Err) =>
        AppLogger.error({
          message: "Failed to update the incident record with the log message.",
          stack: Err.stack,
        })
      );
  }

  return BtnInteract.editReply({
    embeds: [new SuccessEmbed().setTitle("Report Logged").setDescription(REDescription)],
    content: null,
    components: [],
  });
}

async function OnReportCancellation(BtnInteract: ButtonInteraction<"cached">) {
  return BtnInteract.update({
    components: [],
    content: "",
    embeds: [
      new InfoEmbed()
        .setTitle("Report Cancelled")
        .setDescription("The report submission has been cancelled, and it hasn't been recorded."),
    ],
  });
}

async function OnReportInvolvedOfficersOrWitnessesAddition(
  BtnInteract: ButtonInteraction<"cached">,
  ReportData: GuildIncidents.IncidentRecord,
  IREmbeds: EmbedBuilder[],
  AdditionFor: "Officers" | "Witnesses"
) {
  let CopiedTargetField = [...ReportData[AdditionFor.toLowerCase() as "officers" | "witnesses"]];
  const InputModal = GetWitnessesInvolvedOfficersInputModal(BtnInteract, AdditionFor, ReportData);
  const ModalSubmission = await BtnInteract.showModal(InputModal).then(() =>
    BtnInteract.awaitModalSubmit({
      time: milliseconds({ minutes: 10 }),
      filter: (Modal) =>
        Modal.user.id === BtnInteract.user.id && Modal.customId === InputModal.data.custom_id!,
    }).catch(() => null)
  );

  if (!ModalSubmission) return;
  let InputText = ModalSubmission.components[0].components[0].value;

  if (!InputText?.trim()) InputText = "N/A";
  CopiedTargetField = FormatSortRDInputNames(InputText.split(ListSplitRegex), false);

  if (!ArraysAreEqual(CopiedTargetField, ReportData[AdditionFor.toLowerCase()])) {
    ReportData[AdditionFor.toLowerCase()] = CopiedTargetField;
    if (AdditionFor === "Officers") {
      IREmbeds[0].setDescription(
        Dedent(`
          Incident Number: ${inlineCode(ReportData.num)}
          Incident Reported By: ${userMention(ModalSubmission.user.id)} on ${FormatTime(ReportData.reported_on, "f")}
          Involved Officers: ${ListFormatter.format(FormatSortRDInputNames(ReportData.officers, true))}
        `)
      );
    } else {
      UpdateEmbedFieldDescription(
        IREmbeds[0],
        "Witnesses",
        ListFormatter.format(ReportData.witnesses)
      );
    }
  }

  return Promise.all([ModalSubmission.deferUpdate(), BtnInteract.editReply({ embeds: IREmbeds })]);
}

async function HandleIRAdditionalDetailsAndConfirmation(
  CmdInteract: SlashCommandInteraction<"cached">,
  ModalSubmission: ModalSubmitInteraction<"cached">,
  CmdModalProvidedData: GuildIncidents.IncidentRecord,
  DAGuildSettings: Guilds.GuildSettings["duty_activities"]
) {
  const IncidentReportEmbeds = GetIncidentReportEmbeds(CmdModalProvidedData, {
    channel_id: CmdInteract.channelId,
  });

  const ConfirmationMsgComponents = [
    GetIOAndWitnessesButtons(CmdInteract),
    GetConfirmationButtons(CmdInteract),
  ];

  IncidentReportEmbeds[0].setColor(Colors.Gold).setTitle("Incident Report Confirmation");
  const ConfirmationMessage = await ModalSubmission.editReply({
    content: `${userMention(CmdInteract.user.id)} - Are you sure you want to submit this incident? Revise the incident details and add involved officers or witnesses if necessary.`,
    allowedMentions: { users: [CmdInteract.user.id] },
    components: ConfirmationMsgComponents,
    embeds: IncidentReportEmbeds,
  });

  ProcessReceivedIRBtnInteractions(
    CmdInteract,
    ConfirmationMessage,
    CmdModalProvidedData,
    IncidentReportEmbeds,
    ConfirmationMsgComponents,
    DAGuildSettings
  );
}

function ProcessReceivedIRBtnInteractions(
  CmdInteract: SlashCommandInteraction<"cached">,
  ConfirmationMessage: Message<true>,
  CmdModalProvidedData: GuildIncidents.IncidentRecord,
  ConfirmationMsgEmbeds: EmbedBuilder[],
  ConfirmationMsgComps: ActionRowBuilder<ButtonBuilder>[],
  DAGuildSettings: Guilds.GuildSettings["duty_activities"]
) {
  const ComponentCollector = ConfirmationMessage.createMessageComponentCollector({
    filter: (Interaction) => Interaction.user.id === CmdInteract.user.id,
    componentType: ComponentType.Button,
    time: milliseconds({ minutes: 10 }),
  });

  ComponentCollector.on("collect", async (BtnInteract) => {
    const BtnId = BtnInteract.customId;
    try {
      if (BtnId.includes("confirm")) {
        await OnReportConfirmation(
          BtnInteract,
          ConfirmationMsgComps,
          CmdModalProvidedData,
          DAGuildSettings.log_channels.incidents
        );
        ComponentCollector.stop("Confirmed");
      } else if (BtnId.includes("cancel")) {
        await OnReportCancellation(BtnInteract);
        ComponentCollector.stop("Cancelled");
      } else if (BtnId.includes("add-io")) {
        await OnReportInvolvedOfficersOrWitnessesAddition(
          BtnInteract,
          CmdModalProvidedData,
          ConfirmationMsgEmbeds,
          "Officers"
        );
      } else if (BtnId.includes("add-wit")) {
        await OnReportInvolvedOfficersOrWitnessesAddition(
          BtnInteract,
          CmdModalProvidedData,
          ConfirmationMsgEmbeds,
          "Witnesses"
        );
      }
    } catch (Err: any) {
      AppLogger.error({
        label: CmdFileLabel,
        message: "An error happened while handling incident report buttons.",
        stack: Err.stack,
      });

      if (Err instanceof AppError && Err.is_showable) {
        return new ErrorEmbed().useErrClass(Err).replyToInteract(BtnInteract, true, true, "reply");
      } else {
        return new ErrorEmbed()
          .useErrTemplate("UnknownError")
          .replyToInteract(BtnInteract, true, true, "reply");
      }
    }
  });

  ComponentCollector.on("end", async (Interacts, EndReason) => {
    if (
      EndReason.match(/reason: (?:\w+Delete|time|idle)/) ||
      ["Confirmed", "Cancelled"].includes(EndReason)
    ) {
      return;
    }

    const LastInteract = Interacts.last() || CmdInteract;
    ConfirmationMsgComps.forEach((ActionRow) =>
      ActionRow.components.forEach((Btn) => Btn.setDisabled(true))
    );

    await LastInteract.editReply({
      components: ConfirmationMsgComps,
    }).catch(() => {});
  });
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
/**
 * The callback function for the `/log incident` slash command.
 * @param CmdInteract - The interaction object.
 * @param ReportingOfficer - The information about the reporting officer.
 */
async function IncidentLogCallback(
  CmdInteract: SlashCommandInteraction<"cached">,
  ReportingOfficer: ReporterInfo
) {
  const CmdProvidedDetails = await GetCmdProvidedDetails(CmdInteract);
  if (!CmdProvidedDetails) return;

  const IDModalSubmission = await AwaitIncidentDetailsModalSubmission(
    CmdInteract,
    CmdProvidedDetails.type
  );

  if (!IDModalSubmission) return;
  await IDModalSubmission.deferReply({ flags: MessageFlags.Ephemeral });

  const GuildDocument = await GuildModel.findById(
    CmdInteract.guildId,
    {
      "settings.utif_enabled": 1,
      "settings.duty_activities.log_channels.incidents": 1,
    },
    { lean: true }
  ).exec();

  if (!GuildDocument) {
    return new ErrorEmbed()
      .useErrTemplate("DBGuildDocumentNotFound")
      .replyToInteract(IDModalSubmission, true, true, "editReply");
  }

  const CmdModalProvidedData = await PrepareIncidentData(
    CmdInteract,
    CmdProvidedDetails,
    IDModalSubmission,
    GuildDocument as unknown as Guilds.GuildDocument,
    ReportingOfficer
  );

  return HandleIRAdditionalDetailsAndConfirmation(
    CmdInteract,
    IDModalSubmission,
    CmdModalProvidedData,
    GuildDocument.settings.duty_activities
  );
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: IncidentLogCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("incident")
    .setDescription("Creates and logs a traffic warning citation record for a person.")
    .addStringOption((Option) =>
      Option.setName("type")
        .setDescription("The type of incident being reported.")
        .setAutocomplete(true)
        .setRequired(true)
        .setMaxLength(4)
        .setMaxLength(36)
    )
    .addStringOption((Option) =>
      Option.setName("location")
        .setDescription(
          "The precise location of the incident, including landmarks and a possible route if applicable."
        )
        .setMinLength(6)
        .setMaxLength(148)
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("status")
        .setDescription("The status of the incident being reported.")
        .setChoices(IncidentStatusesFlattened.map((Status) => ({ name: Status, value: Status })))
        .setMinLength(4)
        .setMaxLength(64)
        .setRequired(true)
    ),
};

for (let i = 1; i <= 10; i++) {
  CommandObject.data.addAttachmentOption((Option) =>
    Option.setName(`evidence_${i}`)
      .setDescription("Evidence and scene photos of the incident. Only static images are accepted.")
      .setRequired(false)
  );
}

// ----------------------------------------------------------------
export default CommandObject;
