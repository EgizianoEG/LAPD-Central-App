import { MongoDB } from "@Config/Secrets.js";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import Mongoose from "mongoose";

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
      label: "Handlers:MongoDB",
      db_name: MongoDB.DBName,
      username: MongoDB.Username,
    });
  } catch (Err: any) {
    AppLogger.error({
      message: "An error occurred while connecting to MongoDB;",
      label: "Handlers:MongoDB",
      db_name: MongoDB.DBName,
      username: MongoDB.Username,
      stack: Err.stack,
      error: {
        ...Err,
      },
    });
  }
}
