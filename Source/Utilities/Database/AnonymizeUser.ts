/* eslint-disable sonarjs/no-duplicate-string */
import AppError from "../Classes/AppError.js";
import ShiftModel from "#Models/Shift.js";
import GuildProfile from "#Models/GuildProfile.js";
import ArrestModel from "#Models/Arrest.js";
import CitationModel from "#Models/Citation.js";
import IncidentModel from "#Models/Incident.js";
import CallsignModel from "#Models/Callsign.js";
import MemberRoleModel from "#Models/MemberRoles.js";
import RolePersistModel from "#Models/RolePersist.js";
import ActivityNoticeModel from "#Models/UserActivityNotice.js";

import { GenerateGhostDiscordId, GenerateGhostUsername } from "#Utilities/Strings/OtherUtils.js";
import { MarkSessionPrivate as MarkDBSessionPrivate } from "#Handlers/AppLogging.js";
import { GenericRequestStatuses } from "#Config/Constants.js";
import { startSession } from "mongoose";

/**
 * Permanently deletes and anonymizes a user from the database at their request.
 *
 * @remarks
 * - For operational security and privacy, this function anonymizes user data for the records:
 *   shift logs, arrests, citations, incidents, activity notices, callsigns, and member roles.
 * - Guild profiles are deleted entirely.
 * - Ghost Ids and usernames are generated using a hash of the original user Id and timestamp,
 *   ensuring that the same user will have different ghost identifiers if anonymized multiple times.
 * - If a GuildId is provided, only records associated with that guild are affected.
 * - Role persists are exempt and not deleted nor anonymized to maintain guild integrity and security.
 *
 * @param UserId - The Discord Snowflake of the user to be anonymized/deleted.
 * @param Username - The current Discord username of the user to be anonymized/deleted.
 * @param GuildId - Optional Discord Snowflake of the guild to limit the anonymization and deletion to.
 * @param Timestamp - An optional timestamp to use for generating ghost Ids and usernames. Defaults to the current time.
 * @returns An object containing the ghost Id, ghost username, ghost nickname, and a summary of records affected.
 */
