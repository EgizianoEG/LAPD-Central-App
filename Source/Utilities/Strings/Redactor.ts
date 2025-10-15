import FFI from "node-ffi-rs";
import Path from "node:path";
import FileSys from "node:fs";
import Process from "node:process";
import Linkify from "linkifyjs";
import AppLogger from "@Utilities/Classes/AppLogger.js";

import { GuildAutomodRulesCache } from "@Utilities/Helpers/Cache.js";
import {
  Guild,
  Collection,
  AutoModerationRule,
  PermissionFlagsBits,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
} from "discord.js";

import {
  IsValidChannelOrMessageLink,
  IsValidDiscordAttachmentLink,
} from "@Utilities/Helpers/Validators.js";

// ---------------------------------------------------------------------------------------
// Definitions:
// ------------
const CLibExtension = Process.platform === "win32" ? "dll" : "so";
const FileLabel = "Utilities:Strings:Redactor";
const CLibPath = Path.join(
  import.meta.dirname,
  "..",
  "..",
  "Resources",
  "Libs",
  `cl_rust_rr.${CLibExtension}`
);

let FFIFuncs: null | {
  rust_regex_replace: RustRegexReplaceFun;
  rust_regex_replace_free: RustRegexRepFreeFun;
} = null;

type ReplacementType = "Word" | "Character";
type FilterUserInputsReturnT<T> = T extends readonly string[] ? string[] : string;
type RustRegexRepFreeFun = (params: [FFI.JsExternal]) => void;
type RustRegexReplaceFun = (
  params: RustRegexReplaceParams
) => FFI.ResultWithErrno<FFI.JsExternal, true>;

export interface FilterUserInputOptions {
  /**
   * The string to use as a replacement when redacting content.
   * @default "*"
   */
  replacement?: string;

  /**
   * Specifies how the replacement should be applied.
   * - `Character`: Each character of a matching word will be replaced with the `replacement` value.
   * - `Word`: The entire word will be replaced with the `replacement` value.
   * @default "Character"
   */
  replacement_type?: ReplacementType;

  /**
   * Indicates whether to filter and redact links and emails from the input.
   * @default true
   */
  filter_links_emails?: boolean;

  /**
   * The guild whose auto-moderation rules should be used to filter the input string.
   * If not set, the input string will only be filtered for links and emails (if enabled), and not based on specific guild auto-moderation rules.
   *
   * **Note:** Auto-moderation rules that do not block messages will not be applied. These rules include those that:
   * - Do not have actions set to `Timeout`, `BlockMessage`, or `BlockMemberInteraction`.
   * - Only have the `SendAlertMessage` action or no action set at all.
   */
  guild_instance?: Guild;

  /**
   * Indicates whether user text input filtering is enabled for the guild. When set to `true`, the input string will be filtered; otherwise, it will not.
   * @default true
   */
  utif_setting_enabled?: boolean;

  /**
   * The Id of the target channel where the input string will be sent.
   * If set, the function will first check if the channel is exempt from certain rules and will not apply those rules to the input string.
   * If not set, the input string will be filtered regardless of the channel.
   */
  target_channel?: string;

  /**
   * The role Ids of the member who wrote/typed the input string.
   * This allows the function to skip or apply certain auto-moderation rules based on the member's roles.
   * If not set, the input string will be filtered regardless of the member's roles.
   */
  input_from_roles?: string[];

  /**
   * Specifies whether to not redact links on Discord domains/subdomains that are considered safe.
   * Safe links are those that are not considered harmful or malicious in nature such as channel, message, and attachment links.
   * Options include:
   * - `true`: Channel, message, and attachment links are excluded.
   * - `false`: All Discord links are included.
   * - `"channel/message"`: Only channel and message links are excluded.
   * - `"attachment"`: Only attachment links are excluded.
   * @remarks This option is only applicable when `filter_links_emails` is set to `true`.
   * @default `"channel/message"`
   */
  allow_discord_safe_links?: boolean | "channel/message" | "attachment";
}

