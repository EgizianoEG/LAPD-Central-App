import { time, roleMention, userMention } from "discord.js";
import { SavedRoleSchema } from "./Schemas/SavedRole.js";
import { Schema, model } from "mongoose";
import { format } from "date-fns";

const RolePersist = new Schema(
  {
    guild: {
      type: String,
      ref: "Guild",
      index: true,
      match: /^\d{15,22}$/,
      required: true,
    },

    user: {
      type: String,
      ref: "GuildProfile",
      match: /^\d{15,22}$/,
      index: true,
      required: true,
    },

    saved_by: {
      _id: false,
      default: {},
      required: true,
      type: {
        user_id: {
          type: String,
          ref: "GuildProfile",
          match: /^\d{15,22}$/,
          required: true,
        },

        username: {
          type: String,
          minLength: 2,
          maxLength: 32,
          required: true,
        },
      },
    },

    saved_on: {
      type: Date,
      required: true,
      default: Date.now,
    },

    reason: {
      type: String,
      default: null,
      required: false,
    },

    expiry: {
      type: Date,
      index: true,
      default: null,
      required: false,
    },

    roles: {
      type: [SavedRoleSchema],
      default: [],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0 && v.length <= 6,
        message: "Role selection requires 1-6 items (received: {VALUE}).",
      },
    },
  },
  {
    virtuals: {
      user_mention: {
        get() {
          return userMention(this.user);
        },
      },

      saved_on_timestamp: {
        get() {
          return time(this.saved_on, "F");
        },
      },

      saved_on_formatted: {
        get() {
          return format(this.saved_on, "MMMM dd, yyyy 'at' HH:mm:ss");
        },
      },

      expiration_timestamp: {
        get() {
          return this.expiry ? time(this.expiry, "F") : null;
        },
      },

      roles_mentioned: {
        get() {
          return this.roles.map((Role) => roleMention(Role.role_id));
        },
      },

      autocomplete_text: {
        get() {
          return this.expiry
            ? `Saved by @${this.saved_by.username} on ${format(this.saved_on, "MMM dd, yy")} – Expires ${format(this.expiry, "MMM dd, yy 'at' HH:mm:ss z")}`
            : `Saved by @${this.saved_by.username} on ${format(this.saved_on, "MMM dd, yy")} – No expiration date set`;
        },
      },
    },
  }
);

const RolePersistenceModel = model("Role_Persist", RolePersist);
export default RolePersistenceModel;
