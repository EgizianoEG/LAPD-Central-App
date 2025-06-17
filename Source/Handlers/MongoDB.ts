import { MongoDBCache } from "@Utilities/Helpers/Cache.js";
import { Collection } from "discord.js";
import { MongoDB } from "@Config/Secrets.js";
import { Guilds } from "@Typings/Utilities/Database.js";
import GuildModel from "@Models/Guild.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Mongoose from "mongoose";

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

    await ProcessMongoDBChangeStream().catch((Err: any) => {
      AppLogger.error({
        message: "An error occurred while handling MongoDB change streams.",
        label: FileLabel,
        db_name: MongoDB.DBName,
        username: MongoDB.Username,
        stack: Err.stack,
        error: {
          ...Err,
        },
      });
    });
  } catch (Err: any) {
    AppLogger.error({
      message: "An error occurred while connecting to MongoDB;",
      label: FileLabel,
      db_name: MongoDB.DBName,
      username: MongoDB.Username,
      stack: Err.stack,
      error: {
        ...Err,
      },
    });
  }
}

async function ProcessMongoDBChangeStream() {
  await SetupGuildCacheWithChangeStream();
}

async function SetupGuildCacheWithChangeStream() {
  await ReloadGuildCache();
  let ChangeStream: Mongoose.mongo.ChangeStream<Guilds.GuildDocument> | null = null;

  const StartChangeStream = () => {
    ChangeStream = GuildModel.watch<
      Guilds.GuildDocument,
      Mongoose.mongo.ChangeStreamDocument<Guilds.GuildDocument>
    >([], {
      fullDocument: "updateLookup",
    });

    ChangeStream.on("change", (Change) => {
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

    ChangeStream.on("error", async (Err) => {
      MongoDBCache.StreamChangeConnected.Guilds = false;
      AppLogger.error({
        message: "MongoDB Guild collection ChangeStream error. Attempting to reconnect...",
        label: FileLabel,
        stack: Err.stack,
        error: { ...Err },
      });

      if (ChangeStream) {
        await ChangeStream.close().catch(() => null);
        ChangeStream = null;
      }

      setTimeout(async () => {
        await ReloadGuildCache();
        StartChangeStream();
      }, 3000);
    });

    ChangeStream.on("close", async () => {
      MongoDBCache.StreamChangeConnected.Guilds = false;
      AppLogger.debug({
        message: "MongoDB Guild collection ChangeStream closed. Attempting to reconnect...",
        label: FileLabel,
      });

      if (ChangeStream) {
        await ChangeStream.close().catch(() => null);
        ChangeStream = null;
      }

      setTimeout(async () => {
        await ReloadGuildCache();
        StartChangeStream();
      }, 3000);
    });

    ChangeStream.on("end", async () => {
      MongoDBCache.StreamChangeConnected.Guilds = false;
      AppLogger.debug({
        message: "MongoDB Guild collection ChangeStream ended. Attempting to reconnect...",
        label: FileLabel,
      });

      if (ChangeStream) {
        await ChangeStream.close().catch(() => null);
        ChangeStream = null;
      }

      setTimeout(async () => {
        await ReloadGuildCache();
        StartChangeStream();
      }, 3000);
    });
  };

  StartChangeStream();
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
