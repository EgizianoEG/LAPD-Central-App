import UserActivityNoticeModel from "@Models/UserActivityNotice.js";
import GuildProfileModel from "@Models/GuildProfile.js";
import MemberRolesModel from "@Models/MemberRoles.js";
import ShiftModel from "@Models/Shift.js";

/**
 * Erases *all* data associated with the provided guild.
 * @WARNING **This action cannot be undone.**
 * @param GuildID - The snowflake Id of the guild to delete associated data for.
 * @returns
 */
export default async function DeleteAssociatedGuildData(GuildIDs: string | string[]) {
  GuildIDs = Array.isArray(GuildIDs) ? GuildIDs : [GuildIDs];
  const QueryFilter = { guild: { $in: GuildIDs } };
  return Promise.all([
    UserActivityNoticeModel.deleteMany(QueryFilter),
    GuildProfileModel.deleteMany(QueryFilter),
    MemberRolesModel.deleteMany(QueryFilter),
    ShiftModel.deleteMany(QueryFilter),
  ]);
}
