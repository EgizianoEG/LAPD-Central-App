import {
  time,
  CacheType,
  GuildMember,
  MessageFlags,
  PermissionsBitField,
  PermissionFlagsBits,
  PermissionResolvable,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from "discord.js";

import {
  UserCommandExecutionsCache,
  GuildCommandExecutionsCache,
} from "#Utilities/Helpers/Cache.js";

import { Discord } from "#Config/Secrets.js";
import { UnorderedList } from "#Utilities/Strings/Formatters.js";
import { PascalToNormal } from "#Utilities/Strings/Converters.js";
import { CommandCooldowns } from "#Typings/Core/Commands.js";
import { IsValidUserPermsObj } from "#Utilities/Helpers/Validators.js";
import { WarnEmbed, ErrorEmbed, UnauthorizedEmbed } from "#Utilities/Classes/ExtraEmbeds.js";
import UserHasPerms from "#Utilities/Database/UserHasPermissions.js";
import Dedent from "dedent";

const BaseCommandCooldownTime = 3;
const AllOtherCmdNamesPattern = /^\$all(?:_other)?$|^\$other(?:_cmds)?$/;

type ChatContextCmdObject = SlashCommandObject | ContextMenuCommandObject;
type ChatContextCmdInteraction<Cached extends CacheType = CacheType> =
  | ChatInputCommandInteraction<Cached>
  | ContextMenuCommandInteraction<Cached>;

type CooldownExtractResult = {
  /** User-specific cooldown value in seconds or null if not set. */
  UserCooldown: Nullable<CommandCooldowns.CooldownValue>;

  /** Guild-specific cooldown value in seconds or null if not set. */
  GuildCooldown: Nullable<CommandCooldowns.CooldownValue>;

  /**
   * Base cooldown time in milliseconds.
   * This is the default cooldown time applied to the command.
   */
  BaseCooldownMs: number;
};

export type ThrottleTracker = {
  /**
   * The number of times the command has been executed by the user
   * or in the guild since the first execution.
   */
  count: number;

  /**
   * The timestamp of the first execution of
   * the command by the user or in the guild (in milliseconds).
   */
  first_exec: number;
};

/**
 * Handles command cooldowns for both slash commands and context menu commands.
 * @param Client - The Discord client instance.
 * @param Interaction - The command interaction (chat input or context menu).
 * @param CommandObject - The command object (slash or context menu).
 * @param CommandName - The full name of the command.
 */
export async function HandleCommandCooldowns(
  Interaction: ChatContextCmdInteraction,
  CommandObject: SlashCommandObject | ContextMenuCommandObject,
  CommandName: string
) {
  if (Interaction.replied) return;
  const CurrentTS = Date.now();
  const { UserCooldown, GuildCooldown, BaseCooldownMs } = ExtractCooldownConfig(
    CommandObject,
    Interaction
  );

  const StandardCooldownResult = await ProcessStandardCooldown(
    Interaction,
    CommandName,
    BaseCooldownMs,
    CurrentTS
  );

  if (StandardCooldownResult) return StandardCooldownResult;
  if (!UserCooldown && !GuildCooldown) return;
  const UserCooldownResult = await ProcessUserCooldown(
    Interaction,
    CommandName,
    UserCooldown,
    CurrentTS
  );

  if (UserCooldownResult) return UserCooldownResult;
  if (Interaction.inGuild()) {
    const GuildCooldownResult = await ProcessGuildCooldown(
      Interaction,
      CommandName,
      GuildCooldown,
      CurrentTS
    );

    if (GuildCooldownResult) {
      return GuildCooldownResult;
    }
  }
}

/**
 * Handles the execution of commands that are restricted to the application developers only.
 * @param CommandObject - The command object containing metadata and options for the command.
 * @param Interaction - The interaction object representing the command invocation, which can be
 *                      either a `ChatInputCommandInteraction` or `ContextMenuCommandInteraction`.
 * @returns A promise that resolves to an unauthorized embed reply if the user is not authorized
 * to execute the command, or nothing if the interaction has already been replied to or the user
 * is authorized.
 *
 * @remarks
 * - This function checks if the command is marked as developer-only (`dev_only`) and verifies
 *   if the user invoking the command is either listed in the bot's developers or is the bot's
 *   application owner.
 * - If the user is unauthorized, an embed message is sent as a reply to the interaction,
 *   indicating that only the (bot/application)'s developers can execute the command.
 */
export async function HandleDevOnlyCommands(
  CommandObject: ChatContextCmdObject,
  Interaction: ChatContextCmdInteraction
) {
  if (Interaction.replied) return;
  if (
    CommandObject.options?.dev_only &&
    !Discord.DeveloperIds.includes(Interaction.user.id) &&
    Interaction.client.application.owner?.id !== Interaction.user.id
  ) {
    return new UnauthorizedEmbed()
      .useErrTemplate("UnauthorizedAccessDev")
      .replyToInteract(Interaction, true);
  }
}

/**
 * Handles user permissions for a given command interaction.
 * This function validates and enforces the user permissions required to execute a command.
 * It supports various permission structures, including arrays, objects, and special keys
 * for handling subcommands and fallback permissions.
 *
 * @param CommandObject - The command object containing metadata and options for the command.
 * @param Interaction - The interaction object representing the user's command input.
 *                      This can be a `ChatInputCommandInteraction` or `ContextMenuCommandInteraction`.
 * @returns A promise that resolves when the permission handling is complete.
 *          If the user lacks the required permissions, the function may terminate early.
 *
 * @remarks
 * - If the interaction has already been replied to or is not in a cached guild, the function exits early.
 * - The function supports the following permission structures:
 *   - `user_perms` as an array: Validates the array of permissions.
 *   - `user_perms` as an object: Handles permissions for specific subcommands or subcommand groups.
 *   - Special keys like `$all_other`, `$other_cmds`, `$all`, and `$other` are used to define fallback permissions.
 * - Subcommands and subcommand groups are checked for specific permissions if applicable.
 * - If no specific permissions are found, the function attempts to match special keys using a predefined pattern.
 */
export async function HandleUserPermissions(
  CommandObject: ChatContextCmdObject,
  Interaction: ChatContextCmdInteraction
) {
  if (Interaction.replied || !Interaction.inCachedGuild()) return;
  if (
    !CommandObject.options?.user_perms ||
    (Array.isArray(CommandObject.options?.user_perms) && !CommandObject.options?.user_perms.length)
  ) {
    return;
  }

  if (Array.isArray(CommandObject.options.user_perms)) {
    return ValidateUserPermissionsArray(CommandObject.options.user_perms, Interaction);
  }

  if (IsValidUserPermsObj(CommandObject.options.user_perms)) {
    return HandleCommandUserPerms(CommandObject.options.user_perms as any, Interaction);
  }

  if (Interaction.isChatInputCommand()) {
    const SubCmdGroup = Interaction.options.getSubcommandGroup(false);
    const SubCommand = Interaction.options.getSubcommand(false);

    if (SubCmdGroup && Object.hasOwn(CommandObject.options.user_perms, SubCmdGroup)) {
      return HandleCommandUserPerms(CommandObject.options.user_perms[SubCmdGroup], Interaction);
    }

    if (SubCommand && Object.hasOwn(CommandObject.options.user_perms, SubCommand)) {
      return HandleCommandUserPerms(CommandObject.options.user_perms[SubCommand], Interaction);
    }
  }

  // Handle '$all_other', '$other_cmds', '$all', as well as '$other' as special cases where
  // these keys specify the permissions needed for all other subcommands not mentioned
  // above in the user perms object structure.
  const MatchingKeyFA = Object.keys(CommandObject.options.user_perms).find((key) =>
    AllOtherCmdNamesPattern.test(key)
  );

  if (MatchingKeyFA) {
    return HandleCommandUserPerms(CommandObject.options.user_perms[MatchingKeyFA], Interaction);
  }
}

/**
 * Checks if the bot has the necessary permissions to perform a command.
 * @param CommandObject - The command object containing metadata and options for the command.
 * @param Interaction - The interaction object representing the user's command input.
 * @returns A promise that resolves when the permission handling is complete.
 *          If the bot lacks any necessary permissions, the function may terminate early with a feedback reply to the user.
 */
export async function HandleAppPermissions(
  CommandObject: ChatContextCmdObject,
  Interaction: ChatContextCmdInteraction
) {
  if (Interaction.replied || !Interaction.inCachedGuild()) return;
  if (
    !CommandObject.options?.app_perms ||
    (Array.isArray(CommandObject.options.app_perms) && !CommandObject.options.app_perms.length) ||
    (!Array.isArray(CommandObject.options.app_perms) &&
      !Object.keys(CommandObject.options.app_perms).length)
  ) {
    return;
  }

  const AppMember = await Interaction.guild.members.fetchMe();
  if (!AppMember) {
    return new ErrorEmbed()
      .useErrTemplate("AppNotFoundInGuildForPerms")
      .replyToInteract(Interaction, true);
  }

  if (Array.isArray(CommandObject.options.app_perms)) {
    return ValidateAppPermissionsArray(AppMember, CommandObject.options.app_perms, Interaction);
  }

  // Subcommand-specific app permission checks are only supported for chat input (slash) commands.
  // Context menu commands do not have subcommands, so we skip this logic for them.
  if (!(Interaction instanceof ChatInputCommandInteraction)) return;
  const SubCmdGroup = Interaction.options.getSubcommandGroup(false);
  const SubCommand = Interaction.options.getSubcommand(false);

  if (SubCmdGroup && Array.isArray(CommandObject.options.app_perms[SubCmdGroup])) {
    return ValidateAppPermissionsArray(
      AppMember,
      CommandObject.options.app_perms[SubCmdGroup],
      Interaction
    );
  }

  if (SubCommand && Array.isArray(CommandObject.options.app_perms[SubCommand])) {
    return ValidateAppPermissionsArray(
      AppMember,
      CommandObject.options.app_perms[SubCommand],
      Interaction
    );
  }
}

/**
 * Checks if a user has the required permissions to run a command and returns an promise for a reply message if any permissions are missing.
 * @param {PermissionResolvable[]} PermsArray - An array of permissions to check for.
 * @param {ChatContextCmdInteraction<"cached">} Interaction - The slash command interaction object received.
 * @returns
 */
export async function ValidateUserPermissionsArray(
  PermsArray: PermissionResolvable[],
  Interaction: ChatContextCmdInteraction<"cached">
) {
  const MissingPerms: string[] = [];
  for (const Permission of PermsArray) {
    if (!Interaction.member.permissions.has(Permission)) {
      const LiteralPerm =
        Object.keys(PermissionFlagsBits).find((Key) => PermissionFlagsBits[Key] === Permission) ??
        "[Unknown]";
      MissingPerms.push(PascalToNormal(LiteralPerm));
    }
  }

  if (MissingPerms.length) {
    const Plural = MissingPerms.length === 1 ? "" : "s";
    return Interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new UnauthorizedEmbed().setDescription(
          "Missing user permission%s.\nYou do not have the following permission%s to run this command:\n%s",
          Plural,
          Plural,
          UnorderedList(MissingPerms)
        ),
      ],
    });
  }
}