/**
 * Options for redacting text, allowing for pattern-based or length-based redaction with customizable replacements.
 */
interface RedactTextFromOptions {
  /**
   * A pattern used to identify the portion of the text to redact. This can be a string or a regular expression.
   * If not provided, the function will not perform redaction based on a pattern.
   */
  from_pattern?: string | RegExp;

  /**
   * The character or string to replace the matched text with, for each character redacted.
   * @default "*"
   */
  replacement?: string;

  /**
   * Indicates whether to redact by length or by pattern.
   * If true, the function will redact a portion of the text based on the specified length/scale provided.
   * @default false
   */
  redact_by_length?: boolean;

  /**
   * Specifies the fraction of the text to redact. The value must be between `0` and `1` (inclusive) and will be
   * clamped to this range if it exceeds the bounds. This option is only applicable when `redact_by_length` is set to `true`.
   * For example:
   * - A value of `0.5` will redact half of the text.
   * - A value of `1` will redact the entire text.
   * @default 0
   */
  redact_fraction?: number;

  /**
   * Indicates whether to redact from the end of the text. This field will have no effect if `from_pattern` is provided,
   * as the regex pattern can be adjusted to ensure it matches from the end of the input.
   * If true, the function will redact from the end of the text instead of the beginning.
   * @default false
   */
  redact_from_end?: boolean;
}

type RustRegexReplaceParams = [
  input: string,
  pattern: string,
  replacement: string,
  replacement_type: ReplacementType,
  allow_list: readonly string[],
  allow_list_count: number,
];

// ---------------------------------------------------------------------------------------

try {
  FFI.open({
    library: "rs_reg_replace",
    path: CLibPath,
  });

  FFIFuncs = FFI.define({
    rust_regex_replace: {
      errno: true,
      library: "rs_reg_replace",
      funcName: "rust_regex_replace",
      retType: FFI.DataType.External,
      paramsType: [
        FFI.DataType.String, // Input string
        FFI.DataType.String, // Pattern
        FFI.DataType.String, // Replacement
        FFI.DataType.String, // Replacement type
        FFI.DataType.StringArray, // Allowlist
        FFI.DataType.I32, // Allowlist count
      ],
    },

    rust_regex_replace_free: {
      errno: true,
      library: "rs_reg_replace",
      funcName: "rust_regex_replace_free",
      retType: FFI.DataType.Void,
      paramsType: [FFI.DataType.External],
    },
  });
} catch (Err: any) {
  AppLogger.error({
    message: "Failed to initialize Rust library functions.",
    path: CLibPath,
    path_exists: FileSys.existsSync(CLibPath),
    label: FileLabel,
    stack: Err.stack,
  });
}

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Redacts links and emails from an input string.
 * @param Input - The input string to redact links and emails from.
 * @param Replacement - The replacement character to use when redacting links and emails. Defaults to `*` for every single character redacted/replaced.
 * @param ReplacementType - The type of replacement to use, either "Character" or "Word". Defaults to "Character".
 * @param ExcludeDiscordSafeLinks - A boolean or string indicating whether to exclude Discord safe links from redaction.
 *  - If `true`, all Discord links are excluded.
 *  - If `"channel/message"`, only channel and message links are excluded.
 *  - If `"attachment"`, only attachment links are excluded.
 *  - If `false`, no links are excluded.
 * @returns An array containing the modified input string (if modified, validate by comparing with `Input`).
 */
