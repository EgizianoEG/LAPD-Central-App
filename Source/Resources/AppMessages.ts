/* eslint-disable sonarjs/no-duplicate-string */
import { Emojis, Colors } from "@Config/Shared.js";
import MentionCmdByName from "@Utilities/Discord/MentionCmd.js";
import Dedent from "dedent";

/**
 * A collection of error messages used throughout the application.
 *
 * Each error message has a unique name (e.g., MalformedShiftTypeName) and contains a title
 * and description. Some messages may include template placeholders (e.g., `%s`) for dynamic content.
 *
 * Usage example:
 * ```ts
 * import { format } from "node:util";
 *
 * const Message = ErrorMessages.ShiftTypeAlreadyExists;
 * const Formatted = format(Message.Description, "Evening Shift");
 * console.error(`${Message.Title}: ${Formatted}`);
 * ```
 */
export const ErrorMessages = {
  UnknownError: {
    Title: "Unknown Error",
    Description: "An unexpected error occurred while processing your request.",
  },

  /**
   * Should be shown to the end user if any server/application/bot error has occurred.
   */
  AppError: {
    Title: "Error",
    Description:
      "Apologies; a server/application error occurred while executing this command. Please attempt again at a later time.",
  },

  /**
   * Can be shown to the end user if any database error has occurred.
   */
  DatabaseError: {
    Title: "Database Error",
    Description:
      "A database error occurred while accessing it. Please try again later or contact support if the issue persists.",
  },

  UnauthorizedAccessDev: {
    Title: "Unauthorized Access",
    Description:
      "Execution of this command is restricted to authorized developers of this application.",
  },

  UnauthorizedInteraction: {
    Title: "Unauthorized",
    Description:
      "You are not permitted to interact with a prompt or process that somebody else has initiated.",
  },

  UnauthorizedCmdUsage: {
    Title: "Unauthorized",
    Description: "You do not have the necessary app permissions to utilize this command.",
  },

  /**
   * If the app/bot could not be located in the guild when checking its permissions.
   * This case should not ever happen...
   */
  AppNotFoundInGuildForPerms: {
    Title: "Unexpected Error",
    Description:
      "The application could not be found on this server to verify its permissions. Please ensure the application is present and try again.",
  },

  InsufficientUTIFManageGuildPerm: {
    Title: "Insufficient Permissions",
    Description:
      "Enabling user text input filtering requires the application to have the `Manage Server` permission to access automoderation rules. The application currently lacks this permission and cannot enforce automoderation as expected.",
  },

  /**
   * Malformed shift type name
   */
  MalformedShiftTypeName: {
    Title: "Malformed Shift Type Name",
    Description:
      "A shift type name may only include letters, numbers, spaces, underscores, dashes, and periods.",
  },

  /**
   * Preserved shift type (for deletion)
   */
  PreservedShiftTypeDeletion: {
    Title: "Preserved Shift Type",
    Description: "You cannot delete the preserved shift type `Default`.",
  },

  /**
   * Preserved shift type (for creation)
   */
  PreservedShiftTypeCreation: {
    Title: "Preserved Shift Type Name",
    Description: "The name `Default` is reserved and cannot be overridden, deleted, or created.",
  },

  /**
   * Shift type already exists (for creation)
   * @template InputShiftTypeName The name of the shift type provided by the user.
   */
  ShiftTypeAlreadyExists: {
    Title: "Shift Type Already Exists",
    Description:
      "There is already a shift type named `%s`. Please make sure you're creating a distinct shift type.",
  },

  /**
   * Nonexistent shift type (for usage)
   */
  NonexistentShiftTypeUsage: {
    Title: "Nonexistent Shift Type",
    Description:
      "No shift type with the provided name exists. Please check the name or use the default type.",
  },

  /**
   * Nonexistent shift type (for deletion)
   * @template InputShiftTypeName The name of the shift type provided by the user.
   */
  NonexistentShiftTypeDeletion: {
    Title: "Shift Type Not Found",
    Description: "The shift type `%s` does not exist on this server and cannot be deleted.",
  },

  /**
   *
   */
  MaximumShiftTypesReached: {
    Title: "Maximum Shift Types Reached",
    Description:
      "The limit of ten shift types has been reached, and you cannot create any further.",
  },

  /**
   * Unauthorized shift type usage
   */
  UnauthorizedShiftTypeUsage: {
    Title: "Unauthorized",
    Description:
      "You do not have the necessary permission or the required role to use this shift type.",
  },

  /**
   * Unauthorized shift type usage
   */
  ShiftMustBeActive: {
    Title: "Shift Not Active",
    Description: "You have to be on an active shift to perform this action.",
  },

  /**
   * An error message to show when attempting to wipe shift records while there aren't any records to delete.
   */
  WipeAllNoShiftsFound: {
    Title: "No Shifts Found",
    Description:
      "It looks like there are currently no recorded shifts that match your search to be deleted.",
  },

  /**
   * Malformed Roblox username
   * @template InputUsername The username provided by the user.
   */
  MalformedRobloxUsername: {
    Title: "Malformed Username",
    Description:
      "The provided username, `%s`, is malformed.\nA Roblox username can be 3 to 20 characters long and can only contain letters, digits, and one underscore character in between.",
  },

  /**
   * Nonexistent Roblox username
   * @template InputUsername The username provided by the user.
   */
  NonexistentRobloxUsername: {
    Title: "Hold Up!",
    Description:
      "The input user `%s` could not be found on Roblox. Please verify the username and try again. If the issue continues, there may be a network or Roblox API error.",
  },

  /**
   * Roblox user already linked (for logging in)
   * @template RobloxUsername The logged in Roblox account's username.
   */
  RobloxUserAlreadyLinked: {
    Title: "Hold Up!",
    get Description() {
      return `You are already logged in as \`%s\`.\nDid you mean to ${MentionCmdByName("log-out")} instead?`;
    },
  },

  /**
   * When validating if the user has inputted the sample text into their profile description.
   * @template {string} RobloxUsername The username of the account.
   * @template {string | number} AttemptsLeft The number of login attempts left, if reached the user must rerun the command.
   */
  RobloxUserVerificationFailed: {
    Title: "Verification Failed",
    Description:
      "Login verification as `%s` failed.\nEnsure that you follow the appropriate instructions before trying again; attempts left: %s",
  },

  /**
   * @template {string} RobloxUsername The username of the account.
   */
  RobloxUserVerificationFailedLimit: {
    Title: "Verification Failed",
    Description:
      "Login verification as `%s` failed.\nPlease rerun the command and ensure you follow the appropriate instructions.",
  },

  /**
   * Something went wrong while attempting to link Roblox account with Bloxlink integration or there was no Roblox account linked with Bloxlink in the first place.
   */
  BloxlinkLinkingFailed: {
    Title: "Account Linking Failed",
    Description:
      "There was a problem linking your Roblox account using Bloxlink. Please try again later or log in manually.",
  },

  /**
   * Roblox account not linked (for logging out)
   */
  LORobloxUserNotLinked: {
    Title: "Hold On!",
    Description: "To log out, you must already be logged in and have linked your Roblox account.",
  },

  /**
   * Roblox account not linked (for shift management command; "duty manage")
   */
  SMRobloxUserNotLinked: {
    Title: "Hold On!",
    Description: "To manage shifts, you must first link your Roblox account.",
  },

  /**
   * Roblox account not linked (general usage)
   */
  RobloxUserNotLinked: {
    Title: "Hold On!",
    get Description() {
      return `You must link your Roblox account using the ${MentionCmdByName("log-in")} command before using this command.`;
    },
  },

  /**
   * Roblox account not in-game (for starting a shift using shift management command; "duty manage")
   */
  SMRobloxUserNotInGame: {
    Title: "Hold On!",
    Description:
      "You cannot begin a new shift unless you are online and connected to the game server.",
  },

  /**
   * Users cannot have two active shifts at the same time even if their shift types are different.
   * @template ActiveShiftTypeName Type of the shift that currently active.
   */
  ShiftAlreadyActive: {
    Title: "A Shift Is Already Active",
    Description:
      "You cannot begin a new shift while another is active, even if the shift type is different. You currently have an active shift of the `%s` type.",
  },

  /**
   * Users cannot have two active shifts at the same time even if their shift types are different.
   * @template ProvidedShiftId The shift Id provided by the user.
   */
  NoShiftFoundWithId: {
    Title: "Shift Not Found",
    Description:
      "The shift with the ID you provided, `%s`, could not be found. It's possible that the shift was removed or the ID might be incorrect.",
  },

  UnknownRadioCode: {
    Title: "Unknown Radio Code",
    Description:
      "Could not find the typed radio code. Make sure you choose one from the autocomplete list.",
  },

  ACUnknownColor: {
    Title: "Unknown Color",
    Description: "Please choose and input a valid color from the autocomplete list provided.",
  },

  ACUnknownVehicle: {
    Title: "Unknown Vehicle",
    Description: "Please select a valid vehicle model from the autocomplete list.",
  },

  MalformedPersonHeight: {
    Title: "Malformed Person Height",
    Description: "Please enter a valid height in feet and inches (e.g., `5'7\"`).",
  },

  InvalidLicensePlate: {
    Title: "Invalid License Plate",
    Description:
      "A license plate must be 3–7 characters long and may only contain letters, numerals, and a single hyphen in between.",
  },

  SelfArrestAttempt: {
    Title: "Hold On!",
    Description:
      "It looks like you're trying to file an arrest report on yourself. Please provide a valid suspect name and try again.",
  },

  SelfCitationAttempt: {
    Title: "Hang On!",
    Description:
      "The violator must be someone other than the issuing officer. Please double-check and enter the correct violator's name.",
  },

  UnknownConfigTopic: {
    Title: "Error",
    Description: "An unknown configuration topic was received.",
  },

  /**
   * @template {string} ConfigTopic - The configuration topic that was attempted to be saved.
   */
  ConfigSaveFailedNCM: {
    Title: "Save Failed",
    Description:
      "An error occurred while saving the %s. No updates were made. Please try again later.",
  },

  GuildConfigNotFound: {
    Title: "Database Error",
    Description:
      "Something went wrong and the guild's current configuration could not be fetched. Please try again later or attempt to readd the application.",
  },

  InvalidGuildChannelFormat: {
    Title: "Malformed Format",
    Description:
      "Kindly provide a valid channel format that consists of a server ID followed by a channel ID, and both are separated by a colon (:).",
  },

  /** For specifying citations/arrests external/outside log channels */
  NotJoinedInGuild: {
    Title: "Not Joined In Server",
    Description:
      "You cannot set up an external logging channel on a server you are not a member of.",
  },

  /** For specifying citations/arrests external/outside log channels */
  InsufficientAdminPerms: {
    Title: "Insufficient Admin Permissions",
    Description:
      "You lack administrative access to that server to configure one of its channels as an external logging channel. You must be an administrator on that server to proceed.",
  },

  /**
   * For specifying citations/arrests external/outside log channels
   * @template {String} GuildId The guild identifier provided.
   */
  DiscordGuildNotFound: {
    Title: "Server Not Found",
    Description:
      "The server with ID `%s` was not found, or the application does not have access to it.",
  },

  /**
   * For specifying citations/arrests external/outside log channels
   * @template {String} ChannelId The channel identifier provided.
   */
  DiscordChannelNotFound: {
    Title: "Channel Not Found",
    Description:
      "The channel with ID `%s` could not be found on the specified server, or is inaccessible to the application.",
  },

  MemberNotFound: {
    Title: "Member Not Found",
    Description:
      "The specified member could not be found on the server. Make sure you're entering a valid member.",
  },

  DBGuildDocumentNotFound: {
    Title: "Database Error",
    Description: "It seems like the guild document was not found in the database.",
  },

  BotMemberSelected: {
    Title: "Bot Member Selected",
    Description:
      "You cannot select a bot as a target. Please choose a human member or user for this action.",
  },

  UnknownDateFormat: {
    Title: "Unknown Date Format",
    Description:
      "The date format entered is incorrect or unsupported. Please provide another relevant format.",
  },

  DateInFuture: {
    Title: "Date In The Future",
    Description:
      "It looks like the date you provided is in the future. Please provide a date from the past.",
  },

  DateInPast: {
    Title: "Date In The Past",
    Description:
      "It looks like the date you provided is in the past. Please provide a date from the future.",
  },

  FailedToVoidShift: {
    Title: "Shift Void Failed",
    Description:
      "It looks like the shift could not be voided. Please try again later or contact support.",
  },

  ShiftVoidMismatch: {
    Title: "Shift Mismatch",
    Description:
      "The active shift does not match the shift you requested to void. You might want to contact a management person for assistance.",
  },

  InvalidRolesSaveId: {
    Title: "Malformed ID",
    Description:
      "The backup ID you entered doesn't look right. Please check that it's a 24-character hexadecimal text (only numbers 0-9 and letters a-f).",
  },

  RolesSaveNotFound: {
    Title: "Save Not Found",
    Description: "There was no save found with the provided identifier to take action on.",
  },

  /**
   * Roles save with a specified id not found for a selected member
   */
  RolesSaveNotFoundFSM: {
    Title: "Save Not Found",
    Description: "No save was found with the provided identifier for the selected member.",
  },

  NoAssignableRolesToLoad: {
    Title: "No Assignable Roles",
    Description:
      "No roles could be assigned from the save. They may be managed, admin-only, or above the application's highest role.",
  },

  /**
   * Roles save not found for a selected member
   */
  DBFailedToDeleteRolesSave: {
    Title: "Database Error",
    Description:
      "An error occurred while deleting this record. Please try again later or contact support.",
  },

  /**
   * No active shift for modification
   */
  NoActiveShiftFM: {
    Title: "No Active Shift",
    Description: "There is no active shift at this moment for the selected user to modify.",
  },

  InvalidShiftId: {
    Title: "Invalid Shift ID",
    Description: "The shift ID inputted is invalid. Please ensure it is a valid 15-digit sequence.",
  },

  UnknownDurationExp: {
    Title: "Unknown Time",
    Description:
      "The duration format entered is either incorrect or unsupported. Kindly attempt again using a different format.",
  },

  SinceUntilDatesOutOfOrder: {
    Title: "Invalid Date Range",
    Description:
      "The date range entered is invalid. Kindly provide an earlier date for `since` and a later date for `to` field.",
  },

  NotEnoughTimePassedAR: {
    Title: "Insufficient Time",
    Description:
      "Not enough time has passed since the date you entered. Please provide a date at least one day earlier than today.",
  },

  InvalidDateRangeAR: {
    Title: "Date Range Too Short",
    Description:
      "The duration between the two dates is too short. Kindly specify a duration of at least 1 day.",
  },

  /**
   * Short typed duration (< 30 seconds)
   */
  ShortTypedDuration: {
    Title: "Short Duration",
    Description:
      "The duration entered is too short. Kindly specify a duration of at least 30 seconds.",
  },

  /**
   * Short typed duration (< 30 seconds)
   */
  ShiftTimeAlreadyReset: {
    Title: "Time Already Reset",
    Description: "The time for this shift has already been reset.",
  },

  ShiftCreationDurationTooLong: {
    Title: "Duration Too Long",
    Description: "The specified duration exceeds the maximum allowed shift length of 1 month.",
  },

  NoRecentShifts: {
    Title: "No Recent Shifts",
    Description:
      "There are no recent records for the specified user to display the last shift for.",
  },

  InvalidPageNumber: {
    Title: "Invalid Page Number",
    Description: "The value entered is not valid for a page number.",
  },

  PageNotFoundWN: {
    Title: "Page Not Found",
    Description: "The page corresponding to the specified number does not exist.",
  },

  ArrestRecordNotFound: {
    Title: "Record Not Found",
    Description: "The arrest record corresponding to the specified booking number is non-existent.",
  },

  CitRecordNotFound: {
    Title: "Record Not Found",
    Description: "The citation corresponding to the specified number is non-existent.",
  },

  InvalidIncidentNum: {
    Title: "Malformed Incident Number",
    Description:
      "The incident number entered is invalid. Please ensure it follows the format `YY-XXXXX[X]`.",
  },

  IncidentRecordNotFound: {
    Title: "Record Not Found",
    Description: "There is no incident report found with the specified number.",
  },

  /**
   * For nickname searches and replaces
   */
  InvalidRegexSyntax: {
    Title: "Invalid Regex Syntax",
    Description: Dedent(`
      The regular expression provided is either invalid or unsupported. \
      Please ensure it follows the correct syntax and try again.

      For more information on regular expressions, please refer to the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).
    `),
  },

  ProvidedUnsafeRegex: {
    Title: "Potentially Unsafe Regex",
    Description:
      "The regular expression provided may be unsafe. Please consider:\n" +
      "- Simplifying complex patterns.\n" +
      "- Avoiding nested repetition quantifiers, such as `(a+)+`.\n" +
      "- Using bounded repetition, like `a{1,10}`, instead of unbounded repetition, such as `a+`.\n",
  },

  NicknameReplacementAlreadyInProgress: {
    Title: "Replacement Cooldown",
    Description:
      "There's a 5-minute waiting period between nickname replacements. " +
      "One is either in progress or recently completed, please try again later.",
  },

  NicknameReplaceNoEligibleMembers: {
    Title: "No Eligible Members",
    Description:
      "There are no members whose nicknames can be modified by the application. " +
      "Make sure that the application has a role above the members you want to modify.",
  },

  NicknameReplaceHigherRoleFilterProvided: {
    Title: "Invalid Role Filter",
    Description:
      "The role provided for filtering is higher than the highest role the application has permission to modify nicknames for. " +
      "Make sure that the application has a role above the members you want to modify their nicknames.",
  },

  NicknameReplaceFilteredReplacement: {
    Title: "Invalid Replacement Detected",
    Description:
      "The replacement string provided contains invalid or disallowed content. " +
      "Please ensure that your replacement string adheres to the application's ToS and the server's content policies.",
  },

  NicknameReplaceMissingManageNicknames: {
    Title: "Missing Permission",
    Description:
      "The application no longer has the `Manage Nicknames` permission required to modify nicknames since this command was executed. " +
      "Please ensure the necessary permission is granted and try again.",
  },

  NicknameReplaceNoReplacementsMade: {
    Title: "No Replacements Made",
    Description:
      "The application couldn't replace any nicknames that matched the provided criteria. This could be due to factors such as role position or insufficient permissions.",
  },

  RARequestNoticeAlreadyExists: {
    Title: "Existing Notice Found",
    Description:
      "You cannot request a reduced activity at the moment, as you already have an active or pending one.",
  },

  RARequestLOANoticeIsPendingOrActive: {
    Title: "Leave of Absence Conflict",
    Description:
      "You cannot request reduced activity while a leave is pending or active. Submit an RA request only when no leave is active or awaiting approval.",
  },

  LOARequestNoticeAlreadyExists: {
    Title: "Existing Leave Found",
    get Description() {
      return (
        "You cannot request a leave of absence at the moment as you already have an active or pending one. " +
        `If you wish to extend your current leave, please use the ${MentionCmdByName("loa manage")} command.`
      );
    },
  },

  LOARequestRANoticeIsPending: {
    Title: "Reduced Activity Conflict",
    Description:
      "You cannot request a leave of absence while a reduced activity request is pending. Please cancel the RA request before submitting a leave request.",
  },

  LOAAlreadyExistsManagement: {
    Title: "Notice Already Exists",
    Description:
      "You cannot place a new leave on a person who already has an active or pending one.",
  },

  LOADurationTooLong: {
    Title: "Duration Too Long",
    Description:
      "The leave duration entered is too long. Kindly specify a duration of at most 90 days (3 months).",
  },

  LOADurationTooShort: {
    Title: "Duration Too Short",
    Description:
      "The leave duration entered is too short. Kindly specify a duration of at least 1 day long.",
  },

  LOAExtDurationTooLong: {
    Title: "Extension Too Long",
    Description:
      "The extension duration entered is too long. Kindly specify a duration of at most 30 days (~1 month).",
  },

  LOATotalDurationTooLong: {
    Title: "Leave Duration Too Long",
    Description:
      "The total leave duration would be too long. Please specify an extension so the total leave is less than or equal to 120 days (~4 months).",
  },

  LOAExtDurationTooShort: {
    Title: "Extension Too Short",
    Description:
      "The length of the extension you have entered is too short. Kindly specify a duration of at least 12 hours.",
  },

  LOAExtensionNotFoundForReview: {
    Title: "Extension Request Not Found",
    Description:
      "There is no pending extension request for this leave of absence to modify or act upon at this time.",
  },

  NoActiveLOAOrExistingExtension: {
    Title: "No Active LOA Or Existing Extension",
    Description:
      "Either there is no active leave of absence or there is an existing extension for this leave at this time.",
  },

  LOAPreviouslyDenied: {
    Title: "Notice Previously Denied",
    Description:
      "You cannot request a leave of absence if a previous notice was denied less than 3 hours ago.",
  },

  LOAPreviouslyCancelled: {
    Title: "A Notice Previously Cancelled",
    Description:
      "You cannot request a leave of absence if a previous notice was cancelled less than 1 hour ago.",
  },

  LOARecentlyEnded: {
    Title: "A Notice Recently Ended",
    Description:
      "You cannot request a new leave of absence if a previous notice ended or was ended or terminated less than 1 hour ago.",
  },

  LOAAlreadyEnded: {
    Title: "Leave Already Ended",
    Description: "Your leave of absence has already ended.",
  },

  LOANotActive: {
    Title: "No Active Leave",
    Description: "There is no active leave of absence to modify or take action on at the moment.",
  },

  NoPendingLOAToCancel: {
    Title: "No Pending Request",
    Description: "You have no pending leave of absence to cancel at the moment.",
  },

  LOAIsOverForExtension: {
    Title: "Leave of Absence Expired",
    Description:
      "It seems like your leave of absence has ended, thus you cannot request an extension. You can only request an extension while your leave of absence is still active.",
  },

  LOAExtensionLimitReached: {
    Title: "Extension Limit Reached",
    Description:
      "You cannot request another extension for your current leave of absence. Only one extension is allowed per leave, regardless of whether it was approved, denied, or cancelled.",
  },

  LOAAdminExistingExtension: {
    Title: "Extension Limit Reached",
    Description:
      "You cannot extend this leave of absence further. Only one extension is allowed per leave, regardless of whether it was approved, denied, or cancelled.",
  },

  UANUnauthorizedManagement: {
    Title: "Unauthorized Management",
    Description:
      "You are not authorized to view additional information or take action on this activity notice unless you are a management or administrator member.",
  },

  LOAModuleDisabled: {
    Title: "Module Disabled",
    Description:
      "The leave of absence module is currently disabled. You cannot request, manage, or administer leaves without it being enabled.",
  },

  DutyActivitiesModuleDisabled: {
    Title: "Module Disabled",
    Description:
      "The duty activities module is currently disabled. You cannot log incidents, citations, or arrests without it being enabled.",
  },

  ShiftManagementModuleDisabled: {
    Title: "Module Disabled",
    Description:
      "The shift management module is currently disabled. You cannot initiate any of duty commands without it being enabled.",
  },

  ReducedActivityModuleDisabled: {
    Title: "Module Disabled",
    Description:
      "The reduced activity module is currently disabled. You cannot request, manage, or administer reduced activity notices without it being enabled.",
  },

  SANoShiftsToModify: {
    Title: "No Shifts To Modify",
    Description:
      "There are no shifts to modify for the selected user. Please ensure the user has shifts before attempting to modify them.",
  },

  /**
   * If there were no shifts under a specific type to modify.
   */
  SANoShiftsToModifyWithType: {
    Title: "No Shifts To Modify",
    Description:
      "There are no shifts of the specified type to modify for the selected user. Please ensure the user has shifts of that type before attempting to modify them.",
  },

  LogIncidentInvalidAttachments: {
    Title: "Invalid Attachment(s)",
    Description:
      "One or more of the provided attachments are invalid. Please provide up to 10 static image attachments with `.png`, `.jpg`, or `.jpeg` extensions.",
  },

  LogIncidentInvalidType: {
    Title: "Invalid Incident Type",
    Description:
      "The incident type provided is invalid. Please choose a valid incident type or category from the autocomplete list.",
  },

  LogIncidentDatabaseInsertFailed: {
    Title: "Database Insert Failed",
    Description:
      "An error occurred while inserting the incident report into the database. Please try again later or contact support if the issue persists.",
  },

  /**
   * Indicates that the application sent the report log message is not the same as the running one,
   * which received the interaction to update/modify the report (a different application.)
   */
  UpdateIncidentReportAppNotAuthor: {
    Title: "Incorrect Action",
    Description:
      "A different application or user sent the target message. Ensure that you are using the command on an incident report message that was sent by the same application, and try again.",
  },

  /**
   * Indicates that there was no incident number included in the report log embed, making the application
   * unable to fetch the target incident report from the database. Could be caused by removing message embeds manually by users.
   */
  UpdateIncidentReportNoIncNum: {
    Title: "Incident Number Not Found",
    Description:
      "The incident report number could not be found in the report log message. Kindly ensure that you are targeting an incident report log message and that it remains intact prior to attempting to modify the corresponding report.",
  },

  /**
   * Due to the application settings on certain guilds, management can decide to delete duty logs automatically after a certain amount of time,
   * which may cause the target incident report to be deleted from the database. This message is shown when the application couldn't find the incident record.
   */
  UpdateIncidentReportIncNotFound: {
    Title: "Incident Not Found",
    Description:
      "The incident report you are trying to update doesn't seem to exist anymore in the database. Kindly verify that it was not deleted before attempting to update.",
  },

  UpdateIncidentReportDBFailed: {
    Title: "Database Update Failed",
    Description:
      "An error occurred while updating the incident report in the database. Please try again later or contact support if the issue persists.",
  },

  UpdateIncidentReportNoMgmtPerms: {
    Title: "Insufficient Permission",
    Description:
      "You do not have permission to update or take action on this incident report. Only the report submitter or staff with management permissions can do so.",
  },

  AttachmentMustBeTextFile: {
    Title: "Invalid Attachment",
    Description: "The uploaded file must be a `.txt` file. Please try again.",
  },

  ActivityReportNoRecordsFound: {
    Title: "No Records Found",
    Description: "There are not enough records in the database to generate the requested report.",
  },

  ActivityReportNoIdentifiedStaff: {
    Title: "Staff Identification Required",
    Description:
      "The current configuration lacks defined staff roles or management roles necessary to identify staff members. Please ensure that at least one staff or management role is set up to generate activity reports.",
  },

  AOTargetMemberMustBeStaff: {
    Title: "Staff Restriction",
    Description: "This action can only be performed on members identified as staff.",
  },

  RADurationTooLong: {
    Title: "Duration Too Long",
    Description:
      "The reduced activity duration entered is too long. Kindly specify a duration of at most 30 days (1 month).",
  },

  RADurationTooShort: {
    Title: "Duration Too Short",
    Description:
      "The length of the reduced activity you have entered is too short. Kindly specify a duration of at least 1 day long.",
  },

  RAPreviouslyDenied: {
    Title: "Notice Previously Denied",
    Description:
      "You cannot request reduced activity if a previous notice was denied less than 3 hours ago.",
  },

  RAPreviouslyCancelled: {
    Title: "Notice Previously Cancelled",
    Description:
      "You cannot request reduced activity if a previous notice was cancelled less than 1 hour ago.",
  },

  RARecentlyEnded: {
    Title: "Notice Recently Ended",
    Description:
      "You cannot request a new reduced activity if a previous notice ended or was terminated less than 1 hour ago.",
  },

  NoPendingRAToCancel: {
    Title: "No Pending Request",
    Description: "You have no pending reduced activity request to cancel at the moment.",
  },

  RANotActive: {
    Title: "No Active Leave",
    Description: "There is no active reduced activity to modify or take action on at the moment.",
  },

  OnlyLeaveExtensionsPossible: {
    Title: "Restricted Extensions",
    Description:
      "Extension requests are only available for leave of absence, not reduced activity.",
  },

  /** Duty Shift Management - Embed Not Found  */
  DSMEmbedNotFound: {
    Title: "Missing Management Embed",
    Description:
      "This shift management prompt is either damaged or missing the management embed. Kindly re-execute the command again.",
  },

  /** Duty Shift Management - Continuation */
  DSMContinueNoShiftTypeFound: {
    Title: "Shift Type Unavailable",
    Description:
      "The shift type you have initially specified does not exist anymore and cannot be used. Kindly initiate another management process with a different shift type.",
  },

  DSMContinueExpired: {
    Title: "Session Expired",
    Description:
      "This shift management session has timed out. Please restart the process by executing the command again.",
  },

  DSMInconsistentShiftActionShiftEnded: {
    Title: "Inconsistent Shift Action",
    Description:
      "The shift you are trying to modify has already ended, been voided, or deleted. No further changes can be made.",
  },

  DSMStateChangedExternally: {
    Title: "Shift State Changed",
    Description:
      "The shift state has been modified elsewhere since this prompt was displayed. The prompt has been updated to reflect the current state.",
  },

  DutyImportNoEntries: {
    Title: "No Entries Found",
    Description:
      "The duty import file contained no valid entries that could be processed. Make sure the entries in the file are correctly formatted and try again.",
  },

  DutyImportFileTooLarge: {
    Title: "File Too Large",
    Description: "The uploaded file exceeds the maximum allowed size of one megabyte (1MB).",
  },

  DutyImportFContentTooLarge: {
    Title: "Content Too Large",
    Description:
      "The uploaded file's content is too large to process. Try splitting it into smaller chunks and uploading them separately.",
  },

  ActionRequiresMemberPresence: {
    Title: "Must Be a Present Member",
    Description:
      "You cannot perform this action on someone who is not currently a member of the server.",
  },

  UANRequesterNoLongerAMember: {
    Title: "Requester No Longer A Member",
    Description:
      "The requester of this notice is no longer a member of this server. You cannot approve this request at this time.",
  },

  RolePersistNoValidRolesProvided: {
    Title: "No Valid Roles Provided",
    Description:
      "You have not provided any valid roles to persist. Please provide at least one valid role by typing and mentioning it.",
  },

  RolePersistCannotPersistProvidedRoles: {
    Title: "Role Persistence Failed",
    Description:
      "**Selected role(s) cannot be saved and presisted due to permission constraints**.\n\n" +
      "**Please ensure all roles:**\n" +
      "- Are not managed by integrations or bots\n" +
      "- Do not have administrative permissions (like 'Manage Roles')\n" +
      "- Are hierarchically below the application's highest role position",
  },

  RolePersistSomeRolesNotPersistable: {
    Title: "Some Roles Not Persistable",
    Description:
      "**One or more of the selected roles cannot be saved and persisted due to permission constraints**.\n\n" +
      "**Please ensure all roles:**\n" +
      "- Are not managed by integrations or bots\n" +
      "- Do not have administrative permissions (like 'Manage Roles')\n" +
      "- Are hierarchically below the application's highest role position",
  },

  RolePersistRecordNotFound: {
    Title: "Record Not Found",
    Description: "The specified role persist record could not be found for the selected person.",
  },

  RolePersistExpiryTooSoon: {
    Title: "Expiry Too Soon",
    Description:
      "The expiry date entered is too soon. Kindly specify an expiry date that is at least 3 hours in the future.",
  },

  /**
   * @template {string} PermissionName - The name of the permission that is missing.
   */
  MemberMissingPermission: {
    Title: "Missing Permission",
    Description:
      "You do not have the required %s permission to perform this action. Kindly check your permissions and try again.",
  },
};