/**
 * Checks if the app has the necessary permissions to perform a command and returns an promis to the error reply message if any permissions are missing.
 * @param {GuildMember} AppInGuild - The guild member object of the bot in the guild where the command is being executed.
 * @param {PermissionResolvable[]} PermsArray - An array of `PermissionResolvable` values. These values represent the permissions that the bot needs to have in order to perform a specific command.
 * @param {ChatContextCmdInteraction<"cached">} Interaction - The slash command interaction object received.
 * @returns a reply to the interaction with an error message if the bot lacks any necessary
 * permissions. If there are missing permissions, it will reply with an ephemeral message containing an
 * error embed that lists the missing permissions. If there are no missing permissions, the function
 * does not return anything.
 */
export async function ValidateAppPermissionsArray(
  AppInGuild: GuildMember,
  PermsArray: PermissionResolvable[],
  Interaction: ChatContextCmdInteraction<"cached">
) {
  const MissingPerms: string[] = [];
  for (const Permission of PermsArray) {
    if (
      AppInGuild?.permissions instanceof PermissionsBitField &&
      !AppInGuild.permissions.has(Permission)
    ) {
      const LiteralPerm =
        Object.keys(PermissionFlagsBits).find((Key) => PermissionFlagsBits[Key] === Permission) ??
        "[Unknown]";
      MissingPerms.push(PascalToNormal(LiteralPerm));
    }
  }

  if (MissingPerms.length) {
    const Plural = MissingPerms.length === 1 ? "" : "s";
    return Interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new ErrorEmbed().setDescription(
          "The application lacks the following necessary permission%s to perform this command:\n%s",
          Plural,
          UnorderedList(MissingPerms)
        ),
      ],
    });
  }
}

