// Dependencies:
// -------------

import {
  User,
  Colors,
  codeBlock,
  Collection,
  GuildMember,
  userMention,
  ButtonStyle,
  ModalBuilder,
  EmbedBuilder,
  MessageFlags,
  LabelBuilder,
  ButtonBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextInputBuilder,
  ButtonInteraction,
  UserSelectMenuBuilder,
  ModalSubmitInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  FormatSortRDInputNames,
  FormatCharges,
  FormatHeight,
  FormatAge,
} from "#Utilities/Strings/Formatters.js";

import LogArrestReport, {
  type ArresteeInfoType,
  type ReportInfoType,
} from "#Utilities/Database/LogArrestReport.js";

import { RandomString } from "#Utilities/Strings/Random.js";
import { ReporterInfo } from "../Log.js";
import { UserHasPermsV2 } from "#Utilities/Database/UserHasPermissions.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "#Utilities/Classes/ExtraEmbeds.js";

import { DivisionBeats } from "#Source/Resources/LAPDCallsigns.js";
import { ArraysAreEqual } from "#Utilities/Helpers/ArraysAreEqual.js";
import { ListSplitRegex } from "#Resources/RegularExpressions.js";
import { FilterUserInput, FilterUserInputOptions } from "#Utilities/Strings/Redactor.js";
import { IsValidPersonHeight, IsValidRobloxUsername } from "#Utilities/Helpers/Validators.js";

import ShowModalAndAwaitSubmission from "#Utilities/Discord/ShowModalAwaitSubmit.js";
import HandleCollectorFiltering from "#Utilities/Discord/HandleCollectorFilter.js";
import GetActiveCallsign from "#Source/Utilities/Database/GetActiveCallsign.js";
import GetBookingMugshot from "#Utilities/ImageRendering/ThumbToMugshot.js";
import GetAllBookingNums from "#Utilities/Database/GetBookingNums.js";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import GetUserThumbnail from "#Utilities/Roblox/GetUserThumb.js";
import GetIdByUsername from "#Utilities/Roblox/GetIdByUsername.js";
import ERLCAgeGroups from "#Resources/ERLC-Data/ERLCAgeGroups.js";
import GetUserInfo from "#Utilities/Roblox/GetUserInfo.js";
import IsLoggedIn from "#Utilities/Database/IsUserLoggedIn.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import AppError from "#Utilities/Classes/AppError.js";
import Dedent from "dedent";

const ListFormatter = new Intl.ListFormat("en");
export type CmdOptionsType<IsPrimaryOfficerNullable extends boolean = false> = {
  PrimaryOfficer: IsPrimaryOfficerNullable extends true ? GuildMember | null : GuildMember;
  ArrestLocation: string | null;
  DetailArresting: string | null;
  Arrestee: string;
  AgeGroup: (typeof ERLCAgeGroups)[number]["name"];
  Gender: "Male" | "Female";
  Height: `${number}'${number}"`;
  Weight: number;
};

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
function GetAdditionalArrestDetailsModal(CmdInteract: SlashCommandInteraction<"cached">) {
  return new ModalBuilder()
    .setTitle("Arrest Report - Additional Information")
    .setCustomId(`arrest-report:${CmdInteract.user.id}:${RandomString(4)}`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Charges")
        .setDescription(
          "The list of charges and possibly warrants related to this arrest listed one by one."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Paragraph)
            .setCustomId("charges-text")
            .setPlaceholder("1. [Charge #1]\n2. [Charge #2]\n3. ...")
            .setMinLength(6)
            .setMaxLength(650)
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel("Evidence")
        .setDescription("A list of any evidence related to the arrest.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Paragraph)
            .setCustomId("evidence-text")
            .setPlaceholder("e.g., CCTV footage, photos, witness statements, etc.")
            .setMinLength(6)
            .setMaxLength(160)
            .setRequired(false)
        ),
      new LabelBuilder()
        .setLabel("Arrest Notes")
        .setDescription(
          "Any additional notes regarding the arrest. This is shown on MDT explicit searches only."
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setStyle(TextInputStyle.Short)
            .setCustomId("arrest-notes")
            .setPlaceholder("e.g., the suspect is popularly known as 'Dexter'.")
            .setMinLength(6)
            .setMaxLength(128)
            .setRequired(false)
        )
    );
}

