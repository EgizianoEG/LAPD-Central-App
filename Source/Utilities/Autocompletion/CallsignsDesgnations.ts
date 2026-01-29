import type { ApplicationCommandOptionChoiceData, GuildMember } from "discord.js";
import { ServiceUnitTypes, DivisionBeats } from "#Resources/LAPDCallsigns.js";
import { GeneralAutocompletionCache } from "#Utilities/Helpers/Cache.js";
import { GenericRequestStatuses } from "#Config/Constants.js";
import { Callsigns, Guilds } from "#Typings/Utilities/Database.js";
import { QueryFilter } from "mongoose";
import GetGuildSettings from "#Utilities/Database/GetGuildSettings.js";
import CallsignModel from "#Models/Callsign.js";

// ---------------------------------------------------------------------------------------
// Autocompletion Functions:
// -------------------------
/**
 * Autocompletes an input callsign service unit type.
 * @param Typed The input value from user.
 * @param GuildId - The guild Id to check unit type restrictions against.
 * @param Member - The guild member requesting the autocompletion (used for restriction checks).
 * @returns An array of suggestions.
 */
export async function AutocompleteServiceUnitType(
  Typed: string,
  GuildId: string | null = null,
  Member: GuildMember | null = null
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: { name: string; value: string }[];
  const GuildSettings = Member && GuildId ? await GetGuildSettings(GuildId) : null;
  const RestrictedIndicator = " (Restricted)";

  if (Typed.match(/^\s*$/)) {
    Suggestions = ServiceUnitTypes.map((u) => {
      const IsRestricted =
        Member && GuildSettings ? IsUnitTypeRestricted(u.unit, Member, GuildSettings) : false;

      const Label = IsRestricted
        ? `${u.unit}  –  (${u.desc})${RestrictedIndicator}`
        : `${u.unit}  –  (${u.desc})`;

      return {
        name: Label,
        value: u.unit,
      };
    });
  } else {
    Suggestions = ServiceUnitTypes.filter((u) => {
      const LowerCaseUnit = u.unit.toLowerCase();
      return LowerCaseUnit.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseUnit);
    }).map((u) => {
      const IsRestricted =
        Member && GuildSettings ? IsUnitTypeRestricted(u.unit, Member, GuildSettings) : false;

      const Label = IsRestricted
        ? `${u.unit}  –  (${u.desc})${RestrictedIndicator}`
        : `${u.unit}  –  (${u.desc})`;

      return {
        name: Label,
        value: u.unit,
      };
    });
  }

  if (!Suggestions.length) {
    Suggestions = ServiceUnitTypes.map((u) => {
      const IsRestricted =
        Member && GuildSettings ? IsUnitTypeRestricted(u.unit, Member, GuildSettings) : false;

      const Label = IsRestricted
        ? `${u.unit}  –  (${u.desc})${RestrictedIndicator}`
        : `${u.unit}  –  (${u.desc})`;

      return {
        name: Label,
        value: u.unit,
      };
    });
  }

  return Suggestions.slice(0, 25);
}

/**
 * Autocompletes an input division beat number.
 * @param Typed The input value from user.
 * @returns An array of suggestions.
 */
export function AutocompleteDivisionBeat(Typed: string): Array<ApplicationCommandOptionChoiceData> {
  const LowerCaseTyped = Typed.toLowerCase();
  let Suggestions: { name: string; value: string }[];

  if (Typed.match(/^\s*$/)) {
    Suggestions = DivisionBeats.map((b) => ({ name: `(${b.num}) ${b.name}`, value: `${b.num}` }));
  } else {
    Suggestions = DivisionBeats.filter((b) => {
      const LowerCaseName = b.name.toLowerCase();
      const NumMatch = `${b.num}`.includes(Typed);
      const NameMatch =
        LowerCaseName.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCaseName);
      return NameMatch || NumMatch;
    }).map((b) => ({ name: `(${b.num}) ${b.name}`, value: `${b.num}` }));
  }

  if (!Suggestions.length)
    Suggestions = DivisionBeats.map((b) => ({ name: `(${b.num}) ${b.name}`, value: `${b.num}` }));

  return Suggestions.slice(0, 25);
}

