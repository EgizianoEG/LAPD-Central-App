import { CallbackWithoutResultAndOptionalError, Model } from "mongoose";
import { randomInt as RandomInteger } from "node:crypto";
import { ShiftFlags } from "../Shift.js";
import { Shifts } from "#Typings/Utilities/Database.js";
import AppError from "#Utilities/Classes/AppError.js";
import ProfileModel from "#Models/GuildProfile.js";
import type ShiftModel from "../Shift.js";

const ErrorTitle = "Invalid Action";
type ShiftRecord = NonNullable<Awaited<ReturnType<(typeof ShiftModel)["findOne"]>>>;

async function GetUpdatedDocument<GOIFailed extends boolean = false>(
  Document: ShiftRecord,
  OldFallback: GOIFailed,
  Silent: boolean = true
): Promise<GOIFailed extends true ? ShiftRecord : ShiftRecord | null> {
  return (Document.constructor as any)
    .findOne({ _id: Document._id })
    .then((Latest: Nullable<ShiftRecord>) => {
      if (OldFallback) {
        return Latest ?? Document;
      }
      return Latest;
    })
    .catch((Err: any) => {
      if (Silent) {
        return null;
      }
      throw Err;
    });
}

function GetUpdateShiftOnDutyDuration(SD: ShiftRecord) {
  const EndTimestamp = SD.end_timestamp?.valueOf() ?? Date.now();
  if (!SD.start_timestamp) return 0;

  const TotalShiftDuration = EndTimestamp - SD.start_timestamp.valueOf();
  const BreakDuration = GetUpdateShiftOnBreakDuration(SD);
  const OnDutyDuration = TotalShiftDuration - BreakDuration;

  return Math.max(OnDutyDuration, 0);
}

function GetUpdateShiftOnBreakDuration(SD: ShiftRecord) {
  const EndTimestamp = SD.end_timestamp?.valueOf() ?? Date.now();
  if (!SD.start_timestamp || SD.events.breaks.length === 0) return 0;

  const TotalShiftDuration = EndTimestamp - SD.start_timestamp.valueOf();
  let OnBreakDuration = SD.events.breaks.reduce((Total, [StartEpoch, EndEpoch]) => {
    return Total + Math.max((EndEpoch || EndTimestamp) - StartEpoch, 0);
  }, 0);

  OnBreakDuration = Math.min(OnBreakDuration, TotalShiftDuration);
  return Math.max(OnBreakDuration, 0);
}

/**
 * Updates the durations of a shift document. Alters it.
 * @param ShiftDocument - The shift document to update.
 * @returns The updated shift document.
 */
export function UpdateShiftDurations(ShiftDocument: ShiftRecord) {
  ShiftDocument.durations.on_duty = GetUpdateShiftOnDutyDuration(ShiftDocument);
  ShiftDocument.durations.on_break = GetUpdateShiftOnBreakDuration(ShiftDocument);
  return ShiftDocument;
}

export function HasBreakActive(this: ShiftRecord) {
  return this.events.breaks.some(([, end]) => end === null);
}

export function HasBreaks(this: ShiftRecord) {
  return this.events.breaks.length > 0;
}

export function ShiftEventAdd(this: ShiftRecord, type: "arrests" | "citations") {
  this.events[type]++;
  return this.save();
}

export async function GetLatestVersion<GOIFailed extends boolean = false>(
  this: ShiftRecord,
  OldFallback: GOIFailed,
  Silent: boolean = true
): Promise<GOIFailed extends true ? ShiftRecord : ShiftRecord | null> {
  return GetUpdatedDocument(this, OldFallback, Silent);
}

