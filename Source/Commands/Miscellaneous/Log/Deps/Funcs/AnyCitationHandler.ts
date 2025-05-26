// Dependencies:
// -------------
import {
  ModalSubmitInteraction,
  ButtonInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ComponentType,
  ModalBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  userMention,
} from "discord.js";

import {
  FormatAge,
  FormatHeight,
  FormatUsername,
  FormatVehicleName,
  FormatCitViolations,
} from "@Utilities/Strings/Formatters.js";

import {
  IsValidLicensePlate,
  IsValidPersonHeight,
  IsValidRobloxUsername,
} from "@Utilities/Other/Validators.js";

import { FilterUserInput, FilterUserInputOptions } from "@Utilities/Strings/Redactor.js";
import { AllVehicleModelNames, AllVehicleModels } from "@Resources/ERLCVehicles.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { RenderFilledNTAForm } from "@Utilities/ImageRendering/GetFilledNTAForm.js";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import { ReporterInfo } from "../../Log.js";
import { RandomString } from "@Utilities/Strings/Random.js";
import { TitleCase } from "@Utilities/Strings/Converters.js";
import { Colors } from "@Config/Shared.js";

import HandleActionCollectorExceptions from "@Utilities/Other/HandleCompCollectorExceptions.js";
import LogTrafficCitation from "@Utilities/Database/LogCitation.js";
import FindClosestMatch from "didyoumean2";
import GetIdByUsername from "@Utilities/Roblox/GetIdByUsername.js";
import BrickColors from "@Resources/BrickColors.js";
import GetUserInfo from "@Utilities/Roblox/GetUserInfo.js";
import Dedent from "dedent";

import AppError from "@Utilities/Classes/AppError.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import GetAllCitationNums from "@Utilities/Database/GetCitationNumbers.js";
import ShowModalAndAwaitSubmission from "@Utilities/Other/ShowModalAwaitSubmit.js";
import CitationModel, { NTATypes } from "@Models/Citation.js";

const CmdFileLabel = "Commands:Miscellaneous:Log:CitWarn";
const ColorNames = BrickColors.map((BC) => BC.name);
type CitationWithOptionalDetails = Omit<
  GuildCitations.AnyCitationData,
  "img_url" | "nta_type" | "comments" | "case_details"
> &
  PartialAllowNull<Pick<GuildCitations.AnyCitationData, "comments" | "case_details" | "nta_type">>;

// ---------------------------------------------------------------------------------------
/**
 * Handles the execution of any citation log command; either warn or fine.
 * @param Interaction - The command interaction.
 * @param CitingOfficer - The one who invoked the command.
 * @param CmdFileLabel - A label to use for logging errors.
 */
