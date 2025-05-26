import {
  SlashCommandSubcommandBuilder,
  PermissionFlagsBits,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  EmbedBuilder,
  ButtonStyle,
  userMention,
  channelLink,
  GuildMember,
  Collection,
  Message,
  User,
} from "discord.js";

import Dedent from "dedent";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import SafeRegex from "safe-regex";
import { GetErrorId } from "@Utilities/Strings/Random.js";
import { Emojis, Colors } from "@Config/Shared.js";
import { FilterUserInput } from "@Utilities/Strings/Redactor.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { ErrorEmbed, InfoEmbed, SuccessEmbed, WarnEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  GuildMembersCache,
  OngoingServerMemberNicknamesReplaceCache,
} from "@Utilities/Other/Cache.js";

const RegexFlags = ["i", "g", "gi"];
// ---------------------------------------------------------------------------------------
// Helpers & Handlers:
// -------------------
function GetConfirmationPromptActionRow(CmdInteraction: SlashCommandInteraction<"cached">) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`nr-confirm:${CmdInteraction.user.id}`)
      .setLabel("Confirm and Replace All")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`nr-cancel:${CmdInteraction.user.id}`)
      .setLabel("Cancel Replacement")
      .setStyle(ButtonStyle.Secondary)
  );
}

function NicknameReplaceMapper(Member: GuildMember, MatchRegex: RegExp, InputReplacement: string) {
  return {
    member: Member,
    original: Member.nickname ?? Member.displayName,
    replaced: (Member.nickname ?? Member.displayName).replace(MatchRegex, InputReplacement),
  };
}

async function IsReplacementSafeToApply(
  CmdInteract: SlashCommandInteraction<"cached">,
  SampleReplacements: { member: GuildMember; original: string; replaced: string }[]
) {
  const [FilteredOriginal, FilteredReplacements] = await Promise.all([
    Promise.all(
      SampleReplacements.map((Rep) =>
        FilterUserInput(Rep.original, {
          filter_links_emails: true,
          guild_instance: CmdInteract.guild,
        })
      )
    ),
    Promise.all(
      SampleReplacements.map((Rep) =>
        FilterUserInput(Rep.replaced, {
          filter_links_emails: true,
          guild_instance: CmdInteract.guild,
        })
      )
    ),
  ]);

  for (let i = 0; i < SampleReplacements.length; i++) {
    if (
      SampleReplacements[i].replaced !== FilteredReplacements[i] &&
      FilteredOriginal[i] === SampleReplacements[i].original
    ) {
      return new ErrorEmbed()
        .useErrTemplate("NicknameReplaceFilteredReplacement")
        .replyToInteract(CmdInteract, true)
        .then(() => false);
    }
  }

  return true;
}

async function HandleReplacementCancellation(ButtonInteract: ButtonInteraction<"cached">) {
  if (ButtonInteract.customId.includes("cancel")) {
    return ButtonInteract.update({
      components: [],
      embeds: [
        new InfoEmbed()
          .setTitle("Replacement Cancelled")
          .setDescription("The nickname replacement process was cancelled at your request."),
      ],
    });
  }
}

function GetCancellationButton(
  Interact: ButtonInteraction<"cached">
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`nr-stop:${Interact.user.id}:${Interact.createdTimestamp}`)
      .setLabel("Stop Process")
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Processes batched nickname replacements for a list of members, updating their nicknames
 * in batches and providing progress updates via a button interaction.
 *
 * @param ButtonInteract - The button interaction used to send progress updates.
 * @param Replacements - An array of objects containing the members and their respective
 *                       replacement nicknames, as returned by `NicknameReplaceMapper`.
 * @param BatchSize - The number of members to process in each batch. Defaults to 50.
 * @returns A promise that resolves to an object containing the total number of successful
 *          replacements (`TotalReplaced`) and the total number of failures (`TotalFailed`).
 *
 * @remarks
 * - The function splits the replacements into batches of the specified size and processes
 *   each batch sequentially.
 * - Progress updates are sent to the user via the provided button interaction every 3 seconds
 *   or after each batch is completed.
 * - A short delay is introduced between processing batches to avoid rate limits.
 * - If an error occurs while setting a member's nickname, it is counted as a failure, and
 *   the function continues processing the remaining members.
 */
