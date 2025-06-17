/* eslint-disable sonarjs/no-duplicate-string */
import {
  User,
  Guild,
  codeBlock,
  userMention,
  GuildMember,
  ButtonStyle,
  EmbedBuilder,
  ButtonBuilder,
  BaseInteraction,
  ImageURLOptions,
  ActionRowBuilder,
  TextBasedChannel,
  ButtonInteraction,
  GuildBasedChannel,
  time as FormatTime,
  PermissionFlagsBits,
  ModalSubmitInteraction,
} from "discord.js";

import { Colors, Emojis, Images, Thumbs } from "@Config/Shared.js";
import { ReadableDuration, Dedent } from "@Utilities/Strings/Formatters.js";
import { UserActivityNotice } from "@Typings/Utilities/Database.js";
import { addMilliseconds } from "date-fns";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";

type UserActivityNoticeDoc = UserActivityNotice.ActivityNoticeHydratedDocument;
type ManagementInteraction = ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">;

// ------------------------------------------------------------------------------------
// Base Class Definition:
// ----------------------
/**
 * Base class for shared methods and properties for user activity notices.
 */
export class BaseUserActivityNoticeLogger {
  protected readonly ImgURLOpts: ImageURLOptions = { size: 128 };
  protected readonly title: string;
  protected readonly title_lower: string;
  protected readonly module_setting: "leave_notices" | "reduced_activity";
  protected readonly cmd_name: string;

  constructor(protected readonly is_leave: boolean) {
    this.title = is_leave ? "Leave of Absence" : "Reduced Activity";
    this.title_lower = this.title.toLowerCase();
    this.module_setting = is_leave ? "leave_notices" : "reduced_activity";
    this.cmd_name = is_leave ? "loa" : "ra";
  }

  /**
   * Checks if the application has the required permissions in the specified channel to either send or edit notice messages.
   * @param Guild - The Discord guild where the channel is located.
   * @param Channel - The guild-based channel to check permissions for.
   * @param Perms - The permission flags to check for. Defaults to `ViewChannel` and `SendMessages` permissions.
   * @returns A promise that resolves to `true` if the bot has all required permissions and the channel is sendable and text-based, `false` otherwise.
   */
  protected async LoggingChannelHasPerms(
    Guild: Guild,
    Channel: GuildBasedChannel,
    Perms: bigint | bigint[] = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  ) {
    const ClientMember = await Guild.members.fetchMe().catch(() => null);
    return (
      ClientMember &&
      Channel.isSendable() &&
      Channel.isTextBased() &&
      Channel.permissionsFor(ClientMember).has(Perms, true)
    );
  }

  /**
   * Retrieves the logging channel for the specified type (log or requests).
   * @param Guild - The guild where the logging channel is being retrieved.
   * @param Type - The type of logging channel to return:
   * - `log`: The channel where updates on notices will be sent.
   * - `requests`: The channel where requests for notices will be sent for approval.
   * @param AdditionalPerms - Additional permissions required for the logging channel in order to return.
   * @returns The logging channel if found and accessible, otherwise `null`.
   */
  protected async FetchLoggingChannel(
    Guild: Guild,
    Type: "log" | "requests",
    AdditionalPerms?: bigint | bigint[]
  ) {
    const LoggingChannelId = await GetGuildSettings(Guild.id).then((Settings) => {
      if (!Settings) return null;
      return Settings[this.module_setting][`${Type}_channel`];
    });

    if (!LoggingChannelId) return null;
    const LoggingChannel = await Guild.channels.fetch(LoggingChannelId).catch(() => null);
    const AbleToSendMsgs =
      LoggingChannel && (await this.LoggingChannelHasPerms(Guild, LoggingChannel, AdditionalPerms));

    return AbleToSendMsgs === true
      ? (LoggingChannel as GuildBasedChannel & TextBasedChannel)
      : null;
  }

