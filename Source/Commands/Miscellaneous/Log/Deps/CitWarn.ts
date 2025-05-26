// Dependencies:
// -------------
import {
  SlashCommandBooleanOption,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  NTATypes,
  RoadSurfaces,
  TrafficConditions,
  TravelDirections,
  WeatherConditions,
} from "@Models/Citation.js";

import ERLCAgeGroups from "@Resources/ERLCAgeGroups.js";
import AnyCitationCallback from "./Funcs/AnyCitationHandler.js";
import { EyeColors, HairColors } from "@Resources/ERLCPDColors.js";
import { ReporterInfo } from "../Log.js";

const CmdFileLabel = "Commands:Miscellaneous:Log:CitWarn";
const EyeColorChoices = EyeColors.map((Color) => {
  return { name: `${Color.name} (${Color.abbreviation})`, value: Color.abbreviation };
});

const HairColorChoices = HairColors.map((Color) => {
  return { name: `${Color.name} (${Color.abbreviation})`, value: Color.abbreviation };
});

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function CitWrnCmdCallback(
  Interaction: SlashCommandInteraction<"cached">,
  CitingOfficer: ReporterInfo
) {
  return AnyCitationCallback(Interaction, CitingOfficer, CmdFileLabel);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
// Shared command options for both fine and citation warning command. Avoids code duplication.
export const SharedCmdOptions = [
  new SlashCommandStringOption()
    .setName("name")
    .setDescription("The username of the violator.")
    .setRequired(true)
    .setMaxLength(3)
    .setMaxLength(20)
    .setAutocomplete(true),
  new SlashCommandStringOption()
    .setName("gender")
    .setDescription("The gender of the violator; either male or female.")
    .setRequired(true)
    .setChoices({ name: "Male", value: "Male" }, { name: "Female", value: "Female" }),
  new SlashCommandIntegerOption()
    .setName("age")
    .setDescription("The violator's age group as stated in the license.")
    .setRequired(true)
    .setChoices(...ERLCAgeGroups),
  new SlashCommandStringOption()
    .setName("height")
    .setDescription("The violator's height in feet and inches.")
    .setMinLength(4)
    .setMaxLength(5)
    .setRequired(true)
    .setAutocomplete(true),
  new SlashCommandIntegerOption()
    .setName("weight")
    .setDescription("The violator's weight in pounds (lbs).")
    .setMinValue(25)
    .setMaxValue(700)
    .setRequired(true)
    .setAutocomplete(true),
  new SlashCommandStringOption()
    .setName("eye-color")
    .setDescription("The violator's eye color.")
    .setMinLength(3)
    .setMaxLength(14)
    .setRequired(true)
    .setChoices(...EyeColorChoices),
  new SlashCommandStringOption()
    .setName("hair-color")
    .setDescription("The violator's hair color.")
    .setMinLength(3)
    .setMaxLength(14)
    .setRequired(true)
    .setChoices(...HairColorChoices),
  new SlashCommandIntegerOption()
    .setName("license-num")
    .setDescription("The violator's driving license number.")
    .setMinValue(99999999)
    .setMaxValue(999999999999)
    .setRequired(true),
  new SlashCommandBooleanOption()
    .setName("commercial-lic")
    .setDescription("Whether the violator has a commercial license.")
    .setRequired(true),
  new SlashCommandStringOption()
    .setName("vehicle-plate")
    .setDescription("The license plate of the violator's vehicle.")
    .setMinLength(3)
    .setMaxLength(7)
    .setRequired(true),
  new SlashCommandStringOption()
    .setName("vehicle-model")
    .setDescription("The model of the violator's vehicle.")
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true)
    .setAutocomplete(true),
  new SlashCommandStringOption()
    .setName("vehicle-color")
    .setDescription("The color of the violator's vehicle.")
    .setMinLength(3)
    .setMaxLength(30)
    .setRequired(true)
    .setAutocomplete(true),
  new SlashCommandStringOption()
    .setName("nta-type")
    .setDescription("The type of notice to appear (NTA) issued. Defaults to 'Traffic'.")
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(false)
    .setChoices(Object.values(NTATypes).map((Type) => ({ name: Type, value: Type }))),
  new SlashCommandBooleanOption()
    .setName("vehicle-commercial")
    .setDescription("Whether the violator's vehicle is classified as commercial.")
    .setRequired(false),
  new SlashCommandBooleanOption()
    .setName("vehicle-hazardous")
    .setDescription("Whether the violator's vehicle is transporting hazardous materials.")
    .setRequired(false),
  new SlashCommandIntegerOption()
    .setName("speed-approx")
    .setDescription(
      "The approximate speed of the violator's vehicle in miles per hour (MPH) at the time of the incident."
    )
    .setMinValue(0)
    .setMaxValue(300)
    .setRequired(false),
  new SlashCommandIntegerOption()
    .setName("speed-limit")
    .setDescription(
      "The posted speed limit in miles per hour (MPH) at the location of the incident."
    )
    .setMinValue(15)
    .setMaxValue(90)
    .setRequired(false),
  new SlashCommandIntegerOption()
    .setName("vehicle-limit")
    .setDescription(
      "The posted speed limit in miles per hour (MPH) at the location of the incident."
    )
    .setMinValue(15)
    .setMaxValue(90)
    .setRequired(false),
  new SlashCommandStringOption()
    .setName("weather")
    .setDescription("The weather conditions at the time of the violation(s).")
    .setMinLength(3)
    .setMaxLength(10)
    .setRequired(false)
    .setChoices(
      Object.values(WeatherConditions).map((Condition) => ({ name: Condition, value: Condition }))
    ),
  new SlashCommandStringOption()
    .setName("traffic")
    .setDescription("The traffic condition at the time of the violation(s).")
    .setMinLength(3)
    .setMaxLength(10)
    .setRequired(false)
    .setChoices(
      Object.values(TrafficConditions).map((Condition) => ({ name: Condition, value: Condition }))
    ),
  new SlashCommandStringOption()
    .setName("surface")
    .setDescription("The road surface condition at the time of the violation(s).")
    .setMinLength(3)
    .setMaxLength(10)
    .setRequired(false)
    .setChoices(Object.values(RoadSurfaces).map((Surface) => ({ name: Surface, value: Surface }))),
  new SlashCommandStringOption()
    .setName("travel-dir")
    .setDescription("The direction of travel of the violator at the time of the violation(s).")
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(false)
    .setChoices(
      Object.entries(TravelDirections).map(([Key, Value]) => ({
        name: Key,
        value: Value,
      }))
    ),
  new SlashCommandBooleanOption()
    .setName("involved-accident")
    .setDescription("Whether this citation or stop is connected to a traffic accident.")
    .setRequired(false),
] as const;

const CommandObject = {
  callback: CitWrnCmdCallback,
  data: new SlashCommandSubcommandBuilder()
    .setName("citation-warning")
    .setDescription("Creates and logs a notice to appear as a citation record for a person."),
};

SharedCmdOptions.forEach((Option) => {
  CommandObject.data.options.push(Option);
});

// ----------------------------------------------------------------
export default CommandObject;
