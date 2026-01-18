import { APIResponses, OpenCloud } from "#Typings/External/Roblox.js";
import { RobloxOpenCloudV2Routes } from "#Config/Constants.js";
import { Roblox } from "#Config/Secrets.js";
import Noblox from "noblox.js";
import Axios from "axios";

const NonexistentUserIdInfo: APIResponses.Users.GetUserResponse = {
  id: 0,
  name: "000",
  displayName: "000",
  created: new Date(),
  description: "",
  isBanned: true,
  hasVerifiedBadge: false,
  externalAppDisplayName: null,
};

/**
 * Retrieves the player information from the Roblox API.
 * @param UserId - The Id of the user. Must be a valid Id to avoid errors. Use `0` for nonexistent user to return a placeholder info.
 * @return A promise that resolves to the user profile details.
 */
export default async function GetUserInfo(
  UserId: number | string
): Promise<APIResponses.Users.GetUserResponse | OpenCloud.V2.Users.GetUserResponse> {
  if (Number(UserId) === 0) return NonexistentUserIdInfo;
  return OpenCloudV2UserInfo(Number(UserId)).catch(() => Noblox.getUserInfo(Number(UserId)));
}

async function OpenCloudV2UserInfo(UserId: number) {
  const Resp = await Axios.get<OpenCloud.V2.Users.GetUserResponse>(
    RobloxOpenCloudV2Routes.GetUser(UserId),
    {
      timeout: 10_000,
      headers: {
        "x-api-key": Roblox.CloudKey,
      },
    }
  );

  return Resp.data;
}
