import {
  User,
  Guild,
  Colors,
  Message,
  Collection,
  inlineCode,
  userMention,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  LabelBuilder,
  ButtonBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextInputBuilder,
  AttachmentBuilder,
  ButtonInteraction,
  time as FormatTime,
  PermissionFlagsBits,
  UserSelectMenuBuilder,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
  ThreadAutoArchiveDuration,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  IncidentTypes,
  IncidentTypesType,
  IncidentNotesLength,
  IncidentDescriptionLength,
  IncidentStatusesFlattened,
} from "#Resources/IncidentConstants.js";

import {
  FormatSortRDInputNames,
  FormatDutyActivitiesLogSignature,
} from "#Utilities/Strings/Formatters.js";

import { Types } from "mongoose";
import { TitleCase } from "#Utilities/Strings/Converters.js";
import { ReporterInfo } from "../Log.js";
import { milliseconds } from "date-fns";
import { ListSplitRegex } from "#Resources/RegularExpressions.js";
import { UserHasPermsV2 } from "#Utilities/Database/UserHasPermissions.js";
import { SendGuildMessages } from "#Utilities/Discord/GuildMessages.js";
import { GuildIncidents, Guilds } from "#Typings/Utilities/Database.js";
import { GetDiscordAttachmentExtension } from "#Utilities/Strings/OtherUtils.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import { FilterUserInput, FilterUserInputOptions } from "#Utilities/Strings/Redactor.js";
import { IsValidRobloxUsername, IsValidDiscordId } from "#Utilities/Helpers/Validators.js";

import GenerateNextSequentialIncidentNumber from "#Utilities/Database/GenerateNextSequenceIncNum.js";
import ShowModalAndAwaitSubmission from "#Source/Utilities/Discord/ShowModalAwaitSubmit.js";
import IncrementActiveShiftEvent from "#Utilities/Database/IncrementActiveShiftEvent.js";
import DisableMessageComponents from "#Utilities/Discord/DisableMsgComps.js";
import HandleCollectorFiltering from "#Utilities/Discord/HandleCollectorFilter.js";
import GetIncidentReportEmbeds from "#Utilities/Reports/GetIncidentReportEmbeds.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import IncidentModel from "#Models/Incident.js";
import GetUserInfo from "#Utilities/Roblox/GetUserInfo.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import AppError from "#Utilities/Classes/AppError.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Constants & Types:
// ------------------
const CmdFileLabel = "Commands:Miscellaneous:Log:Incident";
const ListFormatter = new Intl.ListFormat("en");
const MaxInvOfficers = 10;
const MaxWitnesses = 10;

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
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Incident Description")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("incident-desc")
            .setPlaceholder(
              "Narrative incident in detail, including the sequence of events, injuries, damage, and actions taken."
            )
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(IncidentDescriptionLength.Min)
            .setMaxLength(IncidentDescriptionLength.Max)
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel("Suspects")
        .setDescription("The names of the suspects involved, separated by commas.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("suspects")
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(88)
            .setRequired(false)
        ),
      new LabelBuilder()
        .setLabel("Victims")
        .setDescription("The names of the victims, separated by commas.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("victims")
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(88)
            .setRequired(false)
        ),
      new LabelBuilder()
        .setLabel("Additional Notes")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("notes")
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

/**
 * Builds a modal to collect comma-separated usernames for officers or witnesses.
 *
 * @remarks
 * - This modal is a fallback when users cannot be selected via the Discord
 *   multi-user select (for example, when referring to external names or
 *   non-discord identities). The field is prefilled with any existing
 *   usernames to make incremental edits easier.
 * - The max length is intentionally limited to keep modal submissions
 *   performant and to make downstream parsing predictable.
 *
 * @param Interact - The originating interaction that triggers the modal.
 * @param InputType - Whether the modal is collecting `Officers` or `Witnesses`.
 * @param CurrentUsernames - Existing usernames used to prefill the input.
 * @returns A configured `ModalBuilder` instance.
 */
