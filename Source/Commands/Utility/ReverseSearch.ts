/* eslint-disable sonarjs/no-duplicate-string */
// Dependencies:
// -------------
import AutocompleteRobloxUsername from "@Utilities/Autocompletion/Username.js";
import GetIdByUsername from "@Utilities/Roblox/GetIdByUsername.js";
import GuildProfile from "@Models/GuildProfile.js";

import { ErrorEmbed, InfoEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { IsValidRobloxUsername } from "@Utilities/Helpers/Validators.js";
import {
  userMention,
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  type AutocompleteInteraction,
} from "discord.js";

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  const TargetUsername = CmdInteract.options.getString("roblox-username", true);
  const ResultMsgEphemeral = CmdInteract.options.getBoolean("ephemeral", false) || false;

  if (!IsValidRobloxUsername(TargetUsername)) {
    return new ErrorEmbed()
      .useErrTemplate("MalformedRobloxUsername", TargetUsername)
      .replyToInteract(CmdInteract, true);
  }

  const [RUserId, ExactUsername, RIdFound] = await GetIdByUsername(TargetUsername, false);
  if (RIdFound === false) {
    return new ErrorEmbed()
      .useErrTemplate("NonexistentRobloxUsername", TargetUsername)
      .replyToInteract(CmdInteract, true);
  }

  const LinkedGuildProfile = await GuildProfile.findOne(
    {
      guild: CmdInteract.guildId,
      linked_account: { roblox_user_id: RUserId },
    },
    { user: 1 }
  )
    .lean()
    .exec();

  if (!LinkedGuildProfile) {
    return new InfoEmbed()
      .setThumbnail(null)
      .setTitle("No Match Found")
      .setDescription(`There was no match found for \`${ExactUsername}\` in the database.`)
      .replyToInteract(CmdInteract, ResultMsgEphemeral);
  }

  return new InfoEmbed()
    .setThumbnail(null)
    .setTitle("Match Found")
    .setDescription(
      `The Roblox account with username \`${ExactUsername}\` is currently linked to ${userMention(LinkedGuildProfile.user)}.`
    )
    .replyToInteract(CmdInteract, ResultMsgEphemeral);
}

async function Autocomplete(Interaction: AutocompleteInteraction<"cached">): Promise<void> {
  const { name, value } = Interaction.options.getFocused(true);
  const Suggestions = name === "roblox-username" ? await AutocompleteRobloxUsername(value) : [];
  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  autocomplete: Autocomplete,
  callback: Callback,

  options: {
    cooldown: 3,
    user_perms: { management: true },
  },

  data: new SlashCommandBuilder()
    .setName("reverse-search")
    .setDescription(
      "See who has the Roblox account with the given username linked to their Discord account."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((Option) =>
      Option.setName("roblox-username")
        .setDescription("The Roblox username to search for.")
        .setAutocomplete(true)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20)
    )
    .addBooleanOption((Option) =>
      Option.setName("ephemeral")
        .setDescription("Whether or not the result message is ephemeral.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
