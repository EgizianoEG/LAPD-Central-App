import AutocompleteMemRolesSave from "@Utilities/Autocompletion/MemRolesSave.js";
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  AutocompleteInteraction,
  ApplicationIntegrationType,
  ApplicationCommandOptionChoiceData,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

const Subcommands = [
  (await import("./Subcmds/Backup.js")).default,
  (await import("./Subcmds/Delete.js")).default,
  (await import("./Subcmds/View.js")).default,
  (await import("./Subcmds/Load.js")).default,
  (await import("./Subcmds/List.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------

async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  for (const Subcommand of Subcommands) {
    if (Subcommand.data.name === Interaction.options.getSubcommand()) {
      if (typeof Subcommand.callback === "function") {
        return Subcommand.callback(Interaction);
      } else {
        continue;
      }
    }
  }
}

async function Autocomplete(Interaction: AutocompleteInteraction<"cached">) {
  const { name, value } = Interaction.options.getFocused(true);
  const TargetMember = Interaction.options.get("member", false);
  let Suggestions: ApplicationCommandOptionChoiceData[] = [];

  if (name === "save" || name === "backup") {
    if (!TargetMember?.value) Suggestions = [];
    else
      Suggestions = await AutocompleteMemRolesSave(
        TargetMember.value as string,
        Interaction.guildId,
        value
      );
  }

  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: Callback,
  autocomplete: Autocomplete,

  options: {
    app_perms: { load: [PermissionFlagsBits.ManageRoles] },
    cooldown: {
      $all_other: 8,
      load: { $user: { max_executions: 5, timeframe: 5 * 60, cooldown: 10 } },
    },
    user_perms: {
      $all_other: { management: true },
      load: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
    },
  },

  data: new SlashCommandBuilder()
    .setName("member-roles")
    .setDescription("Utility commands for managing member roles.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

for (const Subcmd of Subcommands) {
  CommandObject.data.addSubcommand(Subcmd.data);
}

// ---------------------------------------------------------------------------------------
export default CommandObject;
