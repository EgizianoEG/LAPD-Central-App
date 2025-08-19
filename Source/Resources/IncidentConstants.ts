// Incident Report Constants; Exported for use in other files.
// -----------------------------------------------------------

export const IncidentDescriptionLength = {
  Min: 20,
  Max: 850,
};

export const IncidentNotesLength = {
  Min: 8,
  Max: 228,
};

export enum IncidentStatuses {
  Active = "Active",
  Closed = "Closed",
  ColdCase = "Cold Case",
  ReferredToOtherAgency = "Referred to Other Agency",
}

export enum ActiveIncidentStatus {
  UnderInvestigation = "Under Investigation",
  SuspectAtLarge = "Suspect at Large",
  InProgress = "In Progress",
}

export enum ClosedIncidentStatus {
  ClearedByArrest = "Cleared by Arrest",
  ClearedByExceptionalMeans = "Cleared by Exceptional Means",
  Inactivated = "Inactivated",
  Unfounded = "Unfounded",
}

export const IncidentStatusesFlattened = [
  ...Object.values(IncidentStatuses).map((Status) => Status),
  ...Object.values(ActiveIncidentStatus).map((Status) => `${IncidentStatuses.Active}: ${Status}`),
  ...Object.values(ClosedIncidentStatus).map((Status) => `${IncidentStatuses.Closed}: ${Status}`),
] as const;

const StatusDescriptions: Record<string, string> = {
  [IncidentStatuses.Active]: "Incident is currently active.",
  [IncidentStatuses.Closed]: "Incident has been closed.",
  [IncidentStatuses.ColdCase]:
    "Major unsolved incident with no active leads; case remains reopenable.",

  [IncidentStatuses.ReferredToOtherAgency]:
    "Case has been transferred to another law enforcement agency for investigation.",

  [`${[IncidentStatuses.Active]}: ${ActiveIncidentStatus.InProgress}`]:
    "Incident is currently being worked on.",

  [`${[IncidentStatuses.Active]}: ${ActiveIncidentStatus.SuspectAtLarge}`]:
    "The suspect is still on the loose and being sought by authorities.",

  [`${[IncidentStatuses.Active]}: ${ActiveIncidentStatus.UnderInvestigation}`]:
    "The incident is being actively investigated by law enforcement.",

  [`${[IncidentStatuses.Closed]}: ${ClosedIncidentStatus.ClearedByArrest}`]:
    "The suspect has been arrested and charged with the crime.",

  [`${[IncidentStatuses.Closed]}: ${ClosedIncidentStatus.ClearedByExceptionalMeans}`]:
    "The case has been closed due to factors outside of law enforcement's control.",

  [`${[IncidentStatuses.Closed]}: ${ClosedIncidentStatus.Inactivated}`]:
    "Investigation suspended due to lack of leads; case remains reopenable.",

  [`${[IncidentStatuses.Closed]}: ${ClosedIncidentStatus.Unfounded}`]:
    "The incident was determined to be false or baseless.",
};

export const IncidentStatusesWithDescriptions = [
  ...Object.values(IncidentStatuses).map((Status) => ({
    status: Status,
    description: StatusDescriptions[Status],
  })),
  ...Object.values(ActiveIncidentStatus).map((Status) => ({
    status: `${IncidentStatuses.Active}: ${Status}`,
    description: StatusDescriptions[`${IncidentStatuses.Active}: ${Status}`],
  })),
  ...Object.values(ClosedIncidentStatus).map((Status) => ({
    status: `${IncidentStatuses.Closed}: ${Status}`,
    description: StatusDescriptions[`${IncidentStatuses.Closed}: ${Status}`],
  })),
].toSorted((a, b) => a.status.localeCompare(b.status));

export const IncidentCategories = {
  Traffic: ["Traffic Collision", "Pursuit", "Traffic Hazard", "DUI/DWI", "Vehicle Impound/Tow"],
  Fire: ["Residential Fire", "Commercial Fire", "Structure Fire", "Bush Fire"],

  Critical: ["Armed Subject", "Active Shooter", "Hostage Situation", "Barricaded Subject"],
  Medical: ["Medical Emergency"],

  Crime: [
    "Theft",
    "Robbery",
    "Assault",
    "Burglary",
    "Shooting",
    "Homicide",
    "Vandalism",
    "Kidnapping",
    "Gang Activity",
    "Drug Activity",
    "Warrant Service",
    "Grand Theft Auto",
    "Attempted Murder",
    "Attempted Robbery",
    "Firearm Discharge",
  ],

  Disturbance: [
    "Loitering",
    "Public Disturbance",
    "Domestic Disturbance",
    "Disorderly Conduct",
    "Noise Complaint",
    "Trespassing",
  ],

  GeneralService: [
    "Suspicious Activity",
    "Animal Complaint",
    "Illegal Dumping",
    "Citizen Assist",
    "Missing Person",
    "Welfare Check",
    "Alarm Drop",
    "Other",
  ],
} as const;

export const IncidentTypes = Object.values(IncidentCategories).flat();
export type IncidentTypesType = (typeof IncidentTypes)[number];
