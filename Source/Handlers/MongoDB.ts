import { defaultComposer } from "default-composer";
import { Guilds, Shifts } from "#Typings/Utilities/Database.js";
import { MongoDBCache } from "#Utilities/Helpers/Cache.js";
import { Collection } from "discord.js";
import { MongoDB } from "#Config/Secrets.js";

import ShiftModel, { ShiftFlags } from "#Models/Shift.js";
import MongoDBDocumentCollection from "#Utilities/Classes/MongoDBDocCollection.js";
import ChangeStreamManager from "#Utilities/Classes/ChangeStreamManager.js";
import GuildModel from "#Models/Guild.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import Mongoose from "mongoose";

const FileLabel = "Handlers:MongoDB";
const BaseGuildDocument: Guilds.GuildDocument = new GuildModel().toObject();
const TrackedShiftFlags: readonly ShiftFlags[] = [
  ShiftFlags.Standard,
  ShiftFlags.Administrative,
  ShiftFlags.Modified,
];

Mongoose.Schema.Types.String.checkRequired((v: string | null | undefined) => v != null);
export default async function MongoDBHandler() {
  const MaxRetries = 8;
  const BaseDelay = 2500;
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
  });

  await GuildStream.Start();
  return GuildStream;
}

async function SetupActiveShiftsChangeStream() {
  await ReloadActiveShiftsCache();
  const ActiveShiftsStream = new ChangeStreamManager<Shifts.ShiftDocument>(ShiftModel, {
    LoggerLabel: `${FileLabel}:ActiveShiftsStream`,
    MaxReconnectAttempts: 8,
  });

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
    Shifts.HydratedShiftDocument
  >(
    ShiftModel,
    InitialRunShiftDocuments.map((Doc) => [Doc._id, Doc] as [string, Shifts.ShiftDocument])
  );

  AppLogger.debug({
    message: "Active shifts cache loaded from database.",
    label: FileLabel,
  });
}
