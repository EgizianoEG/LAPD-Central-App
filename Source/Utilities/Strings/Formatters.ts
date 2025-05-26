/* eslint-disable sonarjs/cognitive-complexity */
import { IsValidDiscordId, IsValidRobloxUsername } from "@Utilities/Other/Validators.js";
import { AddStatutesRegexes, ATVCodesRegexes } from "@Resources/RegularExpressions.js";
import { format as FormatStr } from "node:util";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import { userMention } from "discord.js";
import { TitleCase } from "./Converters.js";
import { Vehicles } from "@Typings/Resources.js";
import ERLCAgeGroups from "@Resources/ERLCAgeGroups.js";
import DHumanizer from "humanize-duration";
import _Dedent from "dedent";

/**
 * Formats an input multiline string of charges into a properly formatted numbered list.
 * @param Input - The input string to format and formalize.
 * @param [Ordered=true] - Whether the list should be ordered and number listed or not; defaults to `true`.
 * @param [ReturnAsArray=true] - If the returned value should be as an array or a string; defaults to `true`.
 * @returns The list of charges either a string or an array depending on the value of `ReturnAsArray` parameter.
 */
export function ListCharges<ReturnType extends boolean = true>(
  Input: string,
  Ordered: boolean = true,
  ReturnAsArray?: ReturnType
): ReturnType extends true ? string[] : string {
  ReturnAsArray = (ReturnAsArray === undefined || ReturnAsArray === true) as any;
  const Charges: string[] =
    Input.trim()
      .replace(/[^\S\n\r]+/g, " ")
      .match(/([^\n\r]+)/g) ?? [];

  if (!Charges.length || (Charges.length === 1 && Charges[0].trim() === "")) {
    return (ReturnAsArray ? Charges : "") as any;
  }

  if (
    Charges.length === 1 &&
    Charges[0].trim().match(/, *(?! *and )|(?:, *|(?<!hit *))and[\b ]/i)
  ) {
    const Modified = Charges[0]
      .trim()
      .replace(/(, *(?! *and )|(?:, *|(?<!hit *))and[\b ])/gi, "\n")
      .match(/[^\n\r]+/g);
    Charges.pop();
    Charges.push(...(Modified as RegExpMatchArray));
  }

  const FormattedCharges = Charges.filter((Charge) => {
    return !Charge.match(/^\s*[-+=#*] Statute/i);
  })
    .map((Charge, Index) => {
      const Modified = Charge.trim().match(/^(?:\d{1,4}\W|\*|-|#\d{1,4}:?)?\s?(.+)$/)?.[1];
      return Ordered ? `${Index + 1}. ${Modified}` : Modified;
    })
    .filter((Charge): Charge is string => Charge !== undefined);

  return (ReturnAsArray ? FormattedCharges : FormattedCharges.join("\n")) as any;
}

/**
 * Analyses every charge in the input array and assigns it a specific California statute (law code) if possible.
 * The following template string is being used:
 * ```yaml
 * "[ChargeShortDescription]\n  - Statute: [StatuteCodeAndSubdivisionIfApplicable] [CodeGroup]"
 * ```
 *
 * So an example of an assigned law code for a charge would be as the following:
 * 1. Eluding a Peace Officer: Disregarding Safety
 *     - Statute: § 2800.2(A) VC
 *
 * @todo Instead of relying solely on regex patterns to assign a law code to a charge, use AI classification approach 😐.
 * @param Charges - The input array of charges (strings).
 * @returns An array of charges after adding statutes to them.
 * @example
 * const CapitalizedNumberedCharges = ["Evading a Peace Officer: Disregarding Safety", "2. Failure to Comply with a Peace Officer"];
 * console.log(AddStatutes(CapitalizedNumberedCharges));
 * // Output:
 * // ["1. Evading a Peace Officer: Disregarding Safety\n  - Statute: § 2800.2(A) VC",
 * //  "2. Failure to Comply with a Peace Officer\n  - Statute: § 69(A)/148(A) PC"]
 */
export function AddStatutes(this: any, Charges: Array<string>): Array<string> {
  if (
    Charges.length === 1 &&
    Charges[0].match(/, |\band\b/i) &&
    Charges[0].match(/hit\s+and\s+run/i) === null
  ) {
    return Charges;
  }

  for (let i = 0; i < Charges.length; i++) {
    const AddChargeStatute = FormatStr.bind(this, "%s\n  - Statute: § %s %s");
    const Charge = Charges[i];

    // Assault/Stabbing charge statute codes
    if (AddStatutesRegexes.Assault.test(Charge)) {
      if (AddStatutesRegexes.DWeaponRegex.test(Charge)) {
        if (Charge.match(/(?:Not|Other than) (?:a )?(?:Firearm|(?:Hand )?Gun|F\/ARM)/i)) {
          if (AddStatutesRegexes.LERegex.test(Charge)) {
            Charges[i] = AddChargeStatute(Charge, "245(C)", "PC");
          } else {
            Charges[i] = AddChargeStatute(Charge, "245(A)(1)", "PC");
          }
        } else if (AddStatutesRegexes.LERegex.test(Charge)) {
          Charges[i] = AddChargeStatute(Charge, "245(D)", "PC");
        } else {
          Charges[i] = AddChargeStatute(Charge, "245(B)", "PC");
        }
      } else if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "240/241(C)", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "240", "PC");
      }
      continue;
    }

    // Battery
    if (AddStatutesRegexes.Battery.test(Charge)) {
      if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "243(B)", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "242", "PC");
      }
      continue;
    }

    // Evasion and Fleeing
    if (AddStatutesRegexes.Evasion.test(Charge)) {
      let Continue = false;
      if (AddStatutesRegexes.RecklessDriving.test(Charge) || /Felony/i.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "2800.2(A)", "VC");
        Continue = true;
      } else {
        for (const RCharge of Charges) {
          if (AddStatutesRegexes.RecklessDriving.test(RCharge)) {
            Charges[i] = AddChargeStatute(Charge, "2800.2(A)", "VC");
            Continue = true;
            break;
          }
        }
      }
      if (!Continue) {
        Charges[i] = AddChargeStatute(Charge, "2800", "VC");
      }
      continue;
    }

    // Resisting a Peace Officer
    if (AddStatutesRegexes.Resisting.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "69(A)/148(A)", "PC");
      continue;
    }

    // Reckless Driving
    if (AddStatutesRegexes.RecklessDriving.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "23103", "VC");
      continue;
    }

    // Drawing a Firearm in Threatening Manner
    if (AddStatutesRegexes.BrandishingFirearm.test(Charge)) {
      if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "417(C)", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "417(A)(1)", "PC");
      }
      continue;
    }

    // Threatening Charge
    if (AddStatutesRegexes.Threatening.test(Charge)) {
      if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "71", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "422(A)", "PC");
      }
      continue;
    }

    // Accessory After the Fact; Unlawfully Helping a Criminal
    if (AddStatutesRegexes.AAF.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "32", "PC");
      continue;
    }

    // Arson; Setting a Building/Property on Fire With the Intent
    if (AddStatutesRegexes.Arson.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "451", "PC");
      continue;
    }

    // Bribery Charge
    if (AddStatutesRegexes.Bribery.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "67", "PC");
      continue;
    }

    // Any robbery charge
    if (AddStatutesRegexes.AnyRobbery.test(Charge)) {
      if (
        Charge.match(/Robberies/i) ||
        Charge.match(/Bank|\bATM\b/i) ||
        Charge.match(/x[2-9]\d?/i)
      ) {
        Charges[i] = AddChargeStatute(Charge, "487", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "211", "PC");
      }
      continue;
    }

    // Grand theft; Jewelry Store, Bank, and ATM Robberies
    if (AddStatutesRegexes.GrandTheft.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "487", "PC");
      continue;
    }

    // Driving Without a Valid License
    if (AddStatutesRegexes.InvalidLicense.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "12500", "VC");
      continue;
    }

    // Possession of Burglary Tools
    if (AddStatutesRegexes.PBTools.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "466", "PC");
      continue;
    }

    // House/Residential Burglary Charge
    if (AddStatutesRegexes.Burglary.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "459/460(A)", "PC");
      continue;
    }

    // Illegal Possession of Weapon(s)
    if (AddStatutesRegexes.PIFirearms.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "12020", "PC");
      continue;
    }

    // Attempt Murder Charges
    if (AddStatutesRegexes.AttemptMurder.test(Charge)) {
      if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "664(E)/187(A)", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "664/187(A)", "PC");
      }
      continue;
    }

    // Shooting on Vehicles/Buildings
    if (AddStatutesRegexes.ShootingVB.test(Charge)) {
      if (Charge.match(/Occupied|Inhabited/i) || AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "246", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "247(B)", "PC");
      }
      continue;
    }

    // Murder Charge
    if (AddStatutesRegexes.Murder.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "187(A)", "PC");
      continue;
    }

    // Kidnapping Charge
    if (AddStatutesRegexes.Kidnapping.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "209", "PC");
      continue;
    }

    // False Imprisonment
    if (AddStatutesRegexes.FImprisonment.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "210.5", "PC");
      continue;
    }

    // Impersonation of someone
    if (AddStatutesRegexes.Impersonation.test(Charge)) {
      if (AddStatutesRegexes.LERegex.test(Charge)) {
        Charges[i] = AddChargeStatute(Charge, "538(D)", "PC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "529(A)", "PC");
      }
      continue;
    }

    // Controlled Substances
    if (AddStatutesRegexes.CSubstances.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "11350(A)", "HS");
      continue;
    }

    // Hit and Run Charge
    if (AddStatutesRegexes.HitAndRun.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "20001/20002", "VC");
      continue;
    }

    // Tamper With Vehicles With Intent
    if (AddStatutesRegexes.Tampering.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "10852", "VC");
      continue;
    }

    // Vandalism; Damaging Public/Others' Properties
    if (AddStatutesRegexes.Vandalism.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "594", "PC");
      continue;
    }

    // Giving False Information to a Peace Officer
    if (
      AddStatutesRegexes.FInformation_NTC.test(Charge) ||
      AddStatutesRegexes.FInformation_TC.test(Charge)
    ) {
      if (
        Charge.match(/Pulled Over|Traffic Stop/i) &&
        AddStatutesRegexes.FInformation_TC.test(Charge)
      ) {
        Charges[i] = AddChargeStatute(Charge, "31", "VC");
      } else {
        Charges[i] = AddChargeStatute(Charge, "148.9", "PC");
      }
      continue;
    }

    // Trespassing in a Private Property or at an Illegal Location
    if (AddStatutesRegexes.Trespassing.test(Charge)) {
      Charges[i] = AddChargeStatute(Charge, "602", "PC");
      continue;
    }

    // Carrying a Firearm in Public Without a CCW (California Concealed Carry) Permit
    if (AddStatutesRegexes.FirearmInPublic.test(Charge)) {
      if (Charge.match(/Conceal(?:ed|ing)?|Hidden|Covered|Invisible/i)) {
        if (Charge.match(/Loaded/i)) {
          Charges[i] = AddChargeStatute(Charge, "25850(A)", "PC");
        } else {
          Charges[i] = AddChargeStatute(Charge, "25400(A)", "PC");
        }
      } else {
        Charges[i] = AddChargeStatute(Charge, "25850(A)", "PC");
      }
    }
  }

  return Charges;
}

