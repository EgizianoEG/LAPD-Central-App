import { differenceInDays, isSameDay, startOfToday } from "date-fns";
import { BloxlinkDiscordToRobloxUsageChache } from "@Utilities/Other/Cache.js";
import { RedactTextByOptions } from "@Utilities/Strings/Redactor.js";
import { Bloxlink } from "@Typings/Utilities/APIResponses.js";
import { Other } from "@Config/Secrets.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Axios from "axios";

const MaxUserRequestsPerDay = 3;
const MaxGlobalRequestsPerDay = 100;
const FileLabel = "Utilities:Roblox:GetRbxIdBloxLink";

let GlobalRequestCount = 0;
let LastResetDate = startOfToday();

type UserLimitInfo = {
  count: number;
  last_request: Date;
};

/**
 * Retrieves the Roblox Id associated with a given Discord user Id using the Bloxlink API.
 * @param DiscordUserId - The Discord user Id to look up.
 * @returns A promise that resolves to the Roblox Id if found, or null if not found or the API request failed for some reason.
 * @throws This function does not throw errors, but logs them using the AppLogger silently and returns `null` instead.
 */
export default async function GetRobloxIdFromDiscordBloxlink(
  DiscordUserId: string
): Promise<number | null> {
  const CurrentTime = new Date();

  if (!Other.BloxlinkAPIKey) return null;
  if (!isSameDay(CurrentTime, LastResetDate)) {
    GlobalRequestCount = 0;
    LastResetDate = startOfToday();
  }

  if (GlobalRequestCount >= MaxGlobalRequestsPerDay) {
    return null;
  }

  const UserLimitInfo = BloxlinkDiscordToRobloxUsageChache.get<UserLimitInfo>(DiscordUserId);
  if (UserLimitInfo) {
    if (differenceInDays(CurrentTime, UserLimitInfo.last_request) < 1) {
      if (UserLimitInfo.count >= MaxUserRequestsPerDay) {
        return null;
      } else {
        BloxlinkDiscordToRobloxUsageChache.set(DiscordUserId, {
          count: UserLimitInfo.count + 1,
          last_request: CurrentTime,
        });
      }
    } else {
      BloxlinkDiscordToRobloxUsageChache.set(DiscordUserId, {
        count: 1,
        last_request: CurrentTime,
      });
    }
  } else {
    BloxlinkDiscordToRobloxUsageChache.set(DiscordUserId, { count: 1, last_request: CurrentTime });
  }

  try {
    const Resp = await Axios.get<Bloxlink.GlobalDiscordToRobloxIdResponse>(
      `https://api.blox.link/v4/public/discord-to-roblox/${DiscordUserId}`,
      {
        headers: { Authorization: Other.BloxlinkAPIKey },
      }
    );

    GlobalRequestCount++;
    return Number(Resp.data.robloxID) || null;
  } catch (Err: any) {
    const ErrorMessage = Err?.response?.data?.error;
    if (Axios.isAxiosError(Err) && (Err.response?.status === 404 || Err.response?.status === 429)) {
      GlobalRequestCount++;
      return null;
    }

    if (Axios.isAxiosError(Err) && Err.response?.status === 400) {
      if (typeof ErrorMessage === "string" && /\bInvalid API Key\b/i.test(ErrorMessage)) {
        AppLogger.warn({
          message:
            "Provided Bloxlink API key is invalid. Make sure it is correct, not expired, and has global access.",
          label: FileLabel,
          stack: Err.stack,
          data: Err.response.data,
          status: Err.response.status,
          api_key: RedactTextByOptions(Other.BloxlinkAPIKey, { from_pattern: /\b\w+$/ }),
        });
      } else {
        AppLogger.warn({
          message: "Bloxlink API returned an error.",
          label: FileLabel,
          stack: Err.stack,
          data: Err.response.data,
          status: Err.response.status,
        });
      }
    } else if (
      Axios.isAxiosError(Err) &&
      Err.response?.status === 401 &&
      typeof ErrorMessage === "string" &&
      /\bGuild ID does not match API Key\b/i.test(ErrorMessage)
    ) {
      AppLogger.warn({
        message:
          "The provided Bloxlink API key has no global access, and is associated with a guild.",
        label: FileLabel,
        stack: Err.stack,
        data: Err.response.data,
        status: Err.response.status,
        api_key: RedactTextByOptions(Other.BloxlinkAPIKey, { from_pattern: /\b\w+$/ }),
      });
    } else {
      AppLogger.error({
        message: "An unexpected error occurred while calling the Bloxlink API",
        label: FileLabel,
        stack: Err.stack,
      });
    }

    return null;
  }
}
