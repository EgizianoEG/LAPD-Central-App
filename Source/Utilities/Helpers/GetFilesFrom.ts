import FileSystem from "node:fs";
import Path from "node:path";

/**
 * Returns an array of full string paths inside a directory
 * @param Directory - The directory to get its file paths from
 * @param FoldersOnly - Whether to only return folder paths inside the given directory or not
 * @requires {@link Path.join `Path.join()`}, {@link Path.extname `Path.extname()`}, and {@link FileSystem.readdirSync `Path.readdirSync()`}
 * @returns
 */
export default function GetFilesFrom(Directory: string, FoldersOnly: boolean = false) {
  const Files = FileSystem.readdirSync(Directory, { withFileTypes: true });
  const Paths: string[] = [];

  for (const File of Files) {
    const FilePath = Path.join(Directory, File.name);
    const ExtName = Path.extname(File.name);

    if (FoldersOnly) {
      if (File.isDirectory()) {
        Paths.push(FilePath);
      }
    } else if (File.isFile() && (ExtName === ".js" || ExtName === ".ts")) {
      Paths.push(`file:${Path.sep.repeat(2)}${FilePath}`);
    }
  }

  return Paths;
}
