import { LogtailTransport } from "@logtail/winston";
import { OmitByValue } from "utility-types";
import { Logtail } from "@logtail/node";
import { Other } from "@Config/Secrets.js";

import SplatFormat from "./Splatter.js";
import Winston from "winston";
import Chalk from "chalk";
import Util from "node:util";

// --------------------------------------------------------------------------------------
type CustomLogger<Levels> = OmitByValue<Winston.Logger, Winston.LeveledLogMethod> & {
  readonly [Level in keyof Levels]: Winston.LeveledLogMethod;
} & { log(level: keyof Levels, message: any): Winston.Logger };

const LogLevel = process.env.LOG_LEVEL?.toLowerCase() || "info";
const LogLabels = Boolean(process.env.LOG_LABELS);
const LevelsData = {
  Levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    metrics: 5,
  },
  Colors: {
    fatal: "black redBG",
    error: "red",
    warn: "yellow",
    info: "blue",
    debug: "cyan",
    metrics: "green",
  },
};

const Format = Winston.format;
const Transports = Winston.transports;
const ColorizeLevel = Format.colorize({ colors: LevelsData.Colors }).colorize;
const IgnorePrivateLogs = Format((Msg) => (Msg.private ? false : Msg));
const IgnoreSpecificConsoleLogs = Format((Msg) =>
  Msg.ignore_console || Msg.level === "metrics" ? false : Msg
);

// --------------------------------------------------------------------------------------
// Custom Formatters:
// ------------------
const FlattenLogMetadata = Format(
  (Info: Winston.Logform.TransformableInfo): Winston.Logform.TransformableInfo => {
    function FlattenDetails(Obj: any): any {
      if (typeof Obj !== "object" || Obj === null) {
        return Obj;
      }

      if ("details" in Obj && typeof Obj.details === "object") {
        Obj = { ...Obj, ...Obj.details };
        delete Obj.details;
        Obj = FlattenDetails(Obj);
      }

      return Obj;
    }

    if ("details" in Info && Info.details !== null) {
      Info.details = FlattenDetails(Info.details);
    }

    if ("metadata" in Info && Info.metadata !== null) {
      Info.metadata = FlattenDetails(Info.metadata);
    }

    return Info;
  }
);

const EliminateCircularRefs = Format(
  (Info: Winston.Logform.TransformableInfo): Winston.Logform.TransformableInfo => {
    const Seen = new WeakSet();
    function SanitizeCircular(Obj: any, Path: string[] = []): any {
      if (typeof Obj !== "object" || Obj === null) {
        return Obj;
      }

      if (Seen.has(Obj)) {
        return "[Circular Reference]";
      }

      Seen.add(Obj);
      if (Array.isArray(Obj)) {
        const Result: any[] = [];
        for (let i = 0; i < Obj.length; i++) {
          Result[i] = SanitizeCircular(Obj[i], [...Path, i.toString()]);
        }
        return Result;
      }

      const Result: Record<string, any> = {};
      for (const Key of Object.keys(Obj)) {
        if (typeof Obj[Key] !== "function" && typeof Obj[Key] !== "symbol") {
          Result[Key] = SanitizeCircular(Obj[Key], [...Path, Key]);
        }
      }

      return Result;
    }

    const CleanedInfo = SanitizeCircular(Info);
    return CleanedInfo;
  }
);

const FormatLogEntry = (Info: Winston.Logform.TransformableInfo): string => {
  let Description: string = String(Info.message);
  const Metadata: Record<string, any> = Info.metadata ?? {};
  const ErrorStack: string | undefined = Info.stack ?? Metadata.stack;
  const Timestamp: string = Info.timestamp ?? Metadata.timestamp;
  const LogLabel: string | undefined = LogLabels ? (Info.label ?? Metadata.label) : null;

  if (ErrorStack && Metadata.stack) {
    Metadata.stack = ErrorStack.replace(
      /(at .+ )\((.+:\d+:\d+)\)/g,
      (_, AtText: string, FilePath: string) => {
        if (!FilePath.startsWith("node:")) FilePath = `file:///${FilePath}`;
        FilePath = FilePath.replace(/[\\/]/g, process.platform === "win32" ? "/" : "\\");
        FilePath = FilePath.replaceAll(" ", "%20").replace(/:(\d+):(\d+)/g, (_, N1, N2) => {
          const Colon = Chalk.white(":");
          return `${Colon}${Chalk.yellow(N1)}${Colon}${Chalk.yellow(N2)}`;
        });

        return `${AtText}(${Chalk.cyan.dim(FilePath)})`;
      }
    );

    if (Metadata.title) {
      Description = `${Metadata.title}; ${Info.message}\n    ${Metadata.stack}`;
    } else {
      Description = `${Info.message}\n    ${Metadata.stack}`;
    }
  }

  return Util.format(
    "%s %s%s: %s",
    Chalk.gray(`[${Timestamp}]`),
    LogLabel ? Chalk.grey(`[${LogLabel}] `) : "",
    ColorizeLevel(Info.level, Info.level.toUpperCase()),
    Description
  );
};

// --------------------------------------------------------------------------------------
// Logger Instance:
// ----------------
Winston.addColors(LevelsData.Colors);
const AppLogger = Winston.createLogger({
  level: LogLevel,
  levels: LevelsData.Levels,
  format: Format.errors({ stack: true }),
  transports: [
    new Transports.Console({
      format: Format.combine(
        IgnoreSpecificConsoleLogs(),
        SplatFormat({ colors: true }),
        Format.timestamp({ format: "hh:mm:ss A" }),
        Format.metadata(),
        Format.printf(FormatLogEntry)
      ),
    }),
  ],
}) as unknown as CustomLogger<typeof LevelsData.Levels>;

// --------------------------------------------------------------------------------------
// Cloud Logging on Production:
// ----------------------------
if (Other.IsProdEnv && Other.LogTailSourceToken && Other.LogTailIngestingHost) {
  const LogTailInst = new Logtail(Other.LogTailSourceToken, {
    endpoint: Other.LogTailIngestingHost,
    batchInterval: 2500,
    syncMax: 8,
  });

  AppLogger.add(
    new LogtailTransport(LogTailInst, {
      level: LogLevel,
      format: Format.combine(
        IgnorePrivateLogs(),
        SplatFormat({ colors: true }),
        EliminateCircularRefs(),
        Format.metadata({ key: "details" }),
        FlattenLogMetadata(),
        Format.json({ space: 2 })
      ),
    })
  );
}

// --------------------------------------------------------------------------------------
export type LogLevels = typeof LevelsData.Levels;
export default AppLogger;
