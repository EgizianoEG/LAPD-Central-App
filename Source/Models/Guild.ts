import { Schema, model } from "mongoose";
import { isAfter } from "date-fns";
import GSettingsSchema from "./Schemas/GuildSettings.js";

const GuildSchema = new Schema({
  _id: {
    type: String,
    required: true,
    match: /^\d{15,22}$/,
  },

  logs: {
    _id: false,
    default: {},
    type: {
      arrests: [
        {
          type: String,
          ref: "Arrest",
        },
      ],
      citations: [
        {
          type: String,
          ref: "Citation",
        },
      ],
      incidents: [
        {
          type: String,
          ref: "Incident",
        },
      ],
    },
  },

  settings: {
    _id: false,
    default: {},
    type: GSettingsSchema,
  },

  last_logs_cleanup: {
    type: Date,
    default: null,
  },

  deletion_scheduled_on: {
    type: Date,
    default: null,
    validate: [
      (d: Date) => d === null || isAfter(d, Date.now()),
      "The deletion date, if set, must be in the future; otherwise, it must be null. Value received: {VALUE}.",
    ],
  },
});

GuildSchema.set("_id", false);
GuildSchema.set("optimisticConcurrency", true);

const GuildModel = model("Guild", GuildSchema);
export default GuildModel;