/**
 * Autocompletes an input beat number.
 * @param TypedBeat - The input value for the beat number.
 * @param GuildId - The guild Id to check beat number availability against.
 * @param Member - The guild member requesting the autocompletion (used for restriction checks).
 * @param TargetDivision - The target division to filter by or give suggestions based on.
 * @returns An array of suggestions.
 * @remarks
 * - If `TargetDivision` is provided, suggestions will be filtered to only include ***available*** beats from that division.
 * - If `TargetDivision` is not provided, suggestions will include all beats from all divisions, regardless.
 * - If `TypedBeat` is empty or whitespace, all relevant vacant beats will be suggested.
 * - If `TypedBeat` is provided and there exists matching beats within the same division, suggestion label will state that this beat is in use.
 * - Beat number restrictions based on user roles will be applied and indicated in suggestion labels.
 */
export async function AutocompleteBeatNumber(
  TypedBeat: string,
  GuildId: string,
  Member: GuildMember | null = null,
  TargetDivision: string | null = null
): Promise<Array<ApplicationCommandOptionChoiceData>> {
  const Suggestions: { name: string; value: string }[] = [];
  const TypedBeatNum = Number.parseInt(TypedBeat.trim(), 10);
  const GuildSettings = Member ? await GetGuildSettings(GuildId) : null;

  if (TypedBeat.match(/^\s*$/) || Number.isNaN(TypedBeatNum) || TypedBeatNum <= 0) {
    const VacantBeatNums = await GetVacantBeatNums(GuildId, TargetDivision);
    const FilteredBeats =
      Member && GuildSettings
        ? VacantBeatNums.filter(
            (BeatNum) =>
              !IsBeatNumberRestricted(Number.parseInt(BeatNum, 10), Member, GuildSettings)
          )
        : VacantBeatNums;

    return FilteredBeats.slice(0, 25).map((BeatNum) => ({
      name: BeatNum,
      value: BeatNum,
    }));
  }

  const FormattedTypedBeat = TypedBeatNum.toString().padStart(2, "0");
  let IsTypedBeatRestricted = false;
  let IsTypedBeatTaken = false;

  if (TargetDivision) {
    const TakenBeatNums = await GetTakenBeatNums(GuildId, TargetDivision);
    IsTypedBeatTaken = TakenBeatNums.includes(FormattedTypedBeat);
  }

  if (Member && GuildSettings) {
    IsTypedBeatRestricted = IsBeatNumberRestricted(TypedBeatNum, Member, GuildSettings);
  }

  let BeatLabel = FormattedTypedBeat;
  const StatusLabels: string[] = [];

  if (TargetDivision && IsTypedBeatTaken) {
    StatusLabels.push("Taken/Unavailable");
  }

  if (IsTypedBeatRestricted) {
    StatusLabels.push("Restricted");
  }

  if (StatusLabels.length > 0) {
    BeatLabel = `${FormattedTypedBeat} (${StatusLabels.join(", ")})`;
  }

  Suggestions.push({
    name: BeatLabel,
    value: FormattedTypedBeat,
  });

  const NearbySuggestions = await GenerateNearbyBeatSuggestions(
    TypedBeatNum,
    GuildId,
    TargetDivision,
    Member,
    GuildSettings,
    14
  );

  Suggestions.push(...NearbySuggestions);
  return Suggestions.slice(0, 25);
}

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
/**
 * Checks if a unit type is restricted for a specific user based on their roles.
 * @param UnitType - The unit type to check.
 * @param Member - The guild member to check restrictions against.
 * @param GuildSettings - The guild settings containing unit type restrictions.
 * @returns `true` if the unit type is restricted for the user, `false` otherwise.
 *
 * @remarks
 * **Whitelist Mode (`unit_type_whitelist: true`):**
 * - All unit types are restricted by default unless explicitly added to `unit_type_restrictions`
 * - If a unit type is in the whitelist with empty `permitted_roles`, it's available to everyone
 * - If it has specific roles in `permitted_roles`, only users with those roles can use it
 *
 * **Blacklist Mode (`unit_type_whitelist: false`):**
 * - All unit types are allowed by default
 * - Only unit types with non-empty `permitted_roles` arrays require specific roles
 * - Unit types not in `unit_type_restrictions` are unrestricted
 */
