import type { ClientSession } from "mongoose";
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
 * @param GuildIds - The snowflake Ids of the guilds to delete associated data for.
 * @param Session - An optional ClientSession to use for transaction management. If not provided, a new session will be created for this operation.
 * @returns
 */
export default async function DeleteAssociatedGuildData(
  GuildIds: string | string[],
  Session?: ClientSession
) {
  GuildIds = Array.isArray(GuildIds) ? GuildIds : [GuildIds];
  const QueryFilter = { guild: { $in: GuildIds } };

  Session ??= await UserActivityNoticeModel.startSession();
  Session.startTransaction();

  try {
    const Results = await Promise.all([
      UserActivityNoticeModel.deleteMany(QueryFilter, { session: Session }).exec(),
      GuildProfileModel.deleteMany(QueryFilter, { session: Session }).exec(),
      MemberRolesModel.deleteMany(QueryFilter, { session: Session }).exec(),
      ShiftModel.deleteMany(QueryFilter, { session: Session }).exec(),
      ArrestModel.deleteMany(QueryFilter, { session: Session }).exec(),
      CitationModel.deleteMany(QueryFilter, { session: Session }).exec(),
      IncidentModel.deleteMany(QueryFilter, { session: Session }).exec(),
      CallsignModel.deleteMany(QueryFilter, { session: Session }).exec(),
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