export default async function AnyCitationCallback(
  Interaction: SlashCommandInteraction<"cached">,
  CitingOfficer: ReporterInfo,
  CmdFileLabel: string = "Commands:Miscellaneous:Log:AnyCitationHandler"
) {
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const SubCmdName = Interaction.options.getSubcommand();
  const CitationType = SubCmdName.includes("fine") ? "Fine" : "Warning";

  const CitationDetailsPart1: GuildCitations.InitialProvidedCmdDetails = {
    fine_amount: Interaction.options.getInteger("fine-amount", false),
    nta_type: (Interaction.options.getString("nta-type", false) ?? NTATypes.Traffic) as NTATypes,
    cit_type: CitationType,

    violator: {
      name: Interaction.options.getString("name", true),
      gender: Interaction.options.getString("gender", true),
      age: FormatAge(Interaction.options.getInteger("age", true)),
      height: FormatHeight(Interaction.options.getString("height", true)),
      weight: Interaction.options.getInteger("weight", true),
      eye_color: Interaction.options.getString("eye-color", true),
      hair_color: Interaction.options.getString("hair-color", true),
      lic_num: Interaction.options.getInteger("license-num", true).toString(),
      lic_is_comm: Interaction.options.getBoolean("commercial-lic", true),
      lic_class: "A",
      city: "Los Angeles",
    },

    vehicle: {
      is_boat: false,
      is_vehicle: true,
      is_aircraft: false,
      commercial: Interaction.options.getBoolean("vehicle-commercial", false) ?? false,
      hazardous_mat: Interaction.options.getBoolean("vehicle-hazardous", false) ?? false,
      lic_num: Interaction.options.getString("vehicle-plate", true).toUpperCase(),
      model: Interaction.options.getString("vehicle-model", true),
      color: Interaction.options.getString("vehicle-color", true),
    },

    comments: {
      accident: Interaction.options.getBoolean("involved-accident", false) ?? false,
      weather: Interaction.options.getString("weather", false),
      traffic: Interaction.options.getString("traffic", false),
      travel_dir: Interaction.options.getString("travel-dir", false),
      road_surface: Interaction.options.getString("surface", false),
    },

    case_details: {
      speed_approx: Interaction.options.getInteger("speed-approx", false),
      posted_speed: Interaction.options.getInteger("speed-limit", false),
      veh_speed_limit: Interaction.options.getInteger("vehicle-limit", false),
    },
  } as GuildCitations.InitialProvidedCmdDetails;

  const ValidationVars = await HandleCmdOptsValidation(
    Interaction,
    CitationDetailsPart1,
    CitingOfficer
  );

  // If the validation failed and a feedback was given, return early.
  if (ValidationVars === true) return;
  try {
    const [RespMsgButtons, Modal] = GetAdditionalInputsModal(Interaction);
    const ResponseMsg = await Interaction.editReply({
      embeds: [GetModalInputsPromptEmbed(CitationDetailsPart1, ValidationVars.vehicle)],
      components: [RespMsgButtons],
    });

    const ActionCollector = ResponseMsg.createMessageComponentCollector({
      filter: (BI) => BI.user.id === Interaction.user.id,
      componentType: ComponentType.Button,
      time: 10 * 60_000,
    });

    ActionCollector.on("collect", async (BInteract) => {
      try {
        const ModalSubmission = await ShowModalAndAwaitSubmission(BInteract, Modal, 10 * 60_000);
        if (!ModalSubmission) return;

        CitationDetailsPart1.violator.id = ValidationVars.violator_id;
        CitationDetailsPart1.vehicle = {
          ...ValidationVars.vehicle,
          color: CitationDetailsPart1.vehicle.color,
          year: ValidationVars.vehicle.model_year.org,
          make: ValidationVars.vehicle.brand,
          model: ValidationVars.vehicle.name,
          body_style: ValidationVars.vehicle.style,
          lic_num: CitationDetailsPart1.vehicle.lic_num.toUpperCase(),
        };

        ActionCollector.stop("ModalSubmitted");
        await OnModalSubmission(
          Interaction,
          CitationDetailsPart1 as GuildCitations.AnyCitationData,
          CitingOfficer,
          ModalSubmission
        );
      } catch (Err: any) {
        AppLogger.error({
          message: "An error occurred while handling additional citation details modal submission;",
          label: CmdFileLabel,
          stack: Err.stack,
          error: { ...Err },
        });
      }
    });
  } catch (Err: any) {
    if (Err instanceof Error && !Err.message.match(/reason: (?:\w+Delete|time)/)) {
      throw new AppError({ message: Err.message, stack: Err.stack });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Local Utility Functions:
// ------------------------
/**
 * Generates a random string of 5 characters, consisting of digits, based on a list of recorded citation numbers.
 * @param GuildId - The ID of the guild to get citation numbers from.
 * @returns a randomly generated string of length `5`, consisting of digits, based on the input parameter.
 */
async function GenerateCitationNumber(GuildId): Promise<number> {
  const AllCitNums = await GetAllCitationNums(GuildId);
  return parseInt(
    RandomString(
      5,
      /\d/,
      AllCitNums.map((Cit) => Cit.num.toString())
    )
  );
}

/**
 * Takes a string representing a weekday and returns a corresponding number.
 * @param {string} WeekDay - A string that represents a day of the week. A full name.
 * @returns If the input is one of the days of the week (Sunday to Saturday), the function returns the
 * corresponding number (`1` to `7`). If the input is not a valid day of the week, the function returns `0`.
 */
function WeekDayToNum(WeekDay: string): number {
  switch (WeekDay) {
    case "Sunday":
      return 1;
    case "Monday":
      return 2;
    case "Tuesday":
      return 3;
    case "Wednesday":
      return 4;
    case "Thursday":
      return 5;
    case "Friday":
      return 6;
    case "Saturday":
      return 7;
    default:
      return 0;
  }
}

/**
 * Returns the additional inputs modal to complete citation details.
 * @param CmdInteract - The interaction object received when the slash command was invoked.
 * @returns A tuple/list containing the modal show button, the modal, and the modal filter in order.
 */
function GetAdditionalInputsModal(CmdInteract: SlashCommandInteraction<"cached">) {
  const ModalShowButtonAR = new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId(`show-modal:${CmdInteract.user.id}`)
      .setLabel("Complete Citation Details")
      .setStyle(ButtonStyle.Secondary)
  );

  const Modal = new ModalBuilder()
    .setTitle("Traffic Citation - Additional Information")
    .setCustomId(`cit-log:${CmdInteract.user.id}:${RandomString(4)}`)
    .setComponents(
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Violator's Residence Address")
          .setStyle(TextInputStyle.Short)
          .setCustomId("residence-address")
          .setPlaceholder("e.g., 7013 Franklin Court")
          .setMinLength(6)
          .setMaxLength(70)
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Location of Violation(s)")
          .setStyle(TextInputStyle.Short)
          .setCustomId("violations-location")
          .setPlaceholder("e.g., River City Bank, Sandstone Road, Postal 205.")
          .setMinLength(6)
          .setMaxLength(70)
      ),
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setLabel("Violation(s)")
          .setStyle(TextInputStyle.Paragraph)
          .setCustomId("traffic-violations")
          .setPlaceholder(
            "Each violation shall be listed on a separate line.\ne.g.,\nSpeeding Over 30 mph\nSkipping Stop Sign"
          )
          .setMinLength(4)
          .setMaxLength(250)
      )
    );

  return [ModalShowButtonAR, Modal] as const;
}

