import ERLCAgeGroups from "@Resources/ERLCAgeGroups.js";
import { GuildArrests } from "@Typings/Utilities/Database.js";
import { model, Model, Schema } from "mongoose";

type ArrestPlainDoc = GuildArrests.ArrestRecord;
type ArrestModelType = Model<ArrestPlainDoc, unknown>;

const ArrestSchema = new Schema<ArrestPlainDoc, ArrestModelType>({
  booking_num: {
    type: Number,
    min: 100,
    max: 999999,
    index: true,
    required: true,
  },

  guild: {
    type: String,
    required: true,
    index: true,
    match: /^\d{15,22}$/,
    ref: "Guild",
  },

  assisting_officers: {
    type: [String],
    default: [],
    required: true,
    index: true,
  },

  made_on: {
    type: Date,
    index: true,
    required: true,
    default: Date.now,
  },

  notes: {
    type: String,
    default: null,
    required: false,
  },

  report_msg: {
    type: String,
    default: null,
    required: false,
    validate: [
      (s: string | null) => s === null || /^\d{15,22}:\d{15,22}$/.test(s),
      "Invalid format for report message; received: '{VALUE}'. Format: <log_channel>:<log_msg_id>.",
    ],
  },

  arrestee: {
    _id: false,
    required: true,
    type: {
      formatted_name: {
        type: String,
        trim: true,
        required: true,
      },

      roblox_id: {
        type: Number,
        min: 0,
        required: true,
      },

      mugshot_url: {
        type: String,
        required: true,
      },

      gender: {
        type: String,
        trim: true,
        required: true,
        enum: ["Male", "Female", "M", "F"],
      },

      height: {
        type: String,
        trim: true,
        required: true,
      },

      weight: {
        type: Number,
        trim: true,
        required: true,
      },

      age_group: {
        type: String,
        required: true,
        enum: ERLCAgeGroups.map((AgeGroup) => AgeGroup.name),
      },

      charges: {
        required: true,
        type: [
          {
            _id: false,
            type: String,
            trim: true,
            required: true,
            minLength: 6,
            maxLength: 1028,
          },
        ],
      },
    },
  },

  arresting_officer: {
    _id: false,
    required: true,
    type: {
      roblox_id: {
        type: Number,
        required: true,
      },

      // Last known name (to use as a fallback when getting the username from id fails).
      formatted_name: {
        type: String,
        required: true,
      },

      discord_id: {
        type: String,
        index: true,
        required: true,
      },
    },
  },
});

ArrestSchema.set("optimisticConcurrency", true);
const ArrestModel = model<ArrestPlainDoc, ArrestModelType>("Arrest", ArrestSchema);
export default ArrestModel;
