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
 * @returns A promise that resolves when the operation is complete.
 */
export default async function DeleteAssociatedGuildData(
  GuildIds: string | string[],
  Session?: ClientSession
): Promise<void> {
  GuildIds = Array.isArray(GuildIds) ? GuildIds : [GuildIds];
  const QueryFilter = { guild: { $in: GuildIds } };

  Session ??= await UserActivityNoticeModel.startSession();
  if (!Session.inTransaction()) Session.startTransaction();

  try {
    await GuildProfileModel.deleteMany(QueryFilter, { session: Session }).exec();
    await UserActivityNoticeModel.deleteMany(QueryFilter, { session: Session }).exec();
    await ShiftModel.deleteMany(QueryFilter, { session: Session }).exec();
    await ArrestModel.deleteMany(QueryFilter, { session: Session }).exec();
    await CitationModel.deleteMany(QueryFilter, { session: Session }).exec();
    await IncidentModel.deleteMany(QueryFilter, { session: Session }).exec();
    await CallsignModel.deleteMany(QueryFilter, { session: Session }).exec();
    await MemberRolesModel.deleteMany(QueryFilter, { session: Session }).exec();

    await Session.commitTransaction();
  } catch (Err) {
    await Session.abortTransaction();
    throw Err;
  } finally {
    await Session.endSession();
  }
}
