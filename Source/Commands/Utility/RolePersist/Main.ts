import AutocompleteRolePersistRecord from "#Utilities/Autocompletion/RolePersistRecord.js";
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
  (await import("./Subcmds/Add.js")).default,
  (await import("./Subcmds/Remove.js")).default,
  (await import("./Subcmds/List.js")).default,
];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function InvokeSubcommandHandler(Interaction: SlashCommandInteraction<"cached">) {
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
  const TargetUser = Interaction.options.get("user", false);
  let Suggestions: ApplicationCommandOptionChoiceData[] = [];

  if (name === "id") {
    Suggestions = TargetUser?.value
      ? await AutocompleteRolePersistRecord(TargetUser.value as string, Interaction.guildId, value)
      : [];
  } else if (name === "expiry" && /\s*/.test(value.trim())) {
    Suggestions = ["1 day", "3 days", "7 days", "2 weeks", "1 month"].map((v) => ({
      name: v,
      value: v,
    }));
  }

  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<SlashCommandSubcommandsOnlyBuilder> = {
  callback: InvokeSubcommandHandler,
  autocomplete: Autocomplete,

  options: {
    app_perms: {
      add: [PermissionFlagsBits.ManageRoles],
      remove: [PermissionFlagsBits.ManageRoles],
    },
    cooldown: {
      $all: 8,
    },
    user_perms: {
      $all: { management: true },
    },
  },

  data: new SlashCommandBuilder()
    .setName("role-persist")
    .setDescription("Utility commands for persisting member roles.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
};

for (const Subcmd of Subcommands) {
  CommandObject.data.addSubcommand(Subcmd.data);
}

// ---------------------------------------------------------------------------------------
export default CommandObject;