export async function StartNewShift(
  this: Model<Shifts.ShiftDocument, unknown, Shifts.ShiftDocumentOverrides>,
  opts: Omit<
    Required<Pick<Shifts.ShiftDocument, "user" | "guild">> & Partial<Shifts.ShiftDocument>,
    "end_timestamp"
  >
) {
  const StartTimestamp = opts.start_timestamp || new Date();
  const ShiftUniqueId =
    opts._id || `${StartTimestamp.getTime()}${RandomInteger(10, 99)}`.slice(0, 15);

  const ActiveShift = await this.findOneAndUpdate(
    { user: opts.user, guild: opts.guild, end_timestamp: null },
    {
      $setOnInsert: {
        _id: ShiftUniqueId,
        user: opts.user,
        guild: opts.guild,
        type: opts.type || "Default",
        start_timestamp: StartTimestamp,
        end_timestamp: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  if (ActiveShift._id !== ShiftUniqueId && ActiveShift.end_timestamp === null) {
    throw new AppError({
      template: "ShiftAlreadyActive",
      template_args: [ActiveShift.type],
      showable: true,
      code: 2,
    });
  }

  return ActiveShift;
}

export async function ShiftBreakStart(
  this: ShiftRecord,
  timestamp: number = Date.now()
): Promise<ShiftRecord> {
  const UpdateDocument = await this.$model()
    .findOneAndUpdate(
      {
        _id: this._id,
        end_timestamp: null,
        $expr: {
          $or: [
            // Case 1: No breaks at all
            {
              // eslint-disable-next-line sonarjs/no-duplicate-string
              $eq: [{ $size: "$events.breaks" }, 0],
            },

            // Case 2: Last break in the array has an end timestamp of null (active break)
            {
              $and: [
                {
                  $gt: [{ $size: "$events.breaks" }, 0],
                },
                {
                  $ne: [
                    {
                      $arrayElemAt: [
                        {
                          $arrayElemAt: ["$events.breaks", -1],
                        },
                        1,
                      ],
                    },
                    null,
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        $push: { "events.breaks": [timestamp, null] },
        $set: {
          "durations.on_duty": GetUpdateShiftOnDutyDuration(this),
          "durations.on_break": GetUpdateShiftOnBreakDuration(this),
        },
      },
      { new: true }
    )
    .exec();

  if (!UpdateDocument) {
    throw new AppError({
      title: ErrorTitle,
      message: "An active break already exists or the shift is no longer active.",
      showable: true,
    });
  }

  return UpdateDocument as unknown as ShiftRecord;
}

export async function ShiftBreakEnd(
  this: ShiftRecord,
  timestamp: number = Date.now()
): Promise<ShiftRecord> {
  const UpdatedDocument = await this.$model()
    .findOneAndUpdate(
      {
        _id: this._id,
        end_timestamp: null,
        $expr: {
          $eq: [
            {
              $arrayElemAt: [
                {
                  $arrayElemAt: ["$events.breaks", -1],
                }, // Get the last element of the breaks array
                1, // Access the second element of the last sub-array
              ],
            },
            null, // Check if it's null (active break)
          ],
        },
      },
      {
        $set: {
          "events.breaks.$[elem].1": timestamp,
          "durations.on_duty": GetUpdateShiftOnDutyDuration(this),
          "durations.on_break": GetUpdateShiftOnBreakDuration(this),
        },
      },
      {
        arrayFilters: [{ "elem.1": null }], // Update the first active break found
        new: true,
      }
    )
    .exec();

  if (!UpdatedDocument) {
    throw new AppError({
      title: ErrorTitle,
      message:
        "There is currently no active break to end. Please start a break before attempting to end it.",
      showable: true,
    });
  }

  return UpdatedDocument as unknown as ShiftRecord;
}

export async function ShiftEnd(
  this: ShiftRecord,
  timestamp: Date | number = new Date()
): Promise<ShiftRecord> {
  const EndTimestamp = new Date(timestamp);
  const ShiftBreaks = this.events.breaks.map(([Started, Ended]) => [
    Started,
    Ended || EndTimestamp.getTime(),
  ]);

  const UpdatedDocument = await this.$model()
    .findOneAndUpdate(
      {
        _id: this._id,
        end_timestamp: null,
      },
      {
        $set: {
          end_timestamp: EndTimestamp,
          "events.breaks": ShiftBreaks,
          "durations.on_duty": GetUpdateShiftOnDutyDuration(this),
          "durations.on_break": GetUpdateShiftOnBreakDuration(this),
        },
      },
      { new: true }
    )
    .exec();

  if (!UpdatedDocument) {
    throw new AppError({
      title: ErrorTitle,
      message:
        "This shift may have already ended, or it might have been recently voided or deleted.",
      showable: true,
    });
  }

  return UpdatedDocument as unknown as ShiftRecord;
}

export async function ResetShiftTime(
  this: ShiftRecord,
  CurrentTimestamp: number = Date.now()
): Promise<ShiftRecord> {
  const DBShiftDoc = await this.getLatestVersion(false, false);
  if (!DBShiftDoc) {
    throw new AppError({ template: "NoShiftFoundWithId", showable: true });
  }

  if (DBShiftDoc.durations.on_duty === 0) {
    throw new AppError({ template: "ShiftTimeAlreadyReset", showable: true });
  }

  const OnDutyModTime = -(
    (DBShiftDoc.end_timestamp?.valueOf() || CurrentTimestamp) - DBShiftDoc.start_timestamp.valueOf()
  );

  const UpdatedDocument = await this.$model()
    .findOneAndUpdate(
      {
        _id: this._id,
      },
      {
        $set: {
          flag: ShiftFlags.Modified,
          "durations.on_duty_mod": OnDutyModTime,
        },
      },
      { new: true }
    )
    .exec();

  if (!UpdatedDocument) {
    throw new AppError({
      title: ErrorTitle,
      showable: true,
      message:
        "The shift you are trying to alter may have been recently voided, deleted, or does no longer exist.",
    });
  }

  return UpdatedDocument as unknown as ShiftRecord;
}

export async function SetShiftTime(
  this: ShiftRecord,
  Duration: number,
  CurrentTimestamp: number = Date.now()
): Promise<ShiftRecord> {
  const DBShiftDoc = await this.getLatestVersion(false, false);
  if (!DBShiftDoc) {
    throw new AppError({ template: "NoShiftFoundWithId", showable: true });
  }

  const DesiredDuration = Math.round(Math.max(Duration, 0));
  const EndTimestamp = DBShiftDoc.end_timestamp?.valueOf() || CurrentTimestamp;
  const ElapsedTime = EndTimestamp - DBShiftDoc.start_timestamp.valueOf();
  const BreakTime = DBShiftDoc.events.breaks.reduce((Total, [StartEpoch, EndEpoch]) => {
    return Total + Math.max((EndEpoch || EndTimestamp) - StartEpoch, 0);
  }, 0);

  const BaseOnDuty = ElapsedTime - BreakTime;
  DBShiftDoc.durations.on_duty_mod = DesiredDuration - BaseOnDuty;

  if (DBShiftDoc.flag === ShiftFlags.Standard) {
    DBShiftDoc.flag = ShiftFlags.Modified;
  }

  return DBShiftDoc.save();
}

export async function AddSubShiftTime(
  this: ShiftRecord,
  Type: "Add" | "Sub" | "Subtract",
  Duration: number
): Promise<ShiftRecord> {
  Duration = Math.round(Duration);
  const DBShiftDoc = await this.getLatestVersion(false, false);
  if (!DBShiftDoc) {
    throw new AppError({ template: "NoShiftFoundWithId", showable: true });
  }

  if (Type === "Add") {
    DBShiftDoc.durations.on_duty_mod += Duration;
  } else {
    DBShiftDoc.durations.on_duty_mod -= Math.min(Duration, DBShiftDoc.durations.on_duty);
  }

  if (DBShiftDoc.flag === ShiftFlags.Standard) {
    DBShiftDoc.flag = ShiftFlags.Modified;
  }

  return DBShiftDoc.save();
}

export async function PreShiftDocDelete(
  this: ShiftRecord,
  next: CallbackWithoutResultAndOptionalError = () => {}
): Promise<void> {
  const OnDutyDecrement = -this.durations.on_duty;
  const OnBreakDecrement = -this.durations.on_break;

  await ProfileModel.updateOne(
    { user: this.user, guild: this.guild },
    [
      {
        $set: {
          "shifts.logs": { $setDifference: ["$shifts.logs", [this._id]] },
          "shifts.total_durations.on_duty": {
            $max: [{ $add: ["$shifts.total_durations.on_duty", OnDutyDecrement] }, 0],
          },
          "shifts.total_durations.on_break": {
            $max: [{ $add: ["$shifts.total_durations.on_break", OnBreakDecrement] }, 0],
          },
        },
      },
    ],
    { upsert: true, setDefaultsOnInsert: true }
  )
    .exec()
    .then(() => next())
    .catch((Err) => next(Err));
}

export default {
  end: ShiftEnd,
  breakEnd: ShiftBreakEnd,
  breakStart: ShiftBreakStart,
  incrementEvents: ShiftEventAdd,
  getLatestVersion: GetLatestVersion,
  hasBreakActive: HasBreakActive,
  hasBreaks: HasBreaks,

  setOnDutyTime: SetShiftTime,
  resetOnDutyTime: ResetShiftTime,
  addSubOnDutyTime: AddSubShiftTime,

  async addOnDutyTime(this: ShiftRecord, Duration: number) {
    return AddSubShiftTime.call(this, "Add", Duration);
  },

  async subOnDutyTime(this: ShiftRecord, Duration: number) {
    return AddSubShiftTime.call(this, "Sub", Duration);
  },
} as Omit<Shifts.ShiftDocumentOverrides, "durations">;
