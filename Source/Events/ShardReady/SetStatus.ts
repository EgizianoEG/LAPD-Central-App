import { Client, ActivityType, PresenceUpdateStatus } from "discord.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";

export default function SetAppStatus(Client: Client<true>, ShardId: number) {
  Client.user.setPresence({
    status: PresenceUpdateStatus.Online,
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
    message: "Successfully set and updated the bot status for the shard with id: %o.",
    splat: [ShardId],
  });
}
