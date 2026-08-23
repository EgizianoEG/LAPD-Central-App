import { Schema } from "mongoose";

const LogCounterSchema = new Schema(
  {
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },

    value: {
      type: Number,
      required: true,
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
