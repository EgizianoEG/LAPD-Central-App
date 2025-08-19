import type { GuildMember } from "discord.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import ShiftModel from "@Models/Shift.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

/**
 * Initialize the database by adding/updating/verifying guild data.
 * @param _ - Unused parameter, included for compatibility.
 * @param Member - The guild member who left the server.
 */
export default async function DBOnMemberLeave(_: DiscordClient, Member: GuildMember) {
  try {
    const NowTimestamp = Date.now();
    const ActiveShift = await ShiftModel.findOne({
      user: Member.id,
      guild: Member.guild.id,
      end_timestamp: null,
    });

    if (ActiveShift) {
      const TerminatedShift = await ActiveShift.end(NowTimestamp);
      await ShiftActionLogger.LogShiftAutomatedEnd(
        TerminatedShift,
        Member,
        "Member has left the server. Automatically ended active shift."
      );
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to check active shift upon user leaving a server;",
      label: "Events:GuildMemberRemove:DBOnMemberLeave",
      stack: Err.stack,
      error: { ...Err },
      splat: [Member.id, Member.guild.id],
    });
  }
}
