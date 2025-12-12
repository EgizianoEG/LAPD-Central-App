import GetGuildSettings from "@Source/Utilities/Database/GetGuildSettings.js";
import CallsignModel from "@Source/Models/Callsign.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import { addHours } from "date-fns";
import { GenericRequestStatuses } from "@Source/Config/Constants.js";
import { GuildMember, PartialGuildMember } from "discord.js";

/**
 * Schedules the release of an active call sign for a guild member when they leave the server.
 * A 12-hour grace period is added to allow for potential rejoining.
 * @param _ - Unused parameter.
 * @param Member - The guild member who left the server.
 */
export default async function ScheduleCallSignReleaseOnMemberLeave(
  _: DiscordClient,
  Member: GuildMember | PartialGuildMember
) {
  try {
    const GuildSettings = await GetGuildSettings(Member.guild.id);
    if (!GuildSettings?.callsigns_module.release_on_inactivity) {
      return;
    }

    const DateNow = new Date();
    await CallsignModel.findOneAndUpdate(
      {
        requester: Member.id,
        guild: Member.guild.id,
        request_status: GenericRequestStatuses.Approved,
        scheduled_release_date: null,
        $or: [{ expiry: null }, { expiry: { $gt: DateNow } }],
      },
      {
        $set: {
          scheduled_release_date: addHours(DateNow, 12),
        },
      }
    ).exec();
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to schedule call sign release upon user leaving a server;",
      label: "Events:GuildMemberRemove:ScheduleCSRelease",
      stack: Err.stack,
      error: Err,
    });
  }
}
