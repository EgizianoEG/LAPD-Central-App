import AppLogger from "#Utilities/Classes/AppLogger.js";
import GuildProfile from "#Models/GuildProfile.js";
import { GuildMember, PartialGuildMember } from "discord.js";

/**
 * Un/De-schedules the deletion of user data relating to the guild they are in.
 * @param _ - Unused parameter.
 * @param Member - The guild member who rejoined the server.
 */
export default async function UnscheduleUserDataDeletionOnMemberRejoin(
  _: DiscordClient,
  Member: GuildMember | PartialGuildMember
) {
  try {
    await GuildProfile.findOneAndUpdate(
      {
        user: Member.user.id,
        guild: Member.guild.id,
        left_at: { $ne: null },
      },
      {
        $set: {
          left_at: null,
        },
      }
    );
  } catch (Err: any) {
    AppLogger.error({
      message: "Failed to unschedule user data deletion upon rejoin;",
      label: "Events:GuildMemberRemove:UnscheduleUDD",
      stack: Err.stack,
      error: Err,
    });
  }
}