/**
 * The function `HandleCommandUserPerms` checks if a user has the required permissions to use a
 * command and returns an unauthorized embed if they do not.
 * @param {NonNullable<CommandObjectOptions["user_perms"]>} Perms - The permissions required for a member/user to execute a command. It could be an array of permissions or an object representing specific permissions.
 * @param {ChatContextCmdInteraction<"cached">} Interaction - The slash command interaction object received.
 * @returns
 */
export async function HandleCommandUserPerms(
  Perms: NonNullable<CommandObjectOptions["user_perms"]>,
  Interaction: ChatContextCmdInteraction<"cached">
) {
  if (Array.isArray(Perms)) {
    return ValidateUserPermissionsArray(Perms, Interaction);
  }

  if (!IsValidUserPermsObj(Perms)) {
    return;
  }

  const [HasPerms, MissingPerms] = await UserHasPerms(Interaction, Perms, true);
  let MissingListed: string;

  if (!HasPerms) {
    if (MissingPerms.length > 1) {
      const OrAndMissingPermIndex = MissingPerms.findIndex((P) => !!P.match(/\b(?:and|or)\b/i));
      const OtherMissingPerms = MissingPerms.filter((P) => !P.match(/\b(?:and|or)\b/i));
      if (OrAndMissingPermIndex >= 0) {
        MissingListed =
          MissingPerms[OrAndMissingPermIndex].replace(/^(.+)\s(and|or)\s(.+)/i, "$1; $2\n- $3") +
          "\n- " +
          OtherMissingPerms.join("\n- ");
      } else {
        MissingListed = `- ${OtherMissingPerms.join("\n- ")}`;
      }
    } else {
      MissingListed = MissingPerms[0].replace(/^(.+)\s(and|or)\s(.+)$/i, "$1; $2\n- $3");
    }

    const PluralSuffix = MissingPerms.length === 1 ? "" : "s";
    return new UnauthorizedEmbed()
      .setDescription(
        Dedent(`
          You do not have the necessary permission${PluralSuffix} to utilize this command.
          Permission${PluralSuffix} Required:
          - ${MissingListed.replaceAll("\n", `\n${" ".repeat(10)}`)}
        `)
      )
      .replyToInteract(Interaction, true);
  }
}

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Extracts the appropriate cooldown configuration based on command structure and interaction.
 * @param CommandObject - The command object containing cooldown configuration.
 * @param Interaction - The interaction to process.
 * @returns Object containing extracted cooldown configuration:
 * - `UserCooldown`: User-specific cooldown value in seconds or null.
 * - `GuildCooldown`: Guild-specific cooldown value in seconds or null.
 * - `BaseCooldownMs`: Base cooldown time in milliseconds.
 */
