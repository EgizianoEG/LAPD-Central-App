import { MongoDBCache } from "@Utilities/Helpers/Cache.js";
import { Collection } from "discord.js";
import { MongoDB } from "@Config/Secrets.js";
import { Guilds, Shifts } from "@Typings/Utilities/Database.js";
import ShiftModel, { ShiftFlags } from "@Models/Shift.js";
import ChangeStreamManager from "@Utilities/Classes/ChangeStreamManager.js";
import GuildModel from "@Models/Guild.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Mongoose from "mongoose";
import MongoDBDocumentCollection from "@Utilities/Classes/MongoDBDocCollection.js";

const FileLabel = "Handlers:MongoDB";
const BaseGuildDocument: Guilds.GuildDocument = new GuildModel().toObject();

export default async function MongoDBHandler() {
  const DatabaseURI = MongoDB.URI.replace(
    /<username>:<password>/,
    `${MongoDB.Username}:${MongoDB.UserPass}`
  );

  try {
    await Mongoose.connect(DatabaseURI, {
      dbName: MongoDB.DBName,
    });

    AppLogger.info({
      message: "Connection to MongoDB has been established.",
      label: FileLabel,
      db_name: MongoDB.DBName,
      username: MongoDB.Username,
    });

    await ProcessMongoDBChangeStream();
  } catch (Err: any) {
    AppLogger.error({
      message: "An error occurred while connecting to MongoDB;",
      label: FileLabel,
      db_name: MongoDB.DBName,
      username: MongoDB.Username,
      stack: Err.stack,
      error: { ...Err },
    });
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
      MongoDBCache.Guilds.set(Change.fullDocument._id, {
        ...BaseGuildDocument,
        ...Change.fullDocument,
      });
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
      if (Change.fullDocument.flag !== ShiftFlags.Standard) return;
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

  await ActiveShiftsStream.Start([
    {
      $match: {
        "fullDocument.flag": ShiftFlags.Standard,
      },
    },
  ]);

  return ActiveShiftsStream;
}

async function ReloadGuildCache() {
  const InitialRunGuildDocuments = await GuildModel.find().lean().exec();
  MongoDBCache.Guilds = new Collection<string, Guilds.GuildDocument>(
    InitialRunGuildDocuments.map(
      (Doc) => [Doc._id, { ...BaseGuildDocument, ...Doc }] as [string, Guilds.GuildDocument]
    )
  );

  AppLogger.debug({
    message: "Guild cache loaded from database.",
    label: FileLabel,
  });
}

async function ReloadActiveShiftsCache() {
  const InitialRunShiftDocuments = await ShiftModel.find({
    flag: ShiftFlags.Standard,
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