function GetArrestPendingSubmissionComponents() {
  const AddUsernamesConfirmationComponents = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId("confirm-report")
      .setLabel("Confirm and Submit")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ao-add-usernames")
      .setLabel("Add Assisting Officers (Usernames)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cancel-report")
      .setLabel("Cancel Report")
      .setStyle(ButtonStyle.Danger)
  );

  const AsstOfficersMenu = new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setPlaceholder("Select the arrest's assisting officers.")
      .setCustomId("assisting-officers")
      .setMinValues(0)
      .setMaxValues(8)
  );

  return [AsstOfficersMenu, AddUsernamesConfirmationComponents] as const;
}

/**
 * Handles the validation of the slash command inputs.
 * @param Interaction
 * @param CmdOptions
 * @returns A boolean indicating whether the interaction was handled and responded to (true) or not (false).
 */
async function HandleCmdOptsValidation(
  Interaction: SlashCommandInteraction<"cached">,
  CmdOptions: CmdOptionsType<true>,
  Reporter: ReporterInfo
): Promise<boolean> {
  if (CmdOptions.PrimaryOfficer?.user.bot) {
    return new ErrorEmbed()
      .useErrTemplate("BotMemberSelected")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (!CmdOptions.PrimaryOfficer) {
    return new ErrorEmbed()
      .useErrTemplate("MemberNotFound")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (!IsValidPersonHeight(CmdOptions.Height)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedPersonHeight")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (!IsValidRobloxUsername(CmdOptions.Arrestee)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedRobloxUsername", CmdOptions.Arrestee)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  const [ARobloxId, , WasUserFound] = await GetIdByUsername(CmdOptions.Arrestee, true);
  if (!WasUserFound) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentRobloxUsername", CmdOptions.Arrestee)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (Reporter.RobloxUserId === ARobloxId) {
    return new ErrorEmbed()
      .useErrTemplate("SelfArrestAttempt")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

/**
 * Filters out assistant officers from a collection of users based on their permissions and the ID of the reporter.
 * @param {string} ReporterId - A string that represents the ID of the user who reported the arrest or is making the request.
 * @param {string} GuildId - A string that represents the ID of the guild.
 * @param UsersCollection - A collection of users (assistant officers).
 * @returns
 */
async function FilterAsstOfficers(
  ReporterId: string,
  GuildId: string,
  UsersCollection: Collection<string, User>
) {
  if (!UsersCollection.size) return UsersCollection;

  const Perms = await UserHasPermsV2([...UsersCollection.keys()], GuildId, {
    management: true,
    staff: true,
    $or: true,
  });

  UsersCollection.delete(ReporterId);
  UsersCollection.sweep((User) => User.bot || !Perms[User.id]);
  return UsersCollection;
}

async function OnReportCancellation(ButtonInteract: ButtonInteraction<"cached">) {
  return ButtonInteract.editReply({
    components: [],
    content: "",
    embeds: [
      new InfoEmbed()
        .setTitle("Report Cancelled")
        .setDescription("The report submission has been cancelled, and it hasn't been logged."),
    ],
  });
}

async function HandleAddAssistingOfficersUsernames(
  BtnInteract: ButtonInteraction<"cached">,
  CurrentAsstUsernames: string[]
): Promise<{ ModalSubmission?: ModalSubmitInteraction<"cached">; UsernamesInput?: string[] }> {
  const UsernamesInputField = new TextInputBuilder()
    .setCustomId("input-usernames")
    .setPlaceholder("Type in here...")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(88)
    .setRequired(false);

  const InputModal = new ModalBuilder()
    .setTitle("Add Assisting Officers - Usernames")
    .setCustomId(`arrest-add-ao-usernames:${BtnInteract.user.id}:${BtnInteract.createdTimestamp}`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Usernames")
        .setDescription("The usernames of assisting officers, separated by commas.")
        .setTextInputComponent(UsernamesInputField)
    );

  const PrefilledInput = (CurrentAsstUsernames || []).join(", ");
  if (PrefilledInput.length >= 3) {
    UsernamesInputField.setValue(PrefilledInput);
  }

  const ModalSubmission = await ShowModalAndAwaitSubmission(BtnInteract, InputModal, 8 * 60_000);
  if (!ModalSubmission) return {};
  await ModalSubmission.deferUpdate();

  const UsernamesInput = ModalSubmission.fields
    .getTextInputValue("input-usernames")
    .split(ListSplitRegex)
    .map((Name) => Name.trim())
    .filter(IsValidRobloxUsername);

  return { ModalSubmission, UsernamesInput };
}

async function OnReportConfirmation(
  ButtonInteract: ButtonInteraction<"cached">,
  ReporterInfo: ReportInfoType,
  ArresteeInfo: ArresteeInfoType
) {
  const LoggedReport = await LogArrestReport(ButtonInteract, ArresteeInfo, ReporterInfo);
  const RSDescription = Dedent(`
      The arrest report has been successfully submitted and logged.
      - Booking Number: \`${LoggedReport.booking_number}\`
      - Logged Report: ${LoggedReport.main_msg_link ?? "N/A"} 
    `);

  return ButtonInteract.editReply({
    embeds: [new SuccessEmbed().setTitle("Report Logged").setDescription(RSDescription)],
    components: [],
    content: "",
  });
}

/**
 * Handles the submission of the charges modal; of course.
 * @param ModalInteraction
 * @param CmdInteraction
 */
async function OnChargesAndDetailsModalSubmission(
  CmdInteract: SlashCommandInteraction<"cached">,
  CmdOptions: CmdOptionsType,
  ReporterMainInfo: ReporterInfo,
  ModalInteraction: ModalSubmitInteraction<"cached">
) {
  await ModalInteraction.deferReply({ flags: MessageFlags.Ephemeral });
  const [ArresteeId] = await GetIdByUsername(CmdOptions.Arrestee, true);
  const [ArresteeUserInfo, ArresteeThumbURL, ExistingBookingNums, GSettings] = await Promise.all([
    GetUserInfo(ArresteeId),
    GetUserThumbnail({
      UserIds: ArresteeId,
      Size: "420x420",
      Format: "png",
      CropType: "bust",
      IsManCharacter: CmdOptions.Gender === "Male",
    }),
    GetAllBookingNums(CmdInteract.guildId).then((Nums) => Nums.map((Num) => Num.num)),
    GetGuildSettings(CmdInteract.guildId),
  ]);

  let AsstOfficersDisIds: string[] = [];
  let AsstOfficersUsernames: string[] = [];
  const UTIFOpts: FilterUserInputOptions = {
    replacement: "#",
    guild_instance: CmdInteract.guild,
    replacement_type: "Character",
    filter_links_emails: true,
    utif_setting_enabled: GSettings.utif_enabled,
  };

  const [FilteredArrestLocation, FilteredDetailArresting, InputCharges, ArrestNotes, EvidenceText] =
    await FilterUserInput(
      [
        CmdOptions.ArrestLocation ?? "",
        CmdOptions.DetailArresting ?? "",
        ModalInteraction.fields.getTextInputValue("charges-text"),
        ModalInteraction.fields.getTextInputValue("arrest-notes"),
        ModalInteraction.fields.getTextInputValue("evidence-text"),
      ],
      UTIFOpts
    );

  CmdOptions.ArrestLocation = FilteredArrestLocation.length ? FilteredArrestLocation : null;
  CmdOptions.DetailArresting = FilteredDetailArresting.length ? FilteredDetailArresting : null;

  const FCharges = FormatCharges(InputCharges, GSettings.duty_activities.auto_annotate_ca_codes);
  const YearSuffix = new Date().getFullYear().toString().slice(-2);
  const BookingNumber = Number.parseInt(
    `${YearSuffix}${RandomString(4, /\d/, ExistingBookingNums)}`
  );

  const PrimaryIsReporter = CmdOptions.PrimaryOfficer.user.id === CmdInteract.user.id;
  const ArrestingOfficerRobloxId = PrimaryIsReporter
    ? null
    : await IsLoggedIn({
        user: { id: CmdOptions.PrimaryOfficer.user.id },
        guildId: CmdInteract.guildId,
      });

  const ArrestingOfficerRobloxInfo = ArrestingOfficerRobloxId
    ? await GetUserInfo(ArrestingOfficerRobloxId)
    : null;

  const ReporterDivisionBeat =
    (await GetActiveCallsign(CmdInteract.guildId, CmdInteract.user.id))?.designation.division ??
    null;

  const BookingMugshotURL = await GetBookingMugshot<true>({
    thumb_is_bust: true,
    return_url: true,
    head_position: 18,
    height: CmdOptions.Height,
    thumb_img: ArresteeThumbURL,
    booking_num: BookingNumber,
    user_gender: CmdOptions.Gender,
    booking_date: CmdInteract.createdAt,
    division: ReporterDivisionBeat ? DivisionBeats[ReporterDivisionBeat - 1]?.name : null,
  });

  if (!PrimaryIsReporter) {
    AsstOfficersDisIds.push(CmdInteract.user.id);
  }

  const ConfirmationEmbed = new EmbedBuilder()
    .setTitle("Arrest Report - Confirmation")
    .setDescription(
      `Arresting Officer: <@${CmdOptions.PrimaryOfficer.user.id}>\n` +
        `Assisting Officers: ${ListFormatter.format(AsstOfficersDisIds.map((Id) => userMention(Id))) || "N/A"}`
    )
    .setThumbnail(BookingMugshotURL)
    .setColor(Colors.Gold)
    .setFields([
      {
        name: "Arrestee",
        value: `${ArresteeUserInfo.displayName} (@${ArresteeUserInfo.name})`,
        inline: true,
      },
      {
        name: "Gender",
        value: CmdOptions.Gender,
        inline: true,
      },
      {
        name: "Arrest Age",
        value: CmdOptions.AgeGroup,
        inline: true,
      },
      {
        name: "Height",
        value: CmdOptions.Height,
        inline: true,
      },
      {
        name: "Weight",
        value: CmdOptions.Weight + " lbs",
        inline: true,
      },
      {
        name: "Charges",
        value: FCharges.join("\n"),
        inline: false,
      },
    ]);

  if (CmdOptions.ArrestLocation?.length) {
    ConfirmationEmbed.spliceFields(-1, 0, {
      name: "Loc. of Arrest",
      value: CmdOptions.ArrestLocation,
      inline: true,
    });
  }

  if (CmdOptions.DetailArresting?.length) {
    ConfirmationEmbed.spliceFields(-1, 0, {
      name: "Detail/Div. Arresting",
      value: CmdOptions.DetailArresting,
      inline: false,
    });
  }

  if (EvidenceText.length) {
    ConfirmationEmbed.spliceFields(-1, 0, {
      name: "Evidence",
      value: EvidenceText,
      inline: false,
    });
  }

  if (ArrestNotes.length) {
    ConfirmationEmbed.addFields({
      name: "Arrest Notes (shown on explicit DB queries)",
      value: codeBlock("fix", ArrestNotes),
      inline: false,
    });
  }

  const [AsstOfficersMenu, AddUsernamesConfirmationComponents] =
    GetArrestPendingSubmissionComponents();

  const ConfirmationMsg = await ModalInteraction.editReply({
    content: `<@${CmdInteract.user.id}>, please review the following arrest information before submitting.`,
    components: [AsstOfficersMenu, AddUsernamesConfirmationComponents],
    embeds: [ConfirmationEmbed],
  });

  const ComponentCollector = ConfirmationMsg.createMessageComponentCollector({
    filter: (Interact) => HandleCollectorFiltering(CmdInteract, Interact),
    time: 10 * 60_000,
  });

  ComponentCollector.on("collect", async (ReceivedInteract) => {
    if (ReceivedInteract.isUserSelectMenu() && ReceivedInteract.customId === "assisting-officers") {
      await ReceivedInteract.deferUpdate();
      const Filtered = await FilterAsstOfficers(
        CmdInteract.user.id,
        CmdInteract.guildId,
        ReceivedInteract.users
      );

      AsstOfficersDisIds = [
        ...(PrimaryIsReporter ? [] : [CmdInteract.user.id]),
        ...Filtered.keys(),
      ];

      AsstOfficersMenu.components[0].setDefaultUsers(AsstOfficersDisIds);
      const FormattedMentions =
        ListFormatter.format(AsstOfficersDisIds.map((Id) => userMention(Id))) || "N/A";

      await ReceivedInteract.editReply({
        components: [AsstOfficersMenu, AddUsernamesConfirmationComponents],
        embeds: [
          ConfirmationEmbed.setDescription(
            `Arresting Officer: <@${CmdOptions.PrimaryOfficer.user.id}>\nAssisting Officers: ${FormattedMentions}`
          ),
        ],
      }).catch(() => null);
    } else if (ReceivedInteract.isButton()) {
      if (ReceivedInteract.customId === "confirm-report") {
        await ReceivedInteract.deferUpdate();
        ComponentCollector.stop("Report Confirmation");
      } else if (ReceivedInteract.customId === "cancel-report") {
        await ReceivedInteract.deferUpdate();
        ComponentCollector.stop("Report Cancellation");
      } else if (ReceivedInteract.customId === "ao-add-usernames") {
        const { ModalSubmission, UsernamesInput } = await HandleAddAssistingOfficersUsernames(
          ReceivedInteract,
          AsstOfficersUsernames
        );

        if (!ModalSubmission || !UsernamesInput) return;
        if (!ArraysAreEqual(AsstOfficersUsernames, UsernamesInput)) {
          AsstOfficersUsernames = UsernamesInput;

          const FormattedMentions =
            ListFormatter.format(
              FormatSortRDInputNames([...AsstOfficersDisIds, ...AsstOfficersUsernames], true)
            ) || "N/A";

          await ModalSubmission.editReply({
            components: [AsstOfficersMenu, AddUsernamesConfirmationComponents],
            embeds: [
              ConfirmationEmbed.setDescription(
                `Arresting Officer: <@${CmdOptions.PrimaryOfficer.user.id}>\nAssisting Officers: ${FormattedMentions}`
              ),
            ],
          }).catch(() => null);
        }
      }
    }
  });

  ComponentCollector.once("end", async (CollectedInteracts, EndReason) => {
    const LastInteraction = CollectedInteracts.last();

    if (EndReason.match(/reason: (?:\w+Delete|time)/)) {
      AsstOfficersMenu.components[0].setDisabled(true);
      for (const Btn of AddUsernamesConfirmationComponents.components) Btn.setDisabled(true);
      return LastInteraction?.editReply({
        message: ConfirmationMsg,
        components: [AddUsernamesConfirmationComponents],
      }).catch(() => null);
    }

    try {
      if (!LastInteraction?.isButton()) return;
      if (EndReason === "Report Confirmation") {
        const ReporterRobloxUserInfo = await GetUserInfo(ReporterMainInfo.RobloxUserId);
        const ReportInfo: ReportInfoType = {
          shift_active: ReporterMainInfo.ActiveShift,
          report_date: CmdInteract.createdAt,
          asst_officers: [...AsstOfficersDisIds, ...AsstOfficersUsernames],

          detail_arresting: CmdOptions.DetailArresting,
          arrest_loc: CmdOptions.ArrestLocation,
          evidence: EvidenceText.length ? EvidenceText : null,

          reporting_officer: PrimaryIsReporter
            ? null
            : {
                discord_id: CmdInteract.user.id,
                roblox_user: {
                  display_name: ReporterRobloxUserInfo.displayName,
                  name: ReporterRobloxUserInfo.name,
                  id: ReporterRobloxUserInfo.id,
                },
              },

          arresting_officer: {
            discord_id: CmdOptions.PrimaryOfficer.user.id,
            roblox_user: {
              display_name:
                ArrestingOfficerRobloxInfo?.displayName ?? ReporterRobloxUserInfo.displayName,
              name: ArrestingOfficerRobloxInfo?.name ?? ReporterRobloxUserInfo.name,
              id: ArrestingOfficerRobloxInfo?.id ?? ReporterRobloxUserInfo.id,
            },
          },
        };

        const ArresteeInfo: ArresteeInfoType = {
          notes: ArrestNotes ?? null,
          booking_num: BookingNumber,
          booking_mugshot: BookingMugshotURL,
          Gender: CmdOptions.Gender,
          Height: CmdOptions.Height,
          Weight: CmdOptions.Weight,
          AgeGroup: CmdOptions.AgeGroup,
          formatted_charges: FCharges,
          roblox_user: {
            display_name: ArresteeUserInfo.displayName,
            name: ArresteeUserInfo.name,
            id: ArresteeId,
          },
        };

        await OnReportConfirmation(LastInteraction, ReportInfo, ArresteeInfo);
      } else {
        await OnReportCancellation(LastInteraction);
      }
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while handling submission of an arrest report.",
        label: "Commands:Miscellaneous:Log:Arrest:FollowUpModalSubmission",
        stack: Err.stack,
      });

      if (LastInteraction) {
        await new ErrorEmbed()
          .setTitle("Error")
          .setDescription(
            "Apologies; an unknown error occurred while handling this report submission."
          )
          .replyToInteract(LastInteraction, true);
      }
    }
  });
}

async function CmdCallback(Interaction: SlashCommandInteraction<"cached">, Reporter: ReporterInfo) {
  const CmdOptions = {
    PrimaryOfficer: Interaction.options.getMember("primary-officer") ?? Interaction.member,
    DetailArresting: Interaction.options.getString("arresting-detail", false),
    ArrestLocation: Interaction.options.getString("arrest-location", false),
    Arrestee: Interaction.options.getString("name", true),
    Gender: Interaction.options.getString("gender", true),
    Height: FormatHeight(Interaction.options.getString("height", true)),
    Weight: Interaction.options.getInteger("weight", true),
    AgeGroup: FormatAge(Interaction.options.getInteger("arrest-age", true)),
  } as CmdOptionsType<true>;

  const ResponseHandled = await HandleCmdOptsValidation(Interaction, CmdOptions, Reporter);
  if (ResponseHandled) return;
  const AdditionalDetailsModal = GetAdditionalArrestDetailsModal(Interaction);

  try {
    const AdditionalDetailsSubmission = await ShowModalAndAwaitSubmission(
      Interaction,
      AdditionalDetailsModal,
      8 * 60 * 1000,
      true
    );

    if (!AdditionalDetailsSubmission) return;
    await OnChargesAndDetailsModalSubmission(
      Interaction,
      CmdOptions as unknown as CmdOptionsType,
      Reporter,
      AdditionalDetailsSubmission
    );
  } catch (Err: unknown) {
    if (Err instanceof Error && !Err.message.match(/reason: (?:\w+Delete|time)/)) {
      throw new AppError({ message: Err.message, stack: Err.stack });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("arrest")
    .setDescription("File an arrest and produce an official report for case records.")
    .addStringOption((Option) =>
      Option.setName("name")
        .setDescription("The username of the arrested suspect.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20)
        .setAutocomplete(true)
    )
    .addStringOption((Option) =>
      Option.setName("gender")
        .setDescription("The gender of the apprehended suspect; either male or female.")
        .setRequired(true)
        .addChoices({ name: "Male", value: "Male" }, { name: "Female", value: "Female" })
    )
    .addIntegerOption((Option) =>
      Option.setName("arrest-age")
        .setDescription("The suspect's age group at the time of arrest.")
        .setRequired(true)
        .addChoices(...ERLCAgeGroups)
    )
    .addStringOption((Option) =>
      Option.setName("height")
        .setDescription("The arrested suspect's height, measured in feet and inches.")
        .setAutocomplete(true)
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(5)
    )
    .addIntegerOption((Option) =>
      Option.setName("weight")
        .setDescription("The arrested suspect's weight in pounds (lbs).")
        .setRequired(true)
        .setMinValue(25)
        .setMaxValue(700)
        .setAutocomplete(true)
    )
    .addUserOption((Option) =>
      Option.setName("primary-officer")
        .setDescription(
          "The officer who conducted the arrest and has primary responsibility for this case. Defaults to you."
        )
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("arrest-location")
        .setDescription("The location where the arrest took place.")
        .setMinLength(3)
        .setMaxLength(24)
        .setRequired(false)
    )
    .addStringOption((Option) =>
      Option.setName("arresting-detail")
        .setDescription("The division, sub-division, or detail responsible for the arrest.")
        .setMinLength(3)
        .setMaxLength(36)
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