function GetModalInputsPromptEmbed(
  CmdProvidedInfo: GuildCitations.InitialProvidedCmdDetails,
  ViolatorVehicle: (typeof AllVehicleModels)[number]
) {
  const Embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Citation Details — Initial Overview")
    .setDescription(
      "**Please review the current citation details and complete the remaining information by clicking the button below.**"
    )
    .setFields(
      {
        inline: false,
        name: "NTA and Citation Type",
        value: `${CmdProvidedInfo.nta_type ?? "Traffic"} ${CmdProvidedInfo.cit_type ?? "Warning"}`,
      },
      {
        inline: true,
        name: "Violator",
        value: `@${CmdProvidedInfo.violator.name}`,
      },
      {
        inline: true,
        name: "Violator Age G.",
        value: CmdProvidedInfo.violator.age,
      },
      {
        inline: true,
        name: "Gender",
        value: CmdProvidedInfo.violator.gender,
      },
      {
        inline: true,
        name: "Vehicle Model",
        value: FormatVehicleName(ViolatorVehicle, {
          name: ViolatorVehicle.brand,
          alias: ViolatorVehicle.counterpart,
        }),
      },
      {
        inline: true,
        name: "Vehicle Color",
        value: CmdProvidedInfo.vehicle.color,
      },
      {
        inline: true,
        name: "License Plate",
        value: CmdProvidedInfo.vehicle.lic_num,
      },
      {
        inline: true,
        name: "License Number",
        value: CmdProvidedInfo.violator.lic_num,
      }
    );

  if (CmdProvidedInfo.fine_amount) {
    Embed.addFields({
      inline: true,
      name: "Fine Amount",
      value: `${CmdProvidedInfo.fine_amount}$`,
    });
  }

  return Embed;
}

/**
 * Validates the command options before the command is executed.
 * This function will attempt to make the citation information valid including vehicle model, color, and violator height by changing the `CitationInfo` object values if necessary.
 * @param Interaction
 * @param CitationInfo
 * @returns If all command inputs are valid, a Promise that resolves to an object with the following properties:
 * - `violator_id`: a number representing the ID of the violator; `0` if no user was found.
 * - `vehicle`: an object representing the vehicle, including its model and brand (if the function didn't respond back).
 */
async function HandleCmdOptsValidation(
  Interaction: SlashCommandInteraction<"cached">,
  CitationInfo: GuildCitations.InitialProvidedCmdDetails,
  CitingOfficer: ReporterInfo
): Promise<
  | {
      violator_id: number;
      vehicle: (typeof AllVehicleModels)[number] & GuildCitations.VehicleInfo;
    }
  | true
