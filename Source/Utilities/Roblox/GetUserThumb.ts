import { Thumbs } from "@Config/Shared.js";
import { APIResponses, APITypes } from "@Typings/External/Roblox.js";
import GetPlaceholderImgURL from "@Utilities/Helpers/GetPlaceholderImg.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Axios from "axios";

const DefaultRetryCount = 2;
const DefaultRetryDelay = 500;
const EndpointMapping = {
  body: { endpoint: "avatar" },
  bust: { endpoint: "avatar-bust" },
  headshot: { endpoint: "avatar-headshot" },
};

type ThumbImgFormat<ImgFormat, CType> = CType extends "bust" ? "png" : ImgFormat;
type ThumbImgSizes<CType extends keyof typeof EndpointMapping> =
  | (CType extends "body" | undefined ? APITypes.Thumbnails.ThumbSizes["body"][number] : never)
  | (CType extends "bust" ? APITypes.Thumbnails.ThumbSizes["bust"][number] : never)
  | (CType extends "headshot" ? APITypes.Thumbnails.ThumbSizes["headshot"][number] : never);

interface GetUserThumbOptions<
  ImageFormat extends APITypes.Thumbnails.ImageFormat | undefined = "png",
  ThumbCropType extends keyof typeof EndpointMapping = "body",
> {
  /**
   * A single user id or an array of user ids to fetch the thumbnail(s) for.
   * If an array, it must be a maximum of `100` user ids and a minimum of `1` user id.
   */
  UserIds: number | number[];

  /**
   * The size of the thumbnail to be returned.
   */
  Size: ThumbImgSizes<ThumbCropType>;

  /**
   * The image format to be returned (image extension); defaults to `png`.
   */
  Format?: ThumbImgFormat<ImageFormat, ThumbCropType>;

  /**
   * The desired crop type of the thumbnail (body, bust, or head-shot); defaults to `body`.
   */
  CropType?: ImageFormat extends "jpeg" ? Exclude<ThumbCropType, "bust"> : ThumbCropType;

  /**
   * Whether the thumbnail should be in a circular shape; defaults to `false`.
   */
  IsCircular?: boolean;

  /**
   * Whether the thumbnail is for a man character; used for fallback placeholders.
   * If not provided, a fallback placeholder without any character details will be returned.
   */
  IsManCharacter?: boolean | null;

  /**
   * Number of retry attempts for pending thumbnails; defaults to 2.
   */
  RetryCount?: number;

  /**
   * Delay in milliseconds between retry attempts; defaults to 500ms.
   */
  RetryDelay?: number;
}

/**
 * **Retrieves and returns desired user thumbnail(s)**.
 * @notice
 * - If provided an array with duplicate user ids, the result array could be disordered.
 * - A fallback placeholder thumbnail will be returned if the API request fails or an error is encountered.
 * - Will retry fetching pending thumbnails for the specified retry count with delays between attempts.
 *
 * @param Options - Configuration object for the thumbnail request
 * @returns A promise that resolves to a single thumbnail URL or an array of thumbnail URLs if `UserIds` is an array.
 *
 * @template UserIdsType - The type of `UserIds` parameter.
 * @template ImageFormat - The image format type of the thumbnail to be returned
 * @template ThumbCropType - The desired crop type of the thumbnail.
 *
 * @example
 * const BodyThumb = await GetUserThumbnail({ UserIds: 1, Size: "352x352" });
 * const BodyThumb = await GetUserThumbnail({ UserIds: 156, Size: "110x110", Format: "jpeg" });
 * const BustThumb = await GetUserThumbnail({ UserIds: 156, Size: "100x100", Format: "png", CropType: "bust" });
 * const CircHeadshotThumbs = await GetUserThumbnail({
 *   UserIds: [156, 157, 1],
 *   Size: "180x180",
 *   Format: "png",
 *   CropType: "headshot",
 *   IsCircular: true,
 *   RetryCount: 3,
 *   RetryDelay: 800
 * });
 */
export default async function GetUserThumbnail<
  UserIdsType extends number | number[] = number,
  ImageFormat extends APITypes.Thumbnails.ImageFormat | undefined = "png",
  ThumbCropType extends keyof typeof EndpointMapping = "body",
>(
  Options: GetUserThumbOptions<ImageFormat, ThumbCropType> & { UserIds: UserIdsType }
): Promise<UserIdsType extends number[] ? string[] : string> {
  const {
    Size,
    UserIds,
    Format = "png",
    CropType = "body",
    IsCircular = false,
    IsManCharacter = null,
    RetryCount = DefaultRetryCount,
    RetryDelay = DefaultRetryDelay,
  } = Options;

  const Endpoint = EndpointMapping[CropType].endpoint;
  const UserIdsArray: number[] = Array.isArray(UserIds) ? [...new Set(UserIds)] : [UserIds];
  if (UserIdsArray.length > 100 || UserIdsArray.length === 0) {
    throw new RangeError(
      `UserIds parameter must be between 1 and 100 entries; received ${UserIdsArray.length}.`
    );
  }

  if (UserIdsArray.length === 1 && UserIdsArray[0] <= 0) {
    return GetFallbackThumbnail(IsManCharacter, Size) as any;
  }

  async function FetchThumbnails(UserIdList: number[]) {
    try {
      const response = await Axios.request<APIResponses.Thumbnails.ThumbnailResponse>({
        url: `/v1/users/${Endpoint}`,
        baseURL: "https://thumbnails.roblox.com",
        params: {
          size: Size,
          format: Format,
          userIds: UserIdList.join(),
          isCircular: IsCircular,
        },
      });

      return response.data.data;
    } catch (Err) {
      AppLogger.error({
        label: "Utilities:Roblox:GetUserThumbnail",
        message: "Failed to fetch user thumbnail(s);",
        stack: (Err as Error).stack,
        details: {
          ...(Err as object),
        },
      });

      return [];
    }
  }

  let ThumbnailData = await FetchThumbnails(UserIdsArray);
  if (RetryCount > 0) {
    let AttemptsLeft = RetryCount;
    while (AttemptsLeft > 0) {
      const PendingUserIds = ThumbnailData.filter((Thumb) => Thumb.state === "Pending").map(
        (Thumb) => Thumb.targetId
      );

      if (PendingUserIds.length === 0) {
        break;
      }

      await DelayExecution(RetryDelay);
      const UpdatedPendingData = await FetchThumbnails(PendingUserIds);

      if (UpdatedPendingData.length > 0) {
        ThumbnailData = ThumbnailData.map(
          (Thumb) =>
            UpdatedPendingData.find((Updated) => Updated.targetId === Thumb.targetId) || Thumb
        );
      }

      AttemptsLeft--;
    }
  }

  const Thumbnails = UserIdsArray.map((UserId) => {
    const Thumb = ThumbnailData.find((data) => data.targetId === UserId);
    if (Thumb?.state === "Completed") {
      return Thumb.imageUrl;
    } else {
      return GetFallbackThumbnail(IsManCharacter, Size);
    }
  });

  if (Array.isArray(UserIds)) {
    return Thumbnails as any;
  } else {
    return Thumbnails[0] as any;
  }
}

function GetFallbackThumbnail(
  IsManCharacter?: boolean | null,
  TargetSize: number | string = 352
): string {
  return typeof IsManCharacter === "boolean"
    ? Thumbs[`RobloxAvatar${IsManCharacter ? "Male" : "Female"}`]
    : GetPlaceholderImgURL(TargetSize as any, "?");
}

function DelayExecution(Ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Ms));
}
