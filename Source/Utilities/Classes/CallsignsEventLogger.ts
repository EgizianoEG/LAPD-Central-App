import {
  Guild,
  spoiler,
  Message,
  codeBlock,
  userMention,
  roleMention,
  TextChannel,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ImageURLOptions,
  ColorResolvable,
  ActionRowBuilder,
  TextBasedChannel,
  ButtonInteraction,
  GuildBasedChannel,
  TextDisplayBuilder,
  time as FormatTime,
  PermissionFlagsBits,
  ModalSubmitInteraction,
} from "discord.js";

import {
  ConcatenateLines,
  FormatCallsignDesignation as FormatCallsign,
} from "@Utilities/Strings/Formatters.js";

import { Colors, Emojis, Thumbs } from "@Config/Shared.js";
import { GenericRequestStatuses } from "@Config/Constants.js";
import { BaseExtraContainer } from "./ExtraContainers.js";
import { Callsigns } from "@Typings/Utilities/Database.js";
import GetGuildSettings from "@Utilities/Database/GetGuildSettings.js";

type CallsignDoc = Callsigns.CallsignDocument;
type ManagementInteraction = ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">;

// ------------------------------------------------------------------------------------
// Main Class Definition:
// ----------------------
/**
 * Event logger class for callsign requests, approvals, denials, and other related actions.
 * Handles logging to designated channels and sending notifications to users.
 */
