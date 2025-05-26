import { JestConfigWithTsJest, pathsToModuleNameMapper } from "ts-jest";
import FileSystem from "node:fs";

/** @type {typeof import("./tsconfig.json")} */
const BaseTsConfig = JSON.parse(
  FileSystem.readFileSync("./tsconfig.json", { encoding: "utf8" }).replace(/^\s+\/\*.+\*\/$/gm, "")
);

const JestConfig: JestConfigWithTsJest = {
  verbose: true,
  preset: "ts-jest/presets/default-esm",
  roots: ["<rootDir>"],

  coverageDirectory: "Coverage",
  modulePaths: ["<rootDir>"],
  moduleDirectories: ["node_modules", "<rootDir>/Source"],
  moduleFileExtensions: ["ts", "js", "json"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(BaseTsConfig.compilerOptions.paths, {
      prefix: "<rootDir>",
      useESM: true,
    }),
  },

  transformIgnorePatterns: ["/node_modules/(?!chalk|ansi-styles)/.+\\.js$"],
  transform: {
    "\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./Tests/tsconfig.json",
        useESM: true,
      },
    ],
  },
};

export default JestConfig;
