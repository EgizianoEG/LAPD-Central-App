import { defaultComposer } from "default-composer";
import { Guilds, Shifts } from "#Typings/Utilities/Database.js";
import { ShutdownStatus } from "./ProcessShutdownHandler.js";
import { MongoDBCache } from "#Utilities/Helpers/Cache.js";
import { Collection } from "discord.js";
import { MongoDB } from "#Config/Secrets.js";

import ShiftModel, { ShiftFlags } from "#Models/Shift.js";
import MongoDBDocumentCollection from "#Utilities/Classes/MongoDBDocCollection.js";
import Mongoose, { Model } from "mongoose";
import ChangeStreamManager from "#Utilities/Classes/ChangeStreamManager.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import DNS from "node:dns";

// -------------------------------------------------------------------------------------------
// Constants & Setup:
// ------------------
const FileLabel = "Handlers:MongoDB";
const BaseGuildDocument: Guilds.GuildDocument = new GuildModel().toObject();
const TrackedShiftFlags: readonly ShiftFlags[] = [
  ShiftFlags.Standard,
  ShiftFlags.Administrative,
  ShiftFlags.Modified,
];

// eslint-disable-next-line sonarjs/no-hardcoded-ip
DNS.promises.setServers(["1.1.1.1", "8.8.8.8", "8.8.4.4"]);
Mongoose.Schema.Types.String.checkRequired((v: string | null | undefined) => v != null);
// -------------------------------------------------------------------------------------------
// MongoDB Handler:
// ----------------
export default async function MongoDBHandler() {
  const MaxRetries = 3;
  const BaseDelay = 3000;
  const DatabaseURI = MongoDB.URI.replace(
    /<username>:<password>/,
    `${MongoDB.Username}:${MongoDB.UserPass}`
  );

  for (let Attempt = 1; Attempt <= MaxRetries; Attempt++) {
    try {
      await Mongoose.connect(DatabaseURI, {
        dbName: MongoDB.DBName,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        connectTimeoutMS: 10_000,
        retryWrites: true,
        retryReads: true,
      });

      AppLogger.info({
        message: "Connection to MongoDB has been established. Managing '%s'.",
        splat: [MongoDB.DBName],
        label: FileLabel,
        username: MongoDB.Username,
      });

      await ProcessMongoDBChangeStream();
      return;
    } catch (Err: any) {
      const IsLastAttempt = Attempt === MaxRetries;
      const RetryDelay = BaseDelay * 2 ** (Attempt - 1);
      const RetryMessage = IsLastAttempt ? "" : `, retrying in ${RetryDelay}ms`;

      if (Attempt === 1) {
        await LogNetworkDiagnostics(MongoDB.URI);
      }

      AppLogger.error({
        message: `MongoDB connection attempt ${Attempt}/${MaxRetries} failed${RetryMessage};`,
        label: FileLabel,
        db_name: MongoDB.DBName,
        username: MongoDB.Username,
        attempt: Attempt,
        stack: Err.stack,
        error: Err,
      });

      if (IsLastAttempt) {
        await LogNetworkDiagnostics(MongoDB.URI);
        AppLogger.fatal({
          message:
            "Failed to connect to MongoDB after all retry attempts. Application will not function correctly.",
          label: FileLabel,
        });
        throw Err;
      }

      await new Promise((Resolve) => setTimeout(Resolve, RetryDelay));
    }
  }
}

// -------------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
/**
 * Logs network diagnostics related to MongoDB connection failures.
 *
 * This function attempts to extract the hostname from the provided MongoDB URI,
 * then performs DNS resolution and SRV record lookup (if applicable) to gather
 * diagnostic information. The results, including any errors encountered, are
 * logged using the application's logger.
 *
 * @param MongoURI - The MongoDB connection URI to diagnose.
 * @returns A promise that resolves when diagnostics have been logged.
 */
async function LogNetworkDiagnostics(MongoURI: string): Promise<void> {
  const Diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    dns_resolution: null as string | null,
    srv_lookup: null as string | null,
    resolved_hosts: [] as string[],
    error_details: null as string | null,
  };

  try {
    const UriMatch = MongoURI.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^/?]+)/);
    const Hostname = UriMatch?.[1]?.split(",")[0]?.split(":")[0];

    if (!Hostname) {
      Diagnostics.error_details = "Could not parse hostname from URI";
      AppLogger.warn({
        message: "Network diagnostics:",
        label: FileLabel,
        diagnostics: Diagnostics,
      });
      return;
    }

    if (MongoURI.includes("+srv")) {
      try {
        const SrvRecords = await DNS.promises.resolveSrv(`_mongodb._tcp.${Hostname}`);
        Diagnostics.srv_lookup = "success";
        Diagnostics.resolved_hosts = SrvRecords.map((R) => `${R.name}:${R.port}`);
      } catch (SrvErr: any) {
        Diagnostics.srv_lookup = `failed: ${SrvErr.code || SrvErr.message}`;
      }
    }

    try {
      const Addresses = await DNS.promises.resolve4(Hostname);
      Diagnostics.dns_resolution = "success";
      if ((Diagnostics.resolved_hosts as string[]).length === 0) {
        Diagnostics.resolved_hosts = Addresses;
      }
    } catch (DnsErr: any) {
      Diagnostics.dns_resolution = `failed: ${DnsErr.code || DnsErr.message}`;
    }
  } catch (Err: any) {
    Diagnostics.error_details = Err.message;
  }

  AppLogger.warn({
    message: "Network diagnostics during MongoDB connection failure:",
    label: FileLabel,
    diagnostics: Diagnostics,
  });
}

