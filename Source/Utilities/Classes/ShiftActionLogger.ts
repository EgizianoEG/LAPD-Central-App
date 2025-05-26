/* eslint-disable sonarjs/no-duplicate-string */
// ------------------------------------------------------------------------------------

import {
  User,
  Guild,
  inlineCode,
  channelLink,
  userMention,
  GuildMember,
  EmbedBuilder,
  MessageFlags,
  resolveColor,
  ComponentType,
  BaseInteraction,
  ImageURLOptions,
  SendableChannels,
  AttachmentBuilder,
  time as FormatTime,
  SeparatorSpacingSize,
  APIContainerComponent,
  PermissionFlagsBits,
} from "discord.js";

import { Shifts } from "@Typings/Utilities/Database.js";
import { Colors } from "@Config/Shared.js";
import { ReadableDuration } from "@Utilities/Strings/Formatters.js";
import { App as DiscordApp } from "@DiscordApp";
import GuildModel from "@Models/Guild.js";
import Dedent from "dedent";

const BluewishText = (Text: string | number, ChannelId: string) => {
  return `[${Text}](${channelLink(ChannelId)})`;
};

// ------------------------------------------------------------------------------------
// Typings:
// --------
type ShiftLogAction = "start" | "break-start" | "break-end" | "end" | "auto-end" | "wipe";
type HydratedShiftDocument = Shifts.HydratedShiftDocument;
type DiscordUserInteract = BaseInteraction<"cached"> | GuildMember;

interface GetBaseDataOpts {
  /** The latest and up-to-date shift document. */
  shift_doc: HydratedShiftDocument;

  /** The target user's information (user id and guild id). */
  target_user: DiscordUserInteract | User | { user_id: string; guild_id: string };

  /**
   * The interaction that triggered the shift action. Used for accurate date of action.
   * Defaults to the current date.
   */
  init_interact: DiscordUserInteract;

  /** Should the base embed include the timestamp field set to the 'init interact' date? */
  set_timestamp?: boolean;
}

// ------------------------------------------------------------------------------------
// Class Definition:
// -----------------
export default class ShiftActionLogger {
  private static readonly AvatarIconOpts: ImageURLOptions = { size: 128 };