function GetWitnessesInvolvedOfficersInputModal(
  Interact: SlashCommandInteraction<"cached"> | ButtonInteraction<"cached">,
  InputType: "Officers" | "Witnesses",
  CurrentUsernames: string[]
): ModalBuilder {
  const UsernamesInputField = new TextInputBuilder()
    .setCustomId(InputType.toLowerCase())
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(3)
    .setMaxLength(88)
    .setRequired(false);

  const Modal = new ModalBuilder()
    .setTitle(`Add ${InputType} (Names)`)
    .setCustomId(
      `incident-add-${InputType.toLowerCase()}:${Interact.user.id}:${Interact.createdTimestamp}`
    )
    .setLabelComponents(
      new LabelBuilder()
        .setLabel(InputType === "Officers" ? "Involved Officers" : "Witnesses")
        .setDescription(
          `The names or Discord user IDs of the ${InputType.toLowerCase()} involved, separated by commas.`
        )
        .setTextInputComponent(UsernamesInputField)
    );

  const PrefilledInput = CurrentUsernames.join(", ");
  if (PrefilledInput.length >= 3) {
    UsernamesInputField.setValue(PrefilledInput);
  }

  return Modal;
}

function GetInvolvedOfficersSelectMenu(): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setPlaceholder("Select officers involved in this incident...")
      .setCustomId("incident-io-select")
      .setMinValues(0)
      .setMaxValues(MaxInvOfficers)
  );
}

function GetWitnessesSelectMenu(): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setPlaceholder("Select witnesses to this incident...")
      .setCustomId("incident-wit-select")
      .setMinValues(0)
      .setMaxValues(MaxWitnesses)
  );
}

/**
 * Filters selected users for incident reports based on permissions and exclusions.
 *
 * @remarks
 * - Bots are removed immediately because they cannot meaningfully be
 *   recorded as involved personnel.
 * - `ExcludedIds` is used to avoid duplicates when the same person may be
 *   present in both the officers and witnesses selections; this simplifies
 *   overlap prevention logic in the UI flow.
 * - When `RequirePerms` is true the function consults `UserHasPermsV2` to
 *   ensure only staff/management can be recorded as officers. This mirrors
 *   the existing permission model used throughout the app and prevents
 *   misclassification of regular users as officers.
 *
 * @param GuildId - The guild ID for permission checks.
 * @param UsersCollection - Collection of selected users.
 * @param ExcludedIds - User Ids to exclude (e.g., already in the other list).
 * @param RequirePerms - Whether to check for staff/management permissions (for officers).
 * @returns Filtered collection of valid users.
 */
async function FilterIncidentPersonnel(
  GuildId: string,
  UsersCollection: Collection<string, User>,
  ExcludedIds: string[] = [],
  RequirePerms: boolean = true
): Promise<Collection<string, User>> {
  if (!UsersCollection.size) return UsersCollection;
  UsersCollection.sweep((User) => User.bot || ExcludedIds.includes(User.id));
  if (!UsersCollection.size || !RequirePerms) return UsersCollection;

  const Perms = await UserHasPermsV2([...UsersCollection.keys()], GuildId, {
    management: true,
    staff: true,
    $or: true,
  });

  UsersCollection.sweep((User) => !Perms[User.id]);
  return UsersCollection;
}

