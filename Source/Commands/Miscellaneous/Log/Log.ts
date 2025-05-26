import { Shifts } from "@Typings/Utilities/Database.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  SlashCommandBuilder,
  InteractionContextType,
  AutocompleteInteraction,
  ApplicationIntegrationType,
  ApplicationCommandOptionChoiceData,
} from "discord.js";

import AutocompleteIncidentType from "@Utilities/Autocompletion/IncidentType.js";
import AutocompleteUsername from "@Utilities/Autocompletion/Username.js";
import AutocompleteVehicle from "@Utilities/Autocompletion/Vehicle.js";
import AutocompleteHeight from "@Utilities/Autocompletion/Height.js";
import AutocompleteWeight from "@Utilities/Autocompletion/Weight.js";
import AutocompleteColor from "@Utilities/Autocompletion/Color.js";
import IsModuleEnabled from "@Utilities/Database/IsModuleEnabled.js";
import GetShiftActive from "@Utilities/Database/GetShiftActive.js";
import GetRobloxUserLinked from "@Utilities/Database/IsUserLoggedIn.js";

const Subcommands = [
  (await import("./Deps/CitFine.js")).default,
  (await import("./Deps/CitWarn.js")).default,
  (await import("./Deps/Arrest.js")).default,
  (await import("./Deps/Incident.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Validates an interaction before the command is executed.
 * @param Interaction - The interaction to validate.
 * @returns If the interaction was handled, returns an object with `RobloxId`
 * and `ActiveShift` for additional processing; otherwise returns `false`.
 */
async function HandleInteractValidation(Interaction: SlashCommandInteraction<"cached">) {
  const ModuleEnabled = await IsModuleEnabled(Interaction.guildId, "duty_activities");
  let IsHandled = false;

  if (ModuleEnabled === false) {
    IsHandled = true;
    await new ErrorEmbed()
      .useErrTemplate("DutyActivitiesModuleDisabled")
      .replyToInteract(Interaction, true, true);
  }

  const HasRobloxLinked = await GetRobloxUserLinked(Interaction);
  if (!HasRobloxLinked) {
    IsHandled = true;
    await new ErrorEmbed()
      .useErrTemplate("RobloxUserNotLinked")
      .replyToInteract(Interaction, true, true);
  }

  const ActiveShift = await GetShiftActive({ Interaction, UserOnly: true });
  // Functionality is unnecessary at the moment.
  // if (!HasActiveShift) {
  //   IsHandled = true;
  //   await new ErrorEmbed()
  //     .setTitle(ErrorMessages.ShiftMustBeActive.Title)
  //     .setDescription(ErrorMessages.ShiftMustBeActive.Description)
  //     .replyToInteract(Interaction, true, true);
  // }

  return IsHandled
    ? null
    : {
        ActiveShift,
        RobloxUserId: HasRobloxLinked,
      };
}

/**
 * @param _
 * @param Interaction
 */
async function Callback(_: DiscordClient, Interaction: SlashCommandInteraction<"cached">) {
  const UserData = await HandleInteractValidation(Interaction);
  if (!UserData) return;
  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === Interaction.options.getSubcommand()) {
      if (typeof Subcommand.callback === "function") {
        return Subcommand.callback(Interaction, UserData);
      } else {
        continue;
      }
    }
  }
}

/**
 * @param Interaction
 * @returns
 */
async function Autocomplete(Interaction: AutocompleteInteraction) {
  const SubCmdName = Interaction.options.getSubcommand();
  const { name, value } = Interaction.options.getFocused(true);
  let Suggestions: ApplicationCommandOptionChoiceData[] = [];

  if (name === "name") {
    Suggestions = await AutocompleteUsername(value);
  } else if (name === "height") {
    Suggestions = AutocompleteHeight(value);
  } else if (name === "weight") {
    Suggestions = AutocompleteWeight(value);
  } else if (name === "type" && SubCmdName === "incident") {
    Suggestions = await AutocompleteIncidentType(value);
  } else if (name === "color" || name === "vehicle-color") {
    Suggestions = AutocompleteColor(value);
  } else if (name === "vehicle" || name === "vehicle-model") {
    Suggestions = AutocompleteVehicle(value);
  }

  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  options: { cooldown: 10, user_perms: { staff: true } },
  callback: Callback,
  autocomplete: Autocomplete,
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("Logs a particular information into the database.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(Subcommands[0].data)
    .addSubcommand(Subcommands[1].data)
    .addSubcommand(Subcommands[2].data)
    .addSubcommand(Subcommands[3].data),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
export interface ReporterInfo {
  ActiveShift: Shifts.HydratedShiftDocument | null;
  RobloxUserId: number;
}
