import { EyeColors, HairColors } from "@Resources/ERLCPDColors.js";
import { model, Model, Schema } from "mongoose";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import ERLCAgeGroups from "@Resources/ERLCAgeGroups.js";

type CitationPlainDoc = GuildCitations.AnyCitationData;
type CitationModelType = Model<CitationPlainDoc, unknown>;

enum CitationTypes {
  Warning = "Warning",
  Fine = "Fine",
}

enum NTATypes {
  Traffic = "Traffic",
  NonTraffic = "Nontraffic",
  Misdemeanor = "MISDEMEANOR",
}

enum WeatherConditions {
  Clear = "Clear",
  Rain = "Rain",
  Fog = "Fog",
}

enum RoadSurfaces {
  Dry = "Dry",
  Wet = "Wet",
}

enum TrafficConditions {
  Light = "Light",
  Medium = "Medium",
  Heavy = "Heavy",
}

enum TravelDirections {
  North = "N",
  South = "S",
  East = "E",
  West = "W",
}

enum DaysOfWeek {
  Sunday = 1,
  Monday = 2,
  Tuesday = 3,
  Wednesday = 4,
  Thursday = 5,
  Friday = 6,
  Saturday = 7,
}

const CitationSchema = new Schema<CitationPlainDoc, CitationModelType>({
  num: {
    min: 0,
    type: Number,
    index: true,
    required: true,
  },

  guild: {
    type: String,
    index: true,
    required: true,
    match: /^\d{15,22}$/,
    ref: "Guild",
  },

  nta_type: {
    type: String,
    required: true,
    enum: Object.values(NTATypes),
    default: NTATypes.Traffic,
  },

  cit_type: {
    type: String,
    enum: Object.values(CitationTypes),
    required: true,
    default() {
      return this.fine_amount ? CitationTypes.Fine : CitationTypes.Warning;
    },
  },

  issued_on: {
    type: Date,
    index: true,
    required: true,
    default: Date.now,
  },

  img_url: {
    type: String,
    required: false,
  },

  dov: {
    type: String,
    trim: true,
    required: true,
  },

  dow: {
    type: Number,
    enum: Object.values(DaysOfWeek).filter((v) => typeof v === "number"),
    required: true,
    default: new Date().getDay() + 1,
  },

  tov: {
    type: String,
    trim: true,
    required: true,
  },

  violation_loc: {
    type: String,
    trim: true,
    required: true,
    maxlength: 70,
    minlength: 3,
    default: "N/A",
  },

  ampm: {
    type: String,
    required: true,
    enum: ["AM", "PM"],
  },

  fine_amount: {
    type: Number,
    required: false,
    max: [1000, "A maximum of $1000 fine amount can be used."],
    min: [20, "A minimum of $20 fine amount can be used."],
    default(this: CitationPlainDoc) {
      return this.cit_type === CitationTypes.Fine ? 0 : null;
    },
  },

  violations: {
    type: [Schema.Types.Mixed],
    default: [],
    required: true,
  },

  comments: {
    _id: false,
    required: true,
    default: {},
    type: {
      accident: {
        type: Boolean,
        default: false,
        required: true,
      },
      weather: {
        type: String,
        default: null,
        required: false,
        validate: [
          (s: string | null | undefined) =>
            s == null || Object.values(WeatherConditions).includes(s as WeatherConditions),
          "Weather condition must be one of the following: Clear, Rain, Fog; or be left as `null` if not applicable.",
        ],
      },
      road_surface: {
        type: String,
        default: null,
        required: false,
        validate: [
          (s: string | null | undefined) =>
            s == null || Object.values(RoadSurfaces).includes(s as RoadSurfaces),
          "Road surface must be one of the following: Dry, Wet; or be left as `null` if not applicable.",
        ],
      },
      traffic: {
        type: String,
        default: null,
        required: false,
        validate: [
          (s: string | null | undefined) =>
            s == null || Object.values(TrafficConditions).includes(s as TrafficConditions),
          "Traffic condition must be one of the following: Light, Medium, Heavy; or be left as `null` if not applicable.",
        ],
      },
      travel_dir: {
        type: String,
        default: null,
        required: false,
        validate: [
          (s: string | null | undefined) =>
            s == null || Object.values(TravelDirections).includes(s as TravelDirections),
          "Travel direction must be one of the following: N, S, E, W; or be left as `null` if not applicable.",
        ],
      },
    },
  },

  case_details: {
    _id: false,
    required: true,
    default: {},
    type: {
      speed_approx: {
        type: Number,
        required: false,
        default: null,
        validate: [
          (n: number | null | undefined) => n == null || (n >= 0 && n <= 300),
          "Vehicle speed approximation must be between 0 and 300 mph; or be left as `null` if not applicable.",
        ],
      },

      posted_speed: {
        type: Number,
        required: false,
        default: null,
        validate: [
          (n: number | null | undefined) => n == null || (n >= 0 && n <= 300),
          "Posted speed limit must be between 0 and 300 mph; or be left as `null` if not applicable.",
        ],
      },

      veh_speed_limit: {
        type: Number,
        required: false,
        default: null,
        validate: [
          (n: number | null | undefined) => n == null || (n >= 0 && n <= 300),
          "Vehicle speed limit must be between 0 and 300 mph; or be left as `null` if not applicable.",
        ],
      },
    },
  },

  citing_officer: {
    _id: false,
    required: true,
    default: {},
    type: {
      discord_id: {
        type: String,
        index: true,
        required: true,
      },
      roblox_id: {
        type: Number,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      display_name: {
        type: String,
        required: true,
      },
    },
  },

  violator: {
    _id: false,
    default: {},
    required: true,
    type: {
      id: {
        type: Number,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      age: {
        type: String,
        required: true,
        enum: ERLCAgeGroups.map((AG) => AG.name),
      },

      gender: {
        type: String,
        required: true,
        enum: ["Male", "Female", "M", "F"],
      },

      hair_color: {
        type: String,
        required: true,
        enum: HairColors.map((C) => C.abbreviation),
      },

      eye_color: {
        type: String,
        required: true,
        enum: EyeColors.map((C) => C.abbreviation),
      },

      height: {
        type: String,
        required: true,
      },

      weight: {
        type: Number,
        required: true,
      },

      city: {
        type: String,
        required: true,
        default: "Los Angeles",
      },

      address: {
        type: String,
        default: "N/A",
        required: true,
      },

      lic_num: {
        type: String,
        required: true,
        minlength: 8,
        maxlength: 12,
      },

      lic_class: {
        type: String,
        default: "A",
        required: true,
      },

      lic_is_comm: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
  },

  vehicle: {
    _id: false,
    required: true,
    default: {},
    type: {
      body_style: {
        type: String,
        required: true,
      },
      lic_num: {
        type: String,
        required: true,
        uppercase: true,
      },
      year: {
        type: String,
        required: true,
      },
      make: {
        type: String,
        required: true,
      },
      model: {
        type: String,
        required: true,
      },
      color: {
        type: String,
        required: true,
      },
      commercial: {
        type: Boolean,
        default: false,
      },
      hazardous_mat: {
        type: Boolean,
        default: false,
      },
      is_vehicle: {
        type: Boolean,
        default: true,
      },
      is_boat: {
        type: Boolean,
        default: false,
      },
      is_aircraft: {
        type: Boolean,
        default: false,
      },
    },
  },
});

CitationSchema.set("optimisticConcurrency", true);
const CitationModel = model<CitationPlainDoc, CitationModelType>("Citation", CitationSchema);

export default CitationModel;
export {
  WeatherConditions,
  TrafficConditions,
  TravelDirections,
  CitationTypes,
  RoadSurfaces,
  DaysOfWeek,
  NTATypes,
};
