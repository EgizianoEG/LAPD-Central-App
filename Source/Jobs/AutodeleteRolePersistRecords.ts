import { GuildMember, PermissionFlagsBits, Guild, Role } from "discord.js";
import { CronJobFileDefReturn } from "#Typings/Core/System.js";
import RolePersistenceModel from "#Models/RolePersist.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import { RolePersist } from "#Typings/Utilities/Database.js";
const FileLabel = "Jobs:AutodeleteExpiredRolePersistRecords";

/**
 * Automatically deletes expired role persistence records from the database and removes associated roles from members.
 * @param Now - The current date or a string indicating the initialization or manual invocation of the function.
 * @param Client - The Discord client instance used to interact with guilds and members.
 * @returns
 */
async function AutodeleteExpiredRolePersistRecords(
  Now: Date | "init" | "manual",
  Client: DiscordClient
) {
  const CurrentDate = Now instanceof Date ? Now : new Date();
  const ExpiredRolePersistRecords = await RolePersistenceModel.find(
    {
      $and: [{ expiry: { $ne: null } }, { expiry: { $lte: CurrentDate } }],
    },
    undefined,
    {
      sort: { expiry: 1 },
      limit: 200,
      lean: true,
    }
  );

  if (!ExpiredRolePersistRecords.length) return;
  const RecordsHandled: string[] = [];
  const RoleRemovalPromises: Promise<any>[] = [];
  const GuildCategorizedExpiredRecords = Object.groupBy(
    ExpiredRolePersistRecords,
    (Record) => Record.guild
  );

  for (const GuildId of Object.keys(GuildCategorizedExpiredRecords)) {
    const GuildInst = await Client.guilds.fetch(GuildId).catch(() => null);
    if (!GuildInst) continue;
    if (!GuildCategorizedExpiredRecords[GuildId]?.length) continue;

    const AppGuildMember = await GuildInst.members.fetchMe();
    if (!AppGuildMember?.permissions.has(PermissionFlagsBits.ManageRoles)) continue;

    await ProcessGuildExpiredRecords(
      GuildInst,
      GuildCategorizedExpiredRecords[GuildId] as unknown as RolePersist.RolePersistDocument[],
      AppGuildMember,
      CurrentDate,
      RoleRemovalPromises,
      RecordsHandled
    );
  }

  const RoleRemovalResults = await Promise.allSettled(RoleRemovalPromises);
  const FailedRoleRemovals = RoleRemovalResults.filter((Result) => Result.status === "rejected");

  if (FailedRoleRemovals.length) {
    AppLogger.error({
      message: "Failed to remove roles from some members due to expired role persistence records.",
      label: FileLabel,
      failed_removals: FailedRoleRemovals.map((Result) => ({
        reason: Result.reason,
        stack: Result.reason instanceof Error ? Result.reason.stack : undefined,
      })),
    });
  }

  if (RecordsHandled.length > 0) {
    await RolePersistenceModel.deleteMany({
      _id: { $in: RecordsHandled },
    });

    AppLogger.debug({
      message: `Successfully processed ${RecordsHandled.length} expired role persistence records.`,
      label: FileLabel,
      records_processed: RecordsHandled.length,
    });
  }
}

/**
 * Processes expired role persistence records for a specific guild, removing roles from users
 * whose records have expired and ensuring active records are preserved.
 *
 * @param Guild - The guild where the expired records are being processed.
 * @param ExpiredRecords - An array of expired role persistence documents to be handled.
 * @param AppMember - The bot's guild member instance, used for role removal operations.
 * @param CurrentDate - The current date used to determine expired records.
 * @param RoleRemovalPromises - An array to collect promises for role removal operations.
 * @param RecordsHandled - An array to track the Ids of records that have been processed.
 * @returns A promise that resolves when all expired records have been processed and added to the RoleRemovalPromises array.
 */
