import type * as DiscordJSMask from "discord.js";
import type * as MongooseMask from "mongoose";
import type * as UtilityTypesMask from "utility-types";
import type { ScheduleOptions } from "node-cron";
import type { GeneralTypings } from "./Utilities/Generic.d.ts";
import type {
  MessageContextMenuCommandInteraction,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
  SlashCommandSubcommandBuilder,
  ContextMenuCommandInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  AutocompleteInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  CacheType,
  Client,
} from "discord.js";

export type DiscordClient = Client<true>;
export type RangedArray<T, Min extends number, Max extends number> = TupleMinMax<T, Min, Max>;
export type SlashCommandInteraction<Cached extends CacheType = undefined> =
  ChatInputCommandInteraction<Cached>;

export type CommandObjectDataType =
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandSubcommandBuilder
  | SlashCommandBuilder
  | undefined;

export type ContextMenuCmdInteractionType =
  | ContextMenuCommandInteraction<Cached | undefined>
  | UserContextMenuCommandInteraction<Cached | undefined>
  | MessageContextMenuCommandInteraction<Cached | undefined>;

export type CommandOptsFallbackKeys = "$all_other" | "$other_cmds" | "$all" | "$other";

export namespace CommandCooldowns {
  export interface CooldownConfig {
    /**
     * The maximum number of times the command can be executed within the given timeframe.
     * If `undefined` or `null`, there is no limit based on execution count.
     * @requires timeframe
     */
    max_executions?: Nullable<number>;

    /**
     * The duration in seconds during which the max_executions limit applies.
     * If `undefined` or `null`, the execution count limit is not time-bound.
     * @requires max_executions
     */
    timeframe?: Nullable<number>;

    /**
     * The cooldown period in seconds before the command can be run again.
     * If `undefined` or `null`, no time-based cooldown is applied.
     */
    cooldown?: Nullable<number>;
  }

  /** A cooldown value can be a simple number (seconds) or a full configuration object. */
  export type CooldownValue = number | CooldownConfig;

  /** A structure to define separate cooldowns for users and guilds. */
  export interface UserGuildCooldownConfig {
    /** User-specific cooldown value (simply a number or full config). */
    $user?: CooldownValue;

    /** Guild-wide cooldown value (simply a number or full config). */
    $guild?: CooldownValue;
  }

  /**
   * A map of subcommand names (excluding $user and $guild special keys).
   * Each subcommand can either:
   * - have a simple cooldown number
   * - or have per-user and/or per-guild settings
   * - or be `null` to disable
   */
  export type SubcommandCooldownMap = {
    [K in string as K extends "$user" | "$guild" ? never : K]?:
      | UserGuildCooldownConfig
      | number
      | null;
  };

  /**
   * The top-level structure for defining cooldowns.
   * Special keys:
   * - `$user`: applies a global user-wide cooldown (cannot nest further)
   * - `$guild`: applies a global guild-wide cooldown (cannot nest further)
   *
   * All other keys are treated as subcommands and support more complex rules.
   */
  export type CooldownRecord =
    | ({
        /** Fallback cooldown value for other commands (simply a number or full config). */
        [K in CommandOptsFallbackKeys]?: CooldownValue | null;
      } & {
        /** Top-level user cooldown (flat only — nesting is invalid). */
        $user?: CooldownValue | null;

        /** Top-level guild cooldown (flat only — nesting is invalid). */
        $guild?: CooldownValue | null;
      } & SubcommandCooldownMap)
    | number;
}

/**
 * @note Each cron job will be automatically started even if not specified in cron options.
 **/
export interface CronJobFileDefReturn {
  cron_exp: string;

  /**
   * The function to be executed on each scheduled occurrence of the cron job.
   * This property is optional, and if not provided, the con job scheduling will be skipped (not registered and will not be executed at any time).
   *
   * - `arg0?: Date | "manual" | "init"`: The first argument is either a `Date` object representing
   *   the exact time when the cron job was triggered, or a string (`"manual"` or `"init"`) that
   *   indicates if the function was invoked manually or on the initial run after the application
   *   starts.
   *   - `Date`: The actual date and time when the cron job is triggered.
   *   - `"manual"`: Indicates the function was manually triggered outside of the scheduled time.
   *   - `"init"`: Indicates that the cron job was executed upon initialization, usually due to a
   *     configuration setting like `runOnInit`.
   *
   * - `arg1?: DiscordClient`: The second argument is the `DiscordClient` instance, allowing the cron
   *   job to interact with Discord, send messages, update statuses, or perform other operations
   *   within the Discord client.
   *
   * @returns The function can return either a value of any type or a promise that resolves to any value,
   * allowing it to perform asynchronous operations as needed.
   */
  cron_func?: (arg0?: Date | "manual" | "init", arg1?: DiscordClient) => any | Promise<any>;

