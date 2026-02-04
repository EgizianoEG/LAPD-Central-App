import { Schema, model } from "mongoose";
import { GuildProfiles } from "#Typings/Utilities/Database.js";
import ShiftsDataSchema from "./Schemas/ShiftsData.js";

const ProfileSchema = new Schema<
  GuildProfiles.ProfileDocument,
  GuildProfiles.ProfileModelType,
  GuildProfiles.ProfileOverrides
>({
  user: {
    type: String,
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

  linked_account: {
    _id: false,
    required: true,
    default: {},
    type: {
      roblox_user_id: {
        min: 0,
        default: 0,
        type: Number,
      },
    },
  },

  preferences: {
    _id: false,
    required: true,
    default: {},
    type: {
      dm_shift_reports: {
        type: Boolean,
        default: false,
      },
    },
  },

  left_at: {
    type: Date,
    index: true,
    default: null,
    required: true,
  },

  activity_notices: {
    required: true,
    default: [],
    type: [
      {
        type: String,
        ref: "ActivityNotice",
      },
    ],
  },

  shifts: {
    _id: false,
    default: {},
    required: true,
    type: ShiftsDataSchema,
  },
});

const ProfileModel = model<GuildProfiles.ProfileDocument, GuildProfiles.ProfileModelType>(
  "GuildProfile",
  ProfileSchema,
  "profiles"
);

export default ProfileModel;