function GetIOAndWitnessesButtons(
  CmdInteract: SlashCommandInteraction<"cached">
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`incident-add-io:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Set Officers (Names)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`incident-add-wit:${CmdInteract.user.id}:${CmdInteract.createdTimestamp}`)
      .setLabel("Set Witnesses (Names)")
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
 * @param CmdInteract - The slash command interaction.
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
  const UniqueAttachments = new Set<string>();
  const ProvidedAttachments =
    CmdInteract.options.resolved?.attachments?.map((Attachment) => Attachment) || [];

  const FilteredAttachments = ProvidedAttachments.filter((Attachment) => {
    if (!Attachment.contentType?.match(/^image[/\\](?:png|jpg|jpeg|webp)/i)) {
      return false;
    }

    const UniqueId = `${Attachment.size}-${Attachment.contentType}-${Attachment.width}x${Attachment.height}`;
    if (UniqueAttachments.has(UniqueId)) {
      return false;
    }

    UniqueAttachments.add(UniqueId);
    return true;
  })
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
 * Prepares incident data for logging based on provided command interaction, API details, and modal submission.
 * @param CmdInteract - The slash command interaction object.
 * @param CmdProvidedDetails - Partial incident record details provided by the command, including mandatory fields: type, location, and status.
 * @param ModalSubmission - The modal submission interaction object.
 * @param GuildSettings - The current list of incident records in the guild.
 * @param ReportingOfficer - Information about the officer reporting the incident.
 * @returns A promise that resolves to the prepared incident data object or `null` if attachment validation fails.
 */
async function InitializeIncidentData(
  CmdInteract: SlashCommandInteraction<"cached">,
  CmdProvidedDetails: CmdProvidedDetailsType,
  ModalSubmission: ModalSubmitInteraction<"cached">,
  GuildSettings: Guilds.GuildDocument["settings"],
  ReportingOfficer: ReporterInfo
): Promise<GuildIncidents.IncidentRecord> {
  const UTIFOpts: FilterUserInputOptions = {
    replacement: "#",
    guild_instance: CmdInteract.guild,
    replacement_type: "Character",
    filter_links_emails: true,
    utif_setting_enabled: GuildSettings.utif_enabled,
  };

  const InputNotes =
    ModalSubmission.fields.getTextInputValue("notes").replaceAll(/\s+/g, " ") || null;
  const ReporterRobloxInfo = await GetUserInfo(ReportingOfficer.RobloxUserId);
  const IncidentNumber = await GenerateNextSequentialIncidentNumber(CmdInteract.guild.id);

  const IncidentNotes = InputNotes ? await FilterUserInput(InputNotes, UTIFOpts) : null;
  const IncidentLoc = await FilterUserInput(CmdProvidedDetails.location, UTIFOpts);
  const IncidentDesc = await FilterUserInput(
    ModalSubmission.fields
      .getTextInputValue("incident-desc")
      .replaceAll(/[^\S\r\n]+/g, " ")
      .replaceAll(/\n{3,}/g, "\n\n"),
    UTIFOpts
  );

  const UniqueSuspects = new Set<string>(
    ModalSubmission.fields
      .getTextInputValue("suspects")
      .split(ListSplitRegex)
      .map((Name) => Name.trim())
      .filter(Boolean)
  );

  const UniqueVictims = new Set<string>(
    ModalSubmission.fields
      .getTextInputValue("victims")
      .split(ListSplitRegex)
      .map((Name) => Name.trim())
      .filter(Boolean)
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
    suspects: Array.from(UniqueSuspects),
    victims: Array.from(UniqueVictims),

    reported_on: ModalSubmission.createdAt,
    reporter: {
      discord_id: CmdInteract.user.id,
      discord_username: CmdInteract.user.username,
      roblox_id: ReportingOfficer.RobloxUserId,
      roblox_display_name: ReporterRobloxInfo?.displayName || "[Unknown]",
      roblox_username: ReporterRobloxInfo?.name || "[Unknown]",
      signature: FormatDutyActivitiesLogSignature(
        CmdInteract.member,
        ReporterRobloxInfo,
        GuildSettings.duty_activities.signature_format
      ),
    },
  };

  return IncidentRecordInst;
}

async function InsertIncidentRecord(
  Interact: ButtonInteraction<"cached"> | SlashCommandInteraction<"cached">,
  IncidentRecord: GuildIncidents.IncidentRecord
): Promise<GuildIncidents.IncidentRecord | null> {
  IncidentRecord = {
    ...IncidentRecord,
    num: await GenerateNextSequentialIncidentNumber(Interact.guild.id),
  };

  const Session = await IncidentModel.startSession();
  let InsertedDocument: GuildIncidents.IncidentRecord | null = null;

  try {
    await Session.withTransaction(async () => {
      const CreatedDocuments = await IncidentModel.create([IncidentRecord], { session: Session });
      if (CreatedDocuments?.[0]) {
        InsertedDocument = CreatedDocuments[0];
        await GuildModel.updateOne(
          { _id: Interact.guildId },
          {
            $set: {
              "logs.incidents.most_recent_num": InsertedDocument.num,
            },
          },
          { session: Session }
        );
      }
    });
  } finally {
    await Session.endSession();
  }

  return InsertedDocument;
}

// ---------------------------------------------------------------------------------------
// Confirmation Handling:
// ----------------------
async function OnReportConfirmation(
  BtnInteract: ButtonInteraction<"cached">,
  ConfirmationMsgComponents: ActionRowBuilder<ButtonBuilder | UserSelectMenuBuilder>[],
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
      nonce: IncidentReport._id.toString(),
      embeds: GetIncidentReportEmbeds(IncidentReport, {
        channel_id: Array.isArray(IRChannelIds) ? IRChannelIds[0] : IRChannelIds,
        guild_id: BtnInteract.guildId,
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
    HandleIncThreadCreation(ReportSentMessage, IncidentReport);
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
          label: CmdFileLabel,
          stack: Err.stack,
          error: Err,
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

/**
 * Handles username-based modal input for officers or witnesses as a fallback.
 *
 * @remarks
 * - This modal path exists because not all involved parties are always
 *   resolvable to Discord users (for example, external witnesses or
 *   community members recorded by name). The modal allows free-text comma
 *   separated names which are then validated and normalized.
 * - The function intentionally only returns Roblox-valid usernames after
 *   parsing; the caller is responsible for deduplicating against already
 *   selected Discord users (both categories) and enforcing combined maximums.
 * - Duplicate names within the modal submission are removed (case-insensitive)
 *   to ensure the same username cannot appear twice from a single interaction.
 * - The caller must also filter results to prevent: (1) cross-category overlap
 *   (officers vs. witnesses), (2) Discord Ids already selected in the same
 *   category, and (3) usernames already selected via the Discord menu.
 * - The modal is awaited for up to 10 minutes to allow slow workflows but
 *   shorter than the component collector to reduce resource lock time.
 *
 * @param BtnInteract - The button interaction that triggered this.
 * @param CurrentNames - Current list of usernames for pre-filling.
 * @param AdditionFor - Whether adding officers or witnesses.
 * @returns Object containing deduplicated usernames and the modal submission, or empty if canceled.
 */
async function HandleNamesModalInput(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentNames: string[],
  AdditionFor: "Officers" | "Witnesses"
): Promise<{ ModalSubmission?: ModalSubmitInteraction<"cached">; Names?: string[] }> {
  const InputModal = GetWitnessesInvolvedOfficersInputModal(BtnInteract, AdditionFor, CurrentNames);
  const ModalSubmission = await ShowModalAndAwaitSubmission(
    BtnInteract,
    InputModal,
    milliseconds({ minutes: 8 })
  );

  if (!ModalSubmission) return {};
  const InputText = ModalSubmission.fields.getTextInputValue(AdditionFor.toLowerCase());
  const RawNames = InputText.split(ListSplitRegex)
    .map((Name) => Name.trim())
    .filter(Boolean);

  const Normalized = RawNames.map((Id) => Id.replace(/^<@!?(\d+)>$/, "$1").trim());
  const ValidNames = Normalized.filter(
    (Name) => IsValidRobloxUsername(Name) || IsValidDiscordId(Name)
  );

  const Names = Array.from(new Map(ValidNames.map((n) => [n.toLowerCase(), n])).values());
  return { ModalSubmission, Names };
}

/**
 * Filters modal-submitted names to prevent duplicates across all sources.
 *
 * @remarks
 * - Removes names that match the opposite category (officers vs witnesses).
 * - Removes names that match the same category's existing usernames.
 * - Removes Discord Ids already selected via menu in either category.
 * - All comparisons are case-insensitive for usernames.
 *
 * @param InputNames - Names from modal submission to filter.
 * @param SameCategoryNames - Existing usernames in the same category.
 * @param SameCategoryDiscordIds - Discord Ids selected via menu in same category.
 * @param OppositeCategoryNames - Usernames in the opposite category.
 * @param OppositeCategoryDiscordIds - Discord Ids in the opposite category.
 * @returns Filtered array containing only unique, non-conflicting names.
 */
function FilterModalSubmittedNames(
  TGuild: Guild,
  InputNames: string[],
  SameCategoryNames: string[],
  SameCategoryDiscordIds: string[],
  OppositeCategoryNames: string[],
  OppositeCategoryDiscordIds: string[]
): string[] {
  return InputNames.filter((Name) => {
    const LowerName = Name.toLowerCase();

    if (OppositeCategoryNames.some((UName) => UName.toLowerCase() === LowerName)) {
      return false;
    }

    if (OppositeCategoryDiscordIds.some((Id) => Id === Name || Id.toLowerCase() === LowerName)) {
      return false;
    }

    if (SameCategoryNames.some((UName) => UName.toLowerCase() === LowerName)) {
      return false;
    }

    if (IsValidDiscordId(Name)) {
      if (SameCategoryDiscordIds.includes(Name)) return false;
      const User = TGuild.client.users.cache.get(Name);
      return !User?.bot;
    }

    return true;
  });
}

/**
 * Updates the embed display for officers and witnesses.
 *
 * @remarks
 * - The embed shows combined lists of Discord mentions and raw usernames
 *   in a consistent, human-readable order. We pass `true` for mention
 *   resolution when appropriate to ensure Discord users are displayed as
 *   mentions while plain usernames are left as text.
 * - This function centralizes formatting to keep the confirmation UI and
 *   eventual log output consistent.
 */
function UpdateOfficersWitnessesEmbed(
  Embed: EmbedBuilder,
  ReportData: GuildIncidents.IncidentRecord,
  OfficersDiscordIds: string[],
  OfficersUsernames: string[],
  WitnessesDiscordIds: string[],
  WitnessesUsernames: string[]
): void {
  const CombinedOfficers = FormatSortRDInputNames(
    [...OfficersDiscordIds, ...OfficersUsernames],
    true
  );

  const CombinedWitnesses = FormatSortRDInputNames(
    [...WitnessesDiscordIds, ...WitnessesUsernames],
    true,
    false
  );

  Embed.setDescription(
    Dedent(`
      Incident Number: ${inlineCode(ReportData.num)}
      Incident Reported By: ${userMention(ReportData.reporter.discord_id)} on ${FormatTime(ReportData.reported_on, "f")}
      Involved Officers: ${ListFormatter.format(CombinedOfficers) || "N/A"}
    `)
  );

  UpdateEmbedFieldDescription(Embed, "Witnesses", ListFormatter.format(CombinedWitnesses) || "N/A");
}

async function HandleIncThreadCreation(
  ReportMessage: Message<true>,
  IncidentReport: GuildIncidents.IncidentRecord
) {
  const GuildSettings = await GetGuildSettings(ReportMessage.guildId);
  if (!GuildSettings?.duty_activities.incident_reports.auto_thread_management) return;
  if (ReportMessage.channel.isThread() || ReportMessage.channel.isThreadOnly()) return;
  if (IncidentReport.status.match(/cleared|closed|referred|inactivated|unfounded|cold/i)) return;
  if (
    !ReportMessage.channel
      .permissionsFor(await ReportMessage.guild.members.fetchMe())
      .has(PermissionFlagsBits.CreatePublicThreads, true)
  ) {
    return;
  }

  const ThreadName = `Incident Report #${IncidentReport.num} - ${IncidentReport.type}`;
  const CreatedThread = await ReportMessage.startThread({
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    reason: `Incident report #${IncidentReport.num} logged; a new thread has been created for it.`,
    name: ThreadName,
  });

  if (CreatedThread.ownerId === ReportMessage.author.id) {
    CreatedThread.members.add(IncidentReport.reporter.discord_id).catch(() => null);
  }

  return CreatedThread;
}