function IsUnitTypeRestricted(
  UnitType: string,
  Member: GuildMember,
  GuildSettings: Guilds.GuildSettings
): boolean {
  const CSModuleSettings = GuildSettings.callsigns_module;
  const UnitTypeRestrictions = CSModuleSettings.unit_type_restrictions;
  const MemberRoleIds = new Set(Member.roles.cache.map((role) => role.id));
  const UnitTypeRestriction = UnitTypeRestrictions.find(
    (restriction) => restriction.unit_type === UnitType
  );

  if (CSModuleSettings.unit_type_whitelist) {
    if (!UnitTypeRestriction) {
      return true;
    }

    if (UnitTypeRestriction.permitted_roles.length > 0) {
      const HasPermittedRole = UnitTypeRestriction.permitted_roles.some((roleId) =>
        MemberRoleIds.has(roleId)
      );
      return !HasPermittedRole;
    }
  } else if (UnitTypeRestriction && UnitTypeRestriction.permitted_roles.length > 0) {
    const HasPermittedRole = UnitTypeRestriction.permitted_roles.some((roleId) =>
      MemberRoleIds.has(roleId)
    );
    return !HasPermittedRole;
  }

  return false;
}

/**
 * Checks if a beat number is restricted for a specific user based on their roles.
 * @param BeatNumber - The beat number to check.
 * @param Member - The guild member to check restrictions against.
 * @param GuildSettings - The guild settings containing beat restrictions.
 * @return `true` if the beat number is restricted for the user, `false` otherwise.
 */