  cron_opts?: ScheduleOptions & {
    /**
     * Defines how unhandled errors in the cron function should be managed.
     *
     * - `"silent/log"`: The error will be caught and logged using the application's logging system,
     *   but the cron job will continue running as normal.
     *
     * - `"silent/ignore"`: The error will be caught and completely suppressed without any logging.
     *   The cron job will continue running.
     *
     * - `"silent/ignore/end_job"`: The error will be caught and completely suppressed with logging.
     *   The cron job will be stopped afterwards.
     *
     * - `"silent/ignore/end_job"`: The error will be caught and completely suppressed without any logging.
     *   The cron job will be stopped afterwards.
     *
     * - `"throw"`: The error will be thrown as an exception, causing the cron job to stop and potentially
     *   propagating the error up the stack, which could stop the application if unhandled.
     *
     * - `(error: any) => any`: A custom error handling function that receives the error as an argument
     *   and allows you to implement custom logic to manage it. This provides the most flexibility
     *   and control over how errors are handled.
     *
     * - `null` or `undefined`: Equivalent to "throw". The error will be thrown as an exception, adhering to the
     *   strictest error handling mode by default.
     */
    errorHandlingMechanism?:
      | "silent/log"
      | "silent/ignore"
      | "silent/log/end_job"
      | "silent/ignore/end_job"
      | "throw"
      | ((error: any) => any)
      | null;
  };
}

