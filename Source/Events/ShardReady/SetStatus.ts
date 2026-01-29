import TriggerAppStatus from "#Source/Utilities/Discord/TriggerAppStatus.js";

export default function SetAppStatus(Client: DiscordClient, ShardId: number) {
  return TriggerAppStatus(Client, "online", ShardId);
}
