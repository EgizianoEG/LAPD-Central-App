import ShiftDurations from "./Schemas/ShiftDurations.js";
import ShiftInstFuncs, { UpdateShiftDurations, StartNewShift } from "./Functions/ShiftModel.js";
import { randomInt as RandomInteger } from "node:crypto";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { Schema, model } from "mongoose";
import { Shifts } from "@Typings/Utilities/Database.js";

enum ShiftFlags {
  /** Auto-generated/created by the system (e.g., scheduled shifts). Future usage 🤔? */
  System = "System",

  /** Default for shifts created/initiated manually by common users. */
  Standard = "Standard",

  /** Imported from external databases/applications. */
  Imported = "Imported",

  /** Modified manually by admins or management staff. This includes time additions and subtractions. */
  Modified = "Modified",

  /** Manually created/initiated by admins or management staff. */
  Administrative = "Administrative",
}

const ShiftSchema = new Schema<
  Shifts.ShiftDocument,
  Shifts.ShiftModel,
  Shifts.ShiftDocumentOverrides
>({
  _id: {
    type: String,
    default() {
      return `${Date.now()}${RandomInteger(10, 99)}`.slice(0, 15);
    },
  },

  user: {
    type: String,
    ref: "GuildProfile",
    match: /^\d{15,22}$/,
    index: true,
    required: true,
  },

  guild: {
    type: String,
    ref: "Guild",
    match: /^\d{15,22}$/,
    index: true,
    required: true,
  },

  start_timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
  },

  end_timestamp: {
    type: Date,
    index: true,
    default: null,
    required: false,
  },

  type: {
    type: String,
    trim: true,
    required: true,
    default: "Default",
  },

  flag: {
    type: String,
    required: true,
    default: ShiftFlags.Standard,
    enum: Object.values(ShiftFlags),
  },

  durations: {
    _id: false,
    default: {},
    required: true,
    type: ShiftDurations,
  },

  events: {
    _id: false,
    default: {},
    type: {
      arrests: {
        type: Number,
        default: 0,
        min: 0,
      },

      citations: {
        type: Number,
        default: 0,
        min: 0,
      },

      incidents: {
        type: Number,
        default: 0,
        min: 0,
      },

      breaks: {
        type: [[Number, Number]],
        default: [],
        validate: {
          validator(breaks) {
            return (
              Array.isArray(breaks) &&
              breaks.every(
                (item) =>
                  Array.isArray(item) &&
                  item.length === 2 &&
                  typeof item[0] === "number" &&
                  (item[1] === null || typeof item[1] === "number")
              )
            );
          },
          message:
            "Each break must be an array with two elements: [start timestamp, end timestamp or null (null = break still active)]",
        },
      },
    },
  },
});

ShiftSchema.set("_id", false);
ShiftSchema.set("optimisticConcurrency", true);
ShiftSchema.statics.startNewShift = StartNewShift;

ShiftSchema.virtual("on_duty_time").get(function () {
  return ReadableDuration(this.durations.on_duty, { largest: 4 });
});

ShiftSchema.virtual("on_break_time").get(function () {
  // Unpredictable behavior; may return `undefined` randomly out of nowhere.
  return ReadableDuration(this.durations.on_break, { largest: 3 });
});

ShiftSchema.pre("save", function (next) {
  UpdateShiftDurations(this);
  next();
});

for (const [MethodName, MethodFunc] of Object.entries(ShiftInstFuncs)) {
  ShiftSchema.method(MethodName, MethodFunc);
}

const ShiftModel = model<Shifts.ShiftDocument, Shifts.ShiftModel>("Shift", ShiftSchema);
export default ShiftModel;
export { ShiftFlags };