declare global {
  export import DiscordJS = DiscordJSMask;
  export import Mongoose = MongooseMask;
  export import UtilityTypes = UtilityTypesMask;

  /**
    * Defines a type that can be either undefined, null, or of type T.
    * @example
      // Expect: `string | undefined | null`
      type NullableString = Nullable<string>;
   */
  type Nullable<T> = undefined | null | T;
  type NonEmptyArray<T> = [T, ...T[]];
  type UnPartial<T> = T extends Partial<infer R> ? R : T;
  type RangedArray<T, Min extends number, Max extends number> = TupleMinMax<T, Min, Max>;

  type PartialAllowNull<T> = {
    [P in keyof T]?: T[P] | null;
  };

  type DeepPartialAllowNull<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartialAllowNull<T[P]> | null : T[P] | null;
  };

  /** Expands a type definition recursively. */
  type ExpandRecursively<T> = T extends (...args: infer A) => infer R
    ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
    : T extends object
      ? T extends infer O
        ? { [K in keyof O]: ExpandRecursively<O[K]> }
        : never
      : T;

  /** @see {@link https://stackoverflow.com/a/72522221} */
  type TupleMinMax<
    T,
    Min extends number,
    Max extends number,
    A extends (T | undefined)[] = [],
    O extends boolean = false,
  > = O extends false
    ? Min extends A["length"]
      ? TupleMinMax<T, Min, Max, A, true>
      : TupleMinMax<T, Min, Max, [...A, T], false>
    : Max extends A["length"]
      ? A
      : TupleMinMax<T, Min, Max, [...A, T?], false>;

  type DiscordClient = Client<true>;
  type SlashCommandWithOptions = Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  type SlashCommandInteraction<Cached extends CacheType = CacheType> =
    ChatInputCommandInteraction<Cached>;

  type AnySlashCmdCallback = (
    arg0: DiscordClient | SlashCommandInteraction,
    arg1?: SlashCommandInteraction
  ) => Promise<any>;

  type AnyCtxMenuCmdCallback = (
    arg0: DiscordClient | ContextMenuCommandInteraction,
    arg1?: ContextMenuCommandInteraction
  ) => Promise<any>;

  interface CommandObjectOptions {
    /** Whether or not this command will be removed if it already exists in the application or excluded from registration. */
    deleted?: boolean;

    /** Should the command be updated regardless of whether it is altered or not? */
    force_update?: boolean;

    /** Should command execution be restricted to application developers only? */
    dev_only?: boolean;

    /**
     * Configure cooldowns for command execution. Can be:
     * - A simple number (seconds between each execution, for each user)
     * - A detailed cooldown configuration object with more granular control
     * - A record mapping subcommands/subcommand groups to their respective cooldown settings
     *
     * Special keys:
     * - Top level `$user`: Applies rate limiting per-user across all commands, alternative to special keys `$other_cmds`, `$all`, etc.
     * - Top level `$guild`: Applies rate limiting per-guild across all commands, alternative to special keys `$other_cmds`, `$all`, etc.
     * - `$all_other`, `$other_cmds`, `$all`, or `$other`: Sets default cooldown for commands not explicitly listed. Has higher priority than top-level `$user` and `$guild`.
     *
     * Important: Special keys (`$user`, `$guild`) cannot be nested within themselves.
     * For example, `{ $user: { $user: 5 } }` is invalid, but `{ $user: 5 }` or `{ search: { $user: 5, $guild: 10 } }` are valid.
     *
     * @example
     * cooldown: {
     *   // Global user cooldown of 10 seconds
     *   $user: 10,
     *
     *   // Specific cooldowns per subcommand
     *   search: {
     *     $user: { max_executions: 20, timeframe: 86400 }, // Limit to 20 uses per day per user
     *     $guild: 30 // Guild-wide cooldown of 30 seconds
     *   }
     * }
     */
    cooldown?: Nullable<CommandCooldowns.CooldownRecord>;

    /**
     * The required user guild permissions to run this command.
     * Could be for the whole command [group] or for each sub-command or sub-command group.
     * @example
     * // The following declaration will only allow subcommand "load" to be used by users with the "Administrator"
     * // permission, and will also allow all other subcommands (not "load") to be used by users with the "Management"
     * // permission for either the server or the bot itself since "$all_other" is set.
     *
     * // Notice that specifying cmds with names will have a higher priority than specifying all other command perms.
     * // Also that the "$all_other" has alternative names: "$other_cmds", "$all", and "$other".
     *
     * const Options: CommandObjectOptions = {
     *  ...
     *  user_perms: { $all_other: { management: true }, load: [PermissionFlagsBits.Administrator] }
     *  ...
     *  }
     */
    user_perms?:
      | PermissionResolvable[]
      | UtilityTypesMask.DeepPartial<GeneralTypings.UserPermissionsConfig>
      | Record<
          CommandOptsFallbackKeys | string,
          | UtilityTypesMask.DeepPartial<GeneralTypings.UserPermissionsConfig>
          | PermissionResolvable[]
        >;

    /**
     * Permissions the bot application needs in the guild to execute this command.
     * If the bot lacks these permissions, the command will fail or behave unexpectedly.
     *
     * Can be provided in two formats:
     * - An array of permissions for the entire command
     * - A record mapping subcommand/group names to their required permission arrays
     *
     * @example
     * // Require basic permissions for the whole command
     * app_perms: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
     *
     * // Different permissions for different subcommands
     * app_perms: {
     *   ban: [PermissionFlagsBits.BanMembers],
     *   info: [PermissionFlagsBits.SendMessages]
     *   clear: [PermissionFlagsBits.ManageMessages],
     * }
     */
    app_perms?: PermissionResolvable[] | Record<string, PermissionResolvable[]>;
  }

  interface ContextMenuCommandObject<
    CmdType extends ContextMenuCmdInteractionType = MessageContextMenuCommandInteraction,
  > {
    callback:
      | ((arg0: DiscordClient, arg1: CmdType<Cached | undefined>) => Promise<any>)
      | ((arg0: CmdType<Cached | undefined>) => Promise<any>);

    /** Optional configurations */
    options?: CommandObjectOptions;

    /** The context menu command itself */
    data: ContextMenuCommandBuilder;
  }

  interface SlashCommandObject<ClassType extends CommandObjectDataType = SlashCommandBuilder> {
    /** The callback function or the `run` function which will be executed on command call */
    callback:
      | ((arg0: DiscordClient, arg1: SlashCommandInteraction<Cached | undefined>) => Promise<any>)
      | ((arg0: SlashCommandInteraction<Cached | undefined>) => Promise<any>);

    /** The autocomplete function which will handle and process autocomplete interactions if applicable */
    autocomplete?: (arg0: AutocompleteInteraction<Cached | undefined>) => Promise<any>;

    /** Optional configurations */
    options?: CommandObjectOptions;

    /** The slash command itself */
    data: ClassType;
  }
}