function ExtractCooldownConfig(
  CommandObject: ChatContextCmdObject,
  Interaction: ChatContextCmdInteraction
): CooldownExtractResult {
  let BaseCooldownMs: number = BaseCommandCooldownTime * 1000;
  let UserCooldown: Nullable<CommandCooldowns.CooldownValue> = null;
  let GuildCooldown: Nullable<CommandCooldowns.CooldownValue> = null;

  if (!CommandObject.options?.cooldown) {
    return { UserCooldown, GuildCooldown, BaseCooldownMs };
  }

  if (typeof CommandObject.options.cooldown === "number") {
    BaseCooldownMs = CommandObject.options.cooldown * 1000;
    return { UserCooldown, GuildCooldown, BaseCooldownMs };
  }

  if (typeof CommandObject.options.cooldown === "object") {
    if (Interaction.isChatInputCommand()) {
      const RunningCmdGS =
        Interaction.options.getSubcommandGroup(false) ?? Interaction.options.getSubcommand(false);

      if (RunningCmdGS) {
        const MatchingSubcmdCooldown = CommandObject.options.cooldown[RunningCmdGS];
        if (MatchingSubcmdCooldown) {
          if (typeof MatchingSubcmdCooldown === "number") {
            BaseCooldownMs = MatchingSubcmdCooldown * 1000;
          } else if (typeof MatchingSubcmdCooldown === "object") {
            UserCooldown = MatchingSubcmdCooldown.$user ?? null;
            GuildCooldown = MatchingSubcmdCooldown.$guild ?? null;

            if (typeof UserCooldown === "number") {
              BaseCooldownMs = UserCooldown * 1000;
            }
          }

          return { UserCooldown, GuildCooldown, BaseCooldownMs };
        }

        const CooldownFallbackKey = Object.keys(CommandObject.options.cooldown).find((key) =>
          AllOtherCmdNamesPattern.test(key)
        );

        if (CooldownFallbackKey) {
          const FallbackCooldown = CommandObject.options.cooldown[CooldownFallbackKey];
          if (typeof FallbackCooldown === "number") {
            BaseCooldownMs = FallbackCooldown * 1000;
          } else if (FallbackCooldown && typeof FallbackCooldown === "object") {
            UserCooldown = FallbackCooldown.$user ?? null;
            GuildCooldown = FallbackCooldown.$guild ?? null;

            if (typeof UserCooldown === "number") {
              BaseCooldownMs = UserCooldown * 1000;
            }
          }

          return { UserCooldown, GuildCooldown, BaseCooldownMs };
        }
      }
    }

    // No subcommand-specific cooldown found, use global settings if present.
    if ("$user" in CommandObject.options.cooldown || "$guild" in CommandObject.options.cooldown) {
      UserCooldown = CommandObject.options.cooldown.$user ?? null;
      GuildCooldown = CommandObject.options.cooldown.$guild ?? null;

      if (typeof UserCooldown === "number") {
        BaseCooldownMs = UserCooldown * 1000;
      }
    }
  }

  return { UserCooldown, GuildCooldown, BaseCooldownMs };
}

