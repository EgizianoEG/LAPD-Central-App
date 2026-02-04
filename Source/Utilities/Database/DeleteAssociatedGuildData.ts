import UserActivityNoticeModel from "#Models/UserActivityNotice.js";
import GuildProfileModel from "#Models/GuildProfile.js";
import MemberRolesModel from "#Models/MemberRoles.js";
import CitationModel from "#Models/Citation.js";
import IncidentModel from "#Models/Incident.js";
import CallsignModel from "#Models/Callsign.js";
import ArrestModel from "#Models/Arrest.js";
import ShiftModel from "#Models/Shift.js";

/**
 * Erases *all* data associated with the provided guild.
 * @WARNING **This action cannot be undone.**
 * @param GuildID - The snowflake Id of the guild to delete associated data for.
 * @returns
 */
export default async function DeleteAssociatedGuildData(GuildIDs: string | string[]) {
  GuildIDs = Array.isArray(GuildIDs) ? GuildIDs : [GuildIDs];
  const QueryFilter = { guild: { $in: GuildIDs } };
  const Session = await UserActivityNoticeModel.startSession();
  Session.startTransaction();

  try {
    const Results = await Promise.all([
      UserActivityNoticeModel.deleteMany(QueryFilter, { session: Session }),
      GuildProfileModel.deleteMany(QueryFilter, { session: Session }),
      MemberRolesModel.deleteMany(QueryFilter, { session: Session }),
      ShiftModel.deleteMany(QueryFilter, { session: Session }),
      ArrestModel.deleteMany(QueryFilter, { session: Session }),
      CitationModel.deleteMany(QueryFilter, { session: Session }),
      IncidentModel.deleteMany(QueryFilter, { session: Session }),
      CallsignModel.deleteMany(QueryFilter, { session: Session }),
    ]);

    await Session.commitTransaction();
    return Results;
  } catch (Err) {
    await Session.abortTransaction();
    throw Err;
  } finally {
    await Session.endSession();
  }
}
