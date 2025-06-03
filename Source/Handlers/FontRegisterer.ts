import { GlobalFonts } from "@napi-rs/canvas/index.js";
import { GetDirName } from "@Utilities/Helpers/Paths.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Path from "node:path";

export default function FontRegisters() {
  const FontsLoaded = GlobalFonts.loadFontsFromDir(
    Path.join(GetDirName(import.meta.url), "..", "Resources", "Fonts")
  );

  AppLogger.debug({
    message: "Successfully registered %o custom fonts for '@napi-rs/canvas' library.",
    label: "Handlers:FontRegisterer",
    splat: [FontsLoaded],
  });
}