/**
 * Process user-specific rate limits.
 * @param Interaction - The command interaction to process.
 * @param CommandName - The full name of the command.
 * @param UserCooldown - The user cooldown configuration.
 * @param CurrentTS - The current timestamp.
 * @returns The interaction reply if a cooldown is applied, otherwise `null`.
 */
async function ProcessUserCooldown(
  Interaction: ChatContextCmdInteraction,
  CommandName: string,
  UserCooldown: Nullable<CommandCooldowns.CooldownValue>,
  CurrentTS: number
) {
  if (!UserCooldown) return null;
  if (typeof UserCooldown === "object") {
    const { timeframe: Timeframe, max_executions: MaxExecutions } = UserCooldown;

    if (MaxExecutions && Timeframe) {
      const UserCmdKey = `${Interaction.user.id}:${CommandName}`;
      let UserExecInfo = UserCommandExecutionsCache.get<ThrottleTracker>(UserCmdKey);

      if (UserExecInfo) {
        if (UserExecInfo.count >= MaxExecutions) {
          const TimeframeEnds = UserExecInfo.first_exec + Timeframe * 1000;
          return Interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new WarnEmbed()
                .setTitle("Rate Limited")
                .setDescription(
                  "You have reached the maximum number of executions for this command at this time. You may try again %s.",
                  time(Math.round(TimeframeEnds / 1000), "R")
                ),
            ],
          });
        }

        UserExecInfo.count++;
        UserCommandExecutionsCache.set(UserCmdKey, UserExecInfo, {
          ttl: Math.floor(UserExecInfo.first_exec + Timeframe * 1000 - CurrentTS),
        });
      } else {
        UserExecInfo = { count: 1, first_exec: CurrentTS };
        UserCommandExecutionsCache.set(UserCmdKey, UserExecInfo, { ttl: Timeframe * 1000 });
      }
    }
  }

  return null;
}

/**
 * Process guild-specific cooldowns including rate limits.
 * @param Interaction - The command interaction to process.
 * @param CommandName - The full name of the command.
 * @param GuildCooldown - The guild cooldown configuration.
 * @param CurrentTS - The current timestamp.
 * @returns The interaction reply if a cooldown is applied, otherwise `null`.
 */