async function HandleIRAdditionalDetailsAndConfirmation(
  CmdInteract: SlashCommandInteraction<"cached">,
  ModalSubmission: ModalSubmitInteraction<"cached">,
  CmdModalProvidedData: GuildIncidents.IncidentRecord,
  DAGuildSettings: Guilds.GuildSettings["duty_activities"]
) {
  const IncidentReportEmbeds = GetIncidentReportEmbeds(CmdModalProvidedData, {
    channel_id: CmdInteract.channelId,
    guild_id: CmdInteract.guildId,
  });

  const OfficersSelectMenu = GetInvolvedOfficersSelectMenu();
  const WitnessesSelectMenu = GetWitnessesSelectMenu();
  const IOAndWitnessesButtons = GetIOAndWitnessesButtons(CmdInteract);
  const ConfirmationButtons = GetConfirmationButtons(CmdInteract);

  const ConfirmationMsgComponents = [
    OfficersSelectMenu,
    WitnessesSelectMenu,
    IOAndWitnessesButtons,
    ConfirmationButtons,
  ];

  IncidentReportEmbeds[0].setColor(Colors.Gold).setTitle("Incident Report Confirmation");
  const ConfirmationMessage = await ModalSubmission.editReply({
    allowedMentions: { users: [CmdInteract.user.id] },
    components: ConfirmationMsgComponents,
    embeds: IncidentReportEmbeds,
    content:
      `${userMention(CmdInteract.user.id)} - Are you sure you want to submit this incident?\n` +
      "Revise the incident details and add involved officers or witnesses if necessary.",
  });

  ProcessReceivedIRComponentInteractions(
    CmdInteract,
    ConfirmationMessage,
    CmdModalProvidedData,
    IncidentReportEmbeds,
    {
      OfficersSelectMenu,
      WitnessesSelectMenu,
      IOAndWitnessesButtons,
      ConfirmationButtons,
    },
    DAGuildSettings
  );
}

