import { UserHasPermsV2 } from "@Utilities/Database/UserHasPermissions.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  SlashCommandBuilder,
  InteractionContextType,
  AutocompleteInteraction,
  ApplicationIntegrationType,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import DutyTypesSubcommandGroup from "./Duty Types/Main.js";
import AutocompleteShiftType from "@Utilities/Autocompletion/ShiftType.js";
import HasRobloxLinked from "@Utilities/Database/IsUserLoggedIn.js";
import IsModuleEnabled from "@Utilities/Database/IsModuleEnabled.js";

const Subcommands = [
  (await import("./Subcmds/Void.js")).default,
  (await import("./Subcmds/Admin.js")).default,
  (await import("./Subcmds/Manage.js")).default,
  (await import("./Subcmds/Active.js")).default,
  (await import("./Subcmds/EndAll.js")).default,
  (await import("./Subcmds/Import.js")).default,
  (await import("./Subcmds/Leaderboard.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Authorize a management slash command usage; returns `true` is it is authorized or `false` otherwise.
 * Users may not utilize the `duty manage` subcommand if they have no linked Roblox account.
 * @param Interaction
 */
async function IsAuthorizedCmdUsage(Interaction: SlashCommandInteraction<"cached">) {
  const SubcmdName = Interaction.options.getSubcommand();
  const ModuleEnabled = await IsModuleEnabled(Interaction.guildId, "shift_management");

  if (ModuleEnabled === false) {
    return new ErrorEmbed()
      .useErrTemplate("ShiftManagementModuleDisabled")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  if (SubcmdName === "manage") {
    const LinkedRobloxUser = await HasRobloxLinked(Interaction);
    if (!LinkedRobloxUser) {
      return new ErrorEmbed()
        .useErrTemplate("SMRobloxUserNotLinked")
        .replyToInteract(Interaction, true)
        .then(() => false);
    }
  }

  return true;
}

/**
 * @param Client
 * @param Interaction
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const SubCommandName = Interaction.options.getSubcommand();
  const SubCommandGroupName = Interaction.options.getSubcommandGroup();

  if (!(await IsAuthorizedCmdUsage(Interaction))) return;
  for (const SubCommand of Subcommands) {
    if (SubCommand.data.name === SubCommandName && typeof SubCommand.callback === "function") {
      return (SubCommand.callback as AnySlashCmdCallback)(Interaction);
    }
  }

  if (SubCommandGroupName === "types" && typeof DutyTypesSubcommandGroup.callback === "function") {
    return (DutyTypesSubcommandGroup.callback as AnySlashCmdCallback)(Interaction);
  }
}

/**
 * @param Interaction
 * @return
 */
async function Autocomplete(Interaction: AutocompleteInteraction<"cached">) {
  const { name, value } = Interaction.options.getFocused(true);
  const SubcommandGroup = Interaction.options.getSubcommandGroup();
  const SubcommandName = Interaction.options.getSubcommand();

  if (
    ["type", "shift-type"].includes(name) ||
    (name === "name" &&
      SubcommandGroup === "types" &&
      SubcommandName === "delete" &&
      (await UserHasPermsV2(Interaction.user.id, Interaction.guildId, { management: true }, true)))
  ) {
    const ShiftTypeSuggestions = await AutocompleteShiftType(value, Interaction.guildId);
    return Interaction.respond(ShiftTypeSuggestions);
  } else {
    return Interaction.respond([{ name: "[Unauthorized]", value: "0" }]);
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  autocomplete: Autocomplete,
  options: {
    cooldown: {
      $all_other: 2.5,
      leaderboard: 5,
      active: 5,
      import: {
        $user: { cooldown: 60, timeframe: 30 * 60, max_executions: 2 },
        $guild: { cooldown: 15, timeframe: 60 * 60, max_executions: 6 },
      },
    },
    user_perms: {
      types: { management: true },
      admin: { management: true },
      import: { management: true },
      $all_other: { staff: true },
      "end-all": { management: true },
    },
  },

  data: new SlashCommandBuilder()
    .setName("duty")
    .setDescription("Duty and shifts related actions.")
    .addSubcommandGroup(DutyTypesSubcommandGroup.data)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

for (const SubCommand of Subcommands) {
  CommandObject.data.addSubcommand(SubCommand.data);
}

// ---------------------------------------------------------------------------------------
export default CommandObject;
