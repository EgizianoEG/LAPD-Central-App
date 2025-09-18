import { FormatCallsignDesignation as FormatDesignation } from "@Utilities/Strings/Formatters.js";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { PermissionFlagsBits } from "discord.js";
import { Callsigns } from "@Typings/Utilities/Database.js";

import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import IsLoggedIn from "@Utilities/Database/IsUserLoggedIn.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Noblox from "noblox.js";
const FileLabel = "Utilities:Discord:HandleCallsignStatusUpdates";

/**
 * Handles the follow-up operations (currently nickname updates)
 * related to a callsign's status update, such as activation or deactivation.
 * Supports multiple callsign documents, potentially from different guilds.
 * @param ClientInst
 * @param UpdatedCallsigns
 */
export default async function HandleCallsignStatusUpdates(
  ClientInst: DiscordClient,
  UpdatedCallsigns: Callsigns.CallsignDocument | Callsigns.CallsignDocument[]
) {
  try {
    const Callsigns = Array.isArray(UpdatedCallsigns) ? UpdatedCallsigns : [UpdatedCallsigns];
    const CallsignsByGuild = Object.groupBy(Callsigns, (C) => C.guild);

    for (const GuildId in CallsignsByGuild) {
      if (!Object.hasOwn(CallsignsByGuild, GuildId)) continue;
      const Guild = await ClientInst.guilds.fetch(GuildId);
      if (!Guild) continue;

      const AppMember = await Guild.members.fetchMe().catch(() => null);
      if (!AppMember?.permissions.has(PermissionFlagsBits.ManageNicknames)) continue;

      const GuildSettings = await GetGuildSettings(GuildId);
      if (!GuildSettings?.callsigns_module.update_nicknames) continue;

      const CallsignsForGuild = CallsignsByGuild[GuildId]!;
      const UpdatePromises = CallsignsForGuild.map(async (Callsign) => {
        const Member = await Guild.members.fetch(Callsign.requester).catch(() => null);
        if (!Member) return;

        const CSDesignation = Callsign.designation;
        const IsAssignment =
          Callsign.request_status === GenericRequestStatuses.Approved &&
          (Callsign.expiry === null || Callsign.expiry > new Date()) &&
          Callsign.reviewed_on;

        if (IsAssignment) {
          let NewNickname = GuildSettings.callsigns_module.nickname_format
            .replace(/{division}/i, CSDesignation.division.toString())
            .replace(/{unit_type}/i, CSDesignation.unit_type.toString())
            .replace(/{beat_num}/i, CSDesignation.beat_num.toString())
            .replace(/{nickname}/i, Member.nickname ?? Member.displayName)
            .replace(/{display_name}/i, Member.displayName);

          if (/{roblox_username}/i.test(NewNickname)) {
            const LinkedAccount = await IsLoggedIn({ user: { id: Member.id }, guildId: GuildId });
            if (LinkedAccount > 0) {
              const Username = await Noblox.getUsernameFromId(LinkedAccount).catch(() => null);
              if (Username) {
                NewNickname = NewNickname.replace(/{roblox_username}/i, Username);
              }
            } else {
              NewNickname = NewNickname.replace(/{roblox_username}/i, "");
            }
          }

          return Member.setNickname(
            NewNickname.slice(0, 32),
            `Call sign '${FormatDesignation(CSDesignation)}' was approved and assigned.`
          );
        } else {
          const CurrentNickname = Member.nickname ?? Member.displayName;
          const PrefixRegex = GenerateCallsignPrefixRegex(
            GuildSettings.callsigns_module.nickname_format
          );

          if (PrefixRegex?.test(CurrentNickname)) {
            const CleanedNickname = CurrentNickname.replace(PrefixRegex, "").trim();
            if (CleanedNickname && CleanedNickname !== CurrentNickname) {
              return Member.setNickname(
                CleanedNickname.slice(0, 32),
                `Call sign '${FormatDesignation(CSDesignation)}' was released or expired.`
              );
            }
          }
        }
      });

      const UpdateResults = await Promise.allSettled(UpdatePromises);
      UpdateResults.forEach((Result) => {
        if (Result.status === "rejected") {
          AppLogger.error({
            message: "Error updating member nickname after callsign status update.",
            label: FileLabel,
            error: Result.reason,
            stack: Result.reason?.stack,
          });
        }
      });
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Error in HandleCallsignStatusUpdates.",
      label: FileLabel,
      stack: Err.stack,
      error: Err,
    });
  }
}

/**
 * Generates a regex pattern to match callsign prefixes based on the guild's nickname format.
 * This function analyzes the format string and creates a pattern that can match various
 * callsign designations at the beginning of nicknames.
 *
 * @param NicknameFormat - The guild's nickname format string (e.g., "{division}-{unit_type}-{beat_num} | {nickname}")
 * @returns RegExp that matches callsign prefixes, or `null` if no callsign pattern is found
 *
 * @example
 * ```typescript
 * const format = "{division}-{unit_type}-{beat_num} | {nickname}";
 * const regex = generateCallsignPrefixRegex(format);
 * // Returns regex that matches: "1-A-50 | ", "14-SL-144 | ", etc.
 * ```
 */
function GenerateCallsignPrefixRegex(NicknameFormat: string): RegExp | null {
  if (!NicknameFormat || NicknameFormat.length > 100) {
    return null;
  }

  // Check if format starts with callsign designation placeholders (potentially wrapped in special chars).
  // Look for callsign placeholders at the start, possibly after opening brackets/parens/etc.
  NicknameFormat = NicknameFormat.trim();
  const StartsWithCallsign = /^[[({\s]*\{(?:division|unit_type|beat_num)\}/i.test(NicknameFormat);

  if (!StartsWithCallsign) {
    return null;
  }

  const BeforeNicknameMatch = NicknameFormat.match(
    /^(.*?)(?:\{(?:nickname|display_name|roblox_username)\}|$)/i
  );

  if (!BeforeNicknameMatch) return null;
  let Pattern = BeforeNicknameMatch[1];
  const HasDivision = /\{division\}/i.test(Pattern);
  const HasUnitType = /\{unit_type\}/i.test(Pattern);
  const HasBeatNum = /\{beat_num\}/i.test(Pattern);

  if (!HasDivision && !HasUnitType && !HasBeatNum) {
    return null;
  }

  // 1. First, escape ALL regex special characters to make the format literal
  // 2. Then replace pre-known placeholders with appropriate regex patterns (case-insensitive)
  // 3. Make hyphens optional and spaces flexible

  Pattern = Pattern.replace(/[.*+?^${}()|\\[\]]/g, "\\$&");
  Pattern = Pattern.replace(/\\?\{division\\?\}/gi, "\\d{1,2}")
    .replace(/\\?\{unit_type\\?\}/gi, "[A-Z]{1,3}\\d*|\\d*[A-Z]{1,3}")
    .replace(/\\?\{beat_num\\?\}/gi, "\\d{1,3}");

  Pattern = Pattern.replace(/\\[-−–—‒⁃‑]/g, "[-−–—‒⁃‑]?").replace(/\\\s/g, "\\s*");
  Pattern = "^" + Pattern + "\\s*";

  try {
    return new RegExp(Pattern, "i");
  } catch (RegexError: any) {
    AppLogger.warn({
      message: "Failed to generate callsign prefix regex pattern.",
      label: FileLabel,
      stack: RegexError.stack,
      error: RegexError,
    });

    return null;
  }
}