export function RedactLinksAndEmails(
  Input: string,
  Replacement: string = "*",
  ReplacementType: ReplacementType = "Character",
  ExcludeDiscordSafeLinks: boolean | "channel/message" | "attachment" = "channel/message"
): string {
  const Matches = Linkify.find(Input);
  const Parts: string[] = [];
  let LastIndex = 0;

  for (const Match of Matches) {
    if (
      Match.isLink &&
      ((ExcludeDiscordSafeLinks === true &&
        (IsValidChannelOrMessageLink(Match.href) ||
          IsValidDiscordAttachmentLink(Match.href, false))) ||
        (ExcludeDiscordSafeLinks === "channel/message" &&
          IsValidChannelOrMessageLink(Match.href)) ||
        (ExcludeDiscordSafeLinks === "attachment" &&
          IsValidDiscordAttachmentLink(Match.href, false)))
    ) {
      continue;
    }

    Parts.push(Input.slice(LastIndex, Match.start));
    Parts.push(ReplacementType === "Word" ? Replacement : Replacement.repeat(Match.value.length));
    LastIndex = Match.end;
  }

  Parts.push(Input.slice(LastIndex));
  return Parts.join("");
}

/**
 * Redacts a portion of the input string based on the provided options.
 * @param Input - The input string to be redacted.
 * @param Options - Configuration options for redaction.
 * @returns The redacted string based on the provided options.
 *          The same string is returned if no or less necessary options are provided.
 */
export function RedactTextByOptions(Input: string, Options: RedactTextFromOptions = {}): string {
  const {
    from_pattern,
    replacement = "*",
    redact_fraction = 0,
    redact_from_end = false,
    redact_by_length = false,
  } = Options;

  const redact_fraction_c = Math.max(0, Math.min(1, redact_fraction));
  if (redact_by_length && redact_fraction_c > 0) {
    const RedactLength = Math.floor(Input.length * redact_fraction_c);
    if (redact_from_end) {
      return Input.slice(0, Input.length - RedactLength) + replacement.repeat(RedactLength);
    } else {
      return replacement.repeat(RedactLength) + Input.slice(RedactLength);
    }
  }

  if (from_pattern) {
    const Pattern = typeof from_pattern === "string" ? new RegExp(from_pattern) : from_pattern;
    const Match = Input.match(Pattern);

    if (Match?.index !== undefined) {
      const StartIndex = Match.index;
      return Input.slice(0, StartIndex) + replacement.repeat(Input.length - StartIndex);
    }
  }

  return Input;
}

/**
 * Filters user input(s) based on provided options and guild auto-moderation rules.
 * @param Inputs - The user input string(s) to be filtered. Can be a single string or an array of strings.
 * @param Options - The options for filtering the user input.
 * @returns The filtered user input. Returns a string if input was a string, or an array of strings if input was an array.
 */
