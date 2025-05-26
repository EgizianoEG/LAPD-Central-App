import {
  AllVehicleModels,
  ERLCVehiclesData,
  AllVehicleModelNames,
} from "@Resources/ERLCVehicles.js";

import { ApplicationCommandOptionChoiceData } from "discord.js";
import { FormatVehicleName } from "../Strings/Formatters.js";
import ShuffleArray from "../Other/ShuffleArray.js";

const VehicleTags: string[] = [];
for (const Brand of ERLCVehiclesData) {
  for (const Model of Brand.models) {
    if (!VehicleTags.includes(Model.style.toLowerCase())) {
      VehicleTags.push(Model.style.toLowerCase());
    }

    if (!VehicleTags.includes(Model.class.toLowerCase())) {
      VehicleTags.push(Model.class.toLowerCase());
    }

    if (!VehicleTags.includes(Model.category.toLowerCase())) {
      VehicleTags.push(Model.category.toLowerCase());
    }
  }
}

/**
 * Autocompletes a vehicle based on the typed input.
 * @param Typed - The typed input to autocomplete.
 * @returns
 */
export default function AutocompleteVehicle(
  Typed: string
): Array<ApplicationCommandOptionChoiceData> {
  let Suggestions: string[] = [];
  const LowerCaseTyped = Typed.toLowerCase();

  if (Typed.match(/^\s*$/)) {
    Suggestions = ShuffleArray([...AllVehicleModelNames]);
  } else if (VehicleTags.includes(LowerCaseTyped)) {
    const MatchingModels = AllVehicleModels.filter(
      (Model) =>
        Model.style.toLowerCase() === LowerCaseTyped ||
        Model.class.toLowerCase() === LowerCaseTyped ||
        Model.category.toLowerCase() === LowerCaseTyped
    );

    Suggestions = MatchingModels.map((Model) =>
      FormatVehicleName(Model, { name: Model.brand, alias: Model.counterpart })
    );
  } else {
    Suggestions = AllVehicleModelNames.filter((Name) => {
      const LowerCasedName = Name.toLowerCase();
      return LowerCasedName.includes(LowerCaseTyped) || LowerCaseTyped.includes(LowerCasedName);
    });
  }

  if (!Suggestions.length) Suggestions = ShuffleArray([...AllVehicleModelNames]);
  return Suggestions.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}
