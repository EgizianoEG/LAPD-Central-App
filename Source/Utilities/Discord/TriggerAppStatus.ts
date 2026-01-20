import { ActivityType, PresenceUpdateStatus } from "discord.js";
import AppLogger from "../Classes/AppLogger.js";

/**
 * Switches the application status between "online" and "idle".
 * @param App
 * @param Status
 * @param ShardId
 */
export default async function TriggerAppStatus(
  App: DiscordClient,
  Status: "online" | "idle",
  ShardId?: number
) {
  ShardId = ShardId ?? App.shard?.ids[0] ?? 0;

  App.user.setPresence({
    status: Status === "online" ? PresenceUpdateStatus.Online : PresenceUpdateStatus.Idle,
    shardId: ShardId,
    activities: [
      {
        type: ActivityType.Custom,
        name: `custom_shard_${ShardId}`,
        state: "Watching and Dispatching",
      },
    ],
  });

  AppLogger.log("info", {
    label: "Events:ShardReady:SetStatus",
    message: "Updated the bot status for the shard with id '%o' to '%s'.",
    splat: [ShardId, Status],
  });
}