export async function FilterUserInput<T extends string | readonly string[]>(
  Inputs: T,
  Options: FilterUserInputOptions = {}
): Promise<T extends readonly string[] ? string[] : string> {
  const IsArrayInput = Array.isArray(Inputs);
  const InputArray = IsArrayInput ? (Inputs.slice() as string[]) : [Inputs as string];

  // Early returns for empty or whitespace-only inputs:
  const FilteredInputs = InputArray.filter((Input) => !!Input && !/^\s*$/.test(Input));
  if (FilteredInputs.length === 0) {
    return (IsArrayInput ? InputArray : InputArray[0] || "") as FilterUserInputsReturnT<T>;
  }

  if (typeof Options.utif_setting_enabled !== "boolean") {
    Options.utif_setting_enabled = true;
  }

  if (!Options.utif_setting_enabled) {
    return (IsArrayInput ? InputArray : InputArray[0] || "") as FilterUserInputsReturnT<T>;
  }

  let ModifiedInputs = InputArray.slice();
  const Replacement = Options.replacement ?? "*";
  const ReplacementType = Options.replacement_type ?? "Character";
  const FilterLinksEmails =
    typeof Options.filter_links_emails === "boolean" ? Options.filter_links_emails : true;

  if (FilterLinksEmails) {
    ModifiedInputs = ModifiedInputs.map((Input) =>
      RedactLinksAndEmails(Input, Replacement, ReplacementType, Options.allow_discord_safe_links)
    );
  }

  // Apply automoderation rules set in the specified guild:
  if (Options.guild_instance) {
    const AppMember =
      Options.guild_instance.members.me ?? (await Options.guild_instance.members.fetchMe());

    const CachedAutoModerationRules = GuildAutomodRulesCache.get(Options.guild_instance.id);
    if (!CachedAutoModerationRules && !AppMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return (IsArrayInput ? ModifiedInputs : ModifiedInputs[0]) as FilterUserInputsReturnT<T>;
    }

    const AutomoderationRules =
      CachedAutoModerationRules ??
      (await Options.guild_instance.autoModerationRules
        .fetch()
        .then((Rules) => {
          GuildAutomodRulesCache.set(Options.guild_instance!.id, Rules);
          return Rules;
        })
        .catch((Err: any) => {
          AppLogger.error({
            message: "Failed to fetch auto-moderation rules for guild '%s'",
            label: FileLabel,
            stack: Err.stack,
            splat: [Options.guild_instance!.id],
          });

          return new Collection<string, AutoModerationRule>();
        }));

    for (const Rule of AutomoderationRules.values()) {
      if (!ShouldAutomoderationRuleBeApplied(Rule, Options)) continue;
      if (Rule.triggerMetadata.keywordFilter.length) {
        const SanitizedRuleAllowedKeywords = SanitizeAutomodRuleKeywords(
          Rule.triggerMetadata.allowList,
          "Allowed"
        );

        const SanitizedRuleBlockedKeywords = SanitizeAutomodRuleKeywords(
          Rule.triggerMetadata.keywordFilter,
          "Blocked"
        );

        if (SanitizedRuleBlockedKeywords.length) {
          const ProcessedInputs: string[] = [];

          for (const Input of ModifiedInputs) {
            try {
              const KeywordsRegex = new RegExp(SanitizedRuleBlockedKeywords.join("|"), "gi");
              const ProcessedInput = Input.replace(KeywordsRegex, (Match: string) => {
                if (SanitizedRuleAllowedKeywords.some((Word) => new RegExp(Word).test(Match))) {
                  return Match;
                }
                return ReplacementType === "Word" ? Replacement : Replacement.repeat(Match.length);
              });

              ProcessedInputs.push(ProcessedInput);
            } catch {
              // If there's an error processing this input, keep it unchanged.
              ProcessedInputs.push(Input);
            }
          }

          ModifiedInputs = ProcessedInputs;
        }
      }

      // Filter inputs based on set Rust regex patterns in the automoderation rule:
      if (!Rule.triggerMetadata.regexPatterns.length || !FFIFuncs?.rust_regex_replace) continue;
      const ForLoopOutput: { last_error: null | Error; error_count: number } = {
        last_error: null,
        error_count: 0,
      };

      for (const Pattern of Rule.triggerMetadata.regexPatterns) {
        ModifiedInputs = ModifiedInputs.map((Input) => {
          try {
            const Received = FFIFuncs.rust_regex_replace([
              Input,
              Pattern,
              Replacement,
              ReplacementType as any,
              Rule.triggerMetadata.allowList,
              Rule.triggerMetadata.allowList.length,
            ]);

            if (Received.errnoCode === 0) {
              const WrappedStrPointer = FFI.wrapPointer([Received.value]);
              const OutputString = FFI.restorePointer<FFI.DataType.String>({
                retType: [FFI.DataType.String],
                paramsValue: WrappedStrPointer,
              })[0];

              // Make sure to free up memory allocated by the returned value:
              FFIFuncs.rust_regex_replace_free([Received.value]);
              return OutputString;
            }

            ForLoopOutput.error_count++;
            ForLoopOutput.last_error = new Error(Received.errnoMessage, {
              cause: Received.errnoCode,
            });

            return Input;
          } catch (Err: any) {
            ForLoopOutput.error_count++;
            ForLoopOutput.last_error = Err;
            return Input;
          }
        });
      }

      if (ForLoopOutput.error_count) {
        AppLogger.error({
          message:
            "Failed to apply auto-moderation rule '%s' for guild '%s'. Errors outputted: %i; last error stack:",
          label: FileLabel,
          stack: ForLoopOutput.last_error?.stack,
          splat: [Rule.id, Options.guild_instance.id, ForLoopOutput.error_count],
        });
      }
    }
  }

  return (IsArrayInput ? ModifiedInputs : ModifiedInputs[0]) as FilterUserInputsReturnT<T>;
}