  /**
   * Fetches the shift actions logging channel for a specific guild.
   * @param Guild
   * @returns
   */
  private static async GetLoggingChannel(Guild: Guild): Promise<SendableChannels | null> {
    const LoggingChannelId = await GuildModel.findById(Guild.id)
      .select("settings.shift_management.log_channel")
      .then((GuildDoc) => {
        if (GuildDoc) {
          return GuildDoc.settings.shift_management.log_channel;
        }
        return null;
      });

    if (!LoggingChannelId) return null;
    const ChannelExists = await Guild.channels.fetch(LoggingChannelId);
    const AbleToSendMsgs =
      ChannelExists?.isSendable() &&
      ChannelExists.isTextBased() &&
      ChannelExists.permissionsFor(await Guild.members.fetchMe()).has(
        [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        true
      );

    return AbleToSendMsgs === true ? ChannelExists : null;
  }

  /**
   * Base data for a target member (inferred from the shift document and command interactions).
   * @param Options - Options for the base data.
   */
  private static async GetBaseData(Options: GetBaseDataOpts) {
    const Guild =
      Options.target_user instanceof GuildMember || Options.target_user instanceof BaseInteraction
        ? Options.target_user.guild
        : await DiscordApp.guilds.fetch(Options.shift_doc.guild);

    const UserInGuild =
      Options.target_user instanceof GuildMember
        ? Options.target_user
        : Options.target_user instanceof BaseInteraction
          ? Options.target_user.member
          : await Guild.members.fetch(Options.shift_doc.user);

    const InteractDate =
      Options.init_interact instanceof GuildMember
        ? new Date()
        : (Options.init_interact?.createdAt ?? new Date());

    const UserAvatarURL = UserInGuild.user.displayAvatarURL(this.AvatarIconOpts);
    const CurrNickname = UserInGuild.nickname ?? UserInGuild.user.displayName;
    const LoggingChannel = await this.GetLoggingChannel(Guild);
    const ShiftStartedRT = FormatTime(
      Math.round(Options.shift_doc.start_timestamp.valueOf() / 1000),
      "R"
    );

    const ShiftEndedRT = Options.shift_doc.end_timestamp
      ? FormatTime(Math.round(Options.shift_doc.end_timestamp.valueOf() / 1000), "R")
      : null;

    const BaseEmbed = new EmbedBuilder().setAuthor({
      iconURL: UserAvatarURL,
      name: `@${UserInGuild.user.username}`,
    });

    if (Options.set_timestamp) {
      BaseEmbed.setTimestamp(InteractDate);
    }

    return { BaseEmbed, LoggingChannel, ShiftStartedRT, ShiftEndedRT, CurrNickname, InteractDate };
  }

  /**
   * Adds additional text before the existing footer text.
   * @param Embed
   * @param AdditionalText
   * @returns
   */
  private static BeforeFooter(Embed: EmbedBuilder, AdditionalText: string): EmbedBuilder {
    if (Embed.data.footer?.text && Embed.data.footer.text.length > 0) {
      return Embed.setFooter({ text: `${AdditionalText}; ${Embed.data.footer.text}` });
    } else {
      return Embed.setFooter({ text: AdditionalText });
    }
  }

  /**
   * Logs a specific shift action to the appropriate and specified channel of a guild.
   * Note: this function automatically checks if the channel is viewable and if the bot has
   * the necessary permissions to send messages on it. It also silently ignore sending messages
   * if the conditions are not met (no view/send perms) without throwing an error.
   * @param Action - The shift action to log.
   * @param UserInteract - Interaction of the user who triggered the shift action.
   * @param ShiftDoc - The latest/updated shift document.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async Log(
    Action: Exclude<ShiftLogAction, "wipe">,
    UserInteract: DiscordUserInteract,
    ShiftDoc: HydratedShiftDocument
  ) {
    if (Action === "start") {
      return this.LogShiftStart(ShiftDoc, UserInteract);
    } else if (Action === "break-end") {
      return this.LogShiftBreakEnd(ShiftDoc, UserInteract);
    } else if (Action === "break-start") {
      return this.LogShiftBreakStart(ShiftDoc, UserInteract);
    } else if (Action === "end") {
      return this.LogShiftEnd(ShiftDoc, UserInteract);
    } else {
      return this.LogShiftAutomatedEnd(ShiftDoc, UserInteract, "Unknown");
    }
  }

  /**
   * Logs a shift start action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param [AdminUser] - The user who ended the shift, if any.
   * @param [TargetUser] - The user whose shift was ended, if any. Should be passed if `AdminUser` is also passed.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftStart(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: DiscordUserInteract,
    AdminUser?: User,
    TargetUser?: User
  ) {
    const BaseData = await this.GetBaseData({
      target_user: TargetUser ?? UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Started")
      .setColor(Colors.ShiftOn)
      .setFields(
        {
          inline: true,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Started: ${BaseData.ShiftStartedRT}
          `),
        },
        {
          inline: true,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        }
      );

    if (AdminUser) {
      this.BeforeFooter(LogEmbed, `Started by: @${AdminUser.username}`);
      LogEmbed.setTimestamp(BaseData.InteractDate);
    }

    if (TargetUser) {
      LogEmbed.setAuthor({
        name: `@${TargetUser.username}`,
        iconURL: TargetUser.displayAvatarURL(this.AvatarIconOpts),
      });
    }

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift break start action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param [AdminUser] - The user who ended the shift, if any.
   * @param [TargetUser] - The user whose shift was ended, if any. Should be passed if `AdminUser` is also passed.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftBreakStart(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: DiscordUserInteract,
    AdminUser?: User,
    TargetUser?: User
  ) {
    const BaseData = await this.GetBaseData({
      target_user: TargetUser ?? UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const BreakStartedRT = FormatTime(Math.round(ShiftDoc.events.breaks[0]![0] / 1000), "R");
    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Break Started")
      .setColor(Colors.ShiftBreak)
      .setFields(
        {
          inline: true,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Shift Started: ${BaseData.ShiftStartedRT}
              - Break Started: ${BreakStartedRT}
          `),
        },
        {
          inline: true,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        }
      );

    if (AdminUser) {
      LogEmbed.setTimestamp(BaseData.InteractDate);
      LogEmbed.setFooter({
        text: `Started by: @${AdminUser.username}; ${LogEmbed.data.footer?.text}`,
      });
    }

    if (TargetUser) {
      LogEmbed.setAuthor({
        name: `@${TargetUser.username}`,
        iconURL: TargetUser.displayAvatarURL(this.AvatarIconOpts),
      });
    }

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift break end action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param [AdminUser] - The user who ended the shift, if any.
   * @param [TargetUser] - The user whose shift was ended, if any. Should be passed if `AdminUser` is also passed.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftBreakEnd(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: DiscordUserInteract,
    AdminUser?: User,
    TargetUser?: User
  ) {
    const BaseData = await this.GetBaseData({
      target_user: TargetUser ?? UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const EndedBreak = ShiftDoc.events.breaks.findLast(() => true) as number[];
    const BreakStartedRT = FormatTime(Math.round(EndedBreak[0] / 1000), "R");
    const EndedBreakTime = ReadableDuration(EndedBreak[1] - EndedBreak[0]);
    const AllBreakTime = ReadableDuration(ShiftDoc.durations.on_break);
    const AllBTEqualsEndedBreak = ShiftDoc.durations.on_break === EndedBreak[1] - EndedBreak[0];

    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Break Ended")
      .setColor(Colors.ShiftBreak)
      .setFields(
        {
          inline: true,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Shift Started: ${BaseData.ShiftStartedRT}
              - Break Started: ${BreakStartedRT}
              - Break Time: ${EndedBreakTime}
              ${AllBTEqualsEndedBreak ? "" : `- All Break Time: ${AllBreakTime}`}
          `),
        },
        {
          inline: true,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        }
      );

    if (AdminUser) {
      LogEmbed.setTimestamp(BaseData.InteractDate);
      LogEmbed.setFooter({
        text: `Ended by: @${AdminUser.username}; ${LogEmbed.data.footer?.text}`,
      });
    }

    if (TargetUser) {
      LogEmbed.setAuthor({
        name: `@${TargetUser.username}`,
        iconURL: TargetUser.displayAvatarURL(this.AvatarIconOpts),
      });
    }

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift end action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param [AdminUser] - The user who ended the shift, if any.
   * @param [TargetUser] - The user whose shift was ended, if any. Should be passed if `AdminUser` is also passed.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftEnd(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: DiscordUserInteract,
    AdminUser?: User,
    TargetUser?: User
  ) {
    const BaseData = await this.GetBaseData({
      target_user: TargetUser ?? UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const OnDutyTime = ReadableDuration(ShiftDoc.durations.on_duty);
    const OnBreakTime = ShiftDoc.hasBreaks() ? ReadableDuration(ShiftDoc.durations.on_break) : null;

    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Ended")
      .setColor(Colors.ShiftOff)
      .addFields(
        {
          inline: false,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        },
        {
          inline: true,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Started: ${BaseData.ShiftStartedRT}
              - Ended: ${BaseData.ShiftEndedRT ?? "*N/A*"}
              - On-Duty Time: ${OnDutyTime}
              ${OnBreakTime ? `- On-Break Time: ${OnBreakTime}` : ""}
          `),
        },
        {
          inline: true,
          name: "Activities",
          value: Dedent(`
            Arrests Made: ${BluewishText(ShiftDoc.events.arrests, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Citations Issued: ${BluewishText(ShiftDoc.events.citations, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Incidents Reported: ${BluewishText(ShiftDoc.events.incidents, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
          `),
        }
      );

    if (AdminUser) {
      this.BeforeFooter(LogEmbed, `Ended by: @${AdminUser.username}`);
      LogEmbed.setTimestamp(BaseData.InteractDate);
    }

    if (TargetUser) {
      LogEmbed.setAuthor({
        name: `@${TargetUser.username}`,
        iconURL: TargetUser.displayAvatarURL(this.AvatarIconOpts),
      });
    }

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift end action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param EndReason - The reason for the shift being automatically ended.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftAutomatedEnd(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: DiscordUserInteract,
    EndReason: string
  ) {
    const BaseData = await this.GetBaseData({
      target_user: UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const OnDutyTime = ReadableDuration(ShiftDoc.durations.on_duty);
    const OnBreakTime = ShiftDoc.hasBreaks() ? ReadableDuration(ShiftDoc.durations.on_break) : null;

    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Automatically Ended")
      .setColor(Colors.ShiftOff)
      .addFields(
        {
          inline: true,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        },
        {
          inline: true,
          name: "Activities",
          value: Dedent(`
            Arrests Made: ${BluewishText(ShiftDoc.events.arrests, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Citations Issued: ${BluewishText(ShiftDoc.events.citations, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Incidents Reported: ${BluewishText(ShiftDoc.events.incidents, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
          `),
        },
        {
          inline: false,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Started: ${BaseData.ShiftStartedRT}
              - Ended: ${BaseData.ShiftEndedRT ?? "*N/A*"}
              - End Reason: ${inlineCode(EndReason)}
              - On-Duty Time: ${OnDutyTime}
              ${OnBreakTime ? `- On-Break Time: ${OnBreakTime}` : ""}
              ${OnBreakTime ? `- Breaks: ${BluewishText(ShiftDoc.events.breaks.length, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}` : ""}
          `),
        }
      );

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift void action to the appropriate and specified channel of a guild.
   * @param ShiftDoc - The latest/updated shift document.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param [AdminUser] - The user who voided the shift, if any.
   * @param [TargetUser] - The user whose shift was voided, if any. Should be passed if `AdminUser` is also passed.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftVoid(
    ShiftDoc: HydratedShiftDocument,
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    AdminUser?: User,
    TargetUser?: User
  ) {
    const BaseData = await this.GetBaseData({
      target_user: TargetUser ?? UserInteract,
      shift_doc: ShiftDoc,
      init_interact: UserInteract,
    });

    const VoidEpoch = FormatTime(UserInteract.createdAt, "R");
    const OnDutyTime = ReadableDuration(ShiftDoc.durations.on_duty);
    const OnBreakTime = ShiftDoc.hasBreaks() ? ReadableDuration(ShiftDoc.durations.on_break) : null;

    const LogEmbed = BaseData.BaseEmbed.setTitle("Shift Voided")
      .setColor(Colors.ShiftVoid)
      .addFields(
        {
          inline: true,
          name: "Officer Details",
          value: Dedent(`
            - Officer: ${userMention(ShiftDoc.user)}
            - Nickname: ${inlineCode(BaseData.CurrNickname)}
          `),
        },
        {
          inline: true,
          name: "Activities",
          value: Dedent(`
            Arrests Made: ${BluewishText(ShiftDoc.events.arrests, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Citations Issued: ${BluewishText(ShiftDoc.events.citations, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
            Incidents Reported: ${BluewishText(ShiftDoc.events.incidents, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}
          `),
        },
        {
          inline: false,
          name: "Shift Details",
          value: Dedent(`
            - Shift ID: ${inlineCode(ShiftDoc._id)}
              - Type: ${inlineCode(ShiftDoc.type)}
              - Started: ${BaseData.ShiftStartedRT}
              - Voided: ${BaseData.ShiftEndedRT ?? VoidEpoch}
              - On-Duty Time: ${OnDutyTime}
              ${OnBreakTime ? `- On-Break Time: ${OnBreakTime}` : ""}
              ${OnBreakTime ? `- Breaks: ${BluewishText(ShiftDoc.events.breaks.length, BaseData.LoggingChannel?.id ?? UserInteract.guild.id)}` : ""}
          `),
        }
      );

    if (AdminUser) {
      this.BeforeFooter(LogEmbed, `Voided by: @${AdminUser.username}`);
      LogEmbed.setTimestamp(UserInteract.createdAt);
    }

    if (TargetUser) {
      LogEmbed.setAuthor({
        name: `@${TargetUser.username}`,
        iconURL: TargetUser.displayAvatarURL(this.AvatarIconOpts),
      });
    }

    return BaseData.LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift wipe-all action to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param WipeResult - The deletion result of mongoose/mongodb.
   * @param ShiftType - Type of shifts that were deleted; defaults to `null` which translates into `*All Types*`.
   * @param TargettedUser - An optional parameter to only specify a targetted user.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftsWipe(
    UserInteract: DiscordUserInteract,
    WipeResult: Mongoose.mongo.DeleteResult & {
      totalTime: number;
      shiftsAfter?: Date;
      shiftsBefore?: Date;
    },
    ShiftType?: string | string[] | null,
    TargettedUser?: User
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.ShiftOff)
      .setTitle(TargettedUser ? "Member Shifts Wiped" : "Shifts Wiped")
      .setFooter({ text: `Wiped by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          ${TargettedUser ? `**Member:** ${userMention(TargettedUser.id)}` : ""}
          **Shifts Deleted:** ${BluewishText(WipeResult.deletedCount, LoggingChannel?.id ?? UserInteract.id)}
        `)
      );

    if (!(UserInteract instanceof GuildMember)) {
      LogEmbed.setTimestamp(UserInteract.createdAt);
    }

    if (Array.isArray(ShiftType) && ShiftType.length > 0) {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Shifts of Type:** ${ShiftType.map((Type) =>
          inlineCode(Type)
        ).join(", ")}`
      );
    } else if (typeof ShiftType === "string") {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Shifts of Type:** ${inlineCode(ShiftType)}`
      );
    } else {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Shifts of Type:** *All Shift Types*`
      );
    }

    if (WipeResult.shiftsAfter) {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Shifts After:** ${FormatTime(WipeResult.shiftsAfter, "D")}`
      );
    } else if (WipeResult.shiftsBefore) {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Shifts Before:** ${FormatTime(WipeResult.shiftsBefore, "D")}`
      );
    }

    LogEmbed.setDescription(
      `${LogEmbed.data.description}\n**On-Duty Time Sum:** ${WipeResult.totalTime ? ReadableDuration(WipeResult.totalTime) : "*N/A*"}`
    );

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift wipe-all action to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd).
   * @param TotalEnded - Total shifts that were ended.
   * @param ShiftType - Type of shifts that were ended; defaults to `null` which translates into `*All Types*`.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftsEndAll(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    TotalEnded: number,
    ShiftType?: string | null
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setTimestamp(UserInteract.createdAt)
      .setColor(Colors.ShiftOff)
      .setTitle("Shifts Ended")
      .setFooter({ text: `Ended by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          **Shift Count:** ${BluewishText(TotalEnded, LoggingChannel?.id ?? UserInteract.id)}
          **Shift${TotalEnded === 1 ? "" : "s"} of Type:** ${ShiftType ? `${inlineCode(ShiftType)}` : "*All Shift Types*"}
        `)
      );

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift delete action done by an administrative user to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd) from the admin user.
   * @param ShiftDeleted - ...
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftDelete(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    ShiftDeleted: HydratedShiftDocument
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setTimestamp(UserInteract.createdAt)
      .setColor(Colors.ShiftOff)
      .setTitle("Member Shift Deleted")
      .setFooter({ text: `Deleted by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          **Member:** <@${ShiftDeleted.user}>
          **Shift ID:** ${inlineCode(ShiftDeleted._id)}
          **Shift of Type:** ${inlineCode(ShiftDeleted.type)}
          **On-Duty Time:** ${ReadableDuration(ShiftDeleted.durations.on_duty)}
          ${ShiftDeleted.durations.on_break ? `**On-Break Time:** ${ReadableDuration(ShiftDeleted.durations.on_break)}` : ""}
        `)
      );

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift time set action done by an administrative user to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd) from the admin user.
   * @param OldShiftDoc - The old shift document with old durations.
   * @param ShiftUpdated - ...
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftTimeSet(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    OldShiftDoc: HydratedShiftDocument,
    ShiftUpdated: HydratedShiftDocument
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setTimestamp(UserInteract.createdAt)
      .setColor(Colors.ShiftVoid)
      .setTitle("Shift Modified — Time Set")
      .setFooter({ text: `Set by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          **Member:** <@${ShiftUpdated.user}>
          **Shift ID:** ${inlineCode(ShiftUpdated._id)}
          **Shift of Type:** ${inlineCode(ShiftUpdated.type)}
          **Previous On-Duty Time:** ${ReadableDuration(OldShiftDoc.durations.on_duty)}
          **Set On-Duty Time:** ${ReadableDuration(ShiftUpdated.durations.on_duty)}
          ${ShiftUpdated.hasBreaks() ? `**On-Break Time:** ${ReadableDuration(ShiftUpdated.durations.on_break)}` : ""}
        `)
      );

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift time reset action done by an administrative user to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd) from the admin user.
   * @param OldShiftDoc - The old shift document with old durations.
   * @param ShiftUpdated - ...
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftTimeReset(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    OldShiftDoc: HydratedShiftDocument,
    ShiftUpdated: HydratedShiftDocument
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setTimestamp(UserInteract.createdAt)
      .setColor(Colors.ShiftOff)
      .setTitle("Shift Modified — Time Reset")
      .setFooter({ text: `Reset by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          **Member:** <@${ShiftUpdated.user}>
          **Shift ID:** ${inlineCode(ShiftUpdated._id)}
          **Shift of Type:** ${inlineCode(ShiftUpdated.type)}
          **Current On-Duty Time:** ${ReadableDuration(ShiftUpdated.durations.on_duty)}
          **Previous On-Duty Time:** ${ReadableDuration(OldShiftDoc.durations.on_duty)}
          ${ShiftUpdated.hasBreaks() ? `**On-Break Time:** ${ReadableDuration(ShiftUpdated.durations.on_break)}` : ""}
        `)
      );

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift time add/subtract action done by an administrative user to the appropriate and specified channel of a guild.
   * @param UserInteract - The received discordjs interaction (button/cmd) from the admin user.
   * @param ShiftModified - ...
   * @param TimeAddedSub - The time which has been added/subtracted in milliseconds.
   * @param ActionType - The action taken on the shift; either adding or subtracting.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftTimeAddSub(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    ShiftModified: HydratedShiftDocument,
    TimeAddedSub: number,
    ActionType: "Add" | "Subtract"
  ) {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    const LogEmbed = new EmbedBuilder()
      .setTimestamp(UserInteract.createdAt)
      .setFooter({ text: `Modified by: @${UserInteract.user.username}` })
      .setDescription(
        Dedent(`
          **Member:** <@${ShiftModified.user}>
          **Shift ID:** ${inlineCode(ShiftModified._id)}
          **Shift of Type:** ${inlineCode(ShiftModified.type)}
          **Time ${ActionType}ed:** ${ReadableDuration(TimeAddedSub)}
          **On-Duty Time:** ${ReadableDuration(ShiftModified.durations.on_duty)}
          ${ShiftModified.hasBreaks() ? `**On-Break Time:** ${ReadableDuration(ShiftModified.durations.on_break)}` : ""}
        `)
      );

    if (ActionType === "Add") {
      LogEmbed.setTitle("Shift Modified — Time Add");
      LogEmbed.setColor(Colors.ShiftOn);
    } else {
      LogEmbed.setTitle("Shift Modified — Time Subtract");
      LogEmbed.setColor(Colors.ShiftOff);
    }

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }

  /**
   * Logs a shift time import action done by an administrative or management user to the appropriate and specified channel of a guild.
   * @param UserInteract - The received interaction (button/cmd) from the admin/management user.
   * @param ImportDetails - ...
   * @param ImportDetails.ShiftsTotal - The total number of shifts imported.
   * @param ImportDetails.UsersTotal - The total number of individuals included in the imported shifts.
   * @param ImportDetails.UnresolvedUsers - The total number of individuals that were not found in the server and thus could not add time to.
   * @param ImportDetails.TotalShiftTime - The total time (on-duty time in milliseconds) of the shifts imported.
   * @param ImportDetails.SourceFileURL - The URL of the source file used for the import (the one which was uploaded).
   * @param ImportDetails.ShiftsOfType - The type of which shifts were imported under.
   * @returns A promise that resolves to the logging message sent or `undefined` if it wasn't.
   */
  public static async LogShiftTimeImport(
    UserInteract: Exclude<DiscordUserInteract, GuildMember>,
    ImportDetails: {
      ShiftsTotal: number;
      UsersTotal: number;
      UnresolvedUsers: number;
      TotalShiftTime: number;
      SourceFileURL: string;
      ShiftsOfType: string;
    }
  ): Promise<DiscordJS.Message<boolean> | undefined> {
    const LoggingChannel = await this.GetLoggingChannel(UserInteract.guild);
    if (!LoggingChannel) return undefined;

    const AccentColor = resolveColor(Colors.ShiftOn);
    const ImportData = new AttachmentBuilder(ImportDetails.SourceFileURL, {
      name: "import_data.txt",
      description: "Shift import source.",
    });

    const CompContainerAPIObj: APIContainerComponent = {
      type: ComponentType.Container,
      accent_color: AccentColor,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: "### Shift Time Imported",
        },
        {
          divider: true,
          type: ComponentType.Separator,
          spacing: SeparatorSpacingSize.Small,
        },
        {
          type: ComponentType.TextDisplay,
          content: Dedent(`
            **Staff Count:** ${BluewishText(ImportDetails.UsersTotal, LoggingChannel.id)}
            **Unresolved Staff:** ${BluewishText(ImportDetails.UnresolvedUsers, LoggingChannel.id)}
            **Imported Shifts:** ${ImportDetails.ShiftsTotal >= ImportDetails.UsersTotal - ImportDetails.UnresolvedUsers ? BluewishText(ImportDetails.ShiftsTotal, LoggingChannel.id) : "*Unknown Count*"}
            **Imported Under Type:** ${inlineCode(ImportDetails.ShiftsOfType)}
            **Total Time Imported:** ${ReadableDuration(ImportDetails.TotalShiftTime)}
          `),
        },
        {
          divider: true,
          type: ComponentType.Separator,
          spacing: SeparatorSpacingSize.Small,
        },
        {
          type: ComponentType.TextDisplay,
          content: `-# Imported by: ${userMention(UserInteract.user.id)}; around ${FormatTime(UserInteract.createdAt, "R")}`,
        },
        {
          type: ComponentType.File,
          file: {
            url: `attachment://${ImportData.name}`,
            content_type: "text/plain",
          },
        },
      ],
    };

    return LoggingChannel.send({
      allowedMentions: { users: [] },
      components: [CompContainerAPIObj],
      files: [ImportData],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
