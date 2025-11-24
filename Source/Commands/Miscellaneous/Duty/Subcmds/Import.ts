/* eslint-disable sonarjs/no-duplicate-string */
import { randomInt as RandomInteger } from "node:crypto";
import { HandleShiftTypeValidation } from "@Utilities/Database/ShiftTypeValidators.js";
import { DutyLeaderboardEntryRegex } from "@Resources/RegularExpressions.js";
import { Dedent, ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { GetErrorId } from "@Utilities/Strings/Random.js";
import {
  SlashCommandSubcommandBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  ComponentType,
  ButtonBuilder,
  MessageFlags,
  ButtonStyle,
  Attachment,
} from "discord.js";

import {
  SuccessContainer,
  ErrorContainer,
  InfoContainer,
  WarnContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import ShiftModel, { ShiftFlags } from "@Models/Shift.js";
import ResolveUsernamesToIds from "@Utilities/Discord/ResolveDiscordUsernames.js";
import ShiftActionLogger from "@Utilities/Classes/ShiftActionLogger.js";
import ParseDuration from "parse-duration";
import AppLogger from "@Utilities/Classes/AppLogger.js";
import AppError from "@Utilities/Classes/AppError.js";

type LeaderboardEntry = {
  // Common to both formats
  username: string; // Matched in both patterns
  hr_time: string; // Matched in both patterns

  // Trident-specific fields (first alternative)
  user_id?: string; // Only in Trident format
  duty_ms?: string | number; // Only in Trident format (but numeric)
  shift_count?: string | number; // Only in Trident format (but numeric)

  // ERM-specific fields (second alternative)
  // (No additional unique fields; just username + hr_time)
};

const FileLabel = "Commands:Miscellaneous:Duty:Import";
const LineRegex = DutyLeaderboardEntryRegex;
const MaxFileSize = 1 * 1024 * 1024; // 1MB
const MaxContentSize = 1.5 * 1024 * 1024; // 1.5MB
// ---------------------------------------------------------------------------------------
// Functions:
// ----------
async function IsAttachmentExtensionValid(
  Interaction: SlashCommandInteraction<"cached">,
  DataFile: Attachment
): Promise<boolean> {
  if (!DataFile.name.endsWith(".txt")) {
    return new ErrorContainer()
      .useErrTemplate("AttachmentMustBeTextFile")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  if (DataFile.size > MaxFileSize) {
    return new ErrorContainer()
      .useErrTemplate("DutyImportFileTooLarge")
      .replyToInteract(Interaction, true)
      .then(() => false);
  }

  return true;
}

async function AwaitImportConfirmation(
  Interaction: SlashCommandInteraction<"cached">
): Promise<{ ConfirmationInteract: ButtonInteraction<"cached"> | null }> {
  const ConfirmationResponse = { ConfirmationInteract: null as ButtonInteraction<"cached"> | null };
  const ConfirmButton = new ButtonBuilder()
    .setCustomId(`confirm-import-dtime:${Interaction.user.id}`)
    .setLabel("Confirm and Proceed")
    .setStyle(ButtonStyle.Danger);

  const CancelButton = new ButtonBuilder()
    .setCustomId(`cancel-import-dtime:${Interaction.user.id}`)
    .setLabel("Cancel Import")
    .setStyle(ButtonStyle.Secondary);

  const ButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    ConfirmButton,
    CancelButton,
  ]);

  const PromptContainer = new WarnContainer()
    .setTitle("Duty Import Confirmation")
    .setFooter("*This prompt will automatically cancel after five minutes of inactivity.*")
    .setDescription(
      Dedent(`
        You are about to import duty time from a leaderboard file. This will *add* the \
        imported time data as *a single shift per individual* to existing records under \
        the \`${Interaction.options.getString("shift-type", false) ?? "Default"}\` shift type.

        Please confirm that you want to proceed with this action.
      `)
    );

  const PromptMessage = await Interaction.reply({
    flags: MessageFlags.IsComponentsV2,
    components: [PromptContainer.attachPromptActionRows(ButtonsRow)],
    withResponse: true,
  }).then((Resp) => Resp.resource!.message!);

  const ButtonResponse = await PromptMessage.awaitMessageComponent({
    filter: (i) => i.user.id === Interaction.user.id,
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  }).catch((Err) => {
    if (Err instanceof Error && Err.message.includes("time")) {
      return Interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [new InfoContainer().useInfoTemplate("DutyImportTimedOut")],
      }).then(() => null);
    }
    return null;
  });

  if (ButtonResponse?.customId.includes("cancel")) {
    return ButtonResponse.update({
      components: [new InfoContainer().useInfoTemplate("DutyImportCancelled")],
    }).then(() => ConfirmationResponse);
  } else if (ButtonResponse?.customId.includes("confirm")) {
    ConfirmationResponse.ConfirmationInteract = ButtonResponse;
  }

  return ConfirmationResponse;
}

