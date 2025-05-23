import { EyeColors, HairColors } from "@Resources/ERLCPDColors.js";
import { model, Model, Schema } from "mongoose";
import { GuildCitations } from "@Typings/Utilities/Database.js";
import ERLCAgeGroups from "@Resources/ERLCAgeGroups.js";

type CitationPlainDoc = GuildCitations.AnyCitationData;
type CitationModelType = Model<CitationPlainDoc, unknown>;

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

  type: {
    type: String,
    enum: ["Warning", "Fine"],
    required: true,
    default() {
      return this.fine_amount ? "Fine" : "Warning";
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
    required: true,
    enum: [1, 2, 3, 4, 5, 6, 7],
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
    max: [200, "A maximum of 200$ fine amount can be used."],
    min: 0,
  },

  violations: {
    type: [Schema.Types.Mixed],
    required: true,
  },

  citing_officer: {
    _id: false,
    required: true,
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
    },
  },
});

CitationSchema.set("optimisticConcurrency", true);
const CitationModel = model<CitationPlainDoc, CitationModelType>("Citation", CitationSchema);
export default CitationModel;
