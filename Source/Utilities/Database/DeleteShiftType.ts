import GuildModel from "@Models/Guild.js";
import AppError from "../Classes/AppError.js";
import GetGuildSettings from "./GetGuildSettings.js";

/**
 * Deletes a specified shift type from the guild ID given.
 *
 * @param Name - The name of the shift type to delete.
 * @param GuildId - The ID of the guild where the shift type is to be deleted.
 * @returns A promise that resolves to the result of the deletion operation.
 * @example
 * // Example usage:
 * try {
 *   const result = await DeleteShiftType("Night Shift", "123456789012345678");
 *
 *   // deletion was successful
 *   console.log("Shift type deleted successfully:", result.settings);
 * } catch (error) {
 *   // Server error:
 *   if (error instanceof AppError) {
 *     console.error("Error deleting shift type:", error.title, error.message);
 *   } else {
 *     console.error("Unexpected error:", error);
 *   }
 * }
 */
export default async function DeleteShiftType(Name: string, GuildId: string) {
  const GuildSettings = await GetGuildSettings(GuildId);
  const ShiftTypeIndex =
    GuildSettings?.shift_management.shift_types.findIndex((ShiftType) => ShiftType.name === Name) ??
    -1;

  if (!GuildSettings) {
    throw new AppError({
      template: "GuildConfigNotFound",
      showable: true,
    });
  }

  if (ShiftTypeIndex === -1) {
    throw new AppError({
      template: "NonexistentShiftTypeDeletion",
      showable: true,
    });
  } else {
    const Result = await GuildModel.updateOne(
      { _id: GuildId },
      { $pull: { "settings.shift_management.shift_types": { name: Name } } },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    if (Result.modifiedCount === 0) {
      throw new AppError({
        template: "ShiftTypeDeletionFailed",
        template_args: [Name],
        showable: true,
      });
    }

    return Result;
  }
}