> {
  if (!ColorNames.includes(CitationInfo.vehicle.color)) {
    const ClosestColorName = FindClosestMatch(CitationInfo.vehicle.color, ColorNames);
    if (!ClosestColorName || !ColorNames.includes(ClosestColorName)) {
      return new ErrorEmbed()
        .useErrTemplate("ACUnknownColor")
        .replyToInteract(Interaction, true)
        .then(() => true);
    } else {
      CitationInfo.vehicle.color = ClosestColorName;
    }
  }

  // Validate the Roblox username. Notice that the `name` property only reflects the Roblox username yet.
  if (!IsValidRobloxUsername(CitationInfo.violator.name)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedRobloxUsername", CitationInfo.violator.name)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (!IsValidLicensePlate(CitationInfo.vehicle.lic_num)) {
    return new ErrorEmbed()
      .useErrTemplate("InvalidLicensePlate")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (CitationInfo.violator?.height && !IsValidPersonHeight(CitationInfo.violator.height)) {
    CitationInfo.violator.height = FormatHeight(CitationInfo.violator.height);
    if (!IsValidPersonHeight(CitationInfo.violator.height)) {
      return new ErrorEmbed()
        .useErrTemplate("MalformedPersonHeight")
        .replyToInteract(Interaction, true)
        .then(() => true);
    }
  }

  const VehicleFound = AllVehicleModels.find((Model) => {
    const MName = FormatVehicleName(Model, { name: Model.brand, alias: Model.counterpart });
    return (
      MName === CitationInfo.vehicle.model.trim() ||
      MName ===
        FindClosestMatch(CitationInfo.vehicle.model.trim(), AllVehicleModelNames, {
          threshold: 0.25,
        })
    );
  });

  if (!VehicleFound) {
    return new ErrorEmbed()
      .useErrTemplate("ACUnknownVehicle")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  const [ViolatorID, ExactUsername, WasUserFound] = await GetIdByUsername(
    CitationInfo.violator.name,
    true
  );
  if (!WasUserFound) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentRobloxUsername", CitationInfo.violator.name)
      .replyToInteract(Interaction, true)
      .then(() => true);
  } else if (CitingOfficer.RobloxUserId === ViolatorID) {
    return new ErrorEmbed()
      .useErrTemplate("SelfCitationAttempt")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  CitationInfo.violator.name = ExactUsername;
  return {
    violator_id: ViolatorID,
    vehicle: { ...CitationInfo.vehicle, ...VehicleFound },
  };
}

/**
 * Handles post modal submission execution logic.
 * @param CmdInteract
 * @param PCitationData - The partial citation data to process and complete.
 * @param CitingOfficer - The officer who is issuing the citation (who also invoked the command).
 * @param ModalSubmission - The modal submission of the last needed information.
 */
async function OnModalSubmission(
  CmdInteract: SlashCommandInteraction<"cached">,
  PCitationData: GuildCitations.AnyCitationData,
  CitingOfficer: ReporterInfo,
  ModalSubmission: ModalSubmitInteraction<"cached">
) {
  if (ModalSubmission.isFromMessage()) {
    await ModalSubmission.update({
      content: null,
      embeds: [new InfoEmbed().useInfoTemplate("ProcessingCitationDetails")],
      components: [],
    });
  } else {
    await ModalSubmission.deferUpdate();
    await ModalSubmission.editReply({
      content: null,
      embeds: [new InfoEmbed().useInfoTemplate("ProcessingCitationDetails")],
      components: [],
    });
  }

  const ViolatorRobloxInfo = await GetUserInfo(PCitationData.violator.id);
  const OfficerRobloxInfo = await GetUserInfo(CitingOfficer.RobloxUserId);
  const GuildSettings = await GetGuildSettings(ModalSubmission.guildId);

  if (!GuildSettings) {
    return new ErrorEmbed()
      .useErrTemplate("GuildConfigNotFound")
      .replyToInteract(ModalSubmission, true);
  }

  let ConfirmationBtnResponse: ButtonInteraction<"cached"> | null = null;
  const UTIFOpts: FilterUserInputOptions = {
    replacement: "#",
    guild_instance: CmdInteract.guild,
    replacement_type: "Character",
    filter_links_emails: true,
    utif_setting_enabled: GuildSettings.utif_enabled,
  };

  try {
    const CitationNumber = await GenerateCitationNumber(ModalSubmission.guildId);
    const DateInfo = CmdInteract.createdAt
      .toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "long",
        month: "long",
        year: "numeric",
        day: "numeric",
        hour12: true,
      })
      .match(/(?<dow>\w+), (?<date>.+)/);

    const TimeInfo = CmdInteract.createdAt
      .toLocaleTimeString("en-US", {
        timeZone: "America/Los_Angeles",
        hour12: true,
      })
      .match(/(?<time>[\d:]+) (?<day_period>\w+)/);

    const CitationFullData: CitationWithOptionalDetails = {
      ...PCitationData,
      dov: DateInfo!.groups!.date,
      tov: TimeInfo!.groups!.time,
      guild: ModalSubmission.guildId,
      issued_on: CmdInteract.createdAt,

      nta_type: PCitationData.nta_type,
      cit_type: PCitationData.cit_type
        ? PCitationData.cit_type
        : PCitationData.fine_amount
          ? "Fine"
          : "Warning",

      dow: WeekDayToNum(DateInfo!.groups!.dow),
      ampm: TimeInfo!.groups!.day_period as "AM" | "PM",
      num: CitationNumber,
      vehicle: PCitationData.vehicle,
      fine_amount: PCitationData.fine_amount,

      violations: FormatCitViolations(
        await FilterUserInput(
          ModalSubmission.fields.getTextInputValue("traffic-violations"),
          UTIFOpts
        )
      ),

      violation_loc: TitleCase(
        await FilterUserInput(
          ModalSubmission.fields.getTextInputValue("violations-location"),
          UTIFOpts
        ),
        true
      ),

      violator: {
        ...PCitationData.violator,
        id: PCitationData.violator.id,
        age: PCitationData.violator.age,
        name: FormatUsername(ViolatorRobloxInfo),
        city: "Los Angeles",
        address:
          TitleCase(
            await FilterUserInput(
              ModalSubmission.fields.getTextInputValue("residence-address"),
              UTIFOpts
            )
          ) || "N/A",
      },

      citing_officer: {
        discord_id: CmdInteract.user.id,
        roblox_id: CitingOfficer.RobloxUserId,
        name: OfficerRobloxInfo.name,
        display_name: OfficerRobloxInfo.displayName,
      },
    };

    const CitationDocument = new CitationModel(CitationFullData);
    const CitationImgBuffer = await RenderFilledNTAForm(CitationDocument);
    const CitImageAttachment = new AttachmentBuilder(CitationImgBuffer, {
      name: `citation_${CmdInteract.createdAt.getFullYear().toString().slice(-2)}_${CitationFullData.num}.jpg`,
    });

    const ConfirmationButtonAR = new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setCustomId("confirm-citation")
        .setLabel("Confirm and Submit")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancel-citation")
        .setLabel("Cancel Citation")
        .setStyle(ButtonStyle.Danger)
    );

    const ConfirmationMsgEmbed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("Confirmation Required")
      .setImage(`attachment://${CitImageAttachment.name}`)
      .setDescription(
        `${userMention(CmdInteract.user.id)}, please confirm that the citation information in the attached image below is correct and ready to be submitted.`
      );

    const ConfirmationMsg = await ModalSubmission.editReply({
      components: [ConfirmationButtonAR],
      embeds: [ConfirmationMsgEmbed],
      files: [CitImageAttachment],
    });

    const DisablePrompt = () => {
      ConfirmationButtonAR.components.forEach((Button) => Button.setDisabled(true));
      return ModalSubmission.editReply({
        components: [ConfirmationButtonAR],
      }).catch(() => null);
    };

    const ButtonResponse = await ConfirmationMsg.awaitMessageComponent({
      filter: (BI) => BI.user.id === CmdInteract.user.id,
      componentType: ComponentType.Button,
      time: 10 * 60_000,
    }).catch((Err) => HandleActionCollectorExceptions(Err, DisablePrompt));

    if (!ButtonResponse) return;
    // eslint-disable-next-line sonarjs/no-dead-store
    ConfirmationBtnResponse = ButtonResponse;

    if (ButtonResponse.customId === "confirm-citation") {
      await ButtonResponse.update({
        files: [],
        content: null,
        components: [],
        embeds: [new InfoEmbed().useInfoTemplate("LoggingCitationRecord")],
      });

      const MainLogMsgLink = await LogTrafficCitation(
        ButtonResponse,
        CitationDocument,
        CitationImgBuffer,
        ViolatorRobloxInfo
      );

      const CEDescription = Dedent(`
        The traffic citation has been successfully created and logged.
        - Citation Number: \`${CitationFullData.num}\`
        - Citation Log: ${MainLogMsgLink ?? "N/A"} 
      `);

      return ButtonResponse.editReply({
        embeds: [new SuccessEmbed().setTitle("Citation Logged").setDescription(CEDescription)],
        components: [],
        content: "",
        files: [],
      });
    } else {
      return ButtonResponse.update({
        components: [],
        content: "",
        files: [],
        embeds: [
          new InfoEmbed()
            .setTitle("Citation Cancelled")
            .setDescription(
              "The citation submission has been cancelled, and it hasn't been logged."
            ),
        ],
      });
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "An error occurred while handling submission process of a citation.",
      label: CmdFileLabel,
      stack: Err.stack,
      error: { ...Err },
    });

    return new ErrorEmbed()
      .setDescription(
        "Apologies; an error occurred while handling your traffic citation log request."
      )
      .replyToInteract(ConfirmationBtnResponse ?? ModalSubmission, true);
  }
}
