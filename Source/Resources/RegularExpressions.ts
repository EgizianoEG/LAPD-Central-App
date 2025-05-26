/**
 * Creates a regular expression pattern that matches any of the given strings.
 * @param {(string | RegExp)[]} Args - A rest parameter of type string[]. It allows the function to accept any number of string arguments.
 * @returns A combined regular expression object.
 */
const ORRegExp = (...Args: (string | RegExp)[]): RegExp => {
  return new RegExp(Args.map((Arg) => (Arg instanceof RegExp ? Arg.source : Arg)).join("|"), "i");
};

const DLRegexStr = /(?:Driv(?:ing|er|er[’']s) License|License|DL)/i.source;
const UnsafeSynonyms = /(?:Unsafe|Not? Safe|Dangerous|Reckless|Risky)/i.source;
const FActionRegex = /(?:Not Using|Fail(?:ing|ure|ed) (?:to )Use|Did(?: not|n['’]?t Use))/i.source;

/**
 * A regular expression used to match and split a list of items.
 * It can handle various delimiters such as commas, ampersands, and the word "and".
 * @remarks This regex is case-insensitive.
 * @example
 * const list = "Item 1, Item 2 and Item 3";
 * const items = list.split(ListSplitRegex);
 * console.log(items); // ["Item 1", "Item 2", "Item 3"]
 */
export const ListSplitRegex = /\s*[,&]\s*(?:and\s|&)?\s*|\s+/i;

/**
 * A regular expression used to parse and extract information from duty leaderboard entries.
 *
 * This regex supports two formats:
 * 1. A detailed format that includes username, user ID, shift count, duty time in milliseconds,
 *    and human-readable time.
 * 2. A simpler format that includes only username and human-readable time.
 *
 * Capturing groups:
 * - `username`: The username of the individual (alphanumeric, underscores, dots, and spaces allowed).
 * - `user_id`: The unique identifier of the user (15 to 22 digits).
 * - `shift_count`: The number of shifts completed by the user (numeric).
 * - `duty_ms`: The total duty time in milliseconds (numeric).
 * - `hr_time`: The human-readable representation of the duty time (e.g., "2 hours, 30 minutes").
 *
 * Notes:
 * - The regex is case-insensitive.
 * - The first format includes all details, while the second format is more concise.
 */
export const DutyLeaderboardEntryRegex =
  // eslint-disable-next-line sonarjs/regex-complexity
  /^(?:\d+)?\.?\s*-?\s*@?(?<username>[\w.\s]+?)\s*-\s*(?<user_id>\d{15,22})\s*-\s*(?<shift_count>\d+)\s+shifts\s*-\s*(?<duty_ms>\d+)ms\s*-\s*(?<hr_time>[\w,\s]+?)$|^@?(?<username>[\w.\s]+?)\s*[-•]\s*(?<hr_time>[\w,\s]+?)$/i;

/**
 * Regular expression to match a line containing an incident report number.
 * Captures the number itself.
 */
export const IncidentReportNumberLineRegex =
  /\bInc(?:ident|\.)\s(?:Num|Number|#)\*{0,3}:?\*{0,3}\s(?:\[?`)?(?:INC-)?(\d{1,2}-\d{5,6})(?:`\]?)?\b/i;

export const UserActivityNoticeMgmtCustomIdRegex = /^(?:loa|ra)-(?:ext-)?(?:app|den|inf)[\w-]*:/;
export const DutyManagementBtnCustomIdRegex = /^dm-(?:start|end|break):\d{15,22}:[\w\-. ]{3,20}/;

export const LEORegex = /(?:Officer|Peace Officer|\bPolice\b|\bLEO\b|\bPO\b)s?/;
export const AddStatutesRegexes = {
  Battery: /Batt[ea]ry/i,
  Bribery: /Brib[eau]ry|Brib(?:e|ing)/i,
  Assault: /A[su]{1,3}[alut]{2,4}|Stab(?:bing|bed)|\bADW(?:\b|[-+:#])/i,
  LERegex: /Officers?|Peace Officers?|\bPolice\b|\bLEO\b|\bPO\b/i,
  HitAndRun: /Hit(?: and | ?& ?)Run/i,
  AnyRobbery: /(?:\w+) Robber(?:y|ies)|Robb(?:ing|ery) (?:of|of an?|an?) \w+/i,
  // CRRobbery: /Cash Register Robber(?:y|ies)/i,
  Tampering: /(?:Damag(?:e|ing)|Tamper(?:ing)) (?:a |an |with )?(?:Car|Vehicle)s?/i,
  Vandalism: /Graffiti|Sabotage|Vandalism|Vandali[zs](?:ing|ed?|es) \w+|Defac(?:e|ing) \w+/i,
  Threatening: /Threat[ei]n(?:ing)?|Threats (?:to|my|for|about) \\w+/i,
  DWeaponRegex: /Deadly|Weapon|Firearm|(?:Hand )?Gun|Pistol|Rifle|Bat|Knife|Hammer/i,
  Impersonation: /Impersonating|False Personation/i,

  Kidnapping: ORRegExp("\\bKidnapp?(ing)?\\b", "Abduct(?:ion|ing)"),
  Burglary: ORRegExp("Burglary", "Breaking into (?:a |an )?(?:House|Residential)"),
  Murder: ORRegExp("\\bMurd[eua]r(?:ing)?\\b", "Homicide", "Killing .+"),

  Evasion: ORRegExp(
    "(?:Evasion|Evading|Fleeing)",
    "Vehicle (?:Fleeing|Eluding|Evasion)",
    "Fail(?:ing|ure|ed)? to (?:Stop|Pull|Pullover)",
    "(?:Running from|Elud(?:e|ing)|Evade) (?:an |a )?"
  ),

  Resisting: ORRegExp(
    "Refus(?:ing|ed|e) \\w+ Orders",
    "Resist(?:ing|ed)? (?:an |a )?Arrest",
    "Obstruct(?:ing|ion)(?: of)? Justice",
    "Fail(?:ing|ure|ed)? to (?:Comply|Follow)",
    `Not (?:Listening|Complying) (?:to|with) (?:an |a )?${LEORegex.source}`,
    `(?:Resist(?:ing)?|Defy(?:ing)?|Obstruct(?:ing|ion)?|Interfer(?:e|ing)? with) (?:an |a |of \\w{1,2}? ?|)?(?:${LEORegex.source}|Investigation)`
  ),

  AAF: ORRegExp(
    "(?:Helping|Helping out|Assisting) (?:a |an )?(?:Criminal|Offender|Lawbreaker)",
    "(?:Accessory|Involved|Conspiracy) (?:after|to|in|with) (?:the |a |an )?(?:Fact|Murder|Homicide|Crime|Robbery|Hostage|Assault)"
  ),

  InvalidLicense: ORRegExp(
    "(?:Expired|Suspended|Invalid) (?:Driving )?License",
    "Driving (?:W/o|Without) (?:a )?(?:Driving )?License",
    "(?:Unlawful|Illegal) to Drive (?:W/o|Without) (?:a )?(?:Driving |Valid (?:Driving )?)?License"
  ),

  RecklessDriving: ORRegExp(
    "Speeding",
    "Traffic Crimes",
    "Crashing into \\w+",
    "Endangerment of \\w+",
    "Driving Reckless(?:ly)?",
    "Dangerous(?:ly)? Driving",
    "Reckless(?:ly)? (?:Driving|Endangerment)",
    "(?:Public|Citizen|Resident) End[arng]+erment",
    "R[au]n(?:ning)? (?:Multiple )?(?:Red)? Lights",
    "(?:Disregard|Disregarding|Ignor(?:ed?|ing)?|No|W/o|Without) Safety"
  ),

  BrandishingFirearm: ORRegExp(
    "(?:Brandish(?:ing|e?s)?|Point(?:ing|s)?|Draw(?:ing|s)?) (?:of )?(?:a |an )?(?:Gun|Firearm|Weapon|Pistol|Rifle)",
    "(?:Brandish(?:ing|e?s)?|Point(?:ing|s)?|Draw(?:ing|s)?) (?:or |of )?(?:Exhibit(?:s|ing) )?(?:a |an )?(?:\\w+ )?(?:Gun|Firearm|Weapon|Pistol|Rifle)"
  ),

  Arson: ORRegExp(
    "Ars[oe]n",
    "Incendiarism",
    "Raising Fire",
    "Burn(?:ing|ed) \\w+",
    "Fire(?:-| )(?:setting|raising)"
  ),

  GrandTheft: ORRegExp(
    "Grand Theft",
    "(?:Jewelry|Bank|Jewelery|jew[elar]ry|House|Residential|\\bATM\\b) (?:Store )?Robber(?:y|ies)",
    "Robb(?:ing|ery) (?:of )?(?:a |an |the )?(?:)(?:Jewelry|Bank|Jewelery|jew[elar]ry|House|Residential|\\bATM\\b)"
  ),

  PBTools: ORRegExp(
    "(?:Possess(?:es|ion|ing)?|Carry(?:es|ing)?) (?:of )?Burglary (?:Tools?|Instruments?)"
  ),

  PIFirearms: ORRegExp(
    "(?:Unlawful |Illegal |Prohibited )?(?:Possess(?:es|ion|ing)?|Carr(?:y|ies|ying)) (?:of )?(?:a |an )?(?:Unlawful|Illegal|Prohibited) (?:Weapon|Gun|Firearm)s?"
  ),

  ShootingVB: ORRegExp(
    "Pop(?:ping)? (?:Vehicle(?:s.|s)? |Car(?:s.|s)? )?T[iy]res?",
    "Discharg(?:e|ing) of (?:a|an)?(?:Firearm|Gun|Weapon)",
    "Discharg(?:e|ing) (?:a )?(?:Firearm|Gun|Weapon) (?:at|on) (?:a |an )?(?:inhabited |Uninhabited |Unoccupied |Occupied )?(?:Vehicle?|Car?|Building?|Bank|Store?|Dwelling)s?",
    "(?:Shoot(?:ing)?|Fir(?:ing|e)) (?:on |at )?(?:a |an )?(?:Inhabited |Uninhabited |Unoccupied |Occupied )?(?:Police |PO(?:s.|s)? |LEO(?:.?s.|s)? |Officer(?:s.|s)? )?(?:Vehicle?|Car?|Building?|Bank|Store?|Dwelling)s?"
  ),

  AttemptMurder: ORRegExp(
    `(?:Trying|Attempt(?:ed|ing)?) (?:${LEORegex.source})?(?:to )?(?:Kill|Murder|Homicide)`,
    "(?:Shoot(?:ing)?|Fir(?:ing|e)|Discharg(?:e|ing)) (?:at |on )?(?:a |an )?(?:Officer|Peace Officer|Police|Civilian|\\bLEO\\b|\\bPO\\b)s?"
  ),

  FImprisonment: ORRegExp(
    "Hostage",
    "Restraint of Liberty",
    "(?:False|Unlawful) (?:Imprisonment|Confinement)",
    "(?:Forcing|Coercing) (?:Someone|Somebody|Civilian) (?:to Stay|to Remain)",
    "(?:Taking|Having) (?:a )?(?:Human(?:being)?|Person|Civilian|Officer|Police Officer|\\bPO\\b|\\bLEO\\b) (?:as |as a )?(?:Human )?(?:Shield|Hostage)"
  ),

  CSubstances: ORRegExp(
    "(?:Drug|Controlled Substance)s? (?:Possess(?:ion|ing)?|Carry(?:ing)?)",
    "(?:Possess(?:es|ion|ing)?|Carry(?:es|ing)?) (?:of |of a )?(?:Controlled Substance|Drug)s?"
  ),

  FInformation_TC: ORRegExp(
    "(?:Giv(?:e|es|ing) |Show(?:s|ing)? )?(?:a )?( ?:False|Incorrect|Invalid) (?:(?:Driving )?License|(?:Car |Vehicle )?Registration|(?:Car |Vehicle )?Insurance)" +
      " to (?:a |an )?" +
      LEORegex.source
  ),

  FInformation_NTC: ORRegExp(
    "(?:Giv(?:e|es|ing) |Show(?:s|ing)? )?(?:a )?(?:False|Incorrect|Invalid) (?:\\bID\\b|Identification)",
    " to (?:a |an )?" + LEORegex.source
  ),

  Trespassing: ORRegExp(
    "Trespass(?:ing|ed?)?",
    "(?:Unauthorized Entry|Illegal Entry)",
    "Refus(?:ing|ed?) to Leave (?:a |an |the )?(?:\\w+ )?(?:Property|Building|Store|Shop)"
  ),

  FirearmInPublic: ORRegExp(
    "(Conceal(?:ed|ing)?|Loaded) (?:Firearm|Weapon|Gun|Pistol|Rifle)",
    "(?:Possess(?:es|ion|ing)?|Carry(?:es|ing)?) (?:a |of |of a )?(?:Concealed |Loaded )?(?:Firearm|Weapon|Gun|Pistol|Rifle)"
  ),
};

export const ATVCodesRegexes = {
  DUI: /Driving Under (?:the )?Influ[eai]nce|\bDUI\b|Dr[uai]nk Driving|Driving (?:While )?Dr[uai]nk/i,
  Jaywalking: /Jaywalking|(?:Unlawful|Illegal) Cross/i,
  Tailgating: /Tailgating|Following Too Closely|Unsafe Following/i,
  MSLViolation: /(?:Impeding|Clogging|Obstructing|Blocking|Slowing(?: Down)?) (?:\w+ )Traffic/i,
  SpeedContest: /Speed(?:ing)? Conte[xs]t|(?:Car|Vehicle|Street|Drag|Illegal|Unlawful) Racing/i,

  SidewalkDriving:
    /(?:Dr[io]v(?:ed?|ing)|Operat(?:ed?|ing)) On (?:\w+ )?(?:Side?walk|Pavement|Footway)/i,
  NoHazardSignals:
    /(?:Not Using|Fail(?:ing|ure|ed) (?:to )Use|Did(?: not|n['’]?t Use)) Hazard (?:Signal|Amber|Light)s?\b|Stop(?:ped|ping)? Sudd[eu]nly/i,
  NoTurningSignal:
    /(?:Not Using|Fail(?:ing|ure|ed) (?:to )Use|Did(?: not|n['’]?t Use)) Turn(?:ing)? (?:Signal|Amber|Light)s?\b|Not Signaling\b/i,
  Speeding:
    /Spee*ding|(?:Unsafe|Dangerous|Reckless|Excessive) Spee*d|Going Over (?:the )?(?:Speed|Limit)/i,
  NoRegistration:
    /Driving (?:Without|W\/o) (?:\w+ )?Registration|(?:Not Valid|Invalid|No|Not Having) Registration|Unregistered (?:Car|Vehicle|Truck|Sedan)/i,

  IllegalParking: ORRegExp(
    /\bpark(?:ing|ed)?\s*(?:illegally|unlawfully|improperly|wrongly|unauthorizedly|prohibitedly|restrictedly|illegal|unlawful|improper|wrong|unauthorized|restricted)\b/,
    /\bpark(?:ing|ed)?\s*(?:in\s+(?:the\s+)?)?(?:middle\s+of(?:\s+(?:the|a))?\s*)?(?:unlawful|illegal|improper)?(?:ly)?\s*road(?:way)?\b/,
    /\b(?:unlawful|illegal|improper|prohibited|wrong|unauthorized|restricted)(?:ly)?\s*park(?:ing|ed)?\b/,
    /\b(?:road|roadway)\s+(?:obstruction|blockage|blockage|congestion|misuse)\b/,
    /\b(?:blocking|obstructing)\s+(?:the\s+)?road(?:way)?\b/,
    /\bobstruction\s+(?:of\s+)?(?:the\s+)?road(?:way)?\b/
  ),

  UnsafeLaneChange: ORRegExp(`${UnsafeSynonyms} Lane Change`),
  UnsafePassing: ORRegExp(`${UnsafeSynonyms} (?:\\w+ )?(?:Pass|Overtak)(?:ed?|ing)?`),
  DefectiveEquipment: ORRegExp(
    "Unsafe (?:Vehicle|Car)",
    "(?:Popped|Blown|Bad|Defective|Damaged) (?:\\w+ )?(?:Wheel|Tyre|Tire)",
    "(?:Unlawfully|Unlawful|Illegal|Illegally|Broken) Equipped (?:Vehicle|Car)",
    "(?:Broken|Faulty|Bad|Defective|Damaged|Broken) (?:\\w+ )?(?:Vehicle|Car|Equipment|Light|Tail ?light|Headlight|Brake|Break|Steering)"
  ),

  SuspendedDL: ORRegExp(
    `(?:Suspended|Revoked) ${DLRegexStr}`,
    `${DLRegexStr} (?:Suspended|Revoked)`
  ),

  FTSAStopSign: ORRegExp(
    "(?:Fail(?:ed|ing|ure)|Did(?: not|n['’]?t)|Ignor(?:e|ed|ing)) (?:to )?Stop(?:ing|ped)? at (?:a |an )?Stop \\w+",
    "(?:Running|Ran|Skipped|Ignor(?:e|ed|ing)|Skipping|Not Stopping) (?:\\w* )?(?:a |an )?Stop \\w+",
    "Stop (?:Sign|Signal) Violation"
  ),

  FTSARedSignal: ORRegExp(
    "(?:Fail(?:ed|ing|ure)|Ignor(?:e|ed|ing)|Did(?:not|n['’]?t)) (?:to )?Stop(?:ing|ped)? at (?:a |an )?Red \\w+",
    "(?:Running|Ran|Skipped|Ignor(?:e|ed|ing)|Skipping|Not Stopping) (?:\\w* )?(?:a |an )?Red \\w+",
    "Red (?:Light|Signal) Violation"
  ),

  NoHeadlights: ORRegExp(
    "Dr[io]v(?:e|ing) (?:Without|W[/\\\\]o|With No) (?:Light|Headlight)s?",
    "(?:Head)lights Not (?:Being )?Used",
    `${FActionRegex} (?:Head)?lights`
  ),

  UnlicensedDriver: ORRegExp(
    "Unlicensed Driver",
    `(?:In|Not? )valid ${DLRegexStr}`,
    `Not having (?:a |an )?${DLRegexStr}`,
    `(?:No|No[tn][ -]Present) ${DLRegexStr}`,
    `Fail(?:ed|ing|ure) (?:To )?Renew\\w* ${DLRegexStr}`,
    `Driving (?:\\w+ )?(?:Without|W/o|W\\o) (?:Possessing)?(?:a |an )?${DLRegexStr}`
  ),

  FTPDrivingLicense: ORRegExp(
    `(?:Refus|Fail)(?:ed|ing|ure|e|al)? (?:To )?(?:Present|Show|Display|Give) ${DLRegexStr}`
  ),
};