async function ProcessBatchedReplacements(
  ButtonInteract: ButtonInteraction<"cached">,
  Replacements: ReturnType<typeof NicknameReplaceMapper>[],
  BatchSize = 20
): Promise<{
  TotalReplaced: number;
  TotalFailed: number;
  EarlyTermination?: boolean;
  TerminationReason?: string;
}> {
  const TotalMembers = Replacements.length;
  let ProcessedCount = 0;
  let TotalReplaced = 0;
  let TotalFailed = 0;
  let LastUpdateTime = Date.now();
  let LastPermissionCheckTime = Date.now();
  let OperationCancelledBy: User | null = null;

  const LengthIssues = Replacements.filter(({ replaced }) => replaced.length > 32);
  const CompCollector = ButtonInteract.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 60 * 1000,
    filter: (Interact) =>
      Interact.customId ===
        `nr-stop:${ButtonInteract.user.id}:${ButtonInteract.createdTimestamp}` &&
      (Interact.user.id === ButtonInteract.user.id ||
        Interact.member.permissions.has(PermissionFlagsBits.Administrator)),
  });

  CompCollector?.on("collect", async (Interact) => {
    OperationCancelledBy = Interact.user;
    await Interact.update({
      components: [],
      embeds: [
        new WarnEmbed()
          .setTitle("Stopping Process")
          .setDescription("Stopping the process after completing the current batch..."),
      ],
    }).catch(() => null);
  });

  if (LengthIssues.length > 0) {
    await UpdateProgressMessage(
      ButtonInteract,
      0,
      TotalMembers,
      0,
      undefined,
      undefined,
      `**Warning:** ${LengthIssues.length} replacement(s) exceed Discord's 32 nickname character limit and will be truncated.`
    );

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const Batches: (typeof Replacements)[] = [];
  for (let i = 0; i < TotalMembers; i += BatchSize) {
    Batches.push(Replacements.slice(i, i + BatchSize));
  }

  await UpdateProgressMessage(ButtonInteract, 0, TotalMembers, 0);
  for (let BatchIndex = 0; BatchIndex < Batches.length; BatchIndex++) {
    if (OperationCancelledBy) {
      await UpdateProgressMessage(
        ButtonInteract,
        ProcessedCount,
        TotalMembers,
        TotalReplaced,
        BatchIndex,
        Batches.length,
        `Operation cancelled at ${userMention(OperationCancelledBy)}'s request.`
      );

      return {
        TotalReplaced,
        TotalFailed,
        EarlyTermination: true,
        TerminationReason: `Cancelled by ${userMention(OperationCancelledBy)}.`,
      };
    }

    const CurrentTime = Date.now();
    if (BatchIndex % 3 === 0 || CurrentTime - LastPermissionCheckTime > 10_000) {
      try {
        const AppMember = await ButtonInteract.guild.members.fetchMe();
        if (!AppMember.permissions.has(PermissionFlagsBits.ManageNicknames, true)) {
          await UpdateProgressMessage(
            ButtonInteract,
            ProcessedCount,
            TotalMembers,
            TotalReplaced,
            BatchIndex + 1,
            Batches.length,
            "Operation terminated early due to permission changes."
          );

          return {
            TotalReplaced,
            TotalFailed,
            EarlyTermination: true,
            TerminationReason: "Application lost required permissions during the operation.",
          };
        }

        if (Batches.length > 5 && BatchIndex < Batches.length - 1) {
          const RemainingMembers = Batches.slice(BatchIndex + 1).flat();
          const FilteredRemainingMembers = RemainingMembers.filter(
            ({ member }) => member.manageable
          );

          if (FilteredRemainingMembers.length < RemainingMembers.length) {
            const SkippedCount = RemainingMembers.length - FilteredRemainingMembers.length;
            TotalFailed += SkippedCount;
            Batches.splice(BatchIndex + 1);

            for (let i = 0; i < FilteredRemainingMembers.length; i += BatchSize) {
              Batches.push(FilteredRemainingMembers.slice(i, i + BatchSize));
            }

            await UpdateProgressMessage(
              ButtonInteract,
              ProcessedCount,
              TotalMembers,
              TotalReplaced,
              BatchIndex + 1,
              Batches.length,
              `${SkippedCount} member(s) skipped due to role changes.`
            );
          }
        }

        LastPermissionCheckTime = CurrentTime;
      } catch (error) {
        AppLogger.warn({
          message: "Failed to recheck permissions during nickname replacement",
          label: "Commands:Utility:Nickname:Replace",
          error,
        });
      }
    }

    const CurrentBatch = Batches[BatchIndex];
    const BatchResults = await Promise.allSettled(
      CurrentBatch.map(async ({ member, replaced }) => {
        try {
          await member.setNickname(
            replaced.substring(0, 32),
            `Automated nickname replacement; executed by @${ButtonInteract.user.username}`
          );
          return true;
        } catch {
          return false;
        }
      })
    );

    const BatchSuccesses = BatchResults.filter(
      (Result) => Result.status === "fulfilled" && Result.value === true
    ).length;

    TotalReplaced += BatchSuccesses;
    TotalFailed += CurrentBatch.length - BatchSuccesses;
    ProcessedCount += CurrentBatch.length;

    if (BatchSuccesses <= BatchSize / 2) {
      await UpdateProgressMessage(
        ButtonInteract,
        ProcessedCount,
        TotalMembers,
        TotalReplaced,
        BatchIndex + 1,
        Batches.length,
        "Operation terminated early due to high failure rate."
      );

      return {
        TotalReplaced,
        TotalFailed,
        EarlyTermination: true,
        TerminationReason:
          "High failure rate detected. Operation terminated to prevent API bad requests.",
      };
    }

    if (CurrentTime - LastUpdateTime > 3 * 1000 || BatchIndex === Batches.length - 1) {
      await UpdateProgressMessage(
        ButtonInteract,
        ProcessedCount,
        TotalMembers,
        TotalReplaced,
        BatchIndex + 1,
        Batches.length
      );
      LastUpdateTime = Date.now();
    }

    if (BatchIndex < Batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  CompCollector?.stop();
  return { TotalReplaced, TotalFailed };
}

/**
 * Updates the progress message for a nickname replacement operation.
 * @param ButtonInteract - The button interaction object, cached for the current session.
 * @param ProcessedCount - The number of nicknames that have been processed so far.
 * @param TotalCount - The total number of nicknames to be processed.
 * @param SuccessCount - The number of nicknames successfully replaced.
 * @param CurrentBatch - (Optional) The current batch number being processed, if batching is used.
 * @param TotalBatches - (Optional) The total number of batches, if batching is used.
 * @param StatusMessage - (Optional) A custom status message to display, used for early termination notices.
 * @returns A promise that resolves when the progress message has been updated.
 */
async function UpdateProgressMessage(
  ButtonInteract: ButtonInteraction<"cached">,
  ProcessedCount: number,
  TotalCount: number,
  SuccessCount: number,
  CurrentBatch?: number,
  TotalBatches?: number,
  StatusMessage?: string
): Promise<void> {
  const PercentComplete = Math.round((ProcessedCount / TotalCount) * 100);
  const ProgressBarSegments = 20;
  const FilledSegments = Math.floor((ProcessedCount / TotalCount) * ProgressBarSegments);
  const EmptySegments = ProgressBarSegments - FilledSegments;
  const ProgressBar = `[${"■".repeat(FilledSegments)}${"□".repeat(EmptySegments)}]`;
  const BatchInfo =
    CurrentBatch && TotalBatches ? `\nProcessing batch ${CurrentBatch}/${TotalBatches}` : "";

  const ProgressEmbed = new EmbedBuilder()
    .setColor(Colors.DarkGrey)
    .setTitle(`${Emojis.LoadingGrey}\u{2000}Replacing Nicknames`)
    .setDescription(
      Dedent(`
        **Progress: ${PercentComplete}% complete**
        ${ProgressBar} \`${ProcessedCount}/${TotalCount}\`
        
        Successfully replaced: \`${SuccessCount}\`
        Failed replacements: \`${ProcessedCount - SuccessCount}\`${BatchInfo}
        
        ${StatusMessage ?? "Kindly wait. Matching nicknames are currently being modified, which may take some time."}
      `)
    );

  await ButtonInteract.editReply({
    embeds: [ProgressEmbed],
    components: [GetCancellationButton(ButtonInteract)],
  }).catch(() => null);
}

/**
 * Handles the confirmation and execution of nickname replacements for eligible members in a Discord guild.
 *
 * @param ButtonInteract - The button interaction that triggered the nickname replacement process.
 * @param MatchingMembers - A collection of guild members whose nicknames match the specified regex.
 * @param EligibleMembers - A collection of guild members eligible for nickname replacement based on permissions and hierarchy.
 * @param MatchRegex - The regular expression used to identify matching nicknames.
 * @param ReplacementExp - The replacement expression to apply to matching nicknames.
 * @returns A promise that resolves to `true` if the process completes successfully, or `false` if it fails or is aborted.
 * @remarks
 * - Ensures that no other nickname replacement process is ongoing for the guild.
 * - Verifies that the bot has the `ManageNicknames` permission.
 * - Processes nickname replacements in batches, with the batch size determined dynamically based on the total number of replacements.
 * - Provides feedback to the user through interaction updates and embeds.
 * - Automatically clears the ongoing process cache for the guild after 5 minutes.
 */
async function HandleReplacementConfirmation(
  ButtonInteract: ButtonInteraction<"cached">,
  MatchingMembers: Collection<string, GuildMember>,
  EligibleMembers: Collection<string, GuildMember>,
  MatchRegex: RegExp,
  ReplacementExp: string
): Promise<boolean> {
  const AppMember = await ButtonInteract.guild.members.fetchMe();
  if (OngoingServerMemberNicknamesReplaceCache.has(ButtonInteract.guildId)) {
    return new ErrorEmbed()
      .useErrTemplate("NicknameReplacementAlreadyInProgress")
      .replyToInteract(ButtonInteract, true)
      .then(() => false);
  } else if (!AppMember.permissions.has(PermissionFlagsBits.ManageNicknames, true)) {
    return new ErrorEmbed()
      .useErrTemplate("NicknameReplaceMissingManageNicknames")
      .replyToInteract(ButtonInteract, true)
      .then(() => false);
  }

  OngoingServerMemberNicknamesReplaceCache.set(ButtonInteract.guildId, true);
  const Replacements = EligibleMembers.filter((Member) => Member.manageable).map((Member) =>
    NicknameReplaceMapper(Member, MatchRegex, ReplacementExp)
  );

  await ButtonInteract.update({
    components: [],
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.DarkGrey)
        .setTitle(`${Emojis.LoadingGrey}\u{2000}Replacing Nicknames`)
        .setDescription("Preparing to process nickname changes. This will begin momentarily."),
    ],
  });

  let FinalRespEmbed: EmbedBuilder;
  const BatchSize = Replacements.length > 500 ? 50 : Replacements.length > 200 ? 25 : 15;
  const { TotalReplaced, TotalFailed, EarlyTermination, TerminationReason } =
    await ProcessBatchedReplacements(ButtonInteract, Replacements, BatchSize);

  setTimeout(
    () => {
      OngoingServerMemberNicknamesReplaceCache.del(ButtonInteract.guildId);
    },
    5 * 60 * 1000
  );

  if (TotalReplaced === 0) {
    FinalRespEmbed = new ErrorEmbed().useErrTemplate("NicknameReplaceNoReplacementsMade");
  } else {
    FinalRespEmbed = new SuccessEmbed()
      .setTitle(
        EarlyTermination
          ? TerminationReason?.includes("Cancelled")
            ? "Process Cancelled"
            : "Process Terminated Early"
          : "Success"
      )
      .setDescription(
        Dedent(`
          **${
            EarlyTermination
              ? TerminationReason?.includes("Cancelled")
                ? "Process cancelled by user."
                : "Process terminated early."
              : "Process completed successfully."
          }**${EarlyTermination ? `\n**Reason:** ${TerminationReason}` : ""}
          **Here is a summary of the results:**
          > - Members Matched: \`${MatchingMembers.size}\`
          > - Members Eligible: \`${EligibleMembers.size}\`
          > - Nicknames Replaced: \`${TotalReplaced}\`
          > - Nicknames Failed: \`${TotalFailed}\`
          
          -# The process took approximately ${ReadableDuration(Date.now() - ButtonInteract.createdTimestamp, { largest: 3 })}.
        `)
      );

    if (EarlyTermination && !TerminationReason?.includes("Cancelled")) {
      FinalRespEmbed.setColor(Colors.Warning);
    } else if (TerminationReason?.includes("Cancelled")) {
      FinalRespEmbed.setColor(Colors.Greyple);
    }
  }

  await ButtonInteract.editReply({
    embeds: [FinalRespEmbed],
    components: [],
  }).catch(() => null);

  return true;
}

