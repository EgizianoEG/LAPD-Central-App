import { type Guilds } from "@Typings/Utilities/Database.js";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { FormatCallsignDesignation } from "@Utilities/Strings/Formatters.js";
import { ErrorContainer, InfoContainer } from "@Utilities/Classes/ExtraContainers.js";
import { ServiceUnitTypes, DivisionBeats } from "@Resources/LAPDCallsigns.js";
import { differenceInMilliseconds, milliseconds } from "date-fns";
import { SlashCommandSubcommandBuilder, RepliableInteraction, MessageFlags } from "discord.js";
import {
  CallsignValidationData,
  GetCallsignValidationData,
} from "@Utilities/Database/CallsignData.js";

import CallsignsEventLogger from "@Utilities/Classes/CallsignsEventLogger.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import CallsignModel from "@Models/Callsign.js";
import AppError from "@Utilities/Classes/AppError.js";

const CallsignEventLogger = new CallsignsEventLogger();
const DeniedRequestCooldown = milliseconds({ hours: 1 });
const ExpiredCallsignCooldown = milliseconds({ minutes: 30 });
const CancelledRequestCooldown = milliseconds({ minutes: 30 });
const ServiceUnitTypesNormalized = ServiceUnitTypes.map((u) => u.unit);
const DivisionBeatIntegers = DivisionBeats.map((d) => d.num) as number[];

// ---------------------------------------------------------------------------------------
// Validation Helpers:
// -------------------
/**
 * Validates the callsign format and availability using pre-fetched data.
 * @param Interaction - The interaction object.
 * @param Division - The division number (1-36).
 * @param UnitType - The unit type string.
 * @param BeatNum - The beat number.
 * @param ValidationData - Pre-fetched callsign validation data.
 * @returns A promise resolving to `true` if an error response is sent due to invalid callsign,
 *          or `false` if the callsign is valid and available.
 */
