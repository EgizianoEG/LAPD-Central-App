import { HydratedDocumentFromSchema, Schema } from "mongoose";
import { Shifts } from "@Typings/Utilities/Database.js";

const ShiftDurations = new Schema({
  total: {
    type: Number,
    default: 0,
    min: 0,
  },

  on_duty: {
    type: Number,
    default: 0,
    min: 0,

    set(this: Shifts.HydratedShiftDocument["durations"], v = -1) {
      if (v === -1) {
        return this.on_duty;
      }
    },

    get(this: Shifts.HydratedShiftDocument["durations"]) {
      const ShiftDoc = this.ownerDocument() as Shifts.HydratedShiftDocument;
      const EndTimestamp = ShiftDoc.end_timestamp?.valueOf() ?? Date.now();
      if (!ShiftDoc.start_timestamp) return 0;

      const TotalShiftDuration = EndTimestamp - ShiftDoc.start_timestamp.valueOf();
      let OnDutyDuration = TotalShiftDuration;
      OnDutyDuration -= this.on_break;
      OnDutyDuration += this.on_duty_mod;

      return Math.max(OnDutyDuration, 0);
    },
  },

  on_break: {
    type: Number,
    default: 0,
    min: 0,

    set(this: Shifts.HydratedShiftDocument["durations"], v = -1) {
      if (v === -1) {
        return this.on_break;
      }
    },

    get(this: Shifts.HydratedShiftDocument["durations"]) {
      const ShiftDoc = this.ownerDocument() as Shifts.HydratedShiftDocument;
      const EndTimestamp = ShiftDoc.end_timestamp?.valueOf() ?? Date.now();
      if (!ShiftDoc.start_timestamp) return 0;

      const TotalShiftDuration = EndTimestamp - ShiftDoc.start_timestamp.valueOf();
      const OnBreakDuration = Math.min(
        ShiftDoc.events.breaks.reduce((Total, [StartEpoch, EndEpoch]) => {
          return Total + Math.max((EndEpoch || EndTimestamp) - StartEpoch, 0);
        }, 0),
        TotalShiftDuration
      );

      this.on_break = OnBreakDuration;
      return OnBreakDuration;
    },
  },

  on_duty_mod: {
    type: Number,
    default: 0,
  },
});

ShiftDurations.set("versionKey", false);
ShiftDurations.remove("total");
ShiftDurations.virtual("total").get(function (
  this: HydratedDocumentFromSchema<typeof ShiftDurations>
) {
  return this.on_duty + this.on_duty_mod + this.on_break;
});

export default ShiftDurations;