async function HandlePromptInteractions(
  CmdInteract: SlashCommandInteraction<"cached">,
  PromptMessage: Message<true>,
  MatchingMembers: Collection<string, GuildMember>,
  EligibleMembers: Collection<string, GuildMember>,
  MatchRegex: RegExp,
  ReplacementExp: string
): Promise<void> {
  const ComponentCollector = PromptMessage.createMessageComponentCollector({
    filter: (BI) => BI.user.id === CmdInteract.user.id,
    componentType: ComponentType.Button,
    idle: 5 * 60 * 1000,
    time: 8 * 60 * 1000,
  });

  ComponentCollector.on("collect", async (ButtonInteract) => {
    const CustomId = ButtonInteract.customId;

    try {
      if (CustomId.includes("cancel")) {
        ComponentCollector.stop("Cancelled");
        await HandleReplacementCancellation(ButtonInteract);
      } else if (CustomId.includes("confirm")) {
        const ProcessCompleted = await HandleReplacementConfirmation(
          ButtonInteract,
          MatchingMembers,
          EligibleMembers,
          MatchRegex,
          ReplacementExp
        );

        if (ProcessCompleted) {
          ComponentCollector.stop("Completed");
        }
      } else {
        return ButtonInteract.deferUpdate();
      }
    } catch (Err: any) {
      const ErrorId = GetErrorId();
      if (!ButtonInteract.replied) {
        await new ErrorEmbed()
          .useErrTemplate("AppError")
          .setErrorId(ErrorId)
          .replyToInteract(ButtonInteract, true);
      }

      AppLogger.error({
        message: "Something went wrong while handling prompt interaction; ",
        label: "Commands:Utility:Nickname:Replace",
        stack: Err.stack,
      });
    }
  });

  ComponentCollector.on("end", async (Collected, Reason) => {
    if (["Cancelled", "Completed"].includes(Reason) || Reason.match(/^\w+Delete/)) {
      return;
    }

    const LastInteract = Collected.last() ?? CmdInteract;
    const ActionRow = GetConfirmationPromptActionRow(CmdInteract);
    ActionRow.components.forEach((Button) => Button.setDisabled(true));
    LastInteract.editReply({
      components: [ActionRow],
    }).catch(() => null);
  });
}

