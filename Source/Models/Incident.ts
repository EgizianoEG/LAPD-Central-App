import { model, Model, Schema } from "mongoose";
import { IsValidIncidentNum } from "@Utilities/Helpers/Validators.js";
import { GuildIncidents } from "@Typings/Utilities/Database.js";
import {
  IncidentTypes,
  IncidentNotesLength,
  IncidentStatusesFlattened,
  IncidentDescriptionLength,
} from "@Resources/IncidentConstants.js";

type IncidentPlainDoc = GuildIncidents.IncidentRecord;
type IncidentModelType = Model<IncidentPlainDoc, unknown>;

const IncidentReportSchema = new Schema<IncidentPlainDoc, IncidentModelType>({
  guild: {
    type: String,
    index: true,
    required: true,
    match: /^\d{15,22}$/,
    ref: "Guild",
  },

  num: {
    type: String,
    index: true,
    required: true,
    validate: {
      validator: IsValidIncidentNum,
      message: "The incident number must be in the format 'YY-XXXXX[X]'.",
    },
  },

  type: {
    type: String,
    required: true,
    enum: IncidentTypes,
  },

  log_message: {
    type: String,
    default: null,
    required: false,
    validate: [
      (s: string | null) => s === null || /^\d{15,22}:\d{15,22}$/.test(s),
      "Invalid format for log message id; received: '{VALUE}'. Format: <log_channel>:<log_msg_id>.",
    ],
  },

  reported_on: {
    type: Date,
    index: true,
    required: true,
    default: Date.now,
  },

  location: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 80,
  },

  suspects: {
    required: true,
    default: [],
    type: [
      {
        _id: false,
        trim: true,
        type: String,
      },
    ],
  },

  victims: {
    required: true,
    default: [],
    type: [
      {
        _id: false,
        trim: true,
        type: String,
      },
    ],
  },

  witnesses: {
    required: true,
    default: [],
    type: [
      {
        _id: false,
        type: String,
        trim: true,
      },
    ],
  },

  officers: {
    required: true,
    default: [],
    type: [
      {
        _id: false,
        trim: true,
        type: String,
      },
    ],
  },

  reporter: {
    required: true,
    _id: false,
    type: {
      roblox_id: Number,
      roblox_username: String,
      roblox_display_name: String,
      discord_username: String,
      discord_id: {
        type: String,
        index: true,
        required: true,
        match: /^\d{15,22}$/,
      },

      signature: {
        type: String,
        required: true,
        minLength: 3,
        maxLength: 100,
        default(this: IncidentPlainDoc) {
          return `@${this.reporter.discord_username}`;
        },
      },
    },
  },

  notes: {
    type: String,
    default: null,
    required: false,
    minlength: IncidentNotesLength.Min,
    maxlength: IncidentNotesLength.Max,
  },

  status: {
    type: String,
    required: true,
    default: "Active",
    enum: IncidentStatusesFlattened,
  },

  attachments: {
    required: true,
    default: [],
    type: [
      {
        _id: false,
        type: String,
      },
    ],
  },

  description: {
    type: String,
    required: true,
    minlength: IncidentDescriptionLength.Min,
    maxlength: IncidentDescriptionLength.Max,
    trim: true,
  },

  last_updated: {
    type: Date,
    required: true,
    default() {
      return this.reported_on || Date.now();
    },
  },

  last_updated_by: {
    _id: false,
    required: false,
    default: null,
    type: {
      discord_id: {
        type: String,
        required: true,
        match: /^\d{15,22}$/,
      },

      discord_username: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 32,
      },

      signature: {
        type: String,
        required: true,
        minLength: 3,
        maxLength: 100,
        default(this: IncidentPlainDoc) {
          return `@${this.last_updated_by!.discord_username}`;
        },
      },
    },
  },
});

IncidentReportSchema.set("optimisticConcurrency", true);
const IncidentModel = model<IncidentPlainDoc, IncidentModelType>("Incident", IncidentReportSchema);
export default IncidentModel;