export async function ValidateCallsignFormat(
  Interaction: RepliableInteraction<"cached">,
  Division: number,
  UnitType: string,
  BeatNum: number,
  ValidationData: CallsignValidationData
): Promise<boolean> {
  if (Division < 1 || Division > 36) {
    return new ErrorContainer()
      .useErrTemplate("CallsignInvalidFormat")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  UnitType = UnitType.toUpperCase();
  UnitType = UnitType === "AIR" ? "Air" : UnitType;

  if (!ServiceUnitTypesNormalized.includes(UnitType)) {
    return new ErrorContainer()
      .useErrTemplate("CallsignInvalidUnitType", UnitType)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (BeatNum < 1 || BeatNum > 999) {
    return new ErrorContainer()
      .useErrTemplate("CallsignInvalidFormat")
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (!DivisionBeatIntegers.includes(Division)) {
    return new ErrorContainer()
      .useErrTemplate("CallsignInvalidDivision", Division)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  if (
    ValidationData.existing_callsign &&
    ValidationData.existing_callsign.requester !== Interaction.user.id
  ) {
    const FormattedBeatNum = BeatNum.toString().padStart(2, "0");
    const CallsignString = `${Division}-${UnitType}-${FormattedBeatNum}`;
    return new ErrorContainer()
      .useErrTemplate("CallsignNotAvailable", CallsignString)
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

/**
 * Validates if the user has permission to request the specified unit type.
 * @param Interaction - The interaction object.
 * @param UnitType - The unit type to validate.
 * @returns A promise resolving to `true` if an error response is sent due to restricted unit type,
 *          or `false` if the user has permission.
 */
export async function ValidateUnitTypePermissions(
  Interaction: SlashCommandInteraction<"cached">,
  ModuleSettings: Guilds.GuildSettings["callsigns_module"],
  UnitType: string
): Promise<boolean> {
  const UnitTypeUpper = UnitType.toUpperCase();
  const UnitTypeRestriction = ModuleSettings.unit_type_restrictions.find(
    (Restriction) => Restriction.unit_type === UnitTypeUpper
  );

  if (UnitTypeRestriction && UnitTypeRestriction.permitted_roles.length > 0) {
    const UserRoles = Interaction.member.roles.cache.map((Role) => Role.id);
    const HasRequiredRole = UnitTypeRestriction.permitted_roles.some((RoleId) =>
      UserRoles.includes(RoleId)
    );

    if (!HasRequiredRole) {
      return new ErrorContainer()
        .useErrTemplate("CallsignUnitTypeRestricted", UnitTypeUpper)
        .replyToInteract(Interaction, true)
        .then(() => true);
    }
  }

  return false;
}

/**
 * Validates if the user has permission to request the specified identifier.
 * @param Interaction - The interaction object.
 * @param BeatNum - The beat number to validate.
 * @returns A promise resolving to `true` if an error response is sent due to restricted identifier,
 *          or `false` if the user has permission.
 */
export async function ValidateIdentifierPermissions(
  Interaction: SlashCommandInteraction<"cached">,
  ModuleSettings: Guilds.GuildSettings["callsigns_module"],
  BeatNum: number
): Promise<boolean> {
  const MemberRoles = Interaction.member.roles.cache.map((Role) => Role.id);

  for (const Restriction of ModuleSettings.beat_restrictions) {
    const [MinRange, MaxRange] = Restriction.range;

    // Check if the beat number falls within this restriction range
    if (BeatNum >= MinRange && BeatNum <= MaxRange) {
      if (Restriction.exclude.includes(BeatNum)) {
        return new ErrorContainer()
          .useErrTemplate("CallsignIdentifierRestricted", BeatNum.toString())
          .replyToInteract(Interaction, true)
          .then(() => true);
      }

      // Check if user has required roles for this range
      if (Restriction.permitted_roles.length > 0) {
        const HasRequiredRole = Restriction.permitted_roles.some((RoleId) =>
          MemberRoles.includes(RoleId)
        );

        if (!HasRequiredRole && !Restriction.allow.includes(BeatNum)) {
          return new ErrorContainer()
            .useErrTemplate("CallsignIdentifierRestricted", BeatNum.toString())
            .replyToInteract(Interaction, true)
            .then(() => true);
        }
      }
    }
  }

  return false;
}

/**
 * Checks if the user already has a pending or active callsign request using pre-fetched data.
 * @param Interaction - The interaction object.
 * @param ValidationData - Pre-fetched callsign validation data.
 * @returns A promise resolving to `true` if an error response is sent due to existing request,
 *          or `false` if the user can submit a new request.
 */
export async function CheckExistingCallsignRequests(
  Interaction: SlashCommandInteraction<"cached">,
  ValidationData: CallsignValidationData
): Promise<boolean> {
  if (ValidationData.pending_request) {
    return new ErrorContainer()
      .useErrTemplate(
        "CallsignAlreadyRequested",
        FormatCallsignDesignation(ValidationData.pending_request.designation)
      )
      .replyToInteract(Interaction, true)
      .then(() => true);
  }

  return false;
}

/**
 * Checks if a user has recently had a denied, cancelled, or expired callsign request using pre-fetched data,
 * and responds with an appropriate error message if they're still in cooldown.
 * @param Interaction - The interaction object containing details about the command invocation.
 * @param ValidationData - Pre-fetched callsign validation data.
 * @returns A promise that resolves to `false` if no recent cooldown applies,
 *          or `true` if an error message is sent due to an active cooldown.
 *
 * The function performs the following cooldown checks:
 * - If the user's most recent callsign request was denied within the last 2 hours, an error message is sent.
 * - If the user's most recent callsign request was cancelled within the last 1 hour, an error message is sent.
 * - If the user's most recent callsign has expired or was revoked within the last 1 hour, an error message is sent.
 */
export async function HasRecentCallsignCooldown(
  Interaction: SlashCommandInteraction<"cached">,
  ValidationData: CallsignValidationData
): Promise<boolean> {
  const MostRecentCallsign = ValidationData.most_recent_callsign;
  if (!MostRecentCallsign) return false;
  const Now = Interaction.createdAt;

  // Check for denied request cooldown (1 hour):
  if (MostRecentCallsign.request_status === GenericRequestStatuses.Denied) {
    const ReviewTime = MostRecentCallsign.reviewed_on || MostRecentCallsign.requested_on;
    if (differenceInMilliseconds(Now, ReviewTime) < DeniedRequestCooldown) {
      return new ErrorContainer()
        .useErrTemplate("CallsignPreviouslyDenied")
        .replyToInteract(Interaction, true)
        .then(() => true);
    }
  }

  // Check for cancelled request cooldown (30 minutes):
  if (MostRecentCallsign.request_status === GenericRequestStatuses.Cancelled) {
    const ReviewTime = MostRecentCallsign.reviewed_on || MostRecentCallsign.requested_on;
    if (differenceInMilliseconds(Now, ReviewTime) < CancelledRequestCooldown) {
      return new ErrorContainer()
        .useErrTemplate("CallsignPreviouslyCancelled")
        .replyToInteract(Interaction, true)
        .then(() => true);
    }
  }

  // Check for recently expired/revoked callsign cooldown (30 minutes):
  if (
    MostRecentCallsign.request_status === GenericRequestStatuses.Approved &&
    MostRecentCallsign.expiry
  ) {
    const ExpiryTime = MostRecentCallsign.expiry;
    if (ExpiryTime < Now && differenceInMilliseconds(Now, ExpiryTime) < ExpiredCallsignCooldown) {
      return new ErrorContainer()
        .useErrTemplate("CallsignRecentlyExpired")
        .replyToInteract(Interaction, true)
        .then(() => true);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------------------
// Logic & Handling:
// -----------------
async function CmdCallback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const Division = Interaction.options.getInteger("division", true);
  const UnitType = Interaction.options.getString("unit-type", true);
  const BeatNum = Interaction.options.getInteger("beat-num", true);
  const RequestReason = Interaction.options.getString("reason", true);

  let UnitTypeUpper = UnitType.toUpperCase();
  UnitTypeUpper = UnitTypeUpper === "AIR" ? "Air" : UnitTypeUpper;

  const FormattedBeatNum = BeatNum.toString().padStart(2, "0");
  const ValidationData = await GetCallsignValidationData(
    Interaction.guildId,
    Interaction.user.id,
    Division,
    UnitTypeUpper,
    FormattedBeatNum,
    Interaction.createdAt
  );

  // Checklist (using pre-fetched data):
  // 1. Check for cooldown restrictions
  // 2. Validate callsign format and availability
  // 3. Validate unit type permissions
  // 4. Validate identifier permissions
  // 5. Check for existing requests/callsigns

  if (await HasRecentCallsignCooldown(Interaction, ValidationData)) return;
  if (await ValidateCallsignFormat(Interaction, Division, UnitType, BeatNum, ValidationData))
    return;

  const GuildSettings = await GetGuildSettings(Interaction.guildId);
  if (!GuildSettings) return new AppError({ template: "GuildConfigNotFound", showable: true });

  if (await ValidateUnitTypePermissions(Interaction, GuildSettings.callsigns_module, UnitType))
    return;
  if (await ValidateIdentifierPermissions(Interaction, GuildSettings.callsigns_module, BeatNum))
    return;
  if (await CheckExistingCallsignRequests(Interaction, ValidationData)) return;

  const ActiveCallsign = ValidationData.active_callsign;
  const PendingCallsign = await CallsignModel.create({
    guild: Interaction.guildId,
    requester: Interaction.user.id,
    request_reason: RequestReason,
    request_status: GenericRequestStatuses.Pending,
    requested_on: Interaction.createdAt,
    designation: {
      division: Division,
      unit_type: UnitTypeUpper,
      beat_num: FormattedBeatNum,
    },
  });

  const FormattedCallsign = FormatCallsignDesignation(PendingCallsign.designation);
  await CallsignEventLogger.SendRequest(Interaction, PendingCallsign, ActiveCallsign).then((PC) => {
    if (PC) {
      PendingCallsign.request_message = `${PC.channel.id}:${PC.id}`;
      return PendingCallsign.save();
    }
  });

  return new InfoContainer()
    .setTitle("Callsign Request Submitted")
    .setDescription(
      `Your request for callsign \`${FormattedCallsign}\` has been submitted for approval. ` +
        "You will be notified via DMs (if possible) whenever there is an update regarding its status.\n\n" +
        `-# To manage your current callsign or requests, you may use the ${MentionCmdByName("callsign manage")} slash command.`
    )
    .replyToInteract(Interaction, true);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: CmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("request")
    .setDescription("File a callsign request.")
    .addIntegerOption((Opt) =>
      Opt.setName("division")
        .setDescription("Geographical division number for the callsign (1-36).")
        .setMinValue(1)
        .setMaxValue(36)
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("unit-type")
        .setDescription("Type of the callsign unit or role.")
        .setMinLength(1)
        .setMaxLength(4)
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((Opt) =>
      Opt.setName("beat-num")
        .setDescription("Identification number for beat, unit, or patrol area.")
        .setMinValue(1)
        .setMaxValue(999)
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("reason")
        .setDescription("The reason for requesting this callsign.")
        .setMinLength(3)
        .setMaxLength(128)
        .setRequired(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
