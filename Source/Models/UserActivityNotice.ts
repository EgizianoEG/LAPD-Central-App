import { isAfter, milliseconds, addMilliseconds, differenceInMilliseconds } from "date-fns";

import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { Schema, model } from "mongoose";

type NoticeDocument = UserActivityNotice.ActivityNoticeHydratedDocument;
const ActivityNoticeSchema = new Schema<
  UserActivityNotice.UserActivityNoticeDocument,
  UserActivityNotice.NoticeModel
>({
  user: {
    type: String,
    ref: "GuildProfile",
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

  type: {
    type: String,
    index: true,
    required: true,
    enum: ["LeaveOfAbsence", "ReducedActivity"],
  },

  quota_scale: {
    type: Number,
    required: false,
    default: null,
    set: (n: number | null) => (n === null ? null : n.toFixed(2)),
    validate: [
      (n: number | null) => n === null || (n >= 0.2 && n <= 0.75),
      "Quota reduction must be between 0.2 and 0.75. Value received: {VALUE}.",
    ],
  },

  reason: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 500,
  },

  request_date: {
    type: Date,
    default: Date.now,
    required: true,
    immutable: true,
  },

  end_date: {
    type: Date,
    required: true,

    default() {
      return addMilliseconds(
        this.review_date || this.request_date,
        this.duration + (this.extension_request?.duration || 0)
      );
    },

    validate: [
      function (this: NoticeDocument, end_date: Date) {
        return isAfter(end_date, this.review_date || this.request_date);
      },
      "The end date must be after the review and request dates of an activity notice. Value received: {VALUE}.",
    ],
  },

  early_end_date: {
    type: Date,
    default: null,
    required: false,
    validate: [
      function (this: NoticeDocument, date: Date) {
        return date === null ? true : isAfter(date, this.review_date || this.request_date);
      },
      "The early end date must be after the review and request date of a notice. Value received: {VALUE}.",
    ],
  },

  early_end_reason: {
    type: String,
    required: false,
    default: null,
  },

  duration: {
    type: Number,
    required: true,
    minlength: milliseconds({ days: 1 }),
    maxlength: milliseconds({ months: 3 }),
  },

  request_msg: {
    type: String,
    default: null,
    required: false,
    validate: [
      (s: string | null) => s === null || /^\d{15,22}:\d{15,22}$/.test(s),
      "Invalid format for request message id; received: {VALUE}. Format: <requests_channel>:<request_msg_id>.",
    ],
  },

  extension_request: {
    required: false,
    default: null,
    _id: false,
    type: {
      date: {
        type: Date,
        required: true,
        default: Date.now,
      },

      request_msg: {
        type: String,
        default: null,
        required: false,
        validate: [
          (s: string | null) => s === null || /^\d{15,22}:\d{15,22}$/.test(s),
          "Invalid format for request message id; received: {VALUE}. Format: <requests_channel>:<request_msg_id>.",
        ],
      },

      duration: {
        type: Number,
        required: true,
        validate: [
          (d: number) => d <= milliseconds({ months: 1 }) && d >= milliseconds({ hours: 12 }),
          "Extended duration must be between 12 hours and 30 days (1 months). Duration received: {VALUE}.",
        ],
      },

      reason: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 500,
      },

      status: {
        type: String,
        required: true,
        default: "Pending",
        enum: ["Pending", "Approved", "Denied", "Cancelled"],
      },

      review_date: {
        type: Date,
        default: null,
        required: false,
        immutable: true,
      },

      reviewer_notes: {
        type: String,
        default: null,
        required: false,
      },

      reviewed_by: {
        required: false,
        default: null,
        _id: false,
        type: {
          id: {
            type: String,
            match: /^\d{15,22}$/,
            required: true,
          },

          username: {
            type: String,
            required: true,
            minLength: 2,
            maxLength: 32,
          },
        },
      },
    },
  },

  review_date: {
    type: Date,
    default: null,
    required: false,
  },

  reviewer_notes: {
    type: String,
    default: null,
    required: false,
  },

  reviewed_by: {
    _id: false,
    default: null,
    required: false,
    type: {
      id: {
        type: String,
        match: /^\d{15,22}$/,
        required: true,
      },

      username: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: 32,
      },
    },
  },

  end_processed: {
    type: Boolean,
    default: false,
    required: true,
  },

  is_manageable: {
    type: Boolean,
    default: true,
    required: true,
  },

  status: {
    type: String,
    required: true,
    default: "Pending",
    enum: ["Pending", "Approved", "Denied", "Cancelled"],
    validate: [
      function (this: NoticeDocument, s: string) {
        if (this.review_date) {
          return s !== "Pending";
        }
        return true;
      },
      "Invalid status. Once an activity notice has been reviewed, it cannot be on pending status.",
    ],
  },
});

