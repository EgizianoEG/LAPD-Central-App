// Dependencies:
// -------------

import {
  MessageFlags,
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
} from "discord.js";

import { FormatUsername } from "#Utilities/Strings/Formatters.js";
import { SuccessContainer } from "#Utilities/Classes/ExtraContainers.js";
import { Autocomplete, HandleInvalidUsername } from "../Miscellaneous/Login.js";

import SetLinkedRobloxAccount from "#Source/Utilities/Database/LinkRobloxAccount.js";
import GetIdByUsername from "#Utilities/Roblox/GetIdByUsername.js";
import GetUserInfo from "#Utilities/Roblox/GetUserInfo.js";

// ---------------------------------------------------------------------------------------
// Command Handling:
// -----------------
async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  const InputUsername = CmdInteract.options.getString("username", true);
  const InputGuildId = CmdInteract.options.getString("guild", true);
  const InputUserId = CmdInteract.options.getUser("user", true).id;

  if (await HandleInvalidUsername(CmdInteract, InputUsername)) {
    return;
  }

  await CmdInteract.deferReply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });

  const [AccountRobloxId] = await GetIdByUsername(InputUsername, true);
  const RobloxAccountInfo = await GetUserInfo(AccountRobloxId);
  await SetLinkedRobloxAccount(
    { guildId: InputGuildId, user: { id: InputUserId } },
    AccountRobloxId
  );

  return CmdInteract.editReply({
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [
      new SuccessContainer().useTemplate(
        "AdminRobloxAccountConnected",
        FormatUsername(RobloxAccountInfo, false, true),
        InputUserId
      ),
    ],
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  options: { cooldown: 5, dev_only: true },
  callback: Callback,
  autocomplete: Autocomplete,

  data: new SlashCommandBuilder()
    .setName("admin-link-roblox")
    .setDescription(
      "Manually link a Roblox account to a specific user in a Guild, skipping verification."
    )
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .addUserOption((Opt) =>
      Opt.setName("user")
        .setDescription("The target user to link their Roblox account.")
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("guild")
        .setDescription("The target guild to link the person's account to.")
        .setMinLength(15)
        .setMaxLength(22)
        .setRequired(true)
    )
    .addStringOption((Option) =>
      Option.setName("username")
        .setDescription("The Roblox username of the target.")
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(true)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
