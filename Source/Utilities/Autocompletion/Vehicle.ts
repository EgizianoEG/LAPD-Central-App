import {
  AllVehicleModels,
  ERLCVehiclesData,
  AllVehicleModelNames,
} from "@Resources/ERLC-Data/ERLCVehicles.js";

import { ApplicationCommandOptionChoiceData } from "discord.js";
import { FormatVehicleName } from "../Strings/Formatters.js";
import ShuffleArray from "../Helpers/ShuffleArray.js";
import FuseJS from "fuse.js";

const VehicleTags: string[] = [];
const FuseInstance = new FuseJS(AllVehicleModels, {
  threshold: 0.5,
  distance: 100,
  shouldSort: true,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true,
  isCaseSensitive: false,
  keys: [
    { name: "brand", weight: 0.4 },
    { name: "name", weight: 0.45 },
    { name: "alias", weight: 0.45 },

    { name: "counterpart", weight: 0.35 },
    { name: "style", weight: 0.2 },

    { name: "class", weight: 0.15 },
    { name: "category", weight: 0.15 },
    { name: "model_year.org", weight: 0.05 },
    { name: "model_year.alt", weight: 0.05 },
  ],
});

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
  const LowerCaseTyped = Typed.trim().toLowerCase();

  if (!LowerCaseTyped || LowerCaseTyped.match(/^\s*$/)) {
    return ShuffleArray([...AllVehicleModelNames])
      .slice(0, 25)
      .map((Choice) => ({ name: Choice, value: Choice }));
  }

  if (VehicleTags.includes(LowerCaseTyped)) {
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
    const SearchResult = FuseInstance.search(LowerCaseTyped, { limit: 30 }).filter(
      (Res) => Res.score! <= 0.65
    );

    Suggestions = SearchResult.map((Result) => {
      const Model = Result.item;
      return FormatVehicleName(Model, { name: Model.brand, alias: Model.counterpart });
    });
  }

  if (!Suggestions.length) {
    Suggestions = AllVehicleModelNames.filter((Name) => {
      const LowerCaseName = Name.toLowerCase();
      return LowerCaseName.includes(LowerCaseTyped);
    });

    if (!Suggestions.length) {
      Suggestions = ShuffleArray([...AllVehicleModelNames]);
    }
  }

  return Suggestions.slice(0, 25).map((Choice) => ({ name: Choice, value: Choice }));
}
