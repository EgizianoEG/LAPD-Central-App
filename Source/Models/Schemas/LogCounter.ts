import { Schema } from "mongoose";

const LogCounterSchema = new Schema(
  {
    year: {
      type: Number,
      default: null,
      min: 24,
      max: 32,
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
      max: 999_999,
    },
  },
  {
    _id: false,
    id: false,
  }
);

export default LogCounterSchema;