function IsBeatNumberRestricted(
  BeatNumber: number,
  Member: GuildMember,
  GuildSettings: Guilds.GuildSettings
): boolean {
  const BeatRestrictions = GuildSettings.callsigns_module.beat_restrictions;
  const MemberRoleIds = new Set(Member.roles.cache.map((role) => role.id));
  if (!BeatRestrictions.length) return false;

  for (const Restriction of BeatRestrictions) {
    const [MinRange, MaxRange] = Restriction.range;

    // Check if beat number falls within this restriction range and
    // if the user has any of the permitted roles for this range
    if (BeatNumber >= MinRange && BeatNumber <= MaxRange) {
      const HasPermittedRole = Restriction.permitted_roles.some((roleId) =>
        MemberRoleIds.has(roleId)
      );

      if (!HasPermittedRole || Restriction.permitted_roles.length === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Gets all vacant (available) beat numbers for a guild and optional division.
 * @param GuildId - The guild Id to check beat number availability against.
 * @param Division - The target division to filter by or give suggestions based on.
 * @returns An array of vacant beat numbers as strings.
 * @remarks
 * - Iterates from 01 to 999 to find available beats.
 */
async function GetVacantBeatNums(
  GuildId: string,
  Division: string | null = null
): Promise<string[]> {
  const TakenBeatNums = await GetTakenBeatNums(GuildId, Division);
  const VacantBeats: string[] = [];

  for (let i = 1; i <= 999; i++) {
    const BeatNum = i.toString().padStart(2, "0");
    if (!TakenBeatNums.includes(BeatNum)) {
      VacantBeats.push(BeatNum);
    }
  }

  return VacantBeats;
}

/**
 * Gets all taken (in-use) beat numbers for a guild and optional division.
 * @param GuildId - The guild Id to check beat number availability against.
 * @param Division - The target division to filter by or give suggestions based on.
 * @returns An array of taken beat numbers as strings.
 * @remarks
 * - Caches results for 10 minutes to optimize performance.
 */
async function GetTakenBeatNums(
  GuildId: string,
  Division: string | null = null
): Promise<string[]> {
  const CacheKey = `beats-in-use:${GuildId}:${Division ?? "any"}`;
  const CacheHit = GeneralAutocompletionCache.get<string[]>(CacheKey);
  if (CacheHit) return CacheHit;

  const InUseFilter: QueryFilter<Callsigns.CallsignDocument> = {
    guild: GuildId,
    $or: [{ expiry: null }, { expiry: { $gt: new Date() } }],
    request_status: GenericRequestStatuses.Approved,
  };

  if (Division) {
    InUseFilter["designation.division"] = Number.parseInt(Division, 10);
  }

  const InUseCallsigns = await CallsignModel.find(InUseFilter, { designation: 1 }).lean();
  const TakenBeatNums = InUseCallsigns.map((c) => c.designation.beat_num);

  GeneralAutocompletionCache.set(CacheKey, TakenBeatNums, { ttl: 600 });
  return TakenBeatNums;
}

/**
 * Generates nearby beat number suggestions around a target number.
 * @param TargetNum - The target beat number.
 * @param GuildId - The guild Id to check beat number availability against.
 * @param Division - The target division to filter by or give suggestions based on.
 * @param Member - The guild member requesting the autocompletion (used for restriction checks).
 * @param GuildSettings - The guild settings containing beat restrictions.
 * @param MaxSuggestions - The maximum number of suggestions to generate.
 * @returns An array of nearby beat number suggestions.
 */
async function GenerateNearbyBeatSuggestions(
  TargetNum: number,
  GuildId: string,
  Division: string | null,
  Member: GuildMember | null,
  GuildSettings: Guilds.GuildSettings | null,
  MaxSuggestions: number
): Promise<{ name: string; value: string }[]> {
  const TakenBeatNums = await GetTakenBeatNums(GuildId, Division);
  const Suggestions: { name: string; value: string }[] = [];
  const StepSize = TargetNum % 10 === 0 ? 5 : 1;

  const GeneratedNums = new Set<number>();
  GeneratedNums.add(TargetNum);

  let CurrentSuggestions = 0;
  let Offset = StepSize;

  while (CurrentSuggestions < MaxSuggestions && Offset <= 500) {
    const UpperNum = TargetNum + Offset;
    if (UpperNum <= 999 && !GeneratedNums.has(UpperNum)) {
      const FormattedUpper = UpperNum.toString().padStart(2, "0");
      const IsUpperTaken = Division && TakenBeatNums.includes(FormattedUpper);
      const IsUpperRestricted =
        Member && GuildSettings && IsBeatNumberRestricted(UpperNum, Member, GuildSettings);

      if (!IsUpperRestricted && !IsUpperTaken) {
        Suggestions.push({
          name: FormattedUpper,
          value: FormattedUpper,
        });
        CurrentSuggestions++;
        GeneratedNums.add(UpperNum);
      }
    }

    const LowerNum = TargetNum - Offset;
    if (LowerNum > 0 && !GeneratedNums.has(LowerNum) && CurrentSuggestions < MaxSuggestions) {
      const FormattedLower = LowerNum.toString().padStart(2, "0");
      const IsLowerTaken = Division && TakenBeatNums.includes(FormattedLower);
      const IsLowerRestricted =
        Member && GuildSettings && IsBeatNumberRestricted(LowerNum, Member, GuildSettings);

      if (!IsLowerRestricted && !IsLowerTaken) {
        Suggestions.push({
          name: FormattedLower,
          value: FormattedLower,
        });
        CurrentSuggestions++;
        GeneratedNums.add(LowerNum);
      }
    }

    Offset += StepSize;
  }

  return Suggestions.sort((a, b) => Number.parseInt(a.value, 10) - Number.parseInt(b.value, 10));
}
