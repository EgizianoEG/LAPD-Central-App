import { Schema } from "mongoose";

const Opts = { _id: false, versionKey: false };
const BaseFields = {
  all: {
    type: Number,
    default: 0,
    min: 0,
  },
  on_duty: {
    type: Number,
    default: 0,
    min: 0,
  },
  on_break: {
    type: Number,
    default: 0,
    min: 0,
  },
};

const TDSchema = new Schema(BaseFields, Opts);
const ADSchema = new Schema(BaseFields, Opts);

TDSchema.remove("all");
TDSchema.virtual("all").get(function () {
  return this.on_duty + this.on_break;
});

ADSchema.remove("all");
ADSchema.virtual("all").get(function () {
  return (this.on_duty + this.on_break) / 2;
});

const ShiftDataSchema = new Schema({
  total_durations: {
    _id: false,
    default: {},
    type: TDSchema,
  },

  average_periods: {
    _id: false,
    default: {},
    type: ADSchema,
  },

  logs: {
    _id: false,
    default: [],
    type: [
      {
        type: String,
        ref: "Shift",
      },
    ],
  },
});

ShiftDataSchema.pre("save", function PreShiftDataSaveFind(next) {
  const ShiftCount = this.logs.length;

  if (ShiftCount === 0) {
    this.average_periods.on_duty = 0;
    this.average_periods.on_break = 0;
  } else {
    this.average_periods.on_duty = Math.round(this.total_durations.on_duty / ShiftCount) || 0;
    this.average_periods.on_break = Math.round(this.total_durations.on_break / ShiftCount) || 0;
  }

  return next();
});

export default ShiftDataSchema;
