import { GenericRequestStatuses } from "@Config/Constants.js";
import { ServiceUnitTypes } from "@Resources/LAPDCallsigns.js";
import { Schema, model } from "mongoose";
import { Callsigns } from "@Typings/Utilities/Database.js";

const CallSignSchema = new Schema<Callsigns.CallsignDocument, Callsigns.CallsignModel>({
  guild: {
    type: String,
    index: true,
    required: true,
    immutable: true,
    match: /^\d{15,22}$/,
  },

  requester: {
    type: String,
    index: true,
    required: true,
    immutable: true,
    match: /^\d{15,22}$/,
  },

  requested_on: {
    type: Date,
    default: Date.now,
    required: true,
    immutable: true,
  },

  request_reason: {
    type: String,
    trim: true,
    required: true,
    default: "N/A",
    minLength: 3,
    maxLength: 128,
  },

  request_status: {
    type: String as any,
    required: true,
    index: true,
    default: GenericRequestStatuses.Pending,
    enum: {
      values: Object.values(GenericRequestStatuses),
      message: `Request status must be one of the following: ${Object.values(GenericRequestStatuses).join(", ")}. Received {VALUE}.`,
    },
  },

  request_message: {
    type: String,
    trim: true,
    default: null,
    required: false,
    validate: [
      (s: string | null) => s === null || /^\d{15,22}:\d{15,22}$/.test(s),
      "Invalid format for request message Id; received: {VALUE}. Format: <requests_channel>:<request_msg_id>.",
    ],
  },

  reviewer: {
    type: String,
    match: /^\d{15,22}$/,
    ref: "GuildProfile",
    default: null,
    required: false,
  },

  reviewer_notes: {
    type: String,
    trim: true,
    default: null,
    required: false,
    minLength: 3,
    maxLength: 128,
  },

  reviewed_on: {
    type: Date,
    default: null,
    required: false,
  },

  expiry: {
    type: Date,
    default: null,
    required: false,
  },

  /**
   * For more information,
   * @see http://forums.radioreference.com/threads/lapd-supervisory-command-staff-callsigns.451920/post-3834919
   */
  designation: {
    _id: false,
    required: true,
    immutable: true,
    alias: "callsign",
    default: {},
    type: {
      division: {
        type: Schema.Types.Int32 as unknown as any,
        index: true,
        required: true,
        default: 1,
        min: 1,
        max: 36,
      },

      unit_type: {
        type: String,
        trim: true,
        index: true,
        required: true,
        minLength: 1,
        maxLength: 4,
        enum: {
          values: ServiceUnitTypes.map((u) => u.unit),
          message: `The callsign unit type must be one of the following: ${ServiceUnitTypes.map((u) => u.unit).join(", ")}, provided {VALUE} is not supported.`,
        },
      },

      beat_num: {
        type: String,
        index: true,
        required: true,
        set: (Value: string) => {
          const Trimmed = Value.trim();
          const Num = parseInt(Trimmed);
          if (isNaN(Num) || Num <= 0) return "000";
          return Num.toString().padStart(2, "0");
        },
        validate: {
          validator: (val: string) => /^\d{2,4}$/.test(val) && parseInt(val) > 0,
          message:
            "Identifier must be 2-4 digits (e.g., '01', '123') and > 0. Value received: {VALUE}",
        },
      },
    },
  },
});

CallSignSchema.virtual("designation_str").get(function (this: Callsigns.CallsignDocument) {
  return `${this.designation.division}-${this.designation.unit_type}-${this.designation.beat_num}`;
});

CallSignSchema.methods.is_active = function (
  this: Callsigns.CallsignDocument,
  now: Date = new Date()
) {
  return (
    this.reviewed_on !== null &&
    this.request_status === GenericRequestStatuses.Approved &&
    (this.expiry === null || this.expiry > now)
  );
};

const CallsignModel = model<Callsigns.CallsignDocument, Callsigns.CallsignModel>(
  "Callsign",
  CallSignSchema
);

export default CallsignModel;
