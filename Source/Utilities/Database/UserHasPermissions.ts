import { BaseInteraction, GuildMember, PermissionFlagsBits } from "discord.js";
import { UserPermsCache, DBRolePermsCache } from "../Other/Cache.js";
import { IsPlainObject, IsEmptyObject } from "../Other/Validators.js";
import { GeneralTypings } from "@Typings/Utilities/Generic.js";
import { App as Client } from "@DiscordApp";
import { DeepPartial } from "utility-types";
import GuildModel from "@Models/Guild.js";

type DBRolePermsType = {
  staff: string[];
  management: string[];
};

type UHPV2Return<ArgType extends string | string[]> = ArgType extends string
  ? boolean
  : Record<string, boolean>;

/**
 * Checks if a user has the required permissions based on the provided permissions configuration.
 * @param CmdInteraction - The user command interaction to process.
 * @param Permissions - Permissions to validate against.
 * @param ReturnMissing - Whether to return a boolean value or an array of missing permissions. Defaults to `undefined` or `false`.
 * @returns A `Promise` that resolves to a boolean value or an array of missing permissions.
 */
export default async function UserHasPerms<RMissing extends boolean = false>(
  CmdInteraction: BaseInteraction<"cached">,
  Permissions: DeepPartial<GeneralTypings.UserPermissionsConfig>,
  ReturnMissing?: RMissing
): Promise<RMissing extends true ? [boolean, string[]] : boolean> {
  if (!IsPlainObject(Permissions) || IsEmptyObject(Permissions)) return BaseReturn(ReturnMissing);
  if (Object.values(Permissions).every((Val) => !Val)) return BaseReturn(ReturnMissing);

  const CheckResult = CheckPerms(
    await GetDBRolePerms(CmdInteraction.guildId),
    Permissions,
    CmdInteraction.member
  );

  if (ReturnMissing) {
    return CheckResult as any;
  } else {
    return CheckResult[0] as any;
  }
}

/**
 * Checks if a user or multiple users have specific permissions in a guild.
 * @param {string | string[]} User - Can be either a string or an array of strings. It represents the user or users for whom the permissions need to be checked.
 * @param {string} GuildId - A string that represents the ID of the guild (server) where the user's permissions will be checked.
 * @param {GeneralTypings.UserPermissionsConfig} Permissions - Represents the permissions that the user should have.
 * @param {boolean} [UseCache=false] - A boolean flag that determines whether to use the cache for retrieving user permissions (if available); default: `false`
 * @returns A `Promise` that resolves to a boolean value or a record of boolean values if `User` is an array.
 */
export async function UserHasPermsV2<UType extends string | string[]>(
  User: UType,
  GuildId: string,
  Permissions: DeepPartial<GeneralTypings.UserPermissionsConfig>,
  UseCache: boolean = false
): Promise<UType extends string ? boolean : Record<string, boolean>> {
  if (
    !IsPlainObject(Permissions) ||
    IsEmptyObject(Permissions) ||
    Object.values(Permissions).every((Val) => !Val)
  ) {
    if (Array.isArray(User)) {
      return User.reduce((Acc, UserId) => {
        Acc[UserId] = true;
        return Acc;
      }, {}) as any;
    } else {
      return true as any;
    }
  }

  if (UseCache && typeof User === "string") {
    const Cached = UserPermsCache.get(`${GuildId}:${User}:${JSON.stringify(Permissions)}`);
    if (typeof Cached === "boolean") return Cached as any;
  }

  const Guild = Client.guilds.cache.get(GuildId);
  if (typeof User === "string") {
    const GuildMember = Guild?.members.cache.get(User);
    if (!GuildMember) return false as any;

    const Result = CheckPerms(await GetDBRolePerms(GuildId, UseCache), Permissions, GuildMember);
    UserPermsCache.set(`${GuildId}:${User}:${JSON.stringify(Permissions)}`, Result);
    return Result[0] as UHPV2Return<UType>;
  } else if (Array.isArray(User)) {
    const Result = {};
    for (const UserId of User) {
      if (UseCache) {
        const Cached = UserPermsCache.get(`${GuildId}:${UserId}:${JSON.stringify(Permissions)}`);
        if (typeof Cached === "boolean") {
          Result[UserId] = Cached;
          continue;
        }
      }

      const GuildMember = Guild?.members.cache.get(UserId);
      if (!GuildMember) {
        Result[UserId] = false;
        continue;
      }

      Result[UserId] = CheckPerms(
        await GetDBRolePerms(GuildId, UseCache),
        Permissions,
        GuildMember
      );

      UserPermsCache.set(`${GuildId}:${User}:${JSON.stringify(Permissions)}`, Result[UserId]);
    }

    return Result[0] as UHPV2Return<UType>;
  } else {
    return false as UHPV2Return<UType>;
  }
}