/**
 * Tracks and processes component interactions for incident report confirmation.
 *
 * @remarks
 * - This is the central interactive loop for the confirmation UI. It accepts
 *   both Discord multi-user select inputs and manual username modal submissions
 *   and merges them into the `CmdModalProvidedData` record.
 * - Overlap prevention across sources: modal-submitted usernames are filtered
 *   to remove duplicates with (1) the opposite category's usernames and Discord
 *   Ids, (2) the same category's existing usernames, and (3) numeric Discord
 *   Ids already selected via the menu in the same category. This ensures a
 *   person cannot be listed twice (once from Discord menu, once from modal).
 * - Overlap prevention within select menus: when a Discord user is added to
 *   officers they are immediately removed from witnesses (and vice versa).
 * - Combined maximums are enforced here (select + text). The function counts
 *   both sources before accepting additional entries to preserve the global
 *   limit expectation for reviewers and downstream processing.
 * - Permission checks for officer selections are delegated to
 *   `FilterIncidentPersonnel` so that only staff/management can be recorded
 *   as officers; non-permitted selections are removed silently from the
 *   collection and the user is shown an updated panel.
 * - This function mutates `CmdModalProvidedData.officers` and
 *   `CmdModalProvidedData.witnesses` as the user updates selections; the
 *   final save happens when the user confirms the report.
 * - Before assigning to `CmdModalProvidedData`, combined lists from both
 *   Discord selections and modal-provided usernames are deduplicated so
 *   the stored record contains distinct involved parties.
 */