/**
 * Formats a user input of traffic violations text for a traffic citation to be made.
 * @param Input - The input text to format and formalize.
 * @returns An array of formatted traffic violations.
 */
export function AddTrafficViolationCodes(
  this: any,
  Violations: string[]
): (GuildCitations.Violation | string)[] {
  const ModifiedViolations: (GuildCitations.Violation | string)[] = [];
  const AddVehCode = FormatStr.bind(this, "%s CVC - %s");

  for (let i = 0; i < Violations.length; i++) {
    const Violation = Violations[i];

    // Speeding or going over the speed limit.
    if (ATVCodesRegexes.Speeding.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("2235[012]", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // Minimum speed laws.
    if (ATVCodesRegexes.MSLViolation.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("22400", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // Running a red signal (red light).
    if (ATVCodesRegexes.FTSARedSignal.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("21453", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // Not using a turn signal.
    if (ATVCodesRegexes.NoTurningSignal.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("22108", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.NoHazardSignals.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("22109", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.NoHeadlights.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("24250", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.SidewalkDriving.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("21663", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.UnsafePassing.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("21750-21759", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.SpeedContest.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("23109", Violation), type: "M" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.UnsafeLaneChange.test(Violation)) {
      ModifiedViolations[i] = { violation: AddVehCode("22107", Violation), type: "I" };
      continue;
    }

    // ...
    if (ATVCodesRegexes.IllegalParking.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("22500", Violation),
        correctable: true,
        type: "I",
      };
      continue;
    }

    // Failure to Yield - At a stop sign or yield sign.
    if (ATVCodesRegexes.FTSAStopSign.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("22450(a)", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.Tailgating.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("21703", Violation),
        correctable: true,
        type: "I",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.DefectiveEquipment.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("24002", Violation),
        correctable: true,
        type: "I",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.Jaywalking.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("21955", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // Unlicensed driver or no driver's license present.
    if (ATVCodesRegexes.UnlicensedDriver.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("12500(a)", Violation),
        correctable: false,
        type: "I",
      };
      continue;
    }

    // Failing to Present or Display or Give a Driving License to a Peace Officer.
    if (ATVCodesRegexes.FTPDrivingLicense.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("12951(b)", Violation),
        correctable: true,
        type: "M",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.SuspendedDL.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("14601.1(a)", Violation),
        correctable: false,
        type: "M",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.NoRegistration.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("4000(a)", Violation),
        correctable: true,
        type: "I",
      };
      continue;
    }

    // ...
    if (ATVCodesRegexes.DUI.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("23152(a)", Violation),
        correctable: false,
        type: "M",
      };
      continue;
    }

    // Misdemeanor reckless driving.
    if (AddStatutesRegexes.RecklessDriving.test(Violation)) {
      ModifiedViolations[i] = {
        violation: AddVehCode("23103", Violation),
        correctable: false,
        type: "M",
      };
      continue;
    }

    ModifiedViolations[i] = Violation;
  }

  return ModifiedViolations;
}

/**
 * Formats a user input of charges text for an arrest report.
 * @param Input - The input charges text to format and formalize.
 * @returns A formatted and number listed charges with its penal codes.
 */
export function FormatCharges(Input: string): string[] {
  const Titled = TitleCase(Input, true);
  const Listed = ListCharges(Titled, true, true);
  return AddStatutes(Listed);
}

/**
 * Takes an input string, formats it to title case, lists the violations, and adds traffic violation codes.
 * @param {string} Input - A string that represents a text of violations.
 * @returns
 */
export function FormatCitViolations(Input: string) {
  const TitleCased = TitleCase(Input, true);
  const ListedViolations = ListCharges(TitleCased, false, true);
  return AddTrafficViolationCodes(ListedViolations);
}

/**
 * Properly formats an input height if it is incomplete or mistyped.
 * @param Input - The input height string.
 * @returns If succeeded, a height in the format `x'y"`; should be a maximum of `7'11"` (automatically enforced). If failed, the original input.
 * @example
 * FormatHeight("7")  // returns the string 7'0"
 * FormatHeight("6 ft 1 in")  // returns the string 6'1"
 * FormatHeight("5 feet 11 inches")  // returns the string 5'11"
 */
export function FormatHeight(Input: string): string {
  const Sanitized = Input.trim().replace(/\s+/g, " ");
  if (Sanitized.match(/^[1-9]+'(?:\d|1[01]?)"$/)) {
    return Sanitized.match(/^(?:[8-9]|[1-9]\d+)/) ? "7'11\"" : Sanitized;
  }

  if (Sanitized.match(/^\d+$/)) {
    return `${Sanitized}'0"`;
  } else if (Sanitized.match(/^\d'$/)) {
    return `${Sanitized}0"`;
  } else if (Sanitized.match(/^\d'\d+$/)) {
    return `${Sanitized}"`;
  } else if (Sanitized.match(/^\d\D+\d+\D*$/)) {
    const Matches = Sanitized.match(/^(\d)\D+(\d+)\D*$/);
    const Feet = Matches![1];
    const Inches = Matches![2];
    return `${Feet}'${Inches}"`;
  }

  return Input;
}

/**
 * Parses a given age integer into a string representation.
 * @param AgeInteger - The age integer as a number or string; `1`, `2`, `3`, `4` or `5`.
 * @returns - The age category string if the input is within the enum range; `"[Unknown]"` otherwise.
 * @enum
 *  - [1]: Kid (<13);
 *  - [2]: Teen (13-19);
 *  - [3]: Young Adult (20-29);
 *  - [4]: Mid Adult (30-49);
 *  - [5]: Senior (50+);
 */
export function FormatAge(AgeInteger: number | string): string {
  AgeInteger = +AgeInteger;
  return ERLCAgeGroups.find((AG) => AG.value === AgeInteger)?.name || "[Unknown]";
}

/**
 * Converts a given multiline string or an array of strings into a formatted unordered list where each line is prefixed with a hyphen.
 * @param {string | string[]} Input
 * @returns
 */
export function UnorderedList(Input: string | string[]): string {
  if (!Input.length) return Input.toString();
  const Lines = Array.isArray(Input) ? Input : Input.split(/\r?\n/);
  return Lines.map((Line) => (Line ? `- ${Line}` : "")).join("\n");
}

/**
 * Returns a formatted string representation of the user's username, display name as well as the id if requested.
 * @param UserData - The basic user data; display name if available, username, and id if also available.
 * @param [IncludeId=false] - Whether to include the user's id in the string (e.g. `"... [000000]"`).
 * @param [UsernameLinked=false] - Whether to mask link with markdown the username
 * (e.g. `Builderman ([@builderman](https://www.roblox.com/users/156/profile))`).
 * Notice that this parameter can only work if the user data received has the user Id, too.
 *
 * @returns
 * @example
 * const UserData = {
 *   name: "builderman_fifty",
 *   display_name: "Builderman",
 *   id: 5010050100,
 * }
 *
 * // returns "Builderman (@builderman_fifty)"
 * FormatUsername(UserData);
 *
 * // returns "Builderman (@builderman_fifty) [5010050100]"
 * FormatUsername(UserData, true);
 */
export function FormatUsername(
  UserData: { name: string; display_name?: string; displayName?: string; id?: string | number },
  IncludeId?: boolean,
  UsernameLinked: boolean = false
): string {
  if (UserData.name) {
    const Formatted = `${UserData.display_name ?? UserData.displayName ?? UserData.name} (${
      UsernameLinked && UserData.id
        ? `[@${UserData.name}](https://www.roblox.com/users/${UserData.id}/profile)`
        : `@${UserData.name}`
    })`;

    if (IncludeId && UserData.id) {
      return `${Formatted} [${UserData.id}]`;
    } else {
      return Formatted;
    }
  }
  return "[Invalid]";
}

/**
 * Returns a formatted name for a given vehicle model and its brand details.
 * Vehicle model name string should be always defined and not empty for a proper result.
 * @param Model - The vehicle model data.
 * @param Brand - The brand of the vehicle model including its counterpart (ER:LC alias).
 * @returns A vehicle name in the format:
 * `[OriginalModelYear] [BrandName] [ModelName] ([AltModelYear] [BrandAlias] [ModelAlias])`.
 * @example
 * const Model = {
     name: "A-100",
     alias: "F-150",
     model_year: { org: "2022", alt: "2021" },
   };

   const Brand = {
     name: "Brand-X",
     alias: "BX",
   };

   // returns "2022 Brand-X A-100 (2021 BX F-150)"
   FormatVehicleName(Model, Brand);
 */
export function FormatVehicleName(
  Model: Omit<Vehicles.VehicleModel, "category" | "class" | "style">,
  Brand: { name: string; alias: string }
): string {
  const OrgMYear = Model.model_year.org ? `${Model.model_year.org} ` : "";
  const AltMYear = Model.model_year.alt ? `${Model.model_year.alt} ` : "";
  const BrandName = Brand.name ? `${Brand.name} ` : "";
  const BrandAlias = Brand.alias ? `${Brand.alias} ` : "";
  const Formatted = FormatStr(
    "%s%s%s (%s%s%s)",
    OrgMYear,
    BrandName,
    Model.name,
    AltMYear,
    BrandAlias,
    Model.alias
  );

  return /^[\s()]+$/.test(Formatted) ? "" : Formatted;
}

/**
 * Formats and sorts an array of names based on their type and optionally mentions Discord users.
 *
 * The function first sorts the input names such that valid Discord IDs appear before other names.
 * It then maps each name to its formatted representation:
 * - If the name is a valid Discord ID, it is either mentioned (if `MentionDisUsers` is true) or returned as is.
 * - If the name is a valid Roblox username, it is prefixed with "@".
 * - Otherwise, the name is returned as is.
 *
 * @param Names - An array of names to be formatted and sorted.
 * @param MentionDisUsers - A boolean indicating whether to mention Discord users. Defaults to `false`.
 * @param AddRUsernamePrefix - A boolean indicating whether to prefix Roblox usernames with "@". Defaults to `true`.
 * @returns A new array of formatted and sorted names.
 */
export function FormatSortRDInputNames(
  Names: string[],
  MentionDisUsers: boolean = false,
  AddRUsernamePrefix: boolean = true
): string[] {
  const GetNameType = (Name: string | undefined) => {
    if (Name && IsValidDiscordId(Name)) return 0;
    else return 1;
  };

  return Names.toSorted((a, b) => {
    return GetNameType(a) - GetNameType(b);
  }).map((Name) => {
    if (IsValidDiscordId(Name)) return MentionDisUsers ? userMention(Name) : Name;
    else if (IsValidRobloxUsername(Name)) return AddRUsernamePrefix ? `@${Name}` : Name;
    else return Name;
  });
}

/**
 * Removes excess unwanted indentation and extra spaces from a given string potentially caused by escaping newlines in a multiline string.
 *
 * This function processes the input string to dedent it and then performs
 * additional cleanup by replacing:
 * - Periods followed by two or more spaces with a single space after the period.
 * - Words separated by two or more spaces with a single space.
 *
 * @param text - The input string to be dedented and cleaned.
 * @returns The processed string with reduced indentation and extra spaces removed.
 */
export function Dedent(text: string): string {
  return _Dedent(text)
    .replace(/\.[^\S\r\n]{2,}([`'"</>\w])/g, ". $1")
    .replace(/([`'"</>\w])[^\S\r\n]{2,}([`'"</>\w])/g, "$1 $2");
}

/**
 * Escapes special characters in a string so that it can be used in a regular expression.
 * @see {@link https://stackoverflow.com/q/3561493 Stack Overflow Reference}
 * @param Str - The string to escape.
 * @returns
 * @example
 * console.log(escapeRegExp("Hello [World]!"));  // Output: Hello \[World\]\!
 * console.log(escapeRegExp("123.456"));  // Output: 123\.456
 */
export function EscapeRegExp(Str: string): string {
  return Str.replace(/[-[\]{}()*+!<=:?./\\^$|]/g, "\\$&");
}

/**
 * Formats a given duration in milliseconds into a human-readable string.
 * @param Duration - The duration in milliseconds to format.
 * @param [Options] - Optional configuration for the formatter. Defaults to `{ largest: 4, round: true, conjunction: " and ", language: "en" }`.
 * @returns A human-readable string representing the duration.
 */
export const ReadableDuration = DHumanizer.humanizer({
  conjunction: " and ",
  language: "en",
  largest: 4,
  round: true,
});

/**
 * An instance of `Intl.ListFormat` for formatting lists of strings in a locale-sensitive manner.
 * @uses 'en-US' locale.
 * @param List - The list of strings to format.
 */
export const ListFormatter = new Intl.ListFormat("en-US");