export default class CallsignsEventLogger {
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
   * Creates a set of management buttons for approving, denying, or requesting additional information about a callsign request.
   * @param UserId - The ID of the user who submitted the callsign request.
   * @param CallsignId - The ID of the callsign request.
   * @param CallsignReviewed - Whether the callsign request has already been reviewed (optional, defaults to `false`).
   *                         This determines whether the buttons should be disabled or not.
   * @returns An action row containing the management buttons.
   */
  CreateManagementButtons(CallsignDocument: CallsignDoc): ActionRowBuilder<ButtonBuilder> {
    const { reviewed_on, requester: UserId, _id: CallsignId } = CallsignDocument;
    const ButtonsDisabled =
      !!reviewed_on || CallsignDocument.request_status === GenericRequestStatuses.Cancelled;

    return new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setCustomId(`callsign-approve:${UserId}:${CallsignId}`)
        .setLabel("Approve")
        .setEmoji(Emojis.WhiteCheck)
        .setDisabled(ButtonsDisabled)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`callsign-deny:${UserId}:${CallsignId}`)
        .setLabel("Deny")
        .setEmoji(Emojis.WhiteCross)
        .setDisabled(ButtonsDisabled)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`callsign-info:${UserId}:${CallsignId}`)
        .setLabel("Additional Information")
        .setEmoji(Emojis.WhitePlus)
        .setDisabled(ButtonsDisabled)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  /**
   * Constructs a pre-defined container for a callsign request.
   * @param Opts - Options for constructing the container:
   * - `RequestStatus`: The type of the request (e.g., "Cancelled", "Pending"). Defaults to "Pending".
   * - `Guild`: The guild where the request was made.
   * - `CallsignDocument`: The callsign document.
   * - `CancellationDate`: The date when the request was cancelled (if applicable).
   * - `CurrentlyAssigned`: The currently assigned callsign document, if any (for transfers).
   * @returns A pre-configured container display component for the request.
   */
  protected GetRequestContainer(Opts: {
    RequestStatus?: keyof typeof GenericRequestStatuses;
    Guild?: Guild;
    CallsignDocument: CallsignDoc;
    CurrentlyAssigned?: CallsignDoc | null;
    CancellationDate?: Date | null;
  }): BaseExtraContainer {
    const {
      RequestStatus = "Pending",
      CallsignDocument,
      CancellationDate,
      CurrentlyAssigned,
    } = Opts;
    const FormattedCallsign = FormatCallsign(CallsignDocument.designation);
    const Strikethrough = RequestStatus === "Cancelled" ? "~~" : "";
    const IsTransfer = !!CurrentlyAssigned;
    const CurrPrevCallsignText =
      IsTransfer && CallsignDocument.request_status === GenericRequestStatuses.Approved
        ? "**Previous Designation:**"
        : "**Current Designation:**";

    const RequestContainer = new BaseExtraContainer()
      .setTitle(`${RequestStatus}  |  Call Sign ${IsTransfer ? "Transfer " : ""}Request`)
      .setFooter(`Reference ID: \`${CallsignDocument._id}\``)
      .setColor(RequestStatus === "Cancelled" ? Colors.RequestDenied : Colors.RequestPending)
      .setDescription(
        ConcatenateLines(
          `**Requester:** ${userMention(CallsignDocument.requester)}`,
          `**${IsTransfer ? "Req. " : ""}Designation:** ${Strikethrough}**\`${FormattedCallsign}\`**${Strikethrough}`,
          IsTransfer
            ? `${CurrPrevCallsignText} **\`${FormatCallsign(CurrentlyAssigned.designation)}\`**`
            : null,
          `**Reason:** ${CallsignDocument.request_reason}`
        )
      );

    if (CancellationDate) {
      RequestContainer.setTimestamp(CancellationDate, " ");
      RequestContainer.setFooter(
        `Reference ID: \`${CallsignDocument._id}\`; cancelled by requester on`
      );
    }

    return RequestContainer;
  }

  /**
   * Generates a message container for a callsign request with the specified status.
   * @param Guild - The guild where the request was made.
   * @param CallsignDocument - The updated callsign document.
   * @param RequestStatus - The status of the request ("Approved", "Denied", "Cancelled", or "Pending").
   * @param CurrPrevAssigned - The currently assigned callsign document, if any (optional).
   * @param [MgmtButtonsAttached=true] - Whether to attach management buttons to the request container.
   *                                     Defaults to `true` and depends on the up-to-date document of the request.
   * @returns A Promise resolving to the configured container for the request.
   */
  async GetRequestMessageContainerWithStatus(
    Guild: Guild,
    CallsignDocument: CallsignDoc,
    RequestStatus: keyof typeof GenericRequestStatuses,
    CurrPrevAssigned?: CallsignDoc | null,
    MgmtButtonsAttached: boolean = true
  ): Promise<BaseExtraContainer> {
    const {
      _id: CallsignId,
      reviewer: Reviewer,
      requester: Requester,
      reviewed_on: ReviewedOn,
    } = CallsignDocument;

    const IsCancelled = RequestStatus === GenericRequestStatuses.Cancelled;
    const RequestContainer = this.GetRequestContainer({
      Guild,
      CallsignDocument,
      RequestStatus: IsCancelled ? "Cancelled" : RequestStatus,
      CurrentlyAssigned: CurrPrevAssigned,
      CancellationDate: IsCancelled ? ReviewedOn : null,
    });

    if (MgmtButtonsAttached) {
      RequestContainer.attachPromptActionRows(this.CreateManagementButtons(CallsignDocument));
    }

    if (!ReviewedOn) {
      return RequestContainer;
    }

    RequestContainer.setTimestamp(ReviewedOn, " ");
    let Title = RequestContainer.title!.split("|")[1];
    let Color: ColorResolvable;
    let FooterText: string;

    switch (RequestStatus) {
      case GenericRequestStatuses.Approved: {
        Title = `Approved  |${Title}`;
        Color = Colors.RequestApproved;
        FooterText = `approved by ${userMention(Reviewer!)} on`;
        break;
      }

      case GenericRequestStatuses.Denied: {
        Title = `Denied  |${Title}`;
        Color = Colors.RequestDenied;
        FooterText = `denied by ${userMention(Reviewer!)} on`;
        break;
      }

      case GenericRequestStatuses.Cancelled: {
        const CancelledBy = Reviewer === Requester ? "requester" : userMention(Reviewer!);
        Title = `Cancelled  |${Title}`;
        Color = Colors.RequestDenied;
        FooterText = `cancelled by ${CancelledBy} on`;
        break;
      }

      default:
        return RequestContainer;
    }

    RequestContainer.setTitle(Title)
      .setColor(Color)
      .setFooter({
        text: `Reference ID: \`${CallsignId}\`; ${FooterText}`,
      });

    return RequestContainer;
  }

  /**
   * Sends a new callsign request to the requests channel for approval.
   * Also sends a DM notice to the requester if possible.
   * @param Interaction - The interaction originating from the requester.
   * @param PendingCallsign - The callsign document pending approval.
   * @param CurrentlyAssigned - The currently assigned callsign document, if any.
   * @returns A Promise resolving to the sent request message if successful.
   */
  async SendRequest(
    Interaction: SlashCommandInteraction<"cached">,
    PendingCallsign: CallsignDoc,
    CurrentlyAssigned?: CallsignDoc | null
  ): Promise<Message<true> | null> {
    const FormattedCallsign = FormatCallsign(PendingCallsign.designation);
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
        .setTitle("Call Sign Request — Request Under Review")
        .setDescription(
          `Your call sign request for **\`${FormattedCallsign}\`**, submitted on ${FormatTime(PendingCallsign.requested_on, "D")}, ` +
            "has been received and is waiting for a review by the management team.\n\n" +
            "You will be notified via DM when there is an update regarding its status."
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? undefined,
        });

      Requester.send({ embeds: [DMNotice] }).catch(() => null);
    }

    // Send the request message if a requests channel is set.
    if (!RequestsChannel) return null;
    const RequestComponents: any[] = [];
    const RequestContainer = await this.GetRequestMessageContainerWithStatus(
      Interaction.guild,
      PendingCallsign,
      GenericRequestStatuses.Pending,
      CurrentlyAssigned
    );

    // Handle role mentions if `alert_on_request` is enabled.
    const AlertRolesMentioned =
      CallsignsModuleSettings?.alert_on_request && CallsignsModuleSettings?.manager_roles?.length
        ? CallsignsModuleSettings.manager_roles.map(roleMention).join(", ")
        : "";

    const MsgFlags = AlertRolesMentioned
      ? MessageFlags.SuppressNotifications | MessageFlags.IsComponentsV2
      : MessageFlags.IsComponentsV2;

    RequestComponents.push(RequestContainer);
    if (AlertRolesMentioned.length) {
      RequestComponents.unshift(
        new TextDisplayBuilder().setContent(`-# *${spoiler(AlertRolesMentioned)}*`)
      );
    }

    return RequestsChannel.send({
      flags: MsgFlags,
      components: RequestComponents,
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
    if (ApprovedRequest.request_status !== GenericRequestStatuses.Approved) {
      return;
    }

    const FormattedCallsign = FormatCallsign(ApprovedRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(ApprovedRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMApprovalNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestApproved)
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}` })
        .setTitle("Call Sign Request — Approval Notice")
        .setDescription(
          ConcatenateLines(
            `Your call sign request for **\`${FormattedCallsign}\`**, submitted on ${FormatTime(ApprovedRequest.requested_on, "D")}, has been approved.`,
            ApprovedRequest.expiry
              ? `Your call sign is set to expire on ${FormatTime(ApprovedRequest.expiry, "F")} (${FormatTime(ApprovedRequest.expiry, "R")}).`
              : null,
            ApprovedRequest.reviewer_notes
              ? `\n**Reviewer Notes:**\n${codeBlock(ApprovedRequest.reviewer_notes)}`
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
        .setTitle("Call Sign Request Approval")
        .setFooter({ text: `Reference ID: ${ApprovedRequest._id}; approved on` })
        .addFields(
          {
            name: CallsignsEventLogger.RequestInfoFieldName,
            inline: true,
            value: ConcatenateLines(
              `**Requester:** ${userMention(ApprovedRequest.requester)}`,
              `**Designation:** \`${FormattedCallsign}\``,
              PreviouslyAssigned
                ? `**Previous Designation:** \`${FormatCallsign(PreviouslyAssigned.designation)}\``
                : null,
              `**Requested:** ${FormatTime(ApprovedRequest.requested_on, "D")}`,
              ApprovedRequest.expiry
                ? `**Expires:** ${FormatTime(ApprovedRequest.expiry, "D")}`
                : null,
              `**Reason:** ${ApprovedRequest.request_reason}`
            ),
          },
          {
            name: "Approval Info",
            inline: true,
            value: ConcatenateLines(
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

      const RequestContainer = await this.GetRequestMessageContainerWithStatus(
        Interaction.guild,
        ApprovedRequest,
        GenericRequestStatuses.Approved,
        PreviouslyAssigned
      );

      await (RequestChannel as TextChannel).messages.edit(MessageId, {
        components: [RequestContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }

  /**
   * Logs the denial of a callsign request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff denying the callsign.
   * @param DeniedRequest - The denied callsign document.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogDenial(
    Interaction: ManagementInteraction,
    DeniedRequest: CallsignDoc,
    CurrPrevCallsign?: CallsignDoc | null
  ): Promise<void> {
    if (DeniedRequest.request_status !== GenericRequestStatuses.Denied) {
      return;
    }

    const FormattedCallsign = FormatCallsign(DeniedRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(DeniedRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMDenialNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestDenied)
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}` })
        .setTitle("Call Sign Request — Denial Notice")
        .setDescription(
          `Your call sign request for **\`${FormattedCallsign}\`**, submitted on ${FormatTime(DeniedRequest.requested_on, "D")}, has been denied.` +
            "You may submit a new request if you believe this denial was made in error or if circumstances have changed." +
            "\n\n**The following note(s) were provided by the reviewer:**" +
            codeBlock(DeniedRequest.reviewer_notes ?? "N/A")
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
        .setTitle("Call Sign Request Denial")
        .setFooter({ text: `Reference ID: ${DeniedRequest._id}; denied on` })
        .setTimestamp(Interaction.createdAt)
        .addFields(
          {
            inline: true,
            name: CallsignsEventLogger.RequestInfoFieldName,
            value: ConcatenateLines(
              `**Requester:** ${userMention(DeniedRequest.requester)}`,
              `**Designation:** \`${FormattedCallsign}\``,
              `**Requested:** ${FormatTime(DeniedRequest.requested_on, "D")}`,
              `**Reason:** ${DeniedRequest.request_reason}`
            ),
          },
          {
            inline: true,
            name: "Denial Info",
            value: ConcatenateLines(
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
        const RequestContainer = await this.GetRequestMessageContainerWithStatus(
          Interaction.guild,
          DeniedRequest,
          GenericRequestStatuses.Denied,
          CurrPrevCallsign
        );

        await RequestChannel.messages.edit(MessageId, {
          components: [RequestContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
  }

  /**
   * Logs the cancellation of a callsign request to the logging channel.
   * Also sends a DM notice to the requester and updates the request message if applicable.
   * @param Interaction - The interaction from the management staff or system cancelling the callsign.
   * @param CancelledRequest - The cancelled callsign document.
   * @param CurrentlyAssigned - The currently assigned callsign document, if any.
   * @returns A Promise resolving after the log and updates are completed.
   */
  async LogCancellation(
    Interaction: ManagementInteraction,
    CancelledRequest: CallsignDoc,
    CurrentlyAssigned?: CallsignDoc | null
  ): Promise<void> {
    if (
      CancelledRequest.request_status !== GenericRequestStatuses.Cancelled ||
      !(CancelledRequest.reviewed_on && CancelledRequest.reviewer)
    ) {
      return;
    }

    const IsSelfCancelled = CancelledRequest.reviewer === CancelledRequest.requester;
    const FormattedCallsign = FormatCallsign(CancelledRequest.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const Requester = await Interaction.guild.members
      .fetch(CancelledRequest.requester)
      .catch(() => null);

    if (Requester) {
      const DMCancellationNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestCancelled)
        .setFooter({ text: `Reference ID: ${CancelledRequest._id}` })
        .setTitle("Call Sign Request — Cancellation Notice")
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? Thumbs.Transparent,
        });

      if (CancelledRequest.reviewed_on && CancelledRequest.reviewer) {
        DMCancellationNotice.setDescription(
          `Your callsign request for **\`${FormattedCallsign}\`**, submitted on ${FormatTime(CancelledRequest.requested_on, "D")}, ` +
            `has been cancelled${IsSelfCancelled ? "" : " automatically"}${IsSelfCancelled ? " at your demand" : ""}.` +
            (CancelledRequest.reviewer_notes
              ? `\n\n**Reason:**\n${codeBlock(CancelledRequest.reviewer_notes)}`
              : "")
        );
      }

      Requester.send({ embeds: [DMCancellationNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const TransferStatus = CurrentlyAssigned ? " Transfer" : "";
      const CancelledByText = IsSelfCancelled
        ? " by requester"
        : CancelledRequest.reviewer === Interaction.client.user.id
          ? " automatically"
          : "";

      const LogEmbed = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestCancelled)
        .setTitle(`Call Sign${TransferStatus} Request Cancellation`)
        .setFooter({
          text: `Reference ID: ${CancelledRequest._id}; cancelled${CancelledByText} on`,
        })
        .addFields({
          inline: true,
          name: CallsignsEventLogger.RequestInfoFieldName,
          value: ConcatenateLines(
            `**Requester:** ${userMention(CancelledRequest.requester)}`,
            `**Designation:** \`${FormattedCallsign}\``,
            `**Requested:** ${FormatTime(CancelledRequest.requested_on, "D")}`,
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
      const RequestContainer = await this.GetRequestMessageContainerWithStatus(
        Interaction.guild,
        CancelledRequest,
        GenericRequestStatuses.Cancelled,
        CurrentlyAssigned
      );

      await ReqMsgChannel.messages
        .edit(ReqMsgId, {
          components: [RequestContainer],
        })
        .catch(() => null);
    }
  }

  /**
   * Logs the administrative release of an active callsign to the logging channel.
   * Also sends a DM notice to the affected user.
   * @param Interaction - The interaction from the management staff releasing the callsign.
   * @param ReleasedCallsign - The released callsign document.
   * @param Notes - Optional notes for the release.
   * @returns A Promise resolving after the log and notifications are completed.
   */
  async LogAdministrativeRelease(
    Interaction: ManagementInteraction,
    ReleasedCallsign: CallsignDoc,
    Notes?: string | null
  ): Promise<void> {
    if (
      ReleasedCallsign.request_status !== GenericRequestStatuses.Approved ||
      !ReleasedCallsign.reviewed_on
    ) {
      return;
    }

    const FormattedCallsign = FormatCallsign(ReleasedCallsign.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const AffectedStaff = await Interaction.client.users
      .fetch(ReleasedCallsign.requester)
      .catch(() => null);

    if (AffectedStaff) {
      const DMReleaseNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestCancelled)
        .setFooter({ text: `Reference ID: ${ReleasedCallsign._id}` })
        .setTitle("Call Sign Administrative Release")
        .setDescription(
          ConcatenateLines(
            `Your active call sign **\`${FormattedCallsign}\`** has been administratively released by management. You may submit a new call sign request if needed.`,
            Notes ? `**\nRelease Notes:**\n${codeBlock(Notes)}` : null
          )
        )
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? undefined,
        });

      AffectedStaff.send({ embeds: [DMReleaseNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setColor(Colors.RequestCancelled)
        .setTitle("Call Sign Administrative Release")
        .setFooter({ text: `Reference ID: ${ReleasedCallsign._id}` })
        .setTimestamp(Interaction.createdAt)
        .addFields(
          {
            inline: true,
            name: "Call Sign Info",
            value: ConcatenateLines(
              `**Designation:** \`${FormattedCallsign}\``,
              `**Assigned On:** ${FormatTime(ReleasedCallsign.reviewed_on, "D")}`,
              `**Affected Staff:** ${userMention(ReleasedCallsign.requester)}`
            ),
          },
          {
            inline: true,
            name: "Release Info",
            value: ConcatenateLines(
              `**Released By:** ${userMention(Interaction.user.id)}`,
              Notes ? `**Notes:**\n${Notes}` : "**Notes:** N/A"
            ),
          }
        );

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }
  }

  /**
   * Logs the administrative assignment of a callsign to the logging channel.
   * Also sends a DM notice to the affected user. This is basically the same as an approval but without a request.
   * @param Interaction - The interaction from the management staff assigning the callsign.
   * @param AssignedCallsign - The assigned callsign document.
   * @param PreviousCallsign - The previously assigned callsign document, if any and if this is a transfer.
   * @returns A Promise resolving after the log and notifications are completed.
   */
  async LogAdministrativeAssignmentOrTransfer(
    Interaction: ManagementInteraction,
    AssignedCallsign: CallsignDoc,
    PreviousCallsign?: CallsignDoc | null
  ): Promise<void> {
    if (AssignedCallsign.request_status !== GenericRequestStatuses.Approved) return;

    const IsTransfer = PreviousCallsign?.request_status === GenericRequestStatuses.Approved;
    const StatusText = IsTransfer ? "Transfer" : "Assignment";
    const FormattedCallsign = FormatCallsign(AssignedCallsign.designation);
    const LogChannel = await this.FetchLoggingChannel(Interaction.guild, "log");
    const AffectedStaff = await Interaction.guild.members
      .fetch(AssignedCallsign.requester)
      .catch(() => null);

    if (AffectedStaff) {
      let DescriptionText = "";

      if (IsTransfer) {
        const PreviousFormattedCallsign = FormatCallsign(PreviousCallsign.designation);
        DescriptionText = `Your call sign has been administratively transferred from **\`${PreviousFormattedCallsign}\`** to **\`${FormattedCallsign}\`**.`;
      } else {
        DescriptionText = `You have been administratively assigned the call sign **\`${FormattedCallsign}\`**.`;
      }

      DescriptionText = ConcatenateLines(
        DescriptionText,
        AssignedCallsign.expiry
          ? `This call sign is set to expire on ${FormatTime(AssignedCallsign.expiry, "F")} (${FormatTime(AssignedCallsign.expiry, "R")}).`
          : null,
        AssignedCallsign.reviewer_notes
          ? `\n**Assignment Notes:**\n${codeBlock(AssignedCallsign.reviewer_notes)}`
          : null
      );

      const DMAssignmentNotice = new EmbedBuilder()
        .setTimestamp(Interaction.createdAt)
        .setColor(Colors.RequestApproved)
        .setFooter({ text: `Reference ID: ${AssignedCallsign._id}` })
        .setTitle(`Administrative Call Sign ${StatusText}`)
        .setDescription(DescriptionText)
        .setAuthor({
          name: Interaction.guild.name,
          iconURL: Interaction.guild.iconURL(this.ImgURLOpts) ?? undefined,
        });

      AffectedStaff.send({ embeds: [DMAssignmentNotice] }).catch(() => null);
    }

    if (LogChannel) {
      const LogEmbed = new EmbedBuilder()
        .setColor(Colors.RequestApproved)
        .setTimestamp(Interaction.createdAt)
        .setTitle(`Administrative Call Sign ${StatusText}`)
        .setFooter({ text: `Assigned Ref. ID: ${AssignedCallsign._id}` })
        .addFields(
          {
            inline: true,
            name: "Call Sign Info",
            value: ConcatenateLines(
              `**Assigned To:** ${userMention(AssignedCallsign.requester)}`,
              `**Designation:** \`${FormattedCallsign}\``,
              AssignedCallsign.expiry
                ? `**Expires:** ${FormatTime(AssignedCallsign.expiry, "R")}`
                : "**Expires:** *Never*"
            ),
          },
          {
            inline: true,
            name: "Assignment Info",
            value: ConcatenateLines(
              `**Assigned By:** ${userMention(Interaction.user.id)}`,
              AssignedCallsign.reviewer_notes
                ? `**Notes:** ${AssignedCallsign.reviewer_notes}`
                : "**Notes:** *N/A*"
            ),
          }
        );

      if (PreviousCallsign?.request_status === GenericRequestStatuses.Approved) {
        LogEmbed.addFields({
          name: "Previous Call Sign",
          value: ConcatenateLines(
            `**Ref. ID:** \`${PreviousCallsign._id}\``,
            `**Designation:** \`${FormatCallsign(PreviousCallsign.designation)}\``,
            `**Approved On:** ${FormatTime(PreviousCallsign.reviewed_on!, "D")}`,
            `**Approved By:** ${userMention(PreviousCallsign.reviewer!)}`
          ),
        });
      }

      LogChannel.send({ embeds: [LogEmbed] }).catch(() => null);
    }
  }
}