/**
 * Determines whether an auto-moderation rule should be applied.
 * @param Rule - The auto-moderation rule to evaluate.
 * @param FilteringOpts - The options used to filter the input string using the auto-moderation rule.
 * @returns `true` if the rule should be applied; otherwise, `false`.
 *
 * **The rule should not be applied if:**
 * - The rule is disabled (`Rule.enabled === false`).
 * - The rule has no actions (`Rule.actions.length === 0`).
 * - All actions of the rule are of type `AutoModerationActionType.SendAlertMessage` which do not block the message triggered it.
 * - The rule is exempt from the target channel (`Rule.exemptChannels.has(FilteringOpts.target_channel)`).
 * - The rule is exempt from the member who wrote/typed the input string (`Rule.exemptRoles.hasAny(...FilteringOpts.input_from_roles)`).
 * - The rule is of trigger type `3`, `4`, `5`, or `6` which are *not* executable by the way we handle them.
 *
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation for more information about why certain rules are not applicable to be executed here.
 */
function ShouldAutomoderationRuleBeApplied(
  Rule: AutoModerationRule,
  FilteringOpts: FilterUserInputOptions
) {
  return !(
    Rule.enabled === false ||
    Rule.actions.length === 0 ||
    Rule.actions.every(
      (RuleAction) => RuleAction.type === AutoModerationActionType.SendAlertMessage
    ) ||
    Rule.eventType === AutoModerationRuleEventType.MemberUpdate ||
    (FilteringOpts.target_channel && Rule.exemptChannels.has(FilteringOpts.target_channel)) ||
    (FilteringOpts.input_from_roles &&
      Rule.exemptRoles.hasAny(...FilteringOpts.input_from_roles)) ||
    [
      AutoModerationRuleTriggerType.Spam,
      AutoModerationRuleTriggerType.MentionSpam,
      AutoModerationRuleTriggerType.KeywordPreset,
      AutoModerationRuleTriggerType.MemberProfile,
    ].includes(Rule.triggerType)
  );
}

/**
 * Sanitizes an array of keywords based on the specified type ("Allowed" or "Blocked").
 * @param Keywords - An array of keywords to be sanitized. Each keyword is a string.
 * @param Type - The type of sanitization to apply. Can be either "Allowed" or "Blocked".
 * @returns An array of sanitized keywords. If the keyword starts or ends with an asterisk (*),
 *          it is treated as a wildcard and sanitized accordingly. Otherwise, it is wrapped
 *          with word boundaries based on the specified type.
 */
function SanitizeAutomodRuleKeywords(Keywords: readonly string[], Type: "Allowed" | "Blocked") {
  Keywords = Keywords.filter((Word) => Boolean(Word) && Linkify.test(Word) === false);
  return Keywords.map((Keyword) => {
    if (!(Keyword.startsWith("*") || Keyword.endsWith("*")))
      return Type === "Allowed" ? `^\\b${Keyword}\\b$` : `\\b${Keyword}\\b`;

    return Keyword.replace(/^\*?([^*\n]+)\*?$/gi, (Match, Capture) => {
      return Match.startsWith("*") ? `\\b[^\\n\\s]*${Capture}\\b` : `\\b${Capture}[^\\n\\s]*\\b`;
    });
  });
}
