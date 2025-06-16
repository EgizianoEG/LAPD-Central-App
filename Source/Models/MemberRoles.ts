import { time, roleMention, userMention } from "discord.js";
import { SavedRoleSchema } from "./Schemas/SavedRole.js";
import { Schema, model } from "mongoose";
import { format } from "date-fns";

const MemberRoles = new Schema(
  {
    guild: {
      type: String,
      ref: "Guild",
      match: /^\d{15,22}$/,
      required: true,
    },

    member: {
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

    nickname: {
      type: String,
      minLength: 1,
      maxLength: 32,
      required: true,
    },

    saved_by: {
      type: String,
      ref: "GuildProfile",
      match: /^\d{15,22}$/,
      required: true,
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

    roles: {
      type: [SavedRoleSchema],
      default: [],
      required: true,
    },
  },
  {
    virtuals: {
      user_mention: {
        get() {
          return userMention(this.member);
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

      roles_mentioned: {
        get() {
          return this.roles.map((Role) => roleMention(Role.role_id));
        },
      },

      autocomplete_text: {
        get() {
          return `${this.nickname} (@${this.username}) – ${format(this.saved_on, "MMM dd, yy 'at' HH:mm:ss")}`;
        },
      },
    },
  }
);

const MemberRolesModel = model("Saved_Role", MemberRoles);
export default MemberRolesModel;