export default async function DeleteAndAnonymizeUser(
  UserId: string,
  Username: string,
  GuildId?: string | null,
  Timestamp: number = Date.now()
): Promise<{
  ghost_id: string;
  ghost_username: string;
  ghost_nickname: string;
  records_affected: {
    profiles: number;
    shifts: number;
    arrests: number;
    citations: number;
    incidents: number;
    activity_notices: number;
    callsigns: number;
    member_roles: number;
    role_persists: number;
  };
}> {
  const GhostId = GenerateGhostDiscordId(UserId, Timestamp);
  const GhostUsername = GenerateGhostUsername(Username, Timestamp);
  const GhostNickname = `[Anon-User-${GhostUsername.slice(-5)}]`;
  const RedactedSignature = `[Redacted-${GhostUsername.slice(-5)}]`;
  const RedactedReason = "[Reason redacted for privacy]";
  const RedactedNotes = "[Notes redacted]";

  const BaseFilter: { user?: string; guild?: string } = {};
  if (GuildId) {
    BaseFilter.guild = GuildId;
  }

  const RecordsAffected = {
    profiles: 0,
    shifts: 0,
    arrests: 0,
    citations: 0,
    incidents: 0,
    callsigns: 0,
    member_roles: 0,
    role_persists: 0,
    activity_notices: 0,
  };

  const Session = await startSession();
  MarkDBSessionPrivate(Session, true);
  Session.startTransaction();

  try {
    // -------------------------------------------------------------------------
    // 1. DELETE: Guild Profiles (Personal Data)
    // -------------------------------------------------------------------------
    const ProfileDeletion = await GuildProfile.deleteMany(
      {
        ...BaseFilter,
        user: UserId,
      },
      { session: Session }
    );

    RecordsAffected.profiles = ProfileDeletion.deletedCount ?? 0;

    // -------------------------------------------------------------------------
    // 2. TERMINATE: Active Activity Notices (LOA/RA)
    // -------------------------------------------------------------------------
    // Active notices must be terminated because ghost IDs won't pass Discord command
    // user option validation, preventing moderators from managing these records.
    await ActivityNoticeModel.updateMany(
      {
        ...BaseFilter,
        user: UserId,
        status: GenericRequestStatuses.Approved,
        early_end_date: null,
        end_date: { $gt: new Date() },
      },
      {
        $set: {
          end_processed: true,
          early_end_date: new Date(),
          early_end_reason: "[Automatically terminated due to user data anonymization]",
        },
      },
      { session: Session }
    );

    // -------------------------------------------------------------------------
    // 3. ANONYMIZE: Activity Notices (Redact Personal Reasons)
    // -------------------------------------------------------------------------
    // 3a. User who submitted the notice
    const ActivityNoticeUserUpdate = await ActivityNoticeModel.updateMany(
      {
        ...BaseFilter,
        user: UserId,
      },
      [
        {
          $set: {
            user: GhostId,
            reason: RedactedReason,
            early_end_reason: {
              $cond: {
                if: { $ne: ["$early_end_reason", null] },
                then: RedactedReason,
                else: "$early_end_reason",
              },
            },
            extension_request: {
              $cond: {
                if: { $ne: ["$extension_request", null] },
                then: {
                  $mergeObjects: ["$extension_request", { reason: RedactedReason }],
                },
                else: "$extension_request",
              },
            },
          },
        },
      ],
      {
        updatePipeline: true,
        session: Session,
      }
    );

    // 3b. User who reviewed the notice
    const ActivityNoticeReviewerUpdate = await ActivityNoticeModel.updateMany(
      {
        ...BaseFilter,
        "reviewed_by.id": UserId,
      },
      {
        $set: {
          "reviewed_by.id": GhostId,
          "reviewed_by.username": GhostUsername,
        },
      },
      { session: Session }
    );

    // 3c. User who reviewed the extension request
    const ActivityNoticeExtReviewerUpdate = await ActivityNoticeModel.updateMany(
      {
        ...BaseFilter,
        "extension_request.reviewed_by.id": UserId,
      },
      {
        $set: {
          "extension_request.reviewed_by.id": GhostId,
          "extension_request.reviewed_by.username": GhostUsername,
        },
      },
      { session: Session }
    );

    RecordsAffected.activity_notices =
      (ActivityNoticeUserUpdate.modifiedCount ?? 0) +
      (ActivityNoticeReviewerUpdate.modifiedCount ?? 0) +
      (ActivityNoticeExtReviewerUpdate.modifiedCount ?? 0);

    // -------------------------------------------------------------------------
    // 4. ANONYMIZE & TERMINATE: Shifts (Operational Data)
    // -------------------------------------------------------------------------
    const ShiftAnonymization = await ShiftModel.updateMany(
      {
        ...BaseFilter,
        user: UserId,
      },
      [
        {
          $set: {
            user: GhostId,
            end_timestamp: {
              $cond: {
                if: { $eq: ["$end_timestamp", null] },
                then: "$$NOW",
                else: "$end_timestamp",
              },
            },
          },
        },
      ],
      {
        updatePipeline: true,
        session: Session,
      }
    );

    RecordsAffected.shifts = ShiftAnonymization.modifiedCount ?? 0;

    // -------------------------------------------------------------------------
    // 5. ANONYMIZE: Arrests (Operational Data + Multiple User Fields)
    // -------------------------------------------------------------------------
    // 4a. Arresting Officer
    const ArrestArrestingUpdate = await ArrestModel.updateMany(
      {
        ...BaseFilter,
        "arresting_officer.discord_id": UserId,
      },
      {
        $set: {
          "arresting_officer.roblox_id": 0,
          "arresting_officer.discord_id": GhostId,
          "arresting_officer.formatted_name": GhostUsername,
          "arresting_officer.signature": RedactedSignature,
        },
      },
      { session: Session }
    );

    // 4b. Reporting/Filing Officer
    const ArrestReportingUpdate = await ArrestModel.updateMany(
      {
        ...BaseFilter,
        "reporting_officer.discord_id": UserId,
      },
      [
        {
          $set: {
            "reporting_officer.roblox_id": 0,
            "reporting_officer.discord_id": GhostId,
            "reporting_officer.formatted_name": GhostUsername,
            "reporting_officer.signature": {
              $cond: {
                if: { $ne: ["$reporting_officer.signature", null] },
                then: RedactedSignature,
                else: "$reporting_officer.signature",
              },
            },
          },
        },
      ],
      {
        updatePipeline: true,
        session: Session,
      }
    );

    // 4c. Assisting Officers Array
    const ArrestAssistingUpdate = await ArrestModel.updateMany(
      {
        ...BaseFilter,
        assisting_officers: UserId,
      },
      [
        {
          $set: {
            assisting_officers: {
              $map: {
                input: "$assisting_officers",
                as: "id_",
                in: {
                  $cond: [{ $eq: ["$$id_", UserId] }, GhostId, "$$id_"],
                },
              },
            },
          },
        },
      ],
      {
        updatePipeline: true,
        session: Session,
      }
    );

    RecordsAffected.arrests =
      (ArrestArrestingUpdate.modifiedCount ?? 0) +
      (ArrestReportingUpdate.modifiedCount ?? 0) +
      (ArrestAssistingUpdate.modifiedCount ?? 0);

    // -------------------------------------------------------------------------
    // 6. ANONYMIZE: Citations (Operational Data)
    // -------------------------------------------------------------------------
    const CitationUpdate = await CitationModel.updateMany(
      {
        ...BaseFilter,
        "citing_officer.discord_id": UserId,
      },
      {
        $set: {
          "citing_officer.roblox_id": 0,
          "citing_officer.discord_id": GhostId,
          "citing_officer.name": GhostUsername,
          "citing_officer.display_name": GhostUsername,
          "citing_officer.signature": RedactedSignature,
        },
      },
      { session: Session }
    );

    RecordsAffected.citations = CitationUpdate.modifiedCount ?? 0;

    // -------------------------------------------------------------------------
    // 7. ANONYMIZE: Incidents (Operational Data + Reporter/Editor Fields)
    // -------------------------------------------------------------------------
    // 6a. Reporter (Filed By)
    const IncidentReporterUpdate = await IncidentModel.updateMany(
      {
        ...BaseFilter,
        "reporter.discord_id": UserId,
      },
      {
        $set: {
          "reporter.discord_id": GhostId,
          "reporter.discord_username": GhostUsername,
          "reporter.roblox_username": GhostUsername,
          "reporter.roblox_display_name": GhostUsername,
          "reporter.signature": RedactedSignature,
          "reporter.roblox_id": 0,
        },
      },
      { session: Session }
    );

    // 6b. Last Editor
    const IncidentEditorUpdate = await IncidentModel.updateMany(
      {
        ...BaseFilter,
        "last_updated_by.discord_id": UserId,
      },
      {
        $set: {
          "last_updated_by.discord_id": GhostId,
          "last_updated_by.discord_username": GhostUsername,
          "last_updated_by.signature": RedactedSignature,
        },
      },
      { session: Session }
    );

    RecordsAffected.incidents =
      (IncidentReporterUpdate.modifiedCount ?? 0) + (IncidentEditorUpdate.modifiedCount ?? 0);

    // -------------------------------------------------------------------------
    // 8. ANONYMIZE: Callsigns (Operational Data + Reviewer Field)
    // -------------------------------------------------------------------------
    // 7a. Requester (Include Expiry Updates)
    // Anonymized users should not retain active callsign assignments.
    // Set expiry date to now for all approved callsigns assigned to this user,
    // whether they have no expiry set or a future expiry date.
    // Note: We do NOT send guild channel notifications for privacy-related expirations; expiry_notified: true.
    const CallsignRequesterUpdate = await CallsignModel.updateMany(
      {
        ...BaseFilter,
        requester: UserId,
      },
      [
        {
          $set: {
            requester: GhostId,
            request_reason: RedactedReason,
            expiry: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$request_status", GenericRequestStatuses.Approved] },
                    {
                      $or: [{ $eq: ["$expiry", null] }, { $gt: ["$expiry", "$$NOW"] }],
                    },
                  ],
                },
                "$$NOW",
                "$expiry",
              ],
            },
            expiry_notified: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$request_status", GenericRequestStatuses.Approved] },
                    {
                      $or: [{ $eq: ["$expiry", null] }, { $gt: ["$expiry", "$$NOW"] }],
                    },
                  ],
                },
                true,
                "$expiry_notified",
              ],
            },
          },
        },
      ],
      {
        updatePipeline: true,
        session: Session,
      }
    );

    // 7b. Reviewer
    const CallsignReviewerUpdate = await CallsignModel.updateMany(
      {
        ...BaseFilter,
        reviewer: UserId,
      },
      {
        $set: {
          reviewer: GhostId,
          reviewer_notes: RedactedNotes,
        },
      },
      { session: Session }
    );

    RecordsAffected.callsigns =
      (CallsignRequesterUpdate.modifiedCount ?? 0) + (CallsignReviewerUpdate.modifiedCount ?? 0);

    // -------------------------------------------------------------------------
    // 9. ANONYMIZE: Member Roles (Audit Trail with PII Scrubbing)
    // -------------------------------------------------------------------------
    // 8a. Member
    const MemberRolesMemberUpdate = await MemberRoleModel.updateMany(
      {
        ...BaseFilter,
        member: UserId,
      },
      {
        $set: {
          member: GhostId,
          username: "deleted_user",
          nickname: "Deleted User",
        },
      },
      { session: Session }
    );

    // 8b. Saved By (Admin who created the snapshot)
    const MemberRolesSavedByUpdate = await MemberRoleModel.updateMany(
      {
        ...BaseFilter,
        saved_by: UserId,
      },
      {
        $set: {
          saved_by: GhostId,
        },
      },
      { session: Session }
    );

    RecordsAffected.member_roles =
      (MemberRolesMemberUpdate.modifiedCount ?? 0) + (MemberRolesSavedByUpdate.modifiedCount ?? 0);

    // -------------------------------------------------------------------------
    // 10. EXEMPT: Role Persist (Server Safety - NO CHANGES)
    // -------------------------------------------------------------------------
    // RolePersist records are intentionally NOT modified to maintain
    // server safety and moderation enforcement (e.g., blacklists).
    // This is documented in the privacy policy as a legitimate interest exemption.
    // However, we can anonymize the "saved_by" admin field if they request deletion
    const RolePersistSavedByUpdate = await RolePersistModel.updateMany(
      {
        ...BaseFilter,
        "saved_by.user_id": UserId,
      },
      {
        $set: {
          "saved_by.user_id": GhostId,
          "saved_by.username": GhostUsername,
        },
      },
      { session: Session }
    );

    RecordsAffected.role_persists = RolePersistSavedByUpdate.modifiedCount ?? 0;

    // -------------------------------------------------------------------------
    // Commit Transaction & Return Results
    // -------------------------------------------------------------------------
    await Session.commitTransaction();
    return {
      ghost_id: GhostId,
      ghost_username: GhostUsername,
      ghost_nickname: GhostNickname,
      records_affected: RecordsAffected,
    };
  } catch (Err: any) {
    await Session.abortTransaction();
    throw new AppError({
      message: `Failed to anonymize user ${UserId} in guild ${GuildId ?? "all guilds"}.`,
      stack: Err.stack,
      code: 1,
    });
  } finally {
    await Session.endSession();
  }
}
