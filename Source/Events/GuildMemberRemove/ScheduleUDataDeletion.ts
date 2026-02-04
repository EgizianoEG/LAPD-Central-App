import AppLogger from "#Utilities/Classes/AppLogger.js";
import GuildProfile from "#Models/GuildProfile.js";
import { GuildMember, PartialGuildMember } from "discord.js";

/**
 * Schedules the deletion of user data relating to the guild they were in.
 * @param _ - Unused parameter.
 * @param Member - The guild member who left the server.
 */
export default async function ScheduleUserDataDeletionOnMemberLeave(
  _: DiscordClient,
  Member: GuildMember | PartialGuildMember
) {
  try {
    await GuildProfile.findOneAndUpdate(
      {
        user: Member.user.id,
        guild: Member.guild.id,
        left_at: { $eq: null },
      },
      {
        $set: {
          left_at: new Date(),
        },
      }
    );
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to schedule user data deletion upon leaving a server;",
      label: "Events:GuildMemberRemove:ScheduleUDD",
      stack: Err.stack,
      error: Err,
    });
  }
}
