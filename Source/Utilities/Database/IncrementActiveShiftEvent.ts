import { Shifts } from "#Typings/Utilities/Database.js";
import ShiftModel from "#Models/Shift.js";

export default async function IncrementActiveShiftEvent(
  Event: keyof Omit<Shifts.ShiftEvents, "breaks">,
  UserId: string,
  GuildId: string
) {
  return ShiftModel.updateOne(
    { guild: GuildId, user: UserId, end_timestamp: null },
    { $inc: { [`events.${Event}`]: 1 } }
  );
}