// ---------------------------------------------------------------------------------------
// Local Helpers:
// --------------
function BaseReturn(ReturnMissing?: boolean) {
  return ReturnMissing ? [true, [] as any] : (true as any);
}

/**
 * Determines whether the given object has a logical operation of "and" or "or".
 * @param Obj - An object that can have two properties: `and`, `or`. These properties are optional and can be of type boolean.
 * @returns Either "and" or "or" based on the presence of the properties in the input object. If neither `'and'` nor `'or'` is present, the function will default to returning "and".
 */
function GetLogicalOperation(Obj: object & { $and?: boolean; $or?: boolean }): "and" | "or" {
  if (Obj.$and) return "and";
  else if (Obj.$or) return "or";
  else return "and";
}

/**
 * Retrieves role permissions for a guild from a database, with an option to use a cache.
 * @param {string} GuildId - A string representing the ID of the guild (server).
 * @param {boolean} [UseCache=false] - A boolean that determines whether to use the cache or not.
 * @returns
 */
async function GetDBRolePerms(
  GuildId: string,
  UseCache: boolean = false
): Promise<DBRolePermsType> {
  if (UseCache && DBRolePermsCache.has(GuildId)) {
    return DBRolePermsCache.get(GuildId) as DBRolePermsType;
  }

  return GuildModel.findById(GuildId)
    .select({ settings: { role_perms: 1 } })
    .then((GuildData) => {
      if (GuildData) {
        DBRolePermsCache.set(GuildId, GuildData.settings.role_perms);
        return GuildData.settings.role_perms;
      }
      throw new Error(`Could not find a guild with the ID '${GuildId}' in the database.`);
    });
}

/**
 * Checks if a guild member has staff or management permissions based on their roles and guild permissions.
 * @param {DBRolePermsType} DBRolePerms
 * @param {DeepPartial<GeneralTypings.UserPermissionsConfig>} Perms
 * @param {GuildMember} GuildMember
 * @returns a boolean value, either true or false.
 */
function CheckPerms(
  DBRolePerms: DBRolePermsType,
  Perms: DeepPartial<GeneralTypings.UserPermissionsConfig>,
  GuildMember: GuildMember
): [boolean, string[]] {
  let HasStaff = false;
  let HasManagement = false;
  const MissingPerms: string[] = [];

  if (Perms.management) {
    if (typeof Perms.management === "boolean") {
      if (
        GuildMember.permissions.has(PermissionFlagsBits.ManageGuild) ||
        GuildMember.roles.cache.hasAny(...DBRolePerms.management)
      ) {
        HasManagement = true;
      } else {
        MissingPerms.push("Manage Server or Application Management");
      }
    } else if (Perms.management.guild && Perms.management.app) {
      const LogicalOperation = GetLogicalOperation(Perms.management);
      if (LogicalOperation === "and") {
        if (
          GuildMember.roles.cache.hasAny(...DBRolePerms.management) &&
          GuildMember.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          HasManagement = true;
        } else {
          MissingPerms.push("Manage Server and Application Management");
        }
      }

      if (LogicalOperation === "or") {
        if (
          GuildMember.roles.cache.hasAny(...DBRolePerms.management) ||
          GuildMember.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          HasManagement = true;
        } else {
          MissingPerms.push("Manage Server or Application Management");
        }
      }
    } else {
      throw new Error(`Invalid 'management' object structure; ${String(Perms.management)}`);
    }
  }

  if (Perms.staff && Perms.staff === true) {
    if (
      GuildMember.permissions.has(PermissionFlagsBits.ManageGuild) ||
      GuildMember.roles.cache.hasAny(...DBRolePerms.staff)
    ) {
      HasStaff = true;
    } else {
      MissingPerms.push("A staff role associated with the application");
    }
  }

  if (Perms.$and) {
    return [HasManagement && HasStaff, MissingPerms] as const;
  } else {
    return [HasStaff || HasManagement, MissingPerms] as const;
  }
}
