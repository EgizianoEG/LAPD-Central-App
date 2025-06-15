import { Schema } from "mongoose";

export const SavedRoleSchema = new Schema(
  {
    role_id: {
      type: String,
      match: /^\d{15,22}$/,
      required: true,
    },

    name: {
      type: String,
      minLength: 1,
      maxLength: 32,
      required: true,
    },
  },
  { _id: false, versionKey: false }
);
