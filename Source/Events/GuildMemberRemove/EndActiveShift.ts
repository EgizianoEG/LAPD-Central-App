import type { GuildMember, PartialGuildMember } from "discord.js";
import ShiftActionLogger from "#Utilities/Classes/ShiftActionLogger.js";
import ShiftModel from "#Models/Shift.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

/**
 * Ends any active shift for a guild member when they leave the server.
 * @param _ - Unused parameter, included for compatibility.
 * @param Member - The guild member who left the server.
 */
export default async function TerminateShiftOnMemberLeave(
  _: DiscordClient,
  Member: GuildMember | PartialGuildMember
) {
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
        Member as GuildMember,
        "Automatically ended due to member leaving the server."
      );
    }
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to check active shift upon user leaving a server;",
      label: "Events:GuildMemberRemove:EndActiveShift",
      stack: Err.stack,
      error: Err,
    });
  }
}
