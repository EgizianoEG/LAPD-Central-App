import { Schema } from "mongoose";
import { DASignatureFormats } from "@Config/Constants.js";
import { ServiceUnitTypes } from "@Resources/LAPDCallsigns.js";
import ShiftTypeSchema from "./ShiftType.js";
import type { Guilds } from "@Typings/Utilities/Database.js";

const SnowflakeIdValidationN1: [RegExp, string] = [
  /^\d{15,22}$/,
  "Received an invalid snowflake Id; received '{VALUE}'.",
];

const SnowflakeIdValidationN2: [RegExp, string] = [
  /^\d{15,22}$|^\d{15,22}:\d{15,22}$/,
  "Received an invalid snowflake Id.",
];

const ArrayOfSnowflakesValidator = {
  validator: (Arr: string[]) => Arr.every((id: string) => /^\d{15,22}$/.test(id)),
  message:
    "Invalid role Id found in the provided snowflake Id array; ensure that all roles are valid.",
};

/**
 * Represents the schema for guild settings in the database.
 * @see @Typings/Utilities/Database.js for schema documentation.
 */
const GuildSettings = new Schema<Guilds.GuildSettings>({
  require_authorization: {
    type: Boolean,
    default: true,
    required: true,
  },

  utif_enabled: {
    type: Boolean,
    default: true,
    required: true,
  },

  role_perms: {
    _id: false,
    required: true,
    default: {},
    type: {
      staff: {
        type: [String],
        validate: ArrayOfSnowflakesValidator,
      },
      management: {
        type: [String],
        validate: ArrayOfSnowflakesValidator,
      },
    },
  },

  shift_management: {
    _id: false,
    default: {},
    required: true,
    type: {
      enabled: {
        type: Boolean,
        default: false,
        required: true,
      },

      shift_types: [ShiftTypeSchema],

      default_quota: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      role_assignment: {
        _id: false,
        default: {},
        type: {
          on_duty: [
            {
              _id: false,
              type: String,
              match: SnowflakeIdValidationN1,
            },
          ],
          on_break: [
            {
              _id: false,
              type: String,
              match: SnowflakeIdValidationN1,
            },
          ],
        },
      },

      log_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },
    },
  },

  duty_activities: {
    _id: false,
    default: {},
    required: true,
    type: {
      enabled: {
        type: Boolean,
        default: false,
        required: true,
      },

      incident_reports: {
        _id: false,
        default: {},
        required: true,
        type: {
          auto_thread_management: {
            type: Boolean,
            default: false,
            required: true,
          },
        },
      },

      arrest_reports: {
        _id: false,
        default: {},
        required: true,
        type: {
          show_header_img: {
            type: Boolean,
            default: false,
            required: true,
          },
        },
      },

      signature_format: {
        type: Number,
        required: true,
        default: DASignatureFormats.DiscordNickname,
        enum: Object.values(DASignatureFormats).filter((v) => typeof v === "number"),
      },

      log_deletion_interval: {
        type: Number,
        default: 0,
        required: true,
        enum: [0, 86400000, 259200000, 604800000, 1209600000, 2592000000],
      },

      log_channels: {
        _id: false,
        default: {},
        type: {
          citations: {
            validate: [(arr: string[]) => arr.length <= 2, "A maximum of 2 channels is allowed."],
            type: [
              {
                type: String,
                _id: false,
                match: SnowflakeIdValidationN2,
              },
            ],
          },

          arrests: {
            validate: [(arr: string[]) => arr.length <= 2, "A maximum of 2 channels is allowed."],
            type: [
              {
                type: String,
                _id: false,
                match: SnowflakeIdValidationN2,
              },
            ],
          },

          incidents: {
            type: String,
            default: null,
            required: false,
            match: SnowflakeIdValidationN1,
          },
        },
      },
    },
  },

  leave_notices: {
    _id: false,
    default: {},
    required: true,
    type: {
      enabled: {
        type: Boolean,
        default: false,
        required: true,
      },

      requests_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      log_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      leave_role: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      active_prefix: {
        type: String,
        default: null,
        required: false,
        minLength: 1,
        maxLength: 8,
      },

      alert_roles: {
        type: [String],
        default: [],
        required: true,
        validate: {
          message: "Expected an array of valid snowflake Ids of length 0-3.",
          validator: (arr: string[]) =>
            ArrayOfSnowflakesValidator.validator(arr) && arr.length <= 3,
        },
      },
    },
  },

  reduced_activity: {
    _id: false,
    default: {},
    required: true,
    type: {
      enabled: {
        type: Boolean,
        default: false,
        required: true,
      },

      requests_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      log_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      ra_role: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      active_prefix: {
        type: String,
        default: null,
        required: false,
        minLength: 1,
        maxLength: 8,
      },

      alert_roles: {
        type: [String],
        default: [],
        required: true,
        validate: {
          message: "Expected an array of valid snowflake Ids of length 0-3.",
          validator: (arr: string[]) =>
            ArrayOfSnowflakesValidator.validator(arr) && arr.length <= 3,
        },
      },
    },
  },

  callsigns_module: {
    _id: false,
    default: {},
    required: true,
    type: {
      enabled: {
        type: Boolean,
        default: false,
        required: true,
      },

      manager_roles: {
        type: [String],
        default: [],
        required: true,
        validate: {
          message: "Expected an array of valid snowflake Ids of length 0-6.",
          validator: (arr: string[]) =>
            ArrayOfSnowflakesValidator.validator(arr) && arr.length <= 6,
        },
      },

      alert_on_request: {
        type: Boolean,
        default: false,
        required: true,
      },

      log_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      requests_channel: {
        type: String,
        default: null,
        required: false,
        match: SnowflakeIdValidationN1,
      },

      unit_type_whitelist: {
        type: Boolean,
        default: false,
        required: true,
      },

      unit_type_restrictions: {
        default: [],
        required: true,
        type: [
          {
            unit_type: {
              type: String,
              required: true,
              enum: ServiceUnitTypes.map((u) => u.unit),
              trim: true,
            },
            permitted_roles: {
              type: [String],
              default: [],
              required: true,
              validate: ArrayOfSnowflakesValidator,
            },
          },
        ],
      },

      beat_restrictions: {
        default: [],
        required: true,
        type: [
          {
            range: {
              type: [Number],
              required: true,
              validate: {
                validator: (arr: number[]) => arr.length === 2 && arr[0] <= arr[1],
                message:
                  "Range must be an array of two numbers where the first is less than or equal to the second.",
              },
            },
            permitted_roles: {
              type: [String],
              default: [],
              required: true,
              validate: ArrayOfSnowflakesValidator,
            },
          },
        ],
      },

      nickname_format: {
        type: String,
        default: "{division}{unit_type}-{beat_num} | {nickname}",
        required: true,
        trim: true,
      },

      update_nicknames: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
  },
});

export default GuildSettings;