  /**
   * Retrieves and validates a Discord channel from a channel:message ID string format.
   * @param Guild - The Discord guild to fetch the channel from.
   * @param ChannelId - A string containing channel Id.
   * @param AdditionalPerms - Additional permissions to check for the channel. Defaults to `ViewChannel`, `SendMessages`, and `ReadMessageHistory`.
   * @returns The validated channel if it exists, is sendable, text-based, and has required permissions; otherwise `null`.
   */
  protected async FetchValidRequestsChannelFromId(
    Guild: Guild,
    ChannelId: string,
    AdditionalPerms: bigint | bigint[] = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]
  ): Promise<(GuildBasedChannel & TextBasedChannel) | null> {
    const Channel = await Guild.channels.fetch(ChannelId).catch(() => null);
    return Channel?.isSendable() &&
      Channel.isTextBased() &&
      (await this.LoggingChannelHasPerms(Guild, Channel, AdditionalPerms))
      ? Channel
      : null;
  }

  /**
   * Retrieves the profile image URL of a user in the specified guild.
   * @param Guild - The guild where the user is located.
   * @param UserId - The Discord ID of the user.
   * @returns The user's profile image URL or a fallback image if the user cannot be fetched.
   */
  protected async GetUserProfileImageURL(Guild: Guild, UserId: string): Promise<string> {
    const User = await Guild.members.fetch(UserId).catch(() => null);
    return User?.displayAvatarURL(this.ImgURLOpts) ?? Thumbs.UnknownImage;
  }

  /**
   * Concatenates multiple lines into a single string, filtering out null or undefined values.
   * @param Lines - The lines to concatenate.
   * @returns A single string with all valid lines joined by newlines.
   */
  protected ConcatenateLines(...Lines: (string | undefined | null)[]): string {
    return Lines.filter(Boolean).join("\n");
  }

  /**
   * Generates a quota reduction text for reduced activity notices.
   * @param NoticeDocument - The activity notice document.
   * @returns A formatted string representing the quota reduction, or `undefined` if not applicable.
   */
  protected GetQuotaReductionText(NoticeDocument: UserActivityNoticeDoc): string | undefined {
    return this.is_leave ? undefined : `**Quota Reduction:** ${NoticeDocument.quota_reduction}`;
  }

  /**
   * Creates a set of management buttons for approving, denying, or requesting additional information about a notice.
   * @param IsExt - Whether the buttons are for an extension request.
   * @param UserId - The ID of the user who submitted the notice.
   * @param NoticeId - The ID of the notice.
   * @param NoticeReviewed - Whether the notice has already been reviewed (optional, defaults to `false`).
   *                         This determines whether the buttons should be disabled or not.
   * @returns An action row containing the management buttons.
   */
  protected CreateManagementButtons(
    IsExt: boolean,
    UserId: string,
    NoticeId: string,
    NoticeReviewed: boolean = false
  ): ActionRowBuilder<ButtonBuilder> {
    const ExtPrefix = IsExt ? "ext-" : "";
    return new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setCustomId(`${this.cmd_name}-${ExtPrefix}approve:${UserId}:${NoticeId}`)
        .setLabel("Approve")
        .setEmoji(Emojis.WhiteCheck)
        .setDisabled(NoticeReviewed ?? false)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${this.cmd_name}-${ExtPrefix}deny:${UserId}:${NoticeId}`)
        .setLabel("Deny")
        .setEmoji(Emojis.WhiteCross)
        .setDisabled(NoticeReviewed ?? false)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${this.cmd_name}-info:${UserId}:${NoticeId}`)
        .setLabel("Additional Information")
        .setEmoji(Emojis.WhitePlus)
        .setDisabled(NoticeReviewed ?? false)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  /**
   * Constructs a pre-defined embed for a user activity notice request.
   * @param Opts - Options for constructing the embed:
   * - `Type`: The type of the request (e.g., "Cancelled", "Pending", "Extension").
   * - `Guild`: The guild where the request was made.
   * - `NoticeDocument`: The activity notice document.
   * - `CancellationDate`: The date when the request was cancelled (if applicable).
   * @returns A pre-configured embed for the request.
   */
  protected GetRequestEmbed(Opts: {
    Type?: "Cancelled" | "Pending" | "Extension";
    Guild?: Guild;
    NoticeDocument: UserActivityNoticeDoc;
    CancellationDate?: Date;
  }) {
    Opts.Type = Opts.Type ?? "Pending";
    const RequesterId = Opts.NoticeDocument.user;
    const Strikethrough = Opts.Type === "Cancelled" ? "~~" : "";
    const Embed = new EmbedBuilder()
      .setImage(Images.FooterDivider)
      .setFooter({ text: `Reference ID: ${Opts.NoticeDocument._id}` })
      .setTitle(`${Opts.Type}  |  ${this.title} Request`)
      .setColor(Opts.Type === "Cancelled" ? Colors.LOARequestDenied : Colors.LOARequestPending);

    if (Opts.Type === "Pending" || Opts.Type === "Cancelled") {
      Embed.setDescription(
        this.ConcatenateLines(
          `**Requester:** ${userMention(RequesterId)}`,
          this.GetQuotaReductionText(Opts.NoticeDocument),
          `**Duration:** ${Opts.NoticeDocument.duration_hr}`,
          `**Ends On:** ${Strikethrough}${Opts.Type === "Pending" && Opts.NoticeDocument.review_date ? "" : "around "}${FormatTime(Opts.NoticeDocument.end_date, "D")}${Strikethrough}`,
          `**Reason:** ${Opts.NoticeDocument.reason}`
        )
      );

      if (Opts.CancellationDate) {
        Embed.setTimestamp(Opts.CancellationDate);
        Embed.setFooter({
          text: `Reference ID: ${Opts.NoticeDocument._id}; cancelled by requester on`,
          iconURL:
            Opts.Guild?.members.cache.get(RequesterId)?.user.displayAvatarURL(this.ImgURLOpts) ??
            Thumbs.UnknownImage,
        });
      }
    } else {
      Embed.setDescription(
        Dedent(`
          **Requester:** ${userMention(RequesterId)}
          **Requested Extension:** ${Opts.NoticeDocument.extended_duration_hr}
          **Total Duration:** ${ReadableDuration(Opts.NoticeDocument.duration + Opts.NoticeDocument.extension_request!.duration)}
          **LOA Started On:** ${FormatTime(Opts.NoticeDocument.review_date!, "F")}
          **LOA Ends On:** after extension, around ${FormatTime(addMilliseconds(Opts.NoticeDocument.end_date, Opts.NoticeDocument.extension_request!.duration), "D")}
          **Extension Reason:** ${Opts.NoticeDocument.extension_request?.reason || "[Unspecified]"}
        `)
      );
    }

    return Embed;
  }

  /**
   * Sends a new activity notice request to the requests channel for approval.
   * Also sends a DM notice to the requester if possible.
   * @param Interaction - The interaction originating from the requester.
   * @param PendingNotice - The activity notice document pending approval.
   * @returns A Promise resolving to the sent request message if successful.
   */
  async SendRequest(
    Interaction: SlashCommandInteraction<"cached">,
    PendingNotice: UserActivityNoticeDoc
  ) {
    const RequestsChannel = await this.FetchLoggingChannel(Interaction.guild, "requests");
    const Requester = await Interaction.guild.members.fetch(PendingNotice.user).catch(() => null);

    // Send a DM notice to the requester.
    if (Requester) {
      const DMNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestPending)
        .setFooter({ text: `Reference ID: ${PendingNotice._id}` })
        .setTitle(`${this.title} — Request Under Review`)
        .setDescription(
          Dedent(`
            Your ${this.title_lower} request, submitted on ${FormatTime(PendingNotice.request_date, "D")}, has been received and is \
            waiting for a review by the management team. The requested notice duration is ${PendingNotice.duration_hr}, and will \
            start on the time of approval. To cancel your pending request, please use the \`/${this.cmd_name} manage\` command on the server.
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    // Send the request message if a requests channel is set.
    if (!RequestsChannel) return;
    const RequestEmbed = this.GetRequestEmbed({ Type: "Pending", NoticeDocument: PendingNotice });
    const ManagementComponents = this.CreateManagementButtons(
      false,
      Interaction.user.id,
      PendingNotice._id.toString()
    );

    return RequestsChannel.send({ embeds: [RequestEmbed], components: [ManagementComponents] });
  }

  /**
   * Generates a message embed for a user activity notice request with the specified status.
   * @param Guild - The guild where the request was made.
   * @param NoticeDocument - The updated activity notice document.
   * @param RequestStatus - The status of the request ("Approved", "Denied", "Cancelled", or "Pending").
   * @returns A Promise resolving to the configured embed for the request.
   */
  async GetRequestMessageEmbedWithStatus(
    Guild: Guild,
    NoticeDocument: UserActivityNoticeDoc,
    RequestStatus: "Approved" | "Denied" | "Cancelled" | "Pending"
  ) {
    const RequestEmbed = this.GetRequestEmbed({
      Guild,
      Type: RequestStatus === "Cancelled" ? RequestStatus : "Pending",
      NoticeDocument,
      CancellationDate:
        RequestStatus === "Cancelled" ? NoticeDocument.review_date : (undefined as any),
    }).setTimestamp(NoticeDocument.review_date);

    if (RequestStatus === "Approved" && NoticeDocument.review_date) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, NoticeDocument.reviewed_by!.id);
      RequestEmbed.setColor(Colors.LOARequestApproved)
        .setTitle(`Approved  |  ${this.title} Request`)
        .setFooter({
          text: `Reference ID: ${NoticeDocument._id}; approved by @${NoticeDocument.reviewed_by!.username} on`,
          iconURL: AvatarURL,
        });
    } else if (RequestStatus === "Denied" && NoticeDocument.review_date) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, NoticeDocument.reviewed_by!.id);
      RequestEmbed.setColor(Colors.LOARequestDenied)
        .setTitle(`Denied  |  ${this.title} Request`)
        .setFooter({
          text: `Reference ID: ${NoticeDocument._id}; denied by @${NoticeDocument.reviewed_by!.username} on`,
          iconURL: AvatarURL,
        });
    } else if (RequestStatus.includes("Cancelled")) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, NoticeDocument.user);
      RequestEmbed.setColor(Colors.LOARequestDenied)
        .setTitle(`Cancelled  |  ${this.title} Request`)
        .setFooter({
          iconURL: AvatarURL,
          text: `Reference ID: ${NoticeDocument._id}; cancelled by requester on`,
        });
    }

    return RequestEmbed;
  }

  /**
   * Logs the approval of an activity notice to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff approving the notice.
   * @param ApprovedRequest - The approved activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogApproval(Interaction: ManagementInteraction, ApprovedRequest: UserActivityNoticeDoc) {
    const Requester = await Interaction.guild.members.fetch(ApprovedRequest.user).catch(() => null);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");

    if (Requester) {
      const DMApprovalNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}` })
        .setTitle(`${this.title} — Approval Notice`)
        .setDescription(
          Dedent(`
            Your leave of absence request, submitted on ${FormatTime(ApprovedRequest.request_date, "D")}, has been approved.
            Your LOA is set to expire on ${FormatTime(ApprovedRequest.end_date, "F")} (${FormatTime(ApprovedRequest.end_date, "R")}). \
            To manage your leave, including requesting an extension or an early termination, please use the \`/loa manage\` command on the server.
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL({ size: 128 }) ?? Thumbs.Transparent,
        });

      if (!this.is_leave) {
        DMApprovalNotice.setDescription(
          Dedent(`
            Your reduced activity request, submitted on ${FormatTime(ApprovedRequest.request_date, "D")}, has been approved.
            Your RA is set to expire on ${FormatTime(ApprovedRequest.end_date, "F")} (${FormatTime(ApprovedRequest.end_date, "R")}).
          `)
        );
      }

      Requester.send({ embeds: [DMApprovalNotice] }).catch(() => null);
    }

    // Send a log message to the server specified channel in the config.
    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle(`${this.title} Approval`)
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}; approved on` })
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: this.ConcatenateLines(
              `**Requester:** ${userMention(ApprovedRequest.user)}`,
              this.GetQuotaReductionText(ApprovedRequest),
              `**Duration:** ${ApprovedRequest.duration_hr}`,
              `**Started:** ${FormatTime(ApprovedRequest.review_date || Interaction.createdAt, "F")}`,
              `**Ends On:** ${FormatTime(ApprovedRequest.end_date, "F")}`,
              `**Reason:** ${ApprovedRequest.reason}`
            ),
          },
          {
            inline: true,
            name: "Approval Info",
            value: Dedent(`
              **Approver**: ${userMention(Interaction.user.id)}
              **Notes:**
              ${ApprovedRequest.reviewer_notes || "*N/A*"}
            `),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] });
    }

    if (ApprovedRequest.request_msg) {
      const [ReqMsgChannelId, ReqMsgId] = ApprovedRequest.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqMsgChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({
        Type: "Pending",
        NoticeDocument: ApprovedRequest,
      })
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle(`Approved  |  ${this.title} Request`)
        .setFooter({
          text: `Reference ID: ${ApprovedRequest._id}; approved by @${Interaction.user.username} on`,
          iconURL: Interaction.user.displayAvatarURL(this.ImgURLOpts),
        });

      const ReviewActionButtons = this.CreateManagementButtons(
        false,
        ApprovedRequest.user,
        ApprovedRequest._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Logs the denial of an activity notice to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff denying the notice.
   * @param DeniedRequest - The denied activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogDenial(Interaction: ManagementInteraction, DeniedRequest: UserActivityNoticeDoc) {
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(DeniedRequest.user).catch(() => null);

    if (Requester) {
      const DMDenialNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}` })
        .setTitle(`${this.title} — Denial Notice`)
        .setDescription(
          Dedent(`
            Your ${this.title_lower} request, submitted on ${FormatTime(DeniedRequest.request_date, "D")}, has been denied. \
            You may submit a new request within 3 hours by using the \`/${this.cmd_name} request\` command on the server. 
            
            **The following note(s) were provided by the reviewer:**
            ${codeBlock("", DeniedRequest.reviewer_notes || "N/A")}
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMDenialNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setColor(Colors.LOARequestDenied)
        .setTitle(`${this.title} Denial`)
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}; denied on` })
        .setTimestamp(Interaction.createdAt)
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: this.ConcatenateLines(
              `**Requester:** ${userMention(DeniedRequest.user)}`,
              this.GetQuotaReductionText(DeniedRequest),
              `**Duration:** ${DeniedRequest.duration_hr}`,
              `**Ends On:** ${FormatTime(DeniedRequest.end_date, "D")}`,
              `**Reason:** ${DeniedRequest.reason}`
            ),
          },
          {
            inline: true,
            name: "Denial Info",
            value: Dedent(`
              **Denier**: ${userMention(Interaction.user.id)}
              **Notes:**
              ${DeniedRequest.reviewer_notes || "*N/A*"}
            `),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] });
    }

    if (DeniedRequest.request_msg) {
      const [ReqMsgChannelId, ReqMsgId] = DeniedRequest.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqMsgChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({
        Type: "Pending",
        NoticeDocument: DeniedRequest,
      })
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setTitle(`Denied  |  ${this.title} Request`)
        .setFooter({
          text: `Reference ID: ${DeniedRequest._id}; denied by @${Interaction.user.username} on`,
          iconURL: Interaction.user.displayAvatarURL(this.ImgURLOpts),
        });

      const ReviewActionButtons = this.CreateManagementButtons(
        false,
        DeniedRequest.user,
        DeniedRequest._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Logs the cancellation of an activity notice to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the requester cancelling the notice.
   * @param CancelledRequest - The cancelled activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogCancellation(
    Interaction: ButtonInteraction<"cached">,
    CancelledRequest: UserActivityNoticeDoc
  ) {
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(CancelledRequest.user)
      .catch(() => null);

    if (Requester) {
      const DMCancellationNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setFooter({ text: `Reference ID: ${CancelledRequest._id}` })
        .setTitle(`${this.title} — Cancellation Notice`)
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      if (CancelledRequest.reviewed_by) {
        DMCancellationNotice.setDescription(
          Dedent(`
            You are no longer on ${this.is_leave ? "leave" : this.title_lower} as your most recent ${this.title_lower}, submitted on ${FormatTime(CancelledRequest.request_date, "D")}, \
            has been cancelled at your request on ${FormatTime(Interaction.createdAt, "d")}. It was set to end ${FormatTime(CancelledRequest.end_date, "R")}.
          `)
        );
      } else {
        DMCancellationNotice.setDescription(
          Dedent(`
            Your previously submitted ${this.title_lower} request, with a duration of ${CancelledRequest.duration_hr}, has been cancelled at your request. \
            There is no active ${this.title_lower} on record for you at this time.
          `)
        );
      }

      Requester.send({ embeds: [DMCancellationNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestCancelled)
        .setTitle(`${this.title} Cancellation`)
        .setFooter({ text: `Reference ID: ${CancelledRequest._id}; cancelled by requester on` })
        .addFields({
          inline: true,
          name: "Request Info",
          value: this.ConcatenateLines(
            `**Requester:** ${userMention(CancelledRequest.user)}`,
            this.GetQuotaReductionText(CancelledRequest),
            `**Duration:** ${CancelledRequest.duration_hr}`,
            `**Reason:** ${CancelledRequest.reason}`
          ),
        });

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (CancelledRequest.request_msg) {
      const [ReqMsgChannelId, ReqMsgId] = CancelledRequest.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqMsgChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({
        Type: "Cancelled",
        Guild: Interaction.guild,
        NoticeDocument: CancelledRequest,
        CancellationDate: Interaction.createdAt,
      });

      const ReviewActionButtons = this.CreateManagementButtons(
        false,
        CancelledRequest.user,
        CancelledRequest._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Logs the end of an activity notice to the logging channel.
   * Also sends a DM notice to the requester if applicable.
   * @param Client - The Discord client instance.
   * @param NoticeDocument - The activity notice document that has ended.
   * @returns A Promise resolving after the log is completed.
   */
  async LogActivityNoticeEnd(Client: DiscordClient, NoticeDocument: UserActivityNoticeDoc) {
    if (!NoticeDocument.is_approved || !NoticeDocument.is_over()) {
      return;
    }

    const Guild = await Client.guilds.fetch(NoticeDocument.guild).catch(() => null);
    const Requester = await Guild?.members.fetch(NoticeDocument.user).catch(() => null);

    if (Guild && Requester) {
      const LeaveOrReduced = this.is_leave ? "leave" : "RA";
      const DMNotice = new EmbedBuilder()
        .setTimestamp(NoticeDocument.end_date)
        .setColor(Colors.LOARequestEnded)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}` })
        .setTitle(`${this.title} — End Notice`)
        .setDescription(
          Dedent(`
            Your ${this.title_lower}, which began on ${FormatTime(NoticeDocument.review_date!, "D")} (${FormatTime(NoticeDocument.review_date!, "R")}), has \
            ended and you are no longer on ${LeaveOrReduced}. If you need to request a new leave, please use the \`/${this.cmd_name} request\` command on the server.
          `)
        )
        .setAuthor({
          name: Guild.name,
          iconURL:
            Client.guilds.cache.get(NoticeDocument.guild)?.iconURL(this.ImgURLOpts) ??
            Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    if (Guild) {
      const LogChannel = await this.FetchLoggingChannel(Guild, "log");
      if (LogChannel) {
        const LogEmbed = new EmbedBuilder()
          .setTimestamp(NoticeDocument.end_date)
          .setColor(Colors.LOARequestEnded)
          .setTitle(`${this.title} Ended`)
          .setFooter({ text: `Reference ID: ${NoticeDocument._id}; ended on` })
          .addFields(
            {
              inline: true,
              name: "Request Info",
              value: this.ConcatenateLines(
                `**Requester:** ${userMention(NoticeDocument.user)}`,
                this.GetQuotaReductionText(NoticeDocument),
                `**Duration:** ${NoticeDocument.duration_hr}`,
                `**Started On:** ${FormatTime(NoticeDocument.review_date!, "F")}`,
                `**Notice Reason:** ${NoticeDocument.reason}`
              ),
            },
            {
              inline: true,
              name: "Approval Info",
              value: Dedent(`
                **Approver**: ${userMention(NoticeDocument.reviewed_by!.id)}
                **Notes:**
                ${NoticeDocument.reviewer_notes || "*N/A*"}
              `),
            }
          );

        return LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
      }
    }
  }

  /**
   * Logs the early termination of an activity notice to the logging channel.
   * Also sends a DM notice to the requester if applicable.
   * @param Interaction - The interaction from the management staff or requester ending the notice early.
   * @param NoticeDocument - The activity notice document that was ended early.
   * @param EndRequestBy - Indicates whether the termination was requested by "Management" or "Requester".
   * @returns A Promise resolving after the log is completed.
   */
  async LogEarlyUANEnd(
    Interaction: ManagementInteraction,
    NoticeDocument: UserActivityNoticeDoc,
    EndRequestBy: "Management" | "Requester"
  ) {
    if (!NoticeDocument.review_date) return;
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(NoticeDocument.user).catch(() => null);

    if (Requester) {
      const DMNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestEnded)
        .setTitle(`${this.title} — End Notice`)
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      if (EndRequestBy === "Requester") {
        DMNotice.setDescription(
          Dedent(`
            Your ${this.title_lower}, originally scheduled to end on ${FormatTime(NoticeDocument.end_date, "D")} (${FormatTime(NoticeDocument.end_date, "R")}), has \
            been terminated (ended) early upon your request. If you need to request a new one, please use the \`/${this.cmd_name} request\` command on the server.
          `)
        ).setFooter({
          text: `Reference ID: ${NoticeDocument._id}`,
        });
      } else {
        DMNotice.setDescription(
          Dedent(`
            Your ${this.title_lower}, originally scheduled to end on ${FormatTime(NoticeDocument.end_date, "D")} (${FormatTime(NoticeDocument.end_date, "R")}), has \
            been terminated (ended) early by management. If you need to request a new one, please use the \`/${this.cmd_name} request\` command on the server.
          `)
        ).setFooter({
          text: `Reference ID: ${NoticeDocument._id}; ended by: @${Interaction.user.username}`,
        });

        if (NoticeDocument.early_end_reason) {
          DMNotice.setDescription(
            DMNotice.data.description +
              `\n\n**Reason Provided by Management:**\n${codeBlock("", NoticeDocument.early_end_reason)}`
          );
        }
      }

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LeaveOrRAText = this.is_leave ? "Leave" : "RA";
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestEnded)
        .setTitle(`${this.title} Ended`)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}; ended early on` })
        .addFields({
          inline: true,
          name: `${LeaveOrRAText} Info`,
          value: this.ConcatenateLines(
            `**Requester:** ${userMention(NoticeDocument.user)}`,
            `**Org. Duration:** ${NoticeDocument.original_duration_hr}`,
            `**${LeaveOrRAText} Duration:** ${NoticeDocument.duration_hr}`,
            this.is_leave ? undefined : this.GetQuotaReductionText(NoticeDocument),
            `**Started On:** ${FormatTime(NoticeDocument.review_date, "F")}`,
            `**Scheduled to End On:** ${FormatTime(NoticeDocument.end_date, "D")}`,
            `**${LeaveOrRAText} Reason:** ${NoticeDocument.reason}`
          ),
        });

      if (EndRequestBy === "Requester") {
        LogEmbed.addFields({
          inline: true,
          name: "Approval Info",
          value: Dedent(`
            **Approver:** ${userMention(NoticeDocument.reviewed_by!.id)}
            **Notes:**
            ${NoticeDocument.reviewer_notes || "*N/A*"}
          `),
        });
      } else {
        LogEmbed.addFields({
          inline: true,
          name: "Management Staff",
          value: Dedent(`
            **Approver:** ${userMention(NoticeDocument.reviewed_by!.id)}
            **Approver Notes:** ${NoticeDocument.reviewer_notes || "*N/A*"}

            **Ended By:** ${userMention(Interaction.user.id)}
            **End Reason:** ${NoticeDocument.early_end_reason || "*N/A*"}
          `),
        });
      }

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }
  }

  /**
   * Logs the wiping of user activity notices to the logging channel.
   * @param MgmtInteract - The interaction from the management staff initiating the wipe.
   * @param WipeResult - The result of the wipe operation.
   * @param RecordsStatus - The status of the records being wiped.
   * @param TargettedUser - The user whose records were wiped (optional).
   * @returns A Promise resolving to the sent log message or `undefined` if no log was sent.
   */
  async LogUserActivityNoticesWipe(
    MgmtInteract: BaseInteraction<"cached"> | GuildMember,
    WipeResult: Mongoose.mongo.DeleteResult & { recordsAfter?: Date; recordsBefore?: Date },
    RecordsStatus?: string,
    TargettedUser?: User
  ) {
    const LoggingChannel = await this.FetchLoggingChannel(MgmtInteract.guild, "log");
    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.LOARequestCancelled)
      .setTitle(
        TargettedUser
          ? `Member ${this.cmd_name.toUpperCase()} Records Wiped`
          : `${this.title} Records Wiped`
      )
      .setFooter({ text: `Wiped by: @${MgmtInteract.user.username} on` })
      .setDescription(
        Dedent(`
          ${TargettedUser ? `**Member:** <@${TargettedUser.id}>` : ""}
          **Records Deleted:** ${WipeResult.deletedCount}
          **Records of Status:** ${RecordsStatus || "*All Statuses*"}
        `)
      );

    if (!(MgmtInteract instanceof GuildMember)) {
      LogEmbed.setTimestamp(MgmtInteract.createdAt);
    }

    if (WipeResult.recordsAfter) {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Records After:** ${FormatTime(WipeResult.recordsAfter, "D")}`
      );
    } else if (WipeResult.recordsBefore) {
      LogEmbed.setDescription(
        `${LogEmbed.data.description}\n**Records Before:** ${FormatTime(WipeResult.recordsBefore, "D")}`
      );
    }

    return LoggingChannel?.send({ embeds: [LogEmbed] });
  }
}

// ------------------------------------------------------------------------------------
// Leave of Absence Logger:
// ------------------------
/**
 * Logger for Leave of Absence (LOA) notices.
 * Includes methods specific to LOA.
 */
export class LeaveOfAbsenceEventLogger extends BaseUserActivityNoticeLogger {
  constructor() {
    super(true);
  }

  /**
   * Sends a log of an extension request to the requests channel for approval.
   * Also sends a DM notice to the requester if possible.
   * @param Interaction - The interaction originating from the requester.
   * @param ActiveLOA - The activity notice document with the extension request.
   * @returns A Promise resolving to the sent request message if successful.
   */
  async SendExtensionRequest(Interaction: ManagementInteraction, ActiveLOA: UserActivityNoticeDoc) {
    const RequestsChannel = await this.FetchLoggingChannel(Interaction.guild, "requests");
    const Requester = await Interaction.guild.members.fetch(ActiveLOA.user).catch(() => null);

    if (Requester && ActiveLOA.extension_request?.date) {
      const DMNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestPending)
        .setFooter({ text: `Reference ID: ${ActiveLOA._id}` })
        .setTitle("Leave of Absence — Extension Request Under Review")
        .setDescription(
          Dedent(`
            Your leave of absence extension request, submitted on ${FormatTime(ActiveLOA.extension_request.date, "D")}, has been received and is waiting for a \
            review by the management team. The requested additional duration is ${ActiveLOA.extended_duration_hr}, and will be added to the leave once the \
            request is approved. To cancel your pending request, please use the \`/${this.cmd_name} manage\` command on the server.
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    if (!RequestsChannel) return;
    const RequestEmbed = this.GetRequestEmbed({ Type: "Extension", NoticeDocument: ActiveLOA });
    const ManagementComponents = this.CreateManagementButtons(
      true,
      Interaction.user.id,
      ActiveLOA._id.toString()
    );

    return RequestsChannel.send({ embeds: [RequestEmbed], components: [ManagementComponents] });
  }

  /**
   * Logs the manual creation of a leave of absence by management staff.
   * Also sends a DM notice to the requester if applicable.
   * @param Interaction - The interaction from the management staff creating the LOA.
   * @param CreatedLOA - The created leave of absence document.
   * @returns A Promise resolving after the log is completed.
   */
  async LogManualLeave(Interaction: ManagementInteraction, CreatedLOA: UserActivityNoticeDoc) {
    const Requester = await Interaction.guild.members.fetch(CreatedLOA.user).catch(() => null);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");

    if (Requester) {
      const DMNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setFooter({ text: `Reference ID: ${CreatedLOA._id}` })
        .setTitle("Leave of Absence — Start Notice")
        .setDescription(
          Dedent(`
            You have been placed on leave by management staff, effective until ${FormatTime(CreatedLOA.end_date, "F")} (${FormatTime(CreatedLOA.end_date, "R")}).
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      if (CreatedLOA.is_manageable) {
        DMNotice.setDescription(
          DMNotice.data.description +
            " To manage your leave, including requesting an extension or an early termination, please use the `/loa manage` command on the server."
        );
      } else {
        DMNotice.setDescription(
          DMNotice.data.description +
            " This leave is under management staff control, and therefore, extensions or early terminations are not possible at this time."
        );
      }

      if (CreatedLOA.reviewer_notes) {
        DMNotice.setDescription(
          DMNotice.data.description +
            `\n\n**The following note(s) were provided by the reviewer:**\n${codeBlock(CreatedLOA.reviewer_notes)}`
        );
      }

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle("Leave of Absence Started")
        .setFooter({ text: `Reference ID: ${CreatedLOA._id}; placed on` })
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: Dedent(`
            **Leave For:** ${userMention(CreatedLOA.user)}
            **Duration:** ${CreatedLOA.duration_hr}
            **Started:** ${FormatTime(CreatedLOA.review_date || Interaction.createdAt, "F")}
            **Ends On:** ${FormatTime(CreatedLOA.end_date, "F")}
            **Reason:** ${CreatedLOA.reason}
          `),
          },
          {
            inline: true,
            name: "Approval Info",
            value: Dedent(`
              **Approver**: ${userMention(Interaction.user.id)}
              **Notes:**
              ${CreatedLOA.reviewer_notes || "*N/A*"}
            `),
          }
        );

      return LogChannel.send({ embeds: [LogEmbed] });
    }
  }

  /**
   * Logs the manual extension of a leave of absenc by management staff.
   * Also sends a DM notice to the requester if applicable.
   * @param Interaction - The interaction from the management staff extending the leave.
   * @param NoticeDocument - The updated leave of absence document.
   * @returns A Promise resolving after the log is completed.
   */
  async LogManualExtension(
    Interaction: ManagementInteraction,
    NoticeDocument: UserActivityNoticeDoc
  ) {
    if (!NoticeDocument.extension_request || !NoticeDocument.review_date) return;
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(NoticeDocument.user).catch(() => null);

    if (Requester) {
      const DMApprovalNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle("Leave of Absence — Extension Notice")
        .setDescription(
          Dedent(`
            Your leave of absence, started on ${FormatTime(NoticeDocument.request_date, "D")}, has been extended by a management staff. \
            The new leave end date is ${FormatTime(NoticeDocument.end_date, "F")} (${FormatTime(NoticeDocument.end_date, "R")}). \
            As of now, this LOA cannot be extended further, but you can request an early termination(if permitted) by \
            using the \`/loa manage\` command on the server.
          `)
        )
        .setFooter({
          text: `Reference ID: ${NoticeDocument._id}; extended by @${Interaction.user.username}`,
        })
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMApprovalNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle("Leave of Absence Extended")
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}; extended on` })
        .addFields({
          inline: true,
          name: "Leave Info",
          value: Dedent(`
            **Leave For:** ${userMention(NoticeDocument.user)}
            **Leave Started:** ${FormatTime(NoticeDocument.review_date, "F")}
            **Leave Ends On:** after extension, ${FormatTime(NoticeDocument.end_date, "D")}
            **Extension Duration:** ${NoticeDocument.extended_duration_hr}
            **Extension Reason:** ${NoticeDocument.extension_request.reason || "*N/A*"}
          `),
        })
        .addFields({
          inline: true,
          name: "Management Staff",
          value: Dedent(`
              **Extended By**: ${userMention(NoticeDocument.extension_request.reviewed_by!.id)}
              **Notes:**
              ${NoticeDocument.extension_request.reviewer_notes || "*N/A*"}
            `),
        });

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }
  }

  /**
   * Logs the approval of an extension request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff approving the extension.
   * @param NoticeDocument - The updated activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogExtensionApproval(
    Interaction: ManagementInteraction,
    NoticeDocument: UserActivityNoticeDoc
  ) {
    if (!NoticeDocument.extension_request || !NoticeDocument.review_date) return;
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(NoticeDocument.user).catch(() => null);

    if (Requester) {
      const DMApprovalNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}` })
        .setTitle("Leave of Absence — Extension Approval Notice")
        .setDescription(
          Dedent(`
            Your leave of absence extension request, submitted on ${FormatTime(NoticeDocument.extension_request.date, "D")}, has been approved.
            The approved leave is now set to expire on ${FormatTime(NoticeDocument.end_date, "F")} (${FormatTime(NoticeDocument.end_date, "R")}). \
            As of now, you cannot request an additional extension for this LOA, but you can request an early termination by using the \`/loa manage\` command on the server.
          `)
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL({ size: 128 }) ?? Thumbs.Transparent,
        });

      Requester.send({ embeds: [DMApprovalNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle("Leave of Absence Extension Approval")
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}; approved on` })
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: Dedent(`
              **Requester:** ${userMention(NoticeDocument.user)}
              **Extension:** ${NoticeDocument.extended_duration_hr}
              **Reason:** ${NoticeDocument.extension_request.reason}
            `),
          },
          {
            inline: true,
            name: "Active LOA",
            value: Dedent(`
              **Started On:** ${FormatTime(NoticeDocument.review_date, "F")}
              **Ends On:** after extension, ${FormatTime(NoticeDocument.end_date, "D")}
            `),
          },
          {
            inline: true,
            name: "Approval Info",
            value: Dedent(`
              **Approver**: ${userMention(NoticeDocument.extension_request.reviewed_by!.id)}
              **Notes:**
              ${NoticeDocument.extension_request.reviewer_notes || "*N/A*"}
            `),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (NoticeDocument.extension_request.request_msg) {
      const [ReqChannelId, ReqMsgId] = NoticeDocument.extension_request.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({ Type: "Pending", NoticeDocument })
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestApproved)
        .setTitle("Approved Extension  |  Leave of Absence Request")
        .setFooter({
          text: `Reference ID: ${NoticeDocument._id}; approved by @${Interaction.user.username} on`,
          iconURL: Interaction.user.displayAvatarURL(this.ImgURLOpts),
        });

      const ReviewActionButtons = this.CreateManagementButtons(
        true,
        NoticeDocument.user,
        NoticeDocument._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Logs the denial of an extension request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff denying the extension.
   * @param NoticeDocument - The updated activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogExtensionDenial(
    Interaction: ManagementInteraction,
    NoticeDocument: UserActivityNoticeDoc
  ) {
    if (!NoticeDocument.extension_request || !NoticeDocument.review_date) return;
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(NoticeDocument.user).catch(() => null);

    if (Requester) {
      const DMDenialNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}` })
        .setTitle("Leave of Absence — Extension Denial Notice")
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL({ size: 128 }) ?? Thumbs.Transparent,
        });

      DMDenialNotice.setDescription(
        Dedent(`
          Your leave of absence extension request, submitted on ${FormatTime(NoticeDocument.extension_request.date, "D")}, has been denied.          
          **The following note(s) were provided by the reviewer:**
          ${codeBlock("", NoticeDocument.extension_request.reviewer_notes || "N/A")}
        `)
      );

      Requester.send({ embeds: [DMDenialNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setTitle("Leave of Absence Extension Denial")
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}` })
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: Dedent(`
              **Requester:** ${userMention(NoticeDocument.user)}
              **Extension:** ${NoticeDocument.extended_duration_hr}
              **Reason:** ${NoticeDocument.extension_request.reason}
            `),
          },
          {
            inline: true,
            name: "Active LOA",
            value: Dedent(`
              **Duration:** ${NoticeDocument.duration_hr}
              **Started On:** ${FormatTime(NoticeDocument.review_date, "F")}
              **Ends On:** ${FormatTime(NoticeDocument.end_date, "D")} (not modified)
            `),
          },
          {
            inline: false,
            name: "Denial Info",
            value: Dedent(`
              **Denier**: ${userMention(NoticeDocument.extension_request.reviewed_by!.id)}
              **Notes:**
              ${NoticeDocument.extension_request.reviewer_notes || "*N/A*"}
            `),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (NoticeDocument.extension_request?.request_msg) {
      const [ReqChannelId, ReqMsgId] = NoticeDocument.extension_request.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({
        NoticeDocument,
        Type: "Extension",
        Guild: Interaction.guild,
        CancellationDate: Interaction.createdAt,
      })
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setTitle("Denied Extension  |  Leave of Absence Request")
        .setFooter({
          iconURL: Interaction.user.displayAvatarURL(this.ImgURLOpts),
          text: `Reference ID: ${NoticeDocument._id}; denied by @${Interaction.user.username} on`,
        });

      const ReviewActionButtons = this.CreateManagementButtons(
        true,
        NoticeDocument.user,
        NoticeDocument._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Logs the cancellation of an extension request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the requester cancelling the extension.
   * @param NoticeDocument - The updated activity notice document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogExtensionCancellation(
    Interaction: ButtonInteraction<"cached">,
    NoticeDocument: UserActivityNoticeDoc
  ) {
    if (!NoticeDocument.extension_request || !NoticeDocument.review_date) return;
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members.fetch(NoticeDocument.user).catch(() => null);

    if (Requester && !NoticeDocument.extension_request.reviewed_by) {
      const DMCancellationNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}` })
        .setTitle("Leave of Absence — Extension Cancellation Notice")
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL({ size: 128 }) ?? Thumbs.Transparent,
        });

      DMCancellationNotice.setDescription(
        Dedent(`
          Your previously submitted LOA extension request, with a duration of ${NoticeDocument.extended_duration_hr}, has been cancelled at your request. \
          Your currently active leave of absence will expire on ${FormatTime(NoticeDocument.end_date, "D")} as it was scheduled.
        `)
      );

      Requester.send({ embeds: [DMCancellationNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestCancelled)
        .setTitle("Leave of Absence Extension Cancellation")
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}; cancelled by requester on` })
        .addFields(
          {
            inline: true,
            name: "Request Info",
            value: Dedent(`
              **Requester:** ${userMention(NoticeDocument.user)}
              **Extension:** ${NoticeDocument.extended_duration_hr}
              **Reason:** ${NoticeDocument.extension_request.reason}
            `),
          },
          {
            inline: true,
            name: "Active LOA",
            value: Dedent(`
              **Duration:** ${NoticeDocument.duration_hr}
              **Started On:** ${FormatTime(NoticeDocument.review_date, "F")}
              **Ends On:** ${FormatTime(NoticeDocument.end_date, "D")} (not modified)
            `),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (NoticeDocument.extension_request?.request_msg) {
      const [ReqChannelId, ReqMsgId] = NoticeDocument.extension_request.request_msg.split(":");
      const ReqMsgChannel = await this.FetchValidRequestsChannelFromId(
        Interaction.guild,
        ReqChannelId
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = this.GetRequestEmbed({
        NoticeDocument,
        Type: "Extension",
        Guild: Interaction.guild,
        CancellationDate: Interaction.createdAt,
      })
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.LOARequestDenied)
        .setFooter({ text: `Reference ID: ${NoticeDocument._id}; cancelled by requester on` })
        .setTitle("Cancelled Extension  |  Leave of Absence Request");

      const ReviewActionButtons = this.CreateManagementButtons(
        true,
        NoticeDocument.user,
        NoticeDocument._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, { embeds: [RequestEmbed], components: [ReviewActionButtons] })
        .catch(() => null);
    }
  }

  /**
   * Retrieves the message embed for a Leave of Absence (LOA) extension request with the specified status.
   * @param Guild - The guild where the request was made.
   * @param LeaveDocument - The LOA document containing the extension request.
   * @param RequestStatus - The status of the extension request ("Pending", "Approved", "Denied", or "Cancelled").
   * @returns A Promise resolving to the configured embed for the extension request.
   */
  async GetLOAExtRequestMessageEmbedWithStatus(
    Guild: Guild,
    LeaveDocument: UserActivityNoticeDoc,
    RequestStatus: "Pending" | "Approved" | "Denied" | "Cancelled"
  ) {
    const RequestEmbed = this.GetRequestEmbed({
      Type: "Extension",
      NoticeDocument: LeaveDocument,
    }).setTimestamp(LeaveDocument.extension_request?.review_date);

    if (RequestStatus === "Approved") {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, LeaveDocument.reviewed_by!.id);
      RequestEmbed.setColor(Colors.LOARequestApproved)
        .setTitle("Approved Extension  |  Leave of Absence Request")
        .setFooter({
          iconURL: AvatarURL,
          text: `Reference ID: ${LeaveDocument._id}; approved by @${LeaveDocument.reviewed_by!.username} on`,
        });
    } else if (RequestStatus === "Denied") {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, LeaveDocument.reviewed_by!.id);
      RequestEmbed.setColor(Colors.LOARequestDenied)
        .setTitle("Denied Extension  |  Leave of Absence Request")
        .setFooter({
          iconURL: AvatarURL,
          text: `Reference ID: ${LeaveDocument._id}; denied by @${LeaveDocument.reviewed_by!.username} on`,
        });
    } else if (RequestStatus === "Cancelled") {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, LeaveDocument.user);
      RequestEmbed.setColor(Colors.LOARequestDenied)
        .setTitle("Cancelled Extension  |  Leave of Absence Request")
        .setFooter({
          iconURL: AvatarURL,
          text: `Reference ID: ${LeaveDocument._id}; cancelled by requester on`,
        });
    } else {
      RequestEmbed.setTitle("Pending Extension  |  Leave of Absence Request");
    }

    return RequestEmbed;
  }
}

// ------------------------------------------------------------------------------------
// Reduced Activity Logger:
// ------------------------
/**
 * Logger for Reduced Activity (RA) notices.
 * This class is intended for handling logging and notification logic specific to reduced activity requests,
 * and shares all methods from the base class except for those that are LOA-specific (such as extension handling).
 */
export class ReducedActivityEventLogger extends BaseUserActivityNoticeLogger {
  constructor() {
    super(false);
  }
}
