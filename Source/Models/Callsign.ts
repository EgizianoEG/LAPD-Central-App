import { Schema, model } from "mongoose";

const CallsignSchema = new Schema({
  holder: {
    type: String,
    required: true,
    immutable: true,
  },

  /** @see http://forums.radioreference.com/threads/lapd-supervisory-command-staff-callsigns.451920/post-3834919 */
  designation: {
    _id: false,
    required: true,
    immutable: true,
    alias: "callsign",
    default: {},
    type: {
      division: {
        type: Schema.Types.Int32,
        required: true,
        default: 7,
        min: 1,
        max: 35,
      },

      unit_type: {
        type: String,
        trim: true,
        required: true,
        uppercase: true,
        enum: {
          values: [
            "A",
            "B",
            "C",
            "E",
            "F",
            "G",
            "K9",
            "H",
            "L",
            "M",
            "N",
            "P",
            "R",
            "S",
            "U",
            "T",
            "W",
            "Y",
            "I",
            "K",
            "X",
            "Z",
          ],
          message:
            "The callsign unit type must be one of the following: A, B, C, E, F, G, K9, H, L, M, N, P, R, S, U, T, W, Y, I, K, X, Z.; provided {VALUE} is not supported.",
        },
      },

      identifier: {
        type: String,
        required: true,
        set: (Value: string) => {
          const Trimmed = Value.trim();
          const Num = parseInt(Trimmed);
          if (isNaN(Num) || Num <= 0) return "000";
          return Num.toString().padStart(3, "0");
        },
        validate: {
          validator: (Value: string) => {
            return Value.match(/^\d{3,4}$/) && parseInt(Value) > 0;
          },
          message:
            "Identifier must be 3-4 digits (e.g., '001', '123') and > 0. Value received: {VALUE}",
        },
      },
    },
  },

  requested_on: {
    type: Date,
    default: Date.now,
    required: true,
    immutable: true,
  },

  approving_user: {
    type: String,
    match: /^\d{15,22}$/,
    ref: "GuildProfile",
    default: null,
    required: false,
  },

  approved_on: {
    type: Date,
    default: null,
    required: false,
  },
});

const CallsignModel = model("Callsign", CallsignSchema);
export default CallsignModel;
