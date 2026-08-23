import { isAfter } from "date-fns";
import { Schema, model, Model } from "mongoose";
import LogCounterSchema from "./Schemas/LogCounter.js";
import GSettingsSchema from "./Schemas/GuildSettings.js";
import type { Guilds } from "#Typings/Utilities/Database.js";

const GuildSchema = new Schema<Guilds.GuildDocument>({
  _id: {
    type: String,
    required: true,
    match: /^\d{15,22}$/,
  },

  counters: {
    _id: false,
    default: {},
    required: true,
    type: {
      arrests: {
        type: LogCounterSchema,
        required: true,
        default: {},
      },

      citations: {
        type: LogCounterSchema,
        required: true,
        default: {},
      },

      incidents: {
        type: LogCounterSchema,
        required: true,
        default: {},
      },
    },
  },

  settings: {
    _id: false,
    default: {},
    type: GSettingsSchema,
  },

  logs: {
    _id: false,
    default: {},
    required: true,
    type: {
      arrests: {
        _id: false,
        default: {},
        required: true,
        type: {
          logged: [
            {
              type: String,
              ref: "Arrests",
            },
          ],
        },
      },

      citations: {
        _id: false,
        default: {},
        required: true,
        type: {
          logged: [
            {
              type: String,
              ref: "Citation",
            },
          ],
        },
      },

      incidents: {
        _id: false,
        default: {},
        required: true,
        type: {
          logged: [
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
        required: true,
        type: {
          changes: [
            {
              type: String,
              ref: "SettingChange",
            },
          ],
        },
      },
    },
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

const GuildModel = model<Guilds.GuildDocument, Model<Guilds.GuildDocument>>("Guild", GuildSchema);
export default GuildModel;