export const InfoMessages = {
  /** General message to inform the user that a specific process/prompt has timed out. */
  ProcessTimedOut: {
    Title: "Timed Out",
    Description:
      "It looks like this process/prompt has timed out. Kindly reinstate if you'd like to continue.",
  },

  DutyImportCancelled: {
    Thumb: null,
    Title: "Import Cancelled",
    Description: "The duty import process has been cancelled. No changes were made.",
  },

  DutyImportTimedOut: {
    Thumb: null,
    Title: "Timed Out",
    Description:
      "The duty import process has been cancelled as it has timed out. No changes were made.",
  },

  DutyImportInProgress: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Import In Progress...`,
    Description: "Kindly wait while the duty import process is in progress.",
  },

  RolePersistSavesNotFoundFSM: {
    Title: "Saves Not Found",
    Description: "There were no role persistence records found for the selected person.",
  },

  RolePersistNoRecordsFound: {
    Title: "No Records Found",
    Description: "There are currently no role persistence records in this server.",
  },

  /**
   * Roles save not found for a selected member
   */
  RoleSavesNotFoundFSM: {
    Title: "Saves Not Found",
    Description: "There were no saves or backups found for the selected person.",
  },

  /**
   * @template {String} ConfigurationTopic
   */
  ConfigTopicNoChangesMade: {
    Title: "No Updates Applied",
    Description:
      "There were no changes made to the %s of the application as the current settings already match the database.",
  },

  NicknameRegexNoMatchingMembers: {
    Title: "No Matching Members",
    Description: "There were no members found with that nickname regex.",
  },

  TimedOutConfigPrompt: {
    Title: "Timed Out",
    Description:
      "This configuration prompt has timed out. If you wish to continue with the process, please re-run the configuration command.",
  },

  NoShiftsFoundLeaderboard: {
    Title: "No Shifts Found",
    Description: "There were no shift records in the server to display a leaderboard for.",
  },

  NoShiftsFoundReport: {
    Title: "No Shifts Found",
    Description: "There were no shift records to create an activity report based on.",
  },

  NoShiftsFoundEndAll: {
    Title: "No Active Shifts",
    Description: "There are no active shifts at the moment to end.",
  },

  NoShiftsEndedEndAll: {
    Title: "No Shifts Ended",
    Description: "There were no active shifts to end, and therefore no change has been made.",
  },

  /**
   * No shifts wiped for specified user
   */
  NoShiftsWipedFU: {
    Title: "No Shifts Wiped",
    Description: "There were no shifts found that could be wiped for the specified user.",
  },

  /**
   * @template {string} - The type of user activity notice record (e.g., "leave of absence", "reduced activity".)
   */
  NoUANsWithActiveStatus: {
    Title: "No Records",
    Description: "There are currently no active %s records to display.",
  },

  /**
   * @template {string} - The type of user activity notice record (e.g., "leave of absence", "reduced activity".)
   */
  NoUANsWithSpecifiedStatus: {
    Title: "No Records",
    Description: "There are currently no %s records with the specified status to display.",
  },

  /**
   * Shift records deletion in progress
   */
  SRDeletionInProgress: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Deleting Shifts...`,
    Description: "Please wait, this process might take a few seconds to complete.",
  },

  SRWipeAllInProgress: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Wiping Shifts...`,
    Description: "Hang tight! This process might take a few seconds to complete.",
  },

  /**
   * @template {string} - The type of user activity notice record (e.g., "Leave" or "RA".)
   */
  UANWipeAllInProgress: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Wiping %s Records...`,
    Description: "Hang tight! This process might take a few moments to complete.",
  },

  /**
   * UAN records deletion in progress
   * @template {string} - The type of user activity notice record (e.g., "Leave" or "Reduced Activity".)
   */
  UANDeletionInProgress: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Deleting %s Records...`,
    Description: "Please wait, this process might take a few moments to complete.",
  },

  CreatingActivityReport: {
    Thumb: null,
    Title: `${Emojis.LoadingBlue}\u{2000}Creating Report...`,
    Description:
      "Please wait while your activity report is being created. This process may take a few seconds to complete.",
  },

  ProcessingCitationDetails: {
    Thumb: null,
    Color: Colors.Gold,
    Title: `${Emojis.LoadingGold}\u{2000}Processing Details...`,
    Description: "Citation details are being processed and validated for submission, please wait.",
  },

  LoggingCitationRecord: {
    Thumb: null,
    Color: Colors.Gold,
    Title: `${Emojis.LoadingGold}\u{2000}Logging Citation...`,
    Description: "Please wait while your submitted citation is processed and logged.",
  },

  /**
   * @template {string} RobloxUsername
   */
  RobloxAccountLoginSuccess: {
    Title: "Successfully Linked",
    Description: "Your Roblox account, %s, has been successfully linked to the application.",
  },

  /**
   * @template {string} RobloxUsername
   */
  RobloxAccountLoginManualSuccess: {
    Title: "Successfully Linked",
    Description:
      "Your Roblox account, %s, has successfully been verified and linked to the application. You may now remove the sample text from your profile description.",
  },
};
