import {
  Collection,
  GuildMember,
  MessageFlags,
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import SafeRegex from "safe-regex";
import HandlePagePagination from "@Utilities/Other/HandlePagePagination.js";
import { ErrorContainer, InfoContainer } from "@Utilities/Classes/ExtraContainers.js";
import { GuildMembersCache } from "@Utilities/Other/Cache.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { GetErrorId } from "@Utilities/Strings/Random.js";

const FileLogLabel = "Commands:Utility:Nickname:Search";
const ListFormatter = new Intl.ListFormat("en");
const MembersPerPage = 15;
const RegexFlags = ["i", "g", "gi"];

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Takes an array of GuildMembers and returns an array of ContainerBuilder, where each container contains a subset of the GuildMembers in a formatted list.
 * @param {GuildMember[]} Members - An array of GuildMember objects, representing the members of a guild.
 * @returns an array of ContainerBuilder objects.
 */
function GeneratePageContainers(Members: GuildMember[]): ContainerBuilder[] {
  const Containers: ContainerBuilder[] = [];
  const MMTotal = Members.length;

  for (let i = 0; i < Members.length; i += MembersPerPage) {
    Containers.push(
      new InfoContainer()
        .setTitle(`Matching Members — ${MMTotal}`)
        .setDescription(
          ListFormatter.format(Members.slice(i, i + MembersPerPage).map((M) => `<@${M.user.id}>`))
        )
    );
  }

  return Containers;
}

async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  const InputRegex = CmdInteract.options.getString("regex", true);
  const InputRFlag = CmdInteract.options.getString("flags", false);
  const RoleFilter = CmdInteract.options.getRole("role_filter", false);
  const ResponseEphemeral = CmdInteract.options.getBoolean("ephemeral", false) || false;
  const ReplyFlags = ResponseEphemeral
    ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    : MessageFlags.IsComponentsV2;

  try {
    const MatchRegex = new RegExp(InputRegex, InputRFlag ?? undefined);
    if (!SafeRegex(MatchRegex)) {
      return new ErrorEmbed()
        .useErrTemplate("ProvidedUnsafeRegex")
        .replyToInteract(CmdInteract, true);
    }

    let GuildMembers: Collection<string, GuildMember>;
    await CmdInteract.deferReply({ flags: ReplyFlags });

    if (GuildMembersCache.has(CmdInteract.guildId)) {
      GuildMembers = GuildMembersCache.get<Collection<string, GuildMember>>(CmdInteract.guildId)!;
    } else {
      GuildMembers = await CmdInteract.guild.members.fetch();
      GuildMembersCache.set(CmdInteract.guildId, GuildMembers);
    }

    const MembersMatching = GuildMembers.filter((Member) => {
      return (
        !Member.user.bot &&
        (RoleFilter ? Member.roles.cache.has(RoleFilter.id) : true) &&
        MatchRegex.test(Member.nickname ?? Member.displayName)
      );
    }).sort((M1, M2) =>
      (M1.nickname ?? M1.displayName).localeCompare(M2.nickname ?? M2.displayName)
    );

    const MemberResultContainers = GeneratePageContainers(MembersMatching.toJSON());
    if (MemberResultContainers.length) {
      return HandlePagePagination({
        pages: MemberResultContainers,
        context: FileLogLabel,
        interact: CmdInteract,
        ephemeral: ResponseEphemeral,
      });
    } else {
      return new InfoContainer()
        .useInfoTemplate("NicknameRegexNoMatchingMembers")
        .replyToInteract(CmdInteract, true);
    }
  } catch (Err: any) {
    if (Err instanceof SyntaxError) {
      return new ErrorEmbed()
        .useErrTemplate("InvalidRegexSyntax")
        .replyToInteract(CmdInteract, true);
    }

    const ErrorId = GetErrorId();
    AppLogger.error({
      label: FileLogLabel,
      message: "An error occurred while searching for members;",
      error_id: ErrorId,
      stack: Err.stack,
      error: {
        ...Err,
      },
    });

    return new ErrorContainer()
      .setDescription(
        "Seems like an unexpected error occurred while searching for members. Please try again later."
      )
      .setErrorId(ErrorId)
      .replyToInteract(CmdInteract, true);
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("search")
    .setDescription(
      "Look up server members by their nicknames using an ECMAScript regular expression."
    )
    .addStringOption((Opt) =>
      Opt.setName("regex")
        .setDescription("The regex to match nicknames with.")
        .setMinLength(2)
        .setMaxLength(35)
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("flags")
        .setDescription("The regex flag(s) to use.")
        .setRequired(false)
        .setChoices(
          ...RegexFlags.map((F) => {
            return { name: F, value: F };
          })
        )
    )
    .addRoleOption((Opt) =>
      Opt.setName("role_filter")
        .setDescription("Only search members in this role (optional).")
        .setRequired(false)
    )
    .addBooleanOption((Opt) =>
      Opt.setName("ephemeral")
        .setDescription("Whether to show the result in an ephemeral message or not.")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