async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  const ShiftType = Interaction.options.getString("shift-type", false) ?? "Default";
  const UploadedFile = Interaction.options.getAttachment("leaderboard-file", true);

  if (!(await IsAttachmentExtensionValid(Interaction, UploadedFile))) return;
  if (await HandleShiftTypeValidation(Interaction, ShiftType, true)) return;
  const { ConfirmationInteract } = await AwaitImportConfirmation(Interaction);

  if (!ConfirmationInteract) return;
  await ConfirmationInteract.update({
    flags: MessageFlags.IsComponentsV2,
    components: [new InfoContainer().useInfoTemplate("DutyImportInProgress")],
  });

  try {
    const FileContent = await (
      await fetch(UploadedFile.url, {
        signal: AbortSignal.timeout(30_000),
      })
    ).text();

    if (new Blob([FileContent]).size > MaxContentSize) {
      throw new AppError({ template: "DutyImportFContentTooLarge", showable: true });
    }

    const FileEntries = FileContent.split(/\r?\n/)
      .map((Line) => Line.trim())
      .filter((Line) => Line.length > 0)
      .filter((Line) => Line.length <= 1000)
      .slice(0, 5000)
      .map((Line) => {
        try {
          return (Line.match(LineRegex)?.groups as LeaderboardEntry) ?? null;
        } catch (RegexError: any) {
          AppLogger.warn({
            message: "Regex processing failed for line",
            line: Line.substring(0, 100),
            error: RegexError,
            stack: RegexError?.stack,
            label: FileLabel,
          });

          return null;
        }
      })
      .filter(
        (Entry) =>
          Entry &&
          "hr_time" in Entry &&
          "username" in Entry &&
          Entry.username.length >= 2 &&
          Entry.username.length <= 32 &&
          /^[a-zA-Z0-9_.]+$/.test(Entry.username) &&
          !Entry.hr_time.trim().match(/^0\s*?seconds$/i)
      )
      .map((Entry) => {
        if (!Entry) return null;
        if (!Entry.duty_ms && Entry.hr_time) {
          Entry.duty_ms = Math.round(Math.abs(ParseDuration(Entry.hr_time, "millisecond") ?? 0));
        } else if (typeof Entry.duty_ms === "string") {
          Entry.duty_ms = Number.parseInt(Entry.duty_ms, 10);
        }

        return Entry as LeaderboardEntry & { duty_ms: number };
      })
      .filter((Entry): Entry is LeaderboardEntry & { duty_ms: number } => Entry !== null);

    if (FileEntries.length === 0) {
      return ConfirmationInteract.editReply({
        components: [new ErrorContainer().useErrTemplate("DutyImportNoEntries")],
      });
    }

    const ResolvedUserIds = await ResolveUsernamesToIds(
      Interaction.guild,
      FileEntries.filter((Entry) => !Entry.user_id && Entry.username).map(
        (Entry) => Entry.username
      ),
      60_000
    );

    for (const Entry of FileEntries) {
      if (!Entry.user_id && Entry.username) {
        Entry.user_id = ResolvedUserIds.get(Entry.username) ?? undefined;
      }
    }

    // Group entries by `user_id` and aggregate duty times for duplicate usernames:
    const UserDutyMap = new Map<string, number>();
    const ValidEntries = FileEntries.filter((Entry) => Entry.user_id && Entry.duty_ms);

    for (const Entry of ValidEntries) {
      const UserId = Entry.user_id!;
      const CurrentDuty = UserDutyMap.get(UserId) || 0;
      UserDutyMap.set(UserId, CurrentDuty + Entry.duty_ms);
    }

    // Shift entries with unique timestamps to avoid ID collisions:
    let ShiftIds: string[] = [];
    let SanitizedShiftEntries: {
      _id: string;
      user: string;
      guild: string;
      flag: ShiftFlags;
      type: string;
      start_timestamp: number;
      end_timestamp: number;
      durations: { on_duty_mod: number };
    }[] = [];

    do {
      SanitizedShiftEntries = Array.from(UserDutyMap.entries()).map(
        ([UserId, TotalDutyMs], index) => {
          const ShiftIdEpoch =
            Date.now() + index * RandomInteger(1, 50) + index + RandomInteger(10, 99);

          return {
            _id: `${ShiftIdEpoch}${RandomInteger(10, 99)}`.slice(0, 15),
            user: UserId,
            guild: Interaction.guild.id,
            flag: ShiftFlags.Imported,
            type: ShiftType,
            start_timestamp: Date.now() + index,
            end_timestamp: Date.now() + index,
            durations: {
              on_duty_mod: TotalDutyMs,
            },
          };
        }
      );

      ShiftIds = SanitizedShiftEntries.map((Entry) => Entry._id);
    } while (new Set(ShiftIds).size !== SanitizedShiftEntries.length);

    const DataParsed = {
      UsersTotal: FileEntries.length,
      ShiftsOfType: ShiftType,
      SourceFileURL: UploadedFile.url,
      TotalShiftTime: Array.from(UserDutyMap.values()).reduce((Acc, DutyMs) => Acc + DutyMs, 0),
      UnresolvedUsers: FileEntries.length - ValidEntries.length,
      UniqueUsersImported: UserDutyMap.size,
      ShiftsTotal: FileEntries.reduce((Acc, Entry) => {
        return typeof Entry.shift_count === "string"
          ? Acc + Number.parseInt(Entry.shift_count, 10)
          : Acc + (Entry.shift_count ?? 0);
      }, 0),
    };

    const UnresolvedUsersText =
      DataParsed.UnresolvedUsers > 0
        ? `; ${DataParsed.UnresolvedUsers} unresolved (not found).`
        : "";

    try {
      await ShiftModel.insertMany(SanitizedShiftEntries);
    } catch (DBError: any) {
      const ErrorId = GetErrorId();
      AppLogger.error({
        message: "Failed to import duty data into the database.",
        error_id: ErrorId,
        label: FileLabel,
        stack: DBError.stack,
        error: DBError,
      });

      return new ErrorContainer()
        .useErrTemplate("DatabaseError")
        .setErrorId(ErrorId)
        .replyToInteract(ConfirmationInteract, false, false, "editReply");
    }

    return Promise.allSettled([
      ShiftActionLogger.LogShiftTimeImport(ConfirmationInteract, DataParsed),
      new SuccessContainer()
        .setThumbnail(null)
        .setTitle("Import Completed")
        .setDescription(
          Dedent(`
            The duty time import has been completed successfully. The following is a summary of the imported data:
            - **Unique Staff Imported:** ${DataParsed.UniqueUsersImported}
            - **Total Staff in File:** ${DataParsed.UsersTotal}${UnresolvedUsersText}
            - **Under Shift Type:** ${DataParsed.ShiftsOfType}
            - **Total Shift Time:** ${ReadableDuration(DataParsed.TotalShiftTime)}
          `)
        )
        .replyToInteract(ConfirmationInteract, false, true, "editReply"),
    ]);
  } catch (Err: any) {
    const ErrorId = GetErrorId();
    const ResponseContainer = new ErrorContainer().setErrorId(ErrorId);

    if (Err instanceof AppError && Err.is_showable) ResponseContainer.useErrClass(Err);
    else ResponseContainer.useErrTemplate("AppError");
    await ConfirmationInteract.editReply({
      components: [ResponseContainer],
    });

    AppLogger.error({
      message: "Import duty time from leaderboard file failed;",
      error_id: ErrorId,
      label: FileLabel,
      stack: Err.stack,
      error: Err,
    });
  }
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("import")
    .setDescription(
      "Transfer and migrate duty time from alternative apps into this system using a .txt leaderboard file."
    )
    .addAttachmentOption((Opt) =>
      Opt.setName("leaderboard-file")
        .setDescription("Leaderboard text file with recorded duty times.")
        .setRequired(true)
    )
    .addStringOption((Opt) =>
      Opt.setName("shift-type")
        .setDescription(
          "The shift type to add the imported time to. Defaults to the application's default type."
        )
        .setMinLength(3)
        .setMaxLength(20)
        .setRequired(false)
        .setAutocomplete(true)
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