async function ProcessGuildExpiredRecords(
  Guild: Guild,
  ExpiredRecords: RolePersist.RolePersistDocument[],
  AppMember: GuildMember,
  CurrentDate: Date,
  RoleRemovalPromises: Promise<any>[],
  RecordsHandled: string[]
) {
  const UserCategorizedExpiredRecords = Object.groupBy(ExpiredRecords, (Record) => Record.user);
  const AffectedUserIds = Object.keys(UserCategorizedExpiredRecords);
  const AllActiveRecordsForUsers = await RolePersistenceModel.find({
    guild: Guild.id,
    user: { $in: AffectedUserIds },
    $or: [{ expiry: { $gte: CurrentDate } }, { expiry: null }],
  })
    .lean()
    .exec();

  const ActiveRecordsByUser = Object.groupBy(AllActiveRecordsForUsers, (Record) => Record.user);
  for (const [UserId, ExpiredUserRecords] of Object.entries(UserCategorizedExpiredRecords)) {
    if (!ExpiredUserRecords?.length) continue;

    const TargetMember = await Guild.members.fetch(UserId).catch(() => null);
    if (!TargetMember) continue;

    const ActiveUserRecords = ActiveRecordsByUser[UserId] || [];
    const ExpiredRecordIds = new Set(ExpiredUserRecords.map((R) => R._id.toString()));
    const NonExpiredActiveRecords = ActiveUserRecords.filter(
      (Record) => !ExpiredRecordIds.has(Record._id.toString())
    ) as unknown as RolePersist.RolePersistDocument[];

    await ProcessUserRoleRemoval(
      TargetMember,
      ExpiredUserRecords,
      NonExpiredActiveRecords,
      AppMember,
      RoleRemovalPromises,
      RecordsHandled
    );
  }
}

/**
 * Processes the removal of roles from a target guild member based on expired role persistence records.
 * Ensures that roles to be removed are not protected by active records and are valid for removal.
 * Adds role removal promises to the provided array and tracks handled records.
 *
 * @param TargetMember - The guild member whose roles are being processed for removal.
 * @param ExpiredRecords - An array of expired role persistence records.
 * @param ActiveRecords - An array of active role persistence records used to protect roles from removal.
 * @param AppMember - The application member used to determine role hierarchy for removal validation.
 * @param RoleRemovalPromises - An array to store promises for role removal operations.
 * @param RecordsHandled - An array to track the Ids of records that have been processed.
 */
async function ProcessUserRoleRemoval(
  TargetMember: GuildMember,
  ExpiredRecords: RolePersist.RolePersistDocument[],
  ActiveRecords: RolePersist.RolePersistDocument[],
  AppMember: GuildMember,
  RoleRemovalPromises: Promise<any>[],
  RecordsHandled: string[]
) {
  const ExpiredRoleIds = [
    ...new Set<string>(
      ExpiredRecords.flatMap((Record) => Record.roles.map((Role) => Role.role_id)).filter(
        (RoleId): RoleId is string => !!RoleId
      )
    ),
  ];

  const ProtectedRoleIds = new Set<string>(
    ActiveRecords.flatMap((Record) => Record.roles.map((Role) => Role.role_id)).filter(
      (RoleId): RoleId is string => !!RoleId
    )
  );

  const RolesToRemoveIds = ExpiredRoleIds.filter((RoleId) => !ProtectedRoleIds.has(RoleId));
  if (!RolesToRemoveIds.length) return;

  const RolesToRemove = RolesToRemoveIds.map((RoleId) =>
    TargetMember.guild.roles.cache.get(RoleId)
  ).filter(
    (Role): Role is Role =>
      !!Role &&
      !Role.managed &&
      TargetMember.roles.cache.has(Role.id) &&
      Role.comparePositionTo(AppMember.roles.highest) < 0
  );

  if (!RolesToRemove.length) {
    RecordsHandled.push(...ExpiredRecords.map((R) => R._id.toString()));
    return;
  }

  const Plural = ExpiredRecords.length > 1 ? "s" : "";
  const RecordIds = ExpiredRecords.map((R) => R._id.toString()).join(", ");

  RoleRemovalPromises.push(
    TargetMember.roles
      .remove(
        RolesToRemove,
        `Role persistence record${Plural} expired; record${Plural}: ${RecordIds}.`
      )
      .then(() => {
        RecordsHandled.push(...ExpiredRecords.map((R) => R._id.toString()));
      })
  );
}

export default {
  cron_exp: "*/10 * * * *",
  cron_func: AutodeleteExpiredRolePersistRecords,
  cron_opts: {
    timezone: "America/Los_Angeles",
    errorHandlingMechanism: "silent/log",
  },
} as CronJobFileDefReturn;