async function ProcessGuildCooldown(
  Interaction: ChatContextCmdInteraction,
  CommandName: string,
  GuildCooldown: Nullable<CommandCooldowns.CooldownValue>,
  CurrentTS: number
) {
  if (!GuildCooldown || !Interaction.inGuild()) return null;
  const GuildId = Interaction.guildId;

  if (typeof GuildCooldown === "object") {
    const {
      cooldown: Cooldown,
      max_executions: MaxExecutions,
      timeframe: Timeframe,
    } = GuildCooldown;

    if (Cooldown) {
      const GuildCmdKey = `${GuildId}:${CommandName}:cooldown`;
      const LastGuildExecution = GuildCommandExecutionsCache.get<number>(GuildCmdKey);

      if (LastGuildExecution) {
        const GuildCooldownTimeMs = Cooldown * 1000;
        const ExpTimestamp = LastGuildExecution + GuildCooldownTimeMs;

        if (CurrentTS < ExpTimestamp) {
          return Interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new WarnEmbed()
                .setTitle("Server Cooldown")
                .setDescription(
                  "This command is currently on cooldown for the entire server. It can be used again %s.",
                  time(Math.round(ExpTimestamp / 1000), "R")
                ),
            ],
          });
        }
      }

      GuildCommandExecutionsCache.set(GuildCmdKey, CurrentTS);
    }

    // Process rate limiting (max executions within timeframe) after cooldown check passes.
    if (MaxExecutions && Timeframe) {
      const GuildCmdKey = `${GuildId}:${CommandName}`;
      let GuildExecInfo = GuildCommandExecutionsCache.get<ThrottleTracker>(GuildCmdKey);

      if (GuildExecInfo) {
        if (GuildExecInfo.count >= MaxExecutions) {
          const TimeframeEnds = GuildExecInfo.first_exec + Timeframe * 1000;
          return Interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new WarnEmbed()
                .setTitle("Server Rate Limited")
                .setDescription(
                  "This server has reached its usage limit for this command at this time. Please try again %s.",
                  time(Math.round(TimeframeEnds / 1000), "R")
                ),
            ],
          });
        }

        GuildExecInfo.count++;
        GuildCommandExecutionsCache.set(GuildCmdKey, GuildExecInfo, {
          ttl: Math.floor(GuildExecInfo.first_exec + Timeframe * 1000 - CurrentTS),
        });
      } else {
        GuildExecInfo = { count: 1, first_exec: CurrentTS };
        GuildCommandExecutionsCache.set(GuildCmdKey, GuildExecInfo, { ttl: Timeframe * 1000 });
      }
    }
  } else if (typeof GuildCooldown === "number") {
    const GuildCmdKey = `${GuildId}:${CommandName}:cooldown`;
    const LastGuildExecution = GuildCommandExecutionsCache.get<number>(GuildCmdKey);

    if (LastGuildExecution) {
      const GuildCooldownTimeMs = GuildCooldown * 1000;
      const ExpTimestamp = LastGuildExecution + GuildCooldownTimeMs;

      if (CurrentTS < ExpTimestamp) {
        return Interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new WarnEmbed()
              .setTitle("Server Cooldown")
              .setDescription(
                "This command is currently on cooldown for the entire server. It can be used again %s.",
                time(Math.round(ExpTimestamp / 1000), "R")
              ),
          ],
        });
      }
    }

    GuildCommandExecutionsCache.set(GuildCmdKey, CurrentTS);
  }

  return null;
}

/**
 * Handles the cooldown mechanism for a command execution, ensuring that users
 * cannot execute the same command repeatedly within a specified cooldown period.
 * @param Interaction - The command interaction.
 * @param CommandName - The name of the command being executed.
 * @param CooldownTimeMs - The cooldown duration in milliseconds.
 * @param CurrentTS - The current timestamp in milliseconds.
 * @returns The interaction reply if a cooldown is applied, `null` otherwise.
 */
async function ProcessStandardCooldown(
  Interaction: ChatContextCmdInteraction,
  CommandName: string,
  CooldownTimeMs: number,
  CurrentTS: number
) {
  const UserCmdKey = `${Interaction.user.id}:${CommandName}:cooldown`;
  const LastUserExecution = UserCommandExecutionsCache.get<number>(UserCmdKey);

  if (LastUserExecution) {
    const ExpTimestamp = LastUserExecution + CooldownTimeMs;

    if (CurrentTS < ExpTimestamp) {
      const IsSlashCommand = Interaction.isChatInputCommand();
      return Interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new WarnEmbed()
            .setTitle("Cooldown")
            .setDescription(
              IsSlashCommand
                ? "Kindly wait. You currently have a cooldown for the %s slash command and may use it again %s."
                : "Kindly wait. You currently have a cooldown for the `%s` context menu command and may use it again %s.",
              IsSlashCommand ? `</${CommandName}:${Interaction.commandId}>` : CommandName,
              time(Math.round(ExpTimestamp / 1000), "R")
            ),
        ],
      });
    }
  }

  UserCommandExecutionsCache.set(UserCmdKey, CurrentTS, { ttl: CooldownTimeMs });
  return null;
}
