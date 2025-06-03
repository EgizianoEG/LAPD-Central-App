import { Other } from "@Config/Secrets.js";
import { ImgBB } from "@Typings/Utilities/APIResponses.js";
import Axios from "axios";
const ExtractRegex = /^https?:\/\/\w+\.com?\/(\w+)\/(\w+)$/i;

/**
 * Deletes an image from ImgBB based on a delete url.
 * @param ImgDeleteURL - The image delete url returned when it was uploaded.
 * @param SilenceErrors - Whether to silence errors and return `null` if the delete fails.
 * @returns
 */
export default async function DeleteFromImgBB(
  ImgDeleteURL: string,
  SilenceErrors: boolean = false
): Promise<ImgBB.ImageDelete | null> {
  const [, DelId, DelHash] = ImgDeleteURL.match(ExtractRegex) || [];
  if (!DelId || !DelHash) throw new Error("Unknown ImgBB delete url format.");

  const Payload = new FormData();
  Payload.append("auth_token", Other.ImgBB_API_Key);
  Payload.append("action", "delete");
  Payload.append("delete", "image");
  Payload.append("deleting[id]", DelId);
  Payload.append("deleting[hash]", DelHash);

  return Axios.post<ImgBB.ImageDelete>("https://ibb.co/json", Payload)
    .then((Resp) => Resp.data)
    .catch((Err) => {
      if (SilenceErrors) return null;
      else throw Err;
    });
}