async function ProcessMongoDBChangeStream() {
  return Promise.all([SetupGuildChangeStream(), SetupActiveShiftsChangeStream()]);
}

async function SetupGuildChangeStream() {
  await ReloadGuildCache();

  const GuildStream = new ChangeStreamManager<Guilds.GuildDocument>(
    GuildModel as unknown as Mongoose.Model<Guilds.GuildDocument>,
    {
      LoggerLabel: `${FileLabel}:GuildStream`,
      MaxReconnectAttempts: 8,
    }
  );

  GuildStream.OnChange(async (Change) => {
    if (Change.operationType === "delete") {
      MongoDBCache.Guilds.delete(Change.documentKey._id);
      return;
    }

    if ("fullDocument" in Change && Change.fullDocument !== undefined) {
      MongoDBCache.Guilds.set(
        Change.fullDocument._id,
        defaultComposer<Guilds.GuildDocument>(BaseGuildDocument, Change.fullDocument)
      );
    }
  });

  GuildStream.OnConnected(async (WasResumable) => {
    if (WasResumable === false) {
      await ReloadGuildCache();
    }

    MongoDBCache.StreamChangeConnected.Guilds = true;
  });

  GuildStream.OnDisconnected(() => {
    MongoDBCache.StreamChangeConnected.Guilds = false;
    if (ShutdownStatus.IsShuttingDown) return GuildStream.Stop();
  });

  await GuildStream.Start();
  return GuildStream;
}

async function SetupActiveShiftsChangeStream() {
  await ReloadActiveShiftsCache();
  const ActiveShiftsStream = new ChangeStreamManager<Shifts.ShiftDocument>(
    ShiftModel as unknown as Model<Shifts.ShiftDocument>,
    {
      LoggerLabel: `${FileLabel}:ActiveShiftsStream`,
      MaxReconnectAttempts: 8,
    }
  );

  ActiveShiftsStream.OnChange(async (Change) => {
    if (Change.operationType === "delete") {
      MongoDBCache.ActiveShifts.delete(Change.documentKey._id);
      return;
    }

    if ("fullDocument" in Change && Change.fullDocument !== undefined) {
      if (!TrackedShiftFlags.includes(Change.fullDocument.flag as ShiftFlags)) return;
      if (Change.fullDocument.end_timestamp === null) {
        MongoDBCache.ActiveShifts.set(Change.fullDocument._id, Change.fullDocument);
      } else {
        MongoDBCache.ActiveShifts.delete(Change.fullDocument._id);
      }
    }
  });

  ActiveShiftsStream.OnConnected(async (WasResumable) => {
    if (WasResumable === false) {
      await ReloadActiveShiftsCache();
    }

    MongoDBCache.StreamChangeConnected.ActiveShifts = true;
  });

  ActiveShiftsStream.OnDisconnected(() => {
    MongoDBCache.StreamChangeConnected.ActiveShifts = false;
    if (ShutdownStatus.IsShuttingDown) return ActiveShiftsStream.Stop();
  });

  await ActiveShiftsStream.Start();
  return ActiveShiftsStream;
}

async function ReloadGuildCache() {
  const InitialRunGuildDocuments = await GuildModel.find().lean().exec();
  MongoDBCache.Guilds = new Collection<string, Guilds.GuildDocument>(
    InitialRunGuildDocuments.map((Doc) => [
      Doc._id,
      defaultComposer<Guilds.GuildDocument>(BaseGuildDocument, Doc as Guilds.GuildDocument),
    ])
  );

  AppLogger.debug({
    message: "Guild cache loaded from database.",
    label: FileLabel,
  });
}

async function ReloadActiveShiftsCache() {
  const InitialRunShiftDocuments = await ShiftModel.find({
    flag: { $in: TrackedShiftFlags },
    end_timestamp: null,
  })
    .lean()
    .exec();

  MongoDBCache.ActiveShifts = new MongoDBDocumentCollection<
    string,
    Shifts.ShiftDocument,
    Shifts.BasicHydratedShiftDocument
  >(
    ShiftModel,
    InitialRunShiftDocuments.map((Doc) => [Doc._id, Doc] as [string, Shifts.ShiftDocument])
  );

  AppLogger.debug({
    message: "Active shifts cache loaded from database.",
    label: FileLabel,
  });
}