// ---------------------------------------------------------------------------------------
// Initial Handling:
// -----------------
async function Callback(CmdInteract: SlashCommandInteraction<"cached">) {
  const InputRegex = CmdInteract.options.getString("regex", true);
  const InputRFlag = CmdInteract.options.getString("flags", false);
  const RoleFilter = CmdInteract.options.getRole("role-filter", false);
  const InputReplacement = CmdInteract.options.getString("replacement", true);
  const AppMember = await CmdInteract.guild.members.fetchMe();

  if (RoleFilter && RoleFilter.comparePositionTo(AppMember.roles.highest) >= 0) {
    return new ErrorEmbed()
      .useErrTemplate("NicknameReplaceHigherRoleFilterProvided")
      .replyToInteract(CmdInteract, true);
  }

  await CmdInteract.deferReply();
  try {
    const MatchRegex = new RegExp(InputRegex, InputRFlag ?? undefined);
    if (!SafeRegex(MatchRegex)) {
      return new ErrorEmbed()
        .useErrTemplate("ProvidedUnsafeRegex")
        .replyToInteract(CmdInteract, true);
    }

    const GuildMembers =
      GuildMembersCache.get<Collection<string, GuildMember>>(CmdInteract.guildId) ??
      (await CmdInteract.guild.members.fetch());

    const MembersMatching = GuildMembers.filter((Member) => {
      return (
        !Member.user.bot &&
        (RoleFilter ? Member.roles.cache.has(RoleFilter.id) : true) &&
        MatchRegex.test(Member.nickname ?? Member.displayName)
      );
    });

    const EligibleMembers = MembersMatching.filter((Member) => {
      return Member.manageable;
    });

    if (MembersMatching.size === 0) {
      return new InfoEmbed()
        .useInfoTemplate("NicknameRegexNoMatchingMembers")
        .replyToInteract(CmdInteract, true);
    }

    if (EligibleMembers.size === 0) {
      return new ErrorEmbed()
        .useErrTemplate("NicknameReplaceNoEligibleMembers")
        .replyToInteract(CmdInteract, true);
    }

    const SampleReplacements = EligibleMembers.random(4).map((Member) =>
      NicknameReplaceMapper(Member, MatchRegex, InputReplacement)
    );

    if (!(await IsReplacementSafeToApply(CmdInteract, SampleReplacements))) {
      return;
    }

    const FormattedSampleReplacementList = SampleReplacements.map(
      (Rep) =>
        `${userMention(Rep.member.id)}: \`${Rep.original}\` → \`${Rep.replaced.substring(0, 32)}\``
    ).join(`\n${" ".repeat(12)}- `);

    const Plural = MembersMatching.size > 1 ? "s" : "";
    const ConfirmationEmbed = new WarnEmbed()
      .setTitle("Confirmation Required")
      .setFooter({
        text: "This prompt will be automatically cancelled after five minutes of no response.",
      })
      .setDescription(
        Dedent(`
          **Are you certain you want to replace ${MembersMatching.size === 1 ? "this" : "these"} \
          [${MembersMatching.size}](${channelLink(CmdInteract.channelId)}) \
          nickname${Plural} matching the regex \`${InputRegex}\` with \`${InputReplacement}\`?**

          **Please keep in mind that:**
          - This action will not affect users with a role position higher than the application's highest role.
          - New nicknames that exceed Discord's 32 character limit will be truncated automatically from the end.
          - This is an irreversible action that will replace any nicknames that match this regex, as demonstrated by the example${Plural} below:
            - ${FormattedSampleReplacementList}
        `)
      );

    const ConfirmationPrompt = await CmdInteract.editReply({
      embeds: [ConfirmationEmbed],
      components: [GetConfirmationPromptActionRow(CmdInteract)],
    });

    await HandlePromptInteractions(
      CmdInteract,
      ConfirmationPrompt,
      MembersMatching,
      EligibleMembers,
      MatchRegex,
      InputReplacement
    );
  } catch (Err) {
    if (Err instanceof SyntaxError) {
      return new ErrorEmbed()
        .useErrTemplate("InvalidRegexSyntax")
        .replyToInteract(CmdInteract, true);
    }

    throw Err;
  }
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("replace")
    .setDescription(
      "Change and modify nicknames of all members based on an ECMAScript regular expression."
    )
    .addStringOption((Opt) =>
      Opt.setName("regex")
        .setDescription("The regular expression to match nicknames with.")
        .setMinLength(2)
        .setMaxLength(35)
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("replacement")
        .setDescription("The replacement string or expression.")
        .setMinLength(2)
        .setMaxLength(35)
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("flags")
        .setDescription("The regex flag(s) to use.")
        .setRequired(false)
        .setChoices(
          ...RegexFlags.map((RegexFlag) => {
            return { name: RegexFlag, value: RegexFlag };
          })
        )
    )
    .addRoleOption((Opt) =>
      Opt.setName("role-filter")
        .setDescription("Only replace nicknames of members in this role (optional).")
        .setRequired(false)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
