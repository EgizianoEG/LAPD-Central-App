import { GuildProfiles } from "#Typings/Utilities/Database.js";
import {
  CallbackWithoutResultAndOptionalError,
  HydratedDocument,
  ProjectionType,
  FilterQuery,
  Document,
  Query,
} from "mongoose";

import ShiftModel from "#Models/Shift.js";
import AppError from "#Utilities/Classes/AppError.js";

export function ProfilePostFind(
  Data: GuildProfiles.HydratedProfileDocument | GuildProfiles.HydratedProfileDocument[],
  next: CallbackWithoutResultAndOptionalError = () => {}
) {
  if (Data) {
    if (Array.isArray(Data)) {
      Data.forEach((Chunk) => {
        UpdateAvgShiftPeriods(Chunk);
      });
    } else {
      UpdateAvgShiftPeriods(Data);
    }
  }
  return next();
}

export function UpdateAvgShiftPeriods(Data: GuildProfiles.HydratedProfileDocument) {
  if (!Data.shifts) return;
  const ShiftCount = Data.shifts.logs.length;

  if (ShiftCount === 0) {
    Data.shifts.average_periods.on_duty = 0;
    Data.shifts.average_periods.on_break = 0;
  } else {
    Data.shifts.average_periods.on_duty =
      Math.round(Data.shifts.total_durations.on_duty / ShiftCount) || 0;
    Data.shifts.average_periods.on_break =
      Math.round(Data.shifts.total_durations.on_break / ShiftCount) || 0;
  }
}

export async function PreDelete(this: any, next = () => {}) {
  if (Array.isArray(this)) {
    this.forEach((thisN) => {
      PreDelete.call(thisN);
    });
    return next();
  }

  if (this instanceof Document) {
    await ShiftModel.deleteMany({
      user: (this as any).user_id,
      guild: (this as any).guild,
    });
  } else if (this instanceof Query) {
    const { user_id, guild } = this.getQuery();
    if (user_id && guild) {
      await ShiftModel.deleteMany({
        user: user_id,
        guild,
      });
    } else {
      const ProfileDoc = await this.model.findOne(this.getQuery()).exec();
      if (ProfileDoc) {
        await ShiftModel.deleteMany({
          user: ProfileDoc.user_id,
          guild: ProfileDoc.guild,
        });
      }
    }
  }

  return next();
}

export async function FindOneOrCreate(
  this: GuildProfiles.ProfileModelType,
  filter: FilterQuery<GuildProfiles.ProfileDocument> & { guild: string; user: string },
  projection?: ProjectionType<GuildProfiles.ProfileDocument> | null
): Promise<HydratedDocument<GuildProfiles.ProfileDocument>> {
  try {
    const FoundDoc = await this.findOne(filter, projection).exec();
    if (FoundDoc) return FoundDoc;
    return this.create(filter);
  } catch (Err: any) {
    throw new AppError({
      title: "DB: Failed to Find Profile",
      message: "Failed to find or create profile.",
      showable: true,
      stack: Err.stack,
      code: 1,
    });
  }
}
