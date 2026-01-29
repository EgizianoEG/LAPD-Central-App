import { mongo } from "mongoose";
import { Guilds } from "#Typings/Utilities/Database.js";
import GuildModel from "#Models/Guild.js";
import AppError from "../Classes/AppError.js";
import GetGuildSettings from "./GetGuildSettings.js";

/**
 * Creates a new shift type for the given guild
 * @param Data The shift type data
 * @returns The shift type after being saved if creation succeeded or an `AppError` instance if there was an exception (would be thrown if the exception was from the database)
 */
export default async function CreateShiftType(Data: Guilds.CreateShiftTypeConfig) {
  const GuildSettings = await GetGuildSettings(Data.guild_id);
  const ShiftTypeExists = GuildSettings?.shift_management.shift_types.some(
    (ShiftType) => ShiftType.name === Data.name
  );

  if (!GuildSettings) {
    throw new AppError({
      template: "GuildConfigNotFound",
      showable: true,
    });
  }

  if (ShiftTypeExists) {
    return new AppError({
      template: "ShiftTypeAlreadyExists",
      showable: true,
    });
  } else if (GuildSettings.shift_management.shift_types.length > 9) {
    return new AppError({
      template: "MaximumShiftTypesReached",
      showable: true,
    });
  } else {
    const NewShiftType = {
      _id: new mongo.ObjectId(),
      name: Data.name,
      is_default: Data.is_default ?? false,
      access_roles: Data.access_roles ?? [],
      created_on: Data.created_on ?? new Date(),
    };

    if (Data.is_default) {
      await GuildModel.updateOne(
        { _id: Data.guild_id },
        {
          $set: {
            "settings.shift_management.shift_types.$[].is_default": false,
          },
        }
      );
    }

    const UpdateOps = {
      $push: {
        "settings.shift_management.shift_types": NewShiftType,
      },
    };

    return GuildModel.findOneAndUpdate({ _id: Data.guild_id }, UpdateOps, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).then(() => NewShiftType);
  }
}