function ProcessReceivedIRComponentInteractions(
  CmdInteract: SlashCommandInteraction<"cached">,
  ConfirmationMessage: Message<true>,
  CmdModalProvidedData: GuildIncidents.IncidentRecord,
  ConfirmationMsgEmbeds: EmbedBuilder[],
  Components: {
    OfficersSelectMenu: ActionRowBuilder<UserSelectMenuBuilder>;
    WitnessesSelectMenu: ActionRowBuilder<UserSelectMenuBuilder>;
    IOAndWitnessesButtons: ActionRowBuilder<ButtonBuilder>;
    ConfirmationButtons: ActionRowBuilder<ButtonBuilder>;
  },
  DAGuildSettings: Guilds.GuildSettings["duty_activities"]
) {
  let OfficersDiscordIds: string[] = [];
  let WitnessesDiscordIds: string[] = [];
  let OfficerNames: string[] = [];
  let WitnessNames: string[] = [];

  const GetAllComponents = () => [
    Components.OfficersSelectMenu,
    Components.WitnessesSelectMenu,
    Components.IOAndWitnessesButtons,
    Components.ConfirmationButtons,
  ];

  const UpdateMessageComponents = async (
    Interaction: ButtonInteraction<"cached"> | UserSelectMenuInteraction<"cached">
  ) => {
    UpdateOfficersWitnessesEmbed(
      ConfirmationMsgEmbeds[0],
      CmdModalProvidedData,
      OfficersDiscordIds,
      OfficerNames,
      WitnessesDiscordIds,
      WitnessNames
    );

    const CombinedOfficers = [...OfficersDiscordIds, ...OfficerNames];
    const CombinedWitnesses = [...WitnessesDiscordIds, ...WitnessNames];
    CmdModalProvidedData.officers = Array.from(new Set(CombinedOfficers));
    CmdModalProvidedData.witnesses = Array.from(new Set(CombinedWitnesses));

    await Interaction.editReply({
      components: GetAllComponents(),
      embeds: ConfirmationMsgEmbeds,
    }).catch(() => null);
  };

  const ComponentCollector = ConfirmationMessage.createMessageComponentCollector({
    filter: (Interact) => HandleCollectorFiltering(CmdInteract, Interact),
    time: milliseconds({ minutes: 10 }),
  });

  ComponentCollector.on("collect", async (ReceivedInteract) => {
    try {
      if (
        ReceivedInteract.isUserSelectMenu() &&
        ReceivedInteract.customId === "incident-io-select"
      ) {
        await ReceivedInteract.deferUpdate();
        const Filtered = await FilterIncidentPersonnel(
          CmdInteract.guildId,
          ReceivedInteract.users,
          WitnessesDiscordIds,
          true
        );

        const NewOfficerIds = [...Filtered.keys()];
        const CombinedTotal = NewOfficerIds.length + OfficerNames.length;

        if (CombinedTotal > MaxInvOfficers) {
          return new ErrorEmbed()
            .useErrTemplate("IncidentReportMaxOWExceeded", "involved officers", CombinedTotal)
            .replyToInteract(ReceivedInteract, true, true, "followUp");
        }

        OfficersDiscordIds = NewOfficerIds;
        OfficerNames = OfficerNames.filter((Name) => !NewOfficerIds.includes(Name));
        WitnessesDiscordIds = WitnessesDiscordIds.filter((Id) => !OfficersDiscordIds.includes(Id));
        Components.OfficersSelectMenu.components[0].setDefaultUsers(OfficersDiscordIds);
        Components.WitnessesSelectMenu.components[0].setDefaultUsers(WitnessesDiscordIds);

        await UpdateMessageComponents(ReceivedInteract);
        return;
      }

      if (
        ReceivedInteract.isUserSelectMenu() &&
        ReceivedInteract.customId === "incident-wit-select"
      ) {
        await ReceivedInteract.deferUpdate();
        const Filtered = await FilterIncidentPersonnel(
          CmdInteract.guildId,
          ReceivedInteract.users,
          OfficersDiscordIds,
          false
        );

        const NewWitnessIds = [...Filtered.keys()];
        const CombinedTotal = NewWitnessIds.length + WitnessNames.length;

        if (CombinedTotal > MaxWitnesses) {
          return new ErrorEmbed()
            .useErrTemplate("IncidentReportMaxOWExceeded", "witnesses", CombinedTotal)
            .replyToInteract(ReceivedInteract, true, true, "followUp");
        }

        WitnessesDiscordIds = NewWitnessIds;
        WitnessNames = WitnessNames.filter((Name) => !NewWitnessIds.includes(Name));
        OfficersDiscordIds = OfficersDiscordIds.filter((Id) => !WitnessesDiscordIds.includes(Id));
        Components.OfficersSelectMenu.components[0].setDefaultUsers(OfficersDiscordIds);
        Components.WitnessesSelectMenu.components[0].setDefaultUsers(WitnessesDiscordIds);

        await UpdateMessageComponents(ReceivedInteract);
        return;
      }

      if (ReceivedInteract.isButton()) {
        const BtnId = ReceivedInteract.customId;

        if (BtnId.includes("confirm")) {
          await ReceivedInteract.deferUpdate();

          CmdModalProvidedData.officers = FormatSortRDInputNames(
            [...OfficersDiscordIds, ...OfficerNames],
            false
          );

          CmdModalProvidedData.witnesses = FormatSortRDInputNames(
            [...WitnessesDiscordIds, ...WitnessNames],
            false,
            false
          );

          await OnReportConfirmation(
            ReceivedInteract,
            GetAllComponents() as ActionRowBuilder<ButtonBuilder>[],
            CmdModalProvidedData,
            DAGuildSettings.log_channels.incidents
          );

          ComponentCollector.stop("Confirmed");
          return;
        }

        if (BtnId.includes("cancel")) {
          await OnReportCancellation(ReceivedInteract);
          ComponentCollector.stop("Cancelled");
          return;
        }

        if (BtnId.includes("add-io")) {
          const { ModalSubmission, Names: IOfficers } = await HandleNamesModalInput(
            ReceivedInteract,
            OfficerNames,
            "Officers"
          );

          if (!ModalSubmission || !IOfficers) return;
          await ModalSubmission.deferUpdate();

          const FilteredIO = FilterModalSubmittedNames(
            ModalSubmission.guild,
            IOfficers,
            [],
            OfficersDiscordIds,
            [],
            WitnessesDiscordIds
          );

          const CombinedTotal = OfficersDiscordIds.length + FilteredIO.length;
          if (CombinedTotal > MaxInvOfficers) {
            return new ErrorEmbed()
              .useErrTemplate("IncidentReportMaxOWExceeded", "involved officers", CombinedTotal)
              .replyToInteract(ReceivedInteract, true, true, "followUp");
          }

          OfficerNames = FilteredIO;
          await UpdateMessageComponents(ReceivedInteract);
          return;
        }

        if (BtnId.includes("add-wit")) {
          const { ModalSubmission, Names: Witnesses } = await HandleNamesModalInput(
            ReceivedInteract,
            WitnessNames,
            "Witnesses"
          );

          if (!ModalSubmission || !Witnesses) return;
          await ModalSubmission.deferUpdate();

          const FilteredWitnesses = FilterModalSubmittedNames(
            ModalSubmission.guild,
            Witnesses,
            [],
            WitnessesDiscordIds,
            [],
            OfficersDiscordIds
          );

          const CombinedTotal = WitnessesDiscordIds.length + FilteredWitnesses.length;
          if (CombinedTotal > MaxWitnesses) {
            return new ErrorEmbed()
              .useErrTemplate("IncidentReportMaxOWExceeded", "witnesses", CombinedTotal)
              .replyToInteract(ReceivedInteract, true, true, "followUp");
          }

          WitnessNames = FilteredWitnesses;
          await UpdateMessageComponents(ReceivedInteract);
          return;
        }
      }
    } catch (Err: any) {
      AppLogger.error({
        label: CmdFileLabel,
        message: "An error happened while handling incident report components.",
        stack: Err.stack,
      });

      if (Err instanceof AppError && Err.is_showable) {
        return new ErrorEmbed()
          .useErrClass(Err)
          .replyToInteract(ReceivedInteract, true, true, "reply");
      } else {
        return new ErrorEmbed()
          .useErrTemplate("UnknownError")
          .replyToInteract(ReceivedInteract, true, true, "reply");
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
    const AllComponents = GetAllComponents();

    for (const ActionRow of AllComponents) {
      for (const Component of ActionRow.components) {
        Component.setDisabled(true);
      }
    }

    await LastInteract.editReply({
      components: AllComponents,
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

  const IncidentInfoModal = GetIncidentInformationModal(CmdInteract, CmdProvidedDetails.type);
  const IDModalSubmission = await ShowModalAndAwaitSubmission(
    CmdInteract,
    IncidentInfoModal,
    milliseconds({ minutes: 12.5 })
  );

  if (!IDModalSubmission) return;
  await IDModalSubmission.deferReply({ flags: MessageFlags.Ephemeral });

  const GuildSettings = await GetGuildSettings(CmdInteract.guildId);
  if (!GuildSettings) {
    return new ErrorEmbed()
      .useErrTemplate("DBGuildDocumentNotFound")
      .replyToInteract(IDModalSubmission, true, true, "editReply");
  }

  const CmdModalProvidedData = await InitializeIncidentData(
    CmdInteract,
    CmdProvidedDetails,
    IDModalSubmission,
    GuildSettings,
    ReportingOfficer
  );

  return HandleIRAdditionalDetailsAndConfirmation(
    CmdInteract,
    IDModalSubmission,
    CmdModalProvidedData,
    GuildSettings.duty_activities
  );
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: IncidentLogCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("incident")
    .setDescription(
      "File a formal incident report for recording and notification to configured incident channels."
    )
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
          "The whereabouts of the incident, including landmarks and a possible route if applicable."
        )
        .setMinLength(6)
        .setMaxLength(80)
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
