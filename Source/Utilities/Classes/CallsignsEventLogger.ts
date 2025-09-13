import {
  Guild,
  spoiler,
  codeBlock,
  userMention,
  roleMention,
  TextChannel,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
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
import { GenericRequestStatuses } from "@Config/Constants.js";
import { Callsigns } from "@Typings/Utilities/Database.js";

import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";
import CallsignModel from "@Models/Callsign.js";

type CallsignDoc = Callsigns.HydratedCallsignDocument;
type ManagementInteraction = ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">;

// ------------------------------------------------------------------------------------
// Main Class Definition:
// ----------------------
/**
 * Event logger class for callsign requests, approvals, denials, and other related actions.
 * Handles logging to designated channels and sending notifications to users.
 */
export class CallsignsEventLogger {
  protected readonly ImgURLOpts: ImageURLOptions = { size: 128 };
  private static readonly RequestInfoFieldName = "Request Info";

  /**
   * Checks if the application has the required permissions in the specified channel to either send or edit callsign messages.
   * @param Guild - The Discord guild where the channel is located.
   * @param Channel - The guild-based channel to check permissions for.
   * @param Perms - The permission flags to check for. Defaults to `ViewChannel` and `SendMessages` permissions.
   * @returns A promise that resolves to `true` if the bot has all required permissions and the channel is sendable and text-based, `false` otherwise.
   */
  protected async LoggingChannelHasPerms(
    Guild: Guild,
    Channel: GuildBasedChannel,
    Perms: bigint | bigint[] = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  ): Promise<boolean> {
    const ClientMember = await Guild.members.fetchMe().catch(() => null);
    return (
      !!ClientMember &&
      Channel.isSendable() &&
      Channel.isTextBased() &&
      Channel.permissionsFor(ClientMember).has(Perms, true)
    );
  }

  /**
   * Retrieves the logging channel for the specified type (log or requests).
   * @param Guild - The guild where the logging channel is being retrieved.
   * @param Type - The type of logging channel to return:
   * - `log`: The channel where updates on callsign requests will be sent.
   * - `requests`: The channel where callsign requests will be sent for approval.
   * @param AdditionalPerms - Additional permissions required for the logging channel in order to return.
   * @returns The logging channel if found and accessible, otherwise `null`.
   */
  protected async FetchLoggingChannel(
    Guild: Guild,
    Type: "log" | "requests",
    AdditionalPerms?: bigint | bigint[]
  ): Promise<(GuildBasedChannel & TextBasedChannel) | null> {
    const GuildSettings = await GetGuildSettings(Guild.id);
    if (!GuildSettings?.callsigns_module.enabled) return null;

    const ChannelId =
      Type === "log"
        ? GuildSettings.callsigns_module.log_channel
        : GuildSettings.callsigns_module.requests_channel;

    if (!ChannelId) return null;
    const TargetChannel = await Guild.channels.fetch(ChannelId).catch(() => null);
    if (!TargetChannel?.isTextBased()) return null;

    const RequiredPerms = AdditionalPerms
      ? [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          ...(Array.isArray(AdditionalPerms) ? AdditionalPerms : [AdditionalPerms]),
        ]
      : [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];

    const HasPermissions = await this.LoggingChannelHasPerms(Guild, TargetChannel, RequiredPerms);
    return HasPermissions ? TargetChannel : null;
  }

  protected async FetchRequestMessageChannel(
    Guild: Guild,
    RequestMsgField: string
  ): Promise<(GuildBasedChannel & TextBasedChannel) | null> {
    const ChannelId = RequestMsgField.split(":")[0];
    const RequestChannel = await Guild.channels.fetch(ChannelId).catch(() => null);
    if (!RequestChannel) return null;

    const HasPermissions = await this.LoggingChannelHasPerms(Guild, RequestChannel);
    return HasPermissions ? (RequestChannel as GuildBasedChannel & TextBasedChannel) : null;
  }

  /**
   * Retrieves the profile image URL of a user in the specified guild.
   * @param Guild - The guild where the user is located.
   * @param UserId - The Discord ID of the user.
   * @returns The user's profile image URL or a fallback image if the user cannot be fetched.
   */
  protected async GetUserProfileImageURL(Guild: Guild, UserId: string): Promise<string> {
    try {
      const GuildMember = await Guild.members.fetch(UserId);
      return GuildMember.displayAvatarURL(this.ImgURLOpts);
    } catch {
      return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
  }

  /**
   * Concatenates multiple lines into a single string, filtering out null or undefined values.
   * @param Lines - The lines to concatenate.
   * @returns A single string with all valid lines joined by newlines.
   */
  protected ConcatenateLines(...Lines: (string | undefined | null)[]): string {
    return Lines.filter((Line) => Line != null).join("\n");
  }

  /**
   * Retrieves the history of a specific callsign designation, including previous and current holders.
   * @param Guild - The guild where the callsign history is being retrieved.
   * @param Designation - The callsign designation to get history for.
   * @returns A Promise resolving to an array of callsign documents sorted by request date (newest first).
   */
  async GetCallsignHistory(
    Guild: Guild,
    Designation: CallsignDoc["designation"]
  ): Promise<CallsignDoc[]> {
    return CallsignModel.find({
      guild: Guild.id,
      "designation.division": Designation.division,
      "designation.unit_type": Designation.unit_type,
      "designation.beat_num": Designation.beat_num,
      request_status: { $in: ["Approved", "Denied"] },
    })
      .sort({ requested_on: -1 })
      .limit(10)
      .exec();
  }

  /**
   * Formats a callsign designation into a readable string.
   * @param Designation - The callsign designation object.
   * @returns A formatted callsign string (e.g., "1A-12").
   */
  FormatCallsign(Designation: CallsignDoc["designation"]): string {
    return `${Designation.division}${Designation.unit_type}-${Designation.beat_num}`;
  }

  /**
   * Creates a set of management buttons for approving, denying, or requesting additional information about a callsign request.
   * @param UserId - The ID of the user who submitted the callsign request.
   * @param CallsignId - The ID of the callsign request.
   * @param CallsignReviewed - Whether the callsign request has already been reviewed (optional, defaults to `false`).
   *                         This determines whether the buttons should be disabled or not.
   * @returns An action row containing the management buttons.
   */
  protected CreateManagementButtons(
    UserId: string,
    CallsignId: string,
    CallsignReviewed: boolean = false
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setCustomId(`callsign-approve:${UserId}:${CallsignId}`)
        .setLabel("Approve")
        .setEmoji(Emojis.WhiteCheck)
        .setDisabled(CallsignReviewed ?? false)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`callsign-deny:${UserId}:${CallsignId}`)
        .setLabel("Deny")
        .setEmoji(Emojis.WhiteCross)
        .setDisabled(CallsignReviewed ?? false)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`callsign-info:${UserId}:${CallsignId}`)
        .setLabel("Additional Information")
        .setEmoji(Emojis.WhitePlus)
        .setDisabled(CallsignReviewed ?? false)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  /**
   * Constructs a pre-defined embed for a callsign request.
   * @param Opts - Options for constructing the embed:
   * - `Type`: The type of the request (e.g., "Cancelled", "Pending").
   * - `Guild`: The guild where the request was made.
   * - `CallsignDocument`: The callsign document.
   * - `CancellationDate`: The date when the request was cancelled (if applicable).
   * @returns A pre-configured embed for the request.
   */
  protected GetRequestEmbed(Opts: {
    Type?: "Cancelled" | "Pending";
    Guild?: Guild;
    CallsignDocument: CallsignDoc;
    CurrentlyAssigned?: CallsignDoc | null;
    CancellationDate?: Date;
  }): EmbedBuilder {
    const { Type = "Pending", CallsignDocument, CancellationDate, CurrentlyAssigned } = Opts;
    const FormattedCallsign = this.FormatCallsign(CallsignDocument.designation);
    const Strikethrough = Type === "Cancelled" ? "~~" : "";
    const CurrPrevCallsignText =
      CurrentlyAssigned && CallsignDocument.request_status === GenericRequestStatuses.Approved
        ? "**Previous Callsign:**"
        : "**Current Callsign:**";

    const Embed = new EmbedBuilder()
      .setImage(Images.FooterDivider)
      .setFooter({ text: `Reference ID: ${CallsignDocument._id}` })
      .setColor(Type === "Cancelled" ? Colors.RequestDenied : Colors.RequestPending)
      .setTitle(`${Type}  |  Callsign Request`)
      .setDescription(
        this.ConcatenateLines(
          `**Requester:** ${userMention(CallsignDocument.requester)}`,
          `**Callsign:** ${Strikethrough}\`${FormattedCallsign}\`${Strikethrough}`,
          CurrentlyAssigned
            ? `${CurrPrevCallsignText} \`${this.FormatCallsign(CurrentlyAssigned.designation)}\``
            : null,
          `**Reason:** ${CallsignDocument.request_reason}`
        )
      );

    if (CancellationDate) {
      Embed.setTimestamp(CancellationDate);
      Embed.setFooter({
        text: `Reference ID: ${CallsignDocument._id}; cancelled by requester on`,
        iconURL: Opts.Guild?.members.cache
          .get(CallsignDocument.requester)
          ?.user.displayAvatarURL(this.ImgURLOpts),
      });
    }

    return Embed;
  }

  /**
   * Generates a message embed for a callsign request with the specified status.
   * @param Guild - The guild where the request was made.
   * @param CallsignDocument - The updated callsign document.
   * @param RequestStatus - The status of the request ("Approved", "Denied", "Cancelled", or "Pending").
   * @returns A Promise resolving to the configured embed for the request.
   */
  async GetRequestMessageEmbedWithStatus(
    Guild: Guild,
    CallsignDocument: CallsignDoc,
    RequestStatus: keyof typeof GenericRequestStatuses,
    CurrPrevAssigned?: CallsignDoc | null
  ): Promise<EmbedBuilder> {
    const RequestEmbed = this.GetRequestEmbed({
      Guild,
      Type: RequestStatus === "Cancelled" ? RequestStatus : "Pending",
      CallsignDocument,
      CurrentlyAssigned: CurrPrevAssigned ?? undefined,
      CancellationDate:
        RequestStatus === "Cancelled" ? CallsignDocument.reviewed_on : (undefined as any),
    }).setTimestamp(CallsignDocument.reviewed_on);

    if (RequestStatus === GenericRequestStatuses.Approved && CallsignDocument.reviewed_on) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, CallsignDocument.reviewer!);
      RequestEmbed.setColor(Colors.RequestApproved)
        .setTitle("Approved  |  Callsign Request")
        .setFooter({
          text: `Reference ID: ${CallsignDocument._id}; approved by @${CallsignDocument.reviewer} on`,
          iconURL: AvatarURL,
        });
    } else if (RequestStatus === GenericRequestStatuses.Denied && CallsignDocument.reviewed_on) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, CallsignDocument.reviewer!);
      RequestEmbed.setColor(Colors.RequestDenied)
        .setTitle("Denied  |  Callsign Request")
        .setFooter({
          text: `Reference ID: ${CallsignDocument._id}; denied by @${CallsignDocument.reviewer} on`,
          iconURL: AvatarURL,
        });
    } else if (RequestStatus === GenericRequestStatuses.Cancelled) {
      const AvatarURL = await this.GetUserProfileImageURL(Guild, CallsignDocument.requester);
      const CancelledBy =
        CallsignDocument.reviewer === CallsignDocument.requester
          ? "requester"
          : `@${CallsignDocument.reviewer}`;

      RequestEmbed.setColor(Colors.RequestDenied)
        .setTitle("Cancelled  |  Callsign Request")
        .setFooter({
          iconURL: AvatarURL,
          text: `Reference ID: ${CallsignDocument._id}; cancelled by ${CancelledBy} on`,
        });
    }

    return RequestEmbed;
  }

  /**
   * Sends a new callsign request to the requests channel for approval.
   * Also sends a DM notice to the requester if possible.
   * @param Interaction - The interaction originating from the requester.
   * @param PendingCallsign - The callsign document pending approval.
   * @returns A Promise resolving to the sent request message if successful.
   */
  async SendRequest(
    Interaction: SlashCommandInteraction<"cached">,
    PendingCallsign: CallsignDoc,
    CurrentlyAssigned?: CallsignDoc | null
  ): Promise<any> {
    const FormattedCallsign = this.FormatCallsign(PendingCallsign.designation);
    const Requester = await Interaction.guild.members
      .fetch(PendingCallsign.requester)
      .catch(() => null);
    const RequestsChannel = await this.FetchLoggingChannel(Interaction.guild, "requests");
    const CallsignsModuleSettings = await GetGuildSettings(PendingCallsign.guild).then(
      (Settings) => Settings?.callsigns_module
    );

    // Send a DM notice to the requester.
    if (Requester) {
      const DMNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestPending)
        .setFooter({ text: `Reference ID: ${PendingCallsign._id}` })
        .setTitle("Callsign Request — Request Under Review")
        .setDescription(
          this.ConcatenateLines(
            `Your callsign request for \`${FormattedCallsign}\`, submitted on ${FormatTime(PendingCallsign.requested_on, "D")}, has been received and is waiting for a review by the management team.`,
            "You will be notified via DM when there is an update regarding its status."
          )
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? undefined,
        });

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    // Send the request message if a requests channel is set.
    if (!RequestsChannel) return;
    const RequestEmbed = this.GetRequestEmbed({
      Type: "Pending",
      CurrentlyAssigned,
      CallsignDocument: PendingCallsign,
    });

    const ManagementComponents = this.CreateManagementButtons(
      Interaction.user.id,
      PendingCallsign._id.toString()
    );

    // Handle role mentions if alert_on_request is enabled
    const AlertRolesMentioned =
      CallsignsModuleSettings?.alert_on_request && CallsignsModuleSettings?.manager_roles?.length
        ? CallsignsModuleSettings.manager_roles.map(roleMention).join(", ")
        : "";

    return RequestsChannel.send({
      content: AlertRolesMentioned ? `-# *${spoiler(AlertRolesMentioned)}*` : undefined,
      components: [ManagementComponents],
      embeds: [RequestEmbed],
      flags: AlertRolesMentioned ? MessageFlags.SuppressNotifications : undefined,
      allowedMentions: {
        roles: CallsignsModuleSettings?.alert_on_request
          ? (CallsignsModuleSettings?.manager_roles ?? [])
          : [],
      },
    });
  }

  /**
   * Logs the approval of a callsign request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff approving the callsign.
   * @param ApprovedRequest - The approved callsign document.
   * @param PreviouslyAssigned - The previously assigned callsign document, if any.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogApproval(
    Interaction: ManagementInteraction,
    ApprovedRequest: CallsignDoc,
    PreviouslyAssigned?: CallsignDoc | null
  ): Promise<void> {
    const FormattedCallsign = this.FormatCallsign(ApprovedRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(ApprovedRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMApprovalNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestApproved)
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}` })
        .setTitle("Callsign Request — Approval Notice")
        .setDescription(
          this.ConcatenateLines(
            `Your callsign request for \`${FormattedCallsign}\`, submitted on ${FormatTime(ApprovedRequest.requested_on, "D")}, has been approved.`,
            ApprovedRequest.expiry
              ? `Your callsign is set to expire on ${FormatTime(ApprovedRequest.expiry, "F")} (${FormatTime(ApprovedRequest.expiry, "R")}).`
              : null,
            ApprovedRequest.reviewer_notes
              ? `**Reviewer Notes:**\n${codeBlock(ApprovedRequest.reviewer_notes)}`
              : null
          )
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL({ size: 128 }) ?? undefined,
        });

      Requester.send({ embeds: [DMApprovalNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestApproved)
        .setTitle("Callsign Request Approval")
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}; approved on` })
        .addFields(
          {
            name: CallsignsEventLogger.RequestInfoFieldName,
            inline: true,
            value: this.ConcatenateLines(
              `**Requester:** ${userMention(ApprovedRequest.requester)}`,
              `**Callsign:** \`${FormattedCallsign}\``,
              PreviouslyAssigned
                ? `**Previous Callsign:** \`${this.FormatCallsign(PreviouslyAssigned.designation)}\``
                : null,
              `**Requested:** ${FormatTime(ApprovedRequest.requested_on, "F")}`,
              ApprovedRequest.expiry
                ? `**Expires:** ${FormatTime(ApprovedRequest.expiry, "F")}`
                : null,
              `**Reason:** ${ApprovedRequest.request_reason}`
            ),
          },
          {
            name: "Approval Info",
            inline: true,
            value: this.ConcatenateLines(
              `**Approver**: ${userMention(Interaction.user.id)}`,
              `**Notes:** ${ApprovedRequest.reviewer_notes ?? "*N/A*"}`
            ),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (ApprovedRequest.request_message) {
      const [, MessageId] = ApprovedRequest.request_message.split(":");
      const RequestChannel = await this.FetchRequestMessageChannel(
        Interaction.guild,
        ApprovedRequest.request_message
      );

      const RequestEmbed = await this.GetRequestMessageEmbedWithStatus(
        Interaction.guild,
        ApprovedRequest,
        GenericRequestStatuses.Approved,
        PreviouslyAssigned
      );

      const ReviewActionButtons = this.CreateManagementButtons(
        ApprovedRequest.requester,
        ApprovedRequest._id.toString(),
        true
      );

      await (RequestChannel as TextChannel).messages
        .edit(MessageId, {
          content: null,
          embeds: [RequestEmbed],
          components: [ReviewActionButtons],
        })
        .catch(() => null);
    }
  }

  /**
   * Logs the denial of a callsign request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff denying the callsign.
   * @param DeniedRequest - The denied callsign document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogDenial(Interaction: ManagementInteraction, DeniedRequest: CallsignDoc): Promise<void> {
    const FormattedCallsign = this.FormatCallsign(DeniedRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(DeniedRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMDenialNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestDenied)
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}` })
        .setTitle("Callsign Request — Denial Notice")
        .setDescription(
          this.ConcatenateLines(
            `Your callsign request for \`${FormattedCallsign}\`, submitted on ${FormatTime(DeniedRequest.requested_on, "D")}, has been denied.`,
            "You may submit a new request if you believe this denial was made in error or if circumstances have changed.",
            "",
            "**The following note(s) were provided by the reviewer:**",
            codeBlock(DeniedRequest.reviewer_notes ?? "N/A")
          )
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? undefined,
        });

      Requester.send({ embeds: [DMDenialNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setColor(Colors.RequestDenied)
        .setTitle("Callsign Request Denial")
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}; denied on` })
        .setTimestamp(Interaction.createdAt)
        .addFields(
          {
            inline: true,
            name: CallsignsEventLogger.RequestInfoFieldName,
            value: this.ConcatenateLines(
              `**Requester:** ${userMention(DeniedRequest.requester)}`,
              `**Requested:** ${FormatTime(DeniedRequest.requested_on, "F")}`,
              `**Callsign:** \`${FormattedCallsign}\``,
              `**Reason:** ${DeniedRequest.request_reason}`
            ),
          },
          {
            inline: true,
            name: "Denial Info",
            value: this.ConcatenateLines(
              `**Denier**: ${userMention(Interaction.user.id)}`,
              "**Notes:**",
              DeniedRequest.reviewer_notes ?? "*N/A*"
            ),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (DeniedRequest.request_message) {
      const [, MessageId] = DeniedRequest.request_message.split(":");
      const RequestChannel = await this.FetchRequestMessageChannel(
        Interaction.guild,
        DeniedRequest.request_message
      );

      if (RequestChannel) {
        const RequestEmbed = await this.GetRequestMessageEmbedWithStatus(
          Interaction.guild,
          DeniedRequest,
          GenericRequestStatuses.Denied
        );

        const ReviewActionButtons = this.CreateManagementButtons(
          DeniedRequest.requester,
          DeniedRequest._id.toString(),
          true
        );

        await RequestChannel.messages
          .edit(MessageId, {
            content: null,
            embeds: [RequestEmbed],
            components: [ReviewActionButtons],
          })
          .catch(() => null);
      }
    }
  }

  /**
   * Logs the cancellation of a callsign request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff or system cancelling the callsign.
   * @param CancelledRequest - The cancelled callsign document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogCancellation(
    Interaction: ManagementInteraction,
    CancelledRequest: CallsignDoc
  ): Promise<void> {
    const FormattedCallsign = this.FormatCallsign(CancelledRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(CancelledRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMCancellationNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestCancelled)
        .setFooter({ text: `Reference ID: ${CancelledRequest._id}` })
        .setTitle("Callsign Request — Cancellation Notice")
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      if (CancelledRequest.reviewed_on && CancelledRequest.reviewer) {
        DMCancellationNotice.setDescription(
          `Your callsign request for \`${FormattedCallsign}\`, submitted on ${FormatTime(CancelledRequest.requested_on, "D")}, ` +
            `has been cancelled${CancelledRequest.reviewer === Interaction.client.user.id ? " automatically" : ""} on ${FormatTime(Interaction.createdAt, "d")}.` +
            (CancelledRequest.reviewer_notes
              ? `\n\n**Reason:**\n${codeBlock(CancelledRequest.reviewer_notes)}`
              : "")
        );
      } else {
        DMCancellationNotice.setDescription(
          `Your callsign request for \`${FormattedCallsign}\` has been cancelled at your request. ` +
            "There is no active callsign assignment on record for you at this time."
        );
      }

      Requester.send({ embeds: [DMCancellationNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestCancelled)
        .setTitle("Callsign Request Cancellation")
        .setFooter({
          text: `Reference ID: ${CancelledRequest._id}; cancelled${CancelledRequest.reviewer === Interaction.client.user.id ? " automatically" : ""} on`,
        })
        .addFields({
          inline: true,
          name: CallsignsEventLogger.RequestInfoFieldName,
          value: this.ConcatenateLines(
            `**Requester:** ${userMention(CancelledRequest.requester)}`,
            `**Requested:** ${FormatTime(CancelledRequest.requested_on, "D")}`,
            `**Callsign:** \`${FormattedCallsign}\``,
            `**Reason:** ${CancelledRequest.request_reason}`
          ),
        });

      if (CancelledRequest.reviewer_notes?.length) {
        LogEmbed.addFields({
          inline: true,
          name: "Cancellation Details",
          value: CancelledRequest.reviewer_notes,
        });
      }

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }

    if (CancelledRequest.request_message) {
      const [, ReqMsgId] = CancelledRequest.request_message.split(":");
      const ReqMsgChannel = await this.FetchRequestMessageChannel(
        Interaction.guild,
        CancelledRequest.request_message
      );

      if (!ReqMsgChannel) return;
      const RequestEmbed = await this.GetRequestMessageEmbedWithStatus(
        Interaction.guild,
        CancelledRequest,
        GenericRequestStatuses.Cancelled
      );

      const ReviewActionButtons = this.CreateManagementButtons(
        CancelledRequest.requester,
        CancelledRequest._id.toString(),
        true
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, {
          content: null,
          embeds: [RequestEmbed],
          components: [ReviewActionButtons],
        })
        .catch(() => null);
    }
  }
}
