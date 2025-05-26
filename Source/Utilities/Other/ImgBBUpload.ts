import { ImgBB } from "@Typings/Utilities/APIResponses.js";
import { Other } from "@Config/Secrets.js";
import Axios from "axios";

/**
 * Uploads an image to ImgBB.
 * @param Img - The image buffer to upload.
 * @param ImgName - Optional name for the image.
 * @param Expiration - Optional expiration time for the image in seconds.
 * Value must be between 60 and 15552000 seconds as specified by ImgBB.
 *
 * @returns The direct URL of the uploaded image, or `null` if the upload fails.
 */
export default async function UploadToImgBB(
  Img: Buffer,
  ImgName?: string,
  Expiration?: number
): Promise<string | null> {
  if (Expiration && (Expiration < 60 || Expiration > 15_552_000)) {
    throw new RangeError("Expiration must be between 60 and 15,552,000 seconds.");
  }

  const Payload = new FormData();
  Payload.append("image", Img.toString("base64"));

  return Axios.post<ImgBB.ImageUpload>("https://api.imgbb.com/1/upload", Payload, {
    params: {
      key: Other.ImgBB_API_Key,
      name: ImgName,
      expiration: Expiration,
    },
  })
    .then((Resp) => Resp.data?.data.url ?? Resp.data?.data.display_url ?? null)
    .catch(() => null);
}