// ---------------------------------------------------------------------------------------
// Helper Definitions:
// -------------------
ActivityNoticeSchema.set("optimisticConcurrency", true);
ActivityNoticeSchema.virtual("is_approved").get(function (this: NoticeDocument) {
  return this.review_date && this.status === "Approved";
});

ActivityNoticeSchema.virtual("is_pending").get(function (this: NoticeDocument) {
  return this.status === "Pending" && !this.review_date;
});

ActivityNoticeSchema.virtual("is_active").get(function (this: NoticeDocument) {
  return (
    this.review_date &&
    this.status === "Approved" &&
    this.early_end_date === null &&
    isAfter(this.end_date, new Date())
  );
});

ActivityNoticeSchema.virtual("quota_reduction").get(function (this: NoticeDocument) {
  return `${Math.round((this.quota_scale || 0) * 100)}%`;
});

ActivityNoticeSchema.virtual("duration_hr").get(function (this: NoticeDocument) {
  const MainPlusExt =
    this.duration +
    (this.extension_request?.status === "Approved" ? this.extension_request.duration : 0);
  return this.early_end_date && this.review_date
    ? ReadableDuration(differenceInMilliseconds(this.early_end_date, this.review_date))
    : ReadableDuration(MainPlusExt);
});

ActivityNoticeSchema.virtual("original_duration_hr").get(function (this: NoticeDocument) {
  return ReadableDuration(this.duration);
});

ActivityNoticeSchema.virtual("extended_duration_hr").get(function (this: NoticeDocument) {
  if (this.extension_request) {
    return ReadableDuration(this.extension_request.duration);
  }
  return ReadableDuration(0);
});

ActivityNoticeSchema.pre("validate", function PreLeaveValidate() {
  if (this.status === "Pending" || this.status === "Cancelled") return;

  this.end_date = addMilliseconds(
    this.review_date || this.request_date,
    this.duration +
      (this.extension_request?.status === "Approved" ? this.extension_request.duration : 0)
  );
});

ActivityNoticeSchema.methods.is_over = function (this: NoticeDocument, now: Date = new Date()) {
  return (
    this.is_approved &&
    !this.is_active &&
    isAfter(
      addMilliseconds(now, 250),
      this.early_end_date ||
        addMilliseconds(
          addMilliseconds(
            this.review_date || this.request_date,
            this.extension_request?.duration || 0
          ),
          this.duration
        )
    )
  );
};

ActivityNoticeSchema.methods.getUpToDate = async function (
  this: NoticeDocument,
  old_fallback: boolean = false
) {
  return (this.constructor as UserActivityNotice.NoticeModel)
    .findById(this._id)
    .exec()
    .then((Doc) => Doc || (old_fallback ? this : null));
};

// ---------------------------------------------------------------------------------------
const UserActivityNoticeModel = model<
  UserActivityNotice.UserActivityNoticeDocument,
  UserActivityNotice.NoticeModel
>("ActivityNotice", ActivityNoticeSchema, "activity_notices");

export default UserActivityNoticeModel;
