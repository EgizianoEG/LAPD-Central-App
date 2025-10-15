import { GlobalFonts } from "@napi-rs/canvas/index.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Path from "node:path";

export default function FontRegisters() {
  const FontsLoaded = GlobalFonts.loadFontsFromDir(
    Path.join(import.meta.dirname, "..", "Resources", "Fonts")
  );

  AppLogger.debug({
    message: "Successfully registered %o custom fonts for '@napi-rs/canvas' library.",
    label: "Handlers:FontRegisterer",
    splat: [FontsLoaded],
  });
}
