import type {
  MessageActionRowComponentBuilder,
  APIComponentInMessageActionRow,
  APITextDisplayComponent,
  APIComponentInContainer,
  MessageFlagsResolvable,
  APIActionRowComponent,
  APIContainerComponent,
  APIThumbnailComponent,
  APISeparatorComponent,
  RepliableInteraction,
  InteractionResponse,
  ColorResolvable,
  Message,
} from "discord.js";

import {
  MessageComponentInteraction,
  time as FormatTime,
  CommandInteraction,
  TextDisplayBuilder,
  ButtonInteraction,
  ContainerBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ComponentType,
  MessageFlags,
  resolveColor,
} from "discord.js";

import { differenceInMilliseconds, milliseconds } from "date-fns";
import { ErrorMessages, InfoMessages } from "#Resources/AppMessages.js";
import { format as FormatString } from "node:util";
import { Colors } from "#Config/Shared.js";
import AppError from "./AppError.js";

type MessageActionRowComponent =
  | ActionRowBuilder<MessageActionRowComponentBuilder>
  | APIActionRowComponent<APIComponentInMessageActionRow>;

type ThumbnailAccessory =
  | APIThumbnailComponent
  | ThumbnailBuilder
  | ((builder: ThumbnailBuilder) => ThumbnailBuilder);

export class BaseExtraContainer extends ContainerBuilder {
  protected _title: string | null = null;
  protected _title_sep_opts: (Partial<APISeparatorComponent> & { no_sep?: boolean }) | null = null;
  protected _description: string | null = null;
  protected _accentColor: ColorResolvable | null = null;
  protected _thumbnail: string | null = null;
  protected _footer: string | null = null;
  protected _timestamp: Date | null = null;
  protected _footerDelimiter: string = " | ";
  protected _footerEmoji: string | null = null;
  protected _actionRows: MessageActionRowComponent[] = [];
  protected _actionRowSeparatorOpts: { spacing?: 1 | 2; divider?: boolean } = {
    spacing: 1,
    divider: true,
  };

  public get title(): string | null {
    return this._title;
  }

  public get description(): string | null {
    return this._description;
  }

  public get accentColor(): ColorResolvable | null {
    return this._accentColor;
  }

  public get thumbnail(): string | null {
    return this._thumbnail;
  }

  public get footer(): string | null {
    return this._footer;
  }

  public get timestamp(): Date | null {
    return this._timestamp;
  }

  public get footerDelimiter(): string {
    return this._footerDelimiter;
  }

  public get footerEmoji(): string | null {
    return this._footerEmoji;
  }

  public get actionRows(): MessageActionRowComponent[] {
    return this._actionRows;
  }

  public get actionRowSeparatorOpts(): { spacing?: 1 | 2; divider?: boolean } {
    return this._actionRowSeparatorOpts;
  }

  constructor() {
    super();
    this.addTextDisplayComponents(
      new TextDisplayBuilder({
        content: this._title ?? "### [Title]",
        id: 1,
      })
    )
      .addSeparatorComponents(new SeparatorBuilder().setDivider().setId(2))
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: this._description ?? "[Description]",
          id: 3,
        })
      );
  }

  /**
   * Extracts the description text from a Discord API container component JSON structure.
   * @param apiData - The Discord API container component data (single container from message components array).
   * @returns The description string content, or `null` if not found.
   */
  static getDescriptionFromContainerJSON(apiData: APIContainerComponent): string | null {
    if (!apiData?.components) return null;

    const DescriptionComponent = apiData.components.find(
      (component: APIComponentInContainer) =>
        component.type === ComponentType.TextDisplay && component.id === 3
    ) as APITextDisplayComponent | undefined;

    return DescriptionComponent?.content ?? null;
  }

  /**
   * Extracts the title text from a Discord API container component JSON structure.
   * @param apiData - The Discord API container component data (single container from message components array).
   * @returns The title string content, or `null` if not found.
   */
  static getTitleFromContainerJSON(apiData: APIContainerComponent): string | null {
    if (!apiData?.components) return null;

    const TitleComponent = apiData.components.find(
      (component: APIComponentInContainer) =>
        component.type === ComponentType.TextDisplay && component.id === 1
    ) as APITextDisplayComponent | undefined;

    return TitleComponent?.content ?? null;
  }

  /**
   * Private method to rebuild the footer component based on current footer text and timestamp.
   * Handles all combinations: footer only, timestamp only, both, or neither.
   * Also handles footer emoji icons using pre-uploaded emojis or emoji strings.
   * @param divider - Whether to include a visible divider line in the footer separator.
   * @returns The current instance for method chaining.
   */
  private _rebuildFooterComponent(divider: boolean = true): this {
    const FooterIndex = this.components.findLastIndex(
      (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 4
    );

    if (FooterIndex !== -1) {
      const StartIndex =
        FooterIndex > 0 && this.components[FooterIndex - 1].data.type === ComponentType.Separator
          ? FooterIndex - 1
          : FooterIndex;

      const ItemsToRemove = FooterIndex - StartIndex + 1;
      this.spliceComponents(StartIndex, ItemsToRemove);
    }

    let FooterContent: string | null = null;
    let FooterIconText = "";

    if (this._footer && this._timestamp) {
      FooterContent = `${this._footer}${this._footerDelimiter}${FormatTime(this._timestamp, "D")}`;
    } else if (this._footer) {
      FooterContent = this._footer;
    } else if (this._timestamp) {
      FooterContent = FormatTime(this._timestamp, "D");
    }

    if (this._footerEmoji && FooterContent) {
      FooterIconText = `${this._footerEmoji} `;
    }

    if (!FooterContent) {
      return this;
    }

    const FinalFooterContent = `${FooterIconText}${FooterContent}`.trim();
    const FooterComponent = new TextDisplayBuilder({
      content: FinalFooterContent.startsWith("-# ")
        ? FinalFooterContent
        : `-# ${FinalFooterContent}`,
      id: 4,
    });

    return this.addSeparatorComponents(
      new SeparatorBuilder().setDivider(divider)
    ).addTextDisplayComponents(FooterComponent);
  }

  /**
   * Private method to rebuild action rows from stored action row data.
   * Removes existing action rows and adds the stored ones with proper separators.
   * Only adds a separator if there's no footer (since footer already has its own separator).
   * @returns The current instance for method chaining.
   */
  private _rebuildActionRows(): this {
    const ActionRowIndices = this.components
      .map((c, i) => (c instanceof ActionRowBuilder ? i : -1))
      .filter((i) => i !== -1);

    for (let i = ActionRowIndices.length - 1; i >= 0; i--) {
      this.spliceComponents(ActionRowIndices[i], 1);
    }

    if (this._actionRows.length > 0) {
      const HasFooter = this.components.some(
        (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 4
      );

      if (!HasFooter) {
        const Separator = new SeparatorBuilder()
          .setSpacing(this._actionRowSeparatorOpts.spacing ?? 1)
          .setDivider(this._actionRowSeparatorOpts.divider ?? true);

        this.addSeparatorComponents(Separator);
      }

      return this.addActionRowComponents(...this._actionRows);
    }

    return this;
  }

  /**
   * Private method to rebuild both footer and action rows in the correct order.
   * This ensures proper separator coordination between components.
   * @param footerDivider - Whether to include a visible divider line in the footer separator.
   * @returns The current instance for method chaining.
   */
  private _rebuildFooterAndActionRows(footerDivider: boolean = true): this {
    this._rebuildFooterComponent(footerDivider);
    return this._rebuildActionRows();
  }

  /**
   * Sets the accent color for the container.
   * @param color - The color to set as the accent, or `null` to clear the accent color.
   *                Accepts a value of type `ColorResolvable`.
   * @returns The current instance for method chaining.
   */
  public setColor(color: ColorResolvable | null): this {
    if (!color) return this.clearAccentColor();
    return this.setAccentColor(resolveColor(color));
  }

  /**
   * Sets the title for the container, trimming any leading or trailing whitespace.
   * Updates the content of the first TextDisplayBuilder component to reflect the new title, formatted as a Markdown heading.
   * @param title - The new title to set. If `null` or `undefined`, an empty string is used.
   * @param sep_opts - Optional configuration for the separator component after the title.
   * @returns The current instance for method chaining.
   */
  public setTitle(
    title?: string | null,
    sep_opts?: Partial<APISeparatorComponent> & { no_sep?: boolean }
  ): this {
    this._title = title?.trim() ?? "";

    if (sep_opts) this._title_sep_opts = sep_opts;
    if (sep_opts && !sep_opts.no_sep && !(this.components[0] instanceof SectionBuilder)) {
      this.components[1] = new SeparatorBuilder(sep_opts);
    } else if (
      sep_opts?.no_sep &&
      this.components.some((c) => c instanceof SeparatorBuilder && c.data.id === 2)
    ) {
      this.components.splice(1, 1);
    }

    if (this.components[0] instanceof SectionBuilder) {
      return (
        (this.components[0].components[0] as TextDisplayBuilder).setContent(`### ${this._title}`) &&
        this
      );
    } else if (this.components[0] instanceof TextDisplayBuilder) {
      return this.components[0].setContent(`### ${this._title}`) && this;
    }

    return this;
  }

  /**
   * Sets the description of this embed using node `util.format()`.
   * @remarks This method will set the description to a single space if it was provided as a falsey value.
   * @requires {@link FormatString `node:util.format()`}
   * @param description - A tuple of data to format (by `util.format()`) and set as the description.
   */
  public setDescription(...description: any[]): this {
    const Formatted = FormatString(...description).trim();
    this._description = Formatted.match(/^(?:\s*|NaN|null|undefined)$/) ? " " : Formatted;

    if (this.components.length > 0 && this.components[0] instanceof SectionBuilder) {
      const DescriptionComponent = this.components[0].components.find(
        (c, index) => c instanceof TextDisplayBuilder && index > 0
      ) as TextDisplayBuilder;

      if (DescriptionComponent) {
        DescriptionComponent.setContent(this._description);
      }
    } else {
      const DescriptionIndex = this.components.findIndex(
        (c, index) => c instanceof TextDisplayBuilder && index > 0
      );

      if (DescriptionIndex !== -1) {
        (this.components[DescriptionIndex] as TextDisplayBuilder).setContent(this._description);
      }
    }

    return this;
  }

  /**
   * Sets the footer text for the container. If a footer is provided, it trims the text,
   * updates the internal footer property, and rebuilds the footer component.
   * If `null` is provided, it removes the footer text and rebuilds the footer component.
   * @param footer - The footer text to set, or `null` to remove the footer.
   * @param divider - Whether to include a visible divider line in the footer separator.
   * @returns The current instance for method chaining.
   */
  public setFooter(footer: string | null, divider?: boolean): this;

  /**
   * Sets the footer with text and optional emoji icon. The emoji should be a pre-uploaded
   * emoji mention (e.g., "<:name:id>").
   * @param opts - Object containing text and optional emoji, or `null` to remove the footer.
   * @param divider - Whether to include a visible divider line in the footer separator.
   * @returns The current instance for method chaining.
   */
  public setFooter(opts: { text: string; emoji?: string | null } | null, divider?: boolean): this;
  public setFooter(
    footerOrOpts: string | { text: string; emoji?: string | null } | null,
    divider: boolean = true
  ): this {
    if (typeof footerOrOpts === "string" || footerOrOpts === null) {
      this._footer = footerOrOpts?.trim() || null;
      this._footerEmoji = null;
    } else if (footerOrOpts) {
      this._footer = footerOrOpts.text.trim();
      this._footerEmoji = footerOrOpts.emoji ? footerOrOpts.emoji.trim() : null;
    } else {
      this._footer = null;
      this._footerEmoji = null;
    }

    return this._rebuildFooterAndActionRows(divider);
  }

  /**
   * Sets the timestamp for the footer. An alternative method to Embeds' `setTimestamp`.
   * @param timestampDate - The date to format as the timestamp. Defaults to the current date and time. If `null`, removes any existing timestamp.
   * @param footerDelimiter - The separator to use between the footer text and the timestamp. Defaults to `" | "`.
   * @returns The current instance for method chaining.
   */
  public setTimestamp(
    timestampDate: Date | null = new Date(),
    footerDelimiter: string = " | "
  ): this {
    this._timestamp = timestampDate;
    this._footerDelimiter = footerDelimiter;
    return this._rebuildFooterAndActionRows(true);
  }

  /**
   * Sets the thumbnail accessory for the container.
   * Accepts a `ThumbnailAccessory` instance, a URL string, or `null` to remove the thumbnail.
   * Restructures the container components based on whether a thumbnail is present.
   * @param accessory - The thumbnail to set. Can be a `ThumbnailAccessory`, a URL string, or `null` to remove the thumbnail.
   * @returns The current instance for method chaining.
   */
  public setThumbnail(accessory: ThumbnailAccessory | string | null): this {
    if (!accessory) {
      if (
        this._thumbnail === null &&
        !(this.components.length && this.components[0] instanceof SectionBuilder)
      ) {
        this._thumbnail = null;
        return this;
      }

      const Section = this.components[0] as SectionBuilder;
      const TitleDisplay = Section.components[0] as TextDisplayBuilder;
      const DescDisplay = Section.components[1] as TextDisplayBuilder;
      const Divider =
        this._title_sep_opts?.no_sep === true
          ? null
          : new SeparatorBuilder(this._title_sep_opts ?? { divider: true });

      if (Divider) {
        const Divider = new SeparatorBuilder().setDivider().setId(2);
        this.spliceComponents(0, 1, TitleDisplay, Divider, DescDisplay);
      } else {
        this.spliceComponents(0, 1, TitleDisplay, DescDisplay);
      }

      this._thumbnail = null;
      return this;
    }

    const Thumb =
      typeof accessory === "string"
        ? new ThumbnailBuilder({
            media: {
              url: accessory,
            },
          })
        : accessory;

    this._thumbnail =
      typeof accessory === "string"
        ? accessory
        : "media" in accessory
          ? accessory.media.url
          : typeof accessory === "function"
            ? (accessory(new ThumbnailBuilder()).data.media?.url ?? null)
            : (accessory.data.media?.url ?? null);

    if (this.components.length > 0 && this.components[0] instanceof SectionBuilder) {
      this.components[0].setThumbnailAccessory(Thumb);
      return this;
    }

    const TitleIndex = this.components.findIndex((c) => c instanceof TextDisplayBuilder);
    const DescriptionIndex = this.components.findIndex(
      (c, index) => c instanceof TextDisplayBuilder && index > TitleIndex
    );

    if (TitleIndex !== -1 && DescriptionIndex !== -1) {
      const TitleComponent = this.components[TitleIndex] as TextDisplayBuilder;
      const DescriptionComponent = this.components[DescriptionIndex] as TextDisplayBuilder;
      const ComponentsToReplace = DescriptionIndex - TitleIndex + 1;

      this.spliceComponents(
        TitleIndex,
        ComponentsToReplace,
        new SectionBuilder()
          .addTextDisplayComponents(TitleComponent, DescriptionComponent)
          .setThumbnailAccessory(Thumb)
      );

      return this;
    }

    this.spliceComponents(0, this.components.length);
    const Section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder({
          content: `### ${this._title || "[Title]"}`,
          id: 1,
        }),
        new TextDisplayBuilder({
          content: this._description || "[Description]",
          id: 3,
        })
      )
      .setThumbnailAccessory(Thumb);

    this.addSectionComponents(Section);
    if (this._footer || this._timestamp) {
      return this._rebuildFooterAndActionRows();
    }

    return this._rebuildActionRows();
  }

  /**
   * Attaches action row(s) containing interactive components (buttons, select menus, etc.) to the container.
   * Stores the action rows internally and rebuilds the component structure to maintain proper hierarchy.
   * This method ensures consistent layout regardless of the order of method calls (setFooter, setThumbnail, etc.).
   *
   * @param actionRows - The action row component(s) containing interactive elements (buttons, select menus, etc.)
   * @param separatorOpts - Configuration options for the separator above the action rows.
   * @param separatorOpts.spacing - The spacing size to use for the separator (1 = small, 2 = large).
   * @param separatorOpts.divider - Whether to show a visible divider line in the separator.
   * @returns The current container instance for method chaining.
   *
   * @example
   * const container = new InfoContainer()
   *   .setTitle("Confirmation")
   *   .setDescription("Please confirm your choice")
   *   .attachPromptActionRows(
   *     new ActionRowBuilder<ButtonBuilder>().addComponents(
   *       new ButtonBuilder()
   *         .setCustomId("confirm")
   *         .setLabel("Confirm")
   *         .setStyle(ButtonStyle.Success),
   *       new ButtonBuilder()
   *         .setCustomId("cancel")
   *         .setLabel("Cancel")
   *         .setStyle(ButtonStyle.Secondary)
   *     )
   *   );
   */
  public attachPromptActionRows(
    actionRows: MessageActionRowComponent | MessageActionRowComponent[],
    separatorOpts: { spacing?: 1 | 2; divider?: boolean } = { spacing: 1, divider: true }
  ): this {
    this._actionRows = Array.isArray(actionRows) ? actionRows : [actionRows];
    this._actionRowSeparatorOpts = separatorOpts;
    return this._rebuildActionRows();
  }

  /**
   * Clears all attached action rows from the container.
   * @returns The current instance for method chaining.
   */
  public clearActionRows(): this {
    this._actionRows = [];
    return this._rebuildActionRows();
  }

  /**
   * Replies to a Discord interaction using the specified reply method, handling ephemeral and silent options.
   * @param interaction - The Discord interaction to reply to. Must be a `RepliableInteraction`.
   * @param ephemeral - Whether the reply should be ephemeral (visible only to the user). Defaults to `false`.
   * @param silent - If `true`, suppresses errors and returns `null` on failure. Defaults to `true`.
   * @param replyMethod - The reply method to use (`"reply"`, `"editReply"`, `"update"`, or `"followUp"`). If not provided, the method is determined automatically.
   * @returns A promise resolving to the interaction response or message, or `null` if silent and an error or inconsistency occurs.
   */
  async replyToInteract(
    interaction: RepliableInteraction,
    ephemeral: boolean = false,
    silent: boolean = true,
    replyMethod?: "reply" | "editReply" | "update" | "followUp"
  ): Promise<InteractionResponse<boolean> | Message<boolean> | null> {
    let ReplyMethod = replyMethod ?? "reply";
    const MsgFlags: MessageFlagsResolvable = ephemeral
      ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      : MessageFlags.IsComponentsV2;

    if (
      differenceInMilliseconds(new Date(), interaction.createdAt) > milliseconds({ minutes: 14.9 })
    ) {
      return null;
    }

    if (
      !replyMethod &&
      (interaction instanceof CommandInteraction || interaction instanceof ButtonInteraction) &&
      (interaction.deferred || interaction.replied)
    ) {
      ReplyMethod = "editReply";
    } else if (
      replyMethod === "editReply" &&
      interaction instanceof MessageComponentInteraction &&
      !(interaction.deferred || interaction.replied) &&
      interaction.message.flags.has(MessageFlags.IsComponentsV2)
    ) {
      ReplyMethod = "update";
    }

    return interaction[ReplyMethod]({
      flags: MsgFlags,
      components: [this],
    })
      .catch(() => {
        if (ReplyMethod === "followUp") {
          return interaction.reply({
            flags: MsgFlags,
            components: [this],
          });
        } else if (
          ReplyMethod === "editReply" &&
          interaction instanceof MessageComponentInteraction &&
          !ephemeral
        ) {
          return interaction.update({
            flags: MsgFlags,
            components: [this],
          });
        } else {
          return interaction.followUp({
            flags: MsgFlags,
            components: [this],
          });
        }
      })
      .catch((err: unknown) => {
        if (silent) return null;
        else throw err;
      });
  }
}

export class InfoContainer extends BaseExtraContainer {
  constructor() {
    super();
    this._title = "Information";
    this._accentColor = Colors.Info;
    this._description = "[Information Description]";

    this.setColor(this._accentColor).setTitle(this._title).setDescription(this._description);
  }

  /**
   * Uses the specified informative template and arguments to set the title and description.
   * @param templateName - The name of the info template to use.
   * @param args - Additional arguments to be used in formatting the info description.
   * @returns The modified instance of the info container.
   */
  useInfoTemplate(templateName: keyof typeof InfoMessages, ...args: any[]) {
    return ApplyContainerTemplate.call(this, "Info", templateName, ...args);
  }
}

export class WarnContainer extends BaseExtraContainer {
  constructor() {
    super();
    this._title = "Warning";
    this._accentColor = Colors.Warning;
    this._description = "[Warning Description]";

    this.setColor(this._accentColor).setTitle(this._title).setDescription(this._description);
  }

  /**
   * Uses the specified informative template and arguments to set the title and description.
   * @param templateName - The name of the info template to use.
   * @param args - Additional arguments to be used in formatting the info description.
   * @returns The modified instance of the info container.
   */
  useInfoTemplate(templateName: keyof typeof InfoMessages, ...args: any[]) {
    return ApplyContainerTemplate.call(this, "Info", templateName, ...args);
  }

  /**
   * Uses the specified warning template and arguments to set the title and description.
   * @param templateName - The name of the warning template to use.
   * @param args - Additional arguments to be used in formatting the warning description.
   * @returns The modified instance of the warning container.
   */
  useErrTemplate(templateName: keyof typeof ErrorMessages, ...args: any[]): WarnContainer {
    return ApplyContainerTemplate.call<
      WarnContainer,
      ["Error", keyof typeof ErrorMessages, ...any[]],
      WarnContainer
    >(this, "Error", templateName, ...args);
  }
}

export class ErrorContainer extends BaseExtraContainer {
  constructor() {
    super();
    this._title = "Error";
    this._accentColor = Colors.Error;
    this._description = "[Error Description]";

    this.setColor(this._accentColor).setTitle(this._title).setDescription(this._description);
  }

  /**
   * Sets the footer of the error embed with the provided error Id.
   * @param ErrorId - The error Id to display in the footer.
   * @param Divider - Whether to include a visible divider line in the footer separator.
   * @returns The modified instance of the error embed.
   */
  setErrorId(ErrorId: string, Divider: boolean = true): this {
    return this.setFooter(`Error ID: \`${ErrorId}\``, Divider);
  }

  /**
   * Uses the specified error object for the container's title and description.
   * @param {AppError | Error} Err - The error object to use.
   * @returns The modified instance of the error container.
   */
  useErrClass(Err: AppError | Error) {
    if (Err instanceof AppError) {
      this.setTitle(Err.title).setDescription(Err.message);
    } else {
      this.setTitle("Error").setDescription(Err.message);
    }
    return this;
  }

  /**
   * Uses the specified error template and arguments to set the title and description.
   * @param templateName - The name of the error template to use.
   * @param args - Additional arguments to be used in formatting the error description.
   * @returns The modified instance of the error container.
   */
  useErrTemplate(templateName: keyof typeof ErrorMessages, ...args: any[]): ErrorContainer {
    return ApplyContainerTemplate.call<
      ErrorContainer,
      ["Error", keyof typeof ErrorMessages, ...any[]],
      ErrorContainer
    >(this, "Error", templateName, ...args);
  }
}

export class SuccessContainer extends BaseExtraContainer {
  constructor() {
    super();
    this._title = "Success";
    this._accentColor = Colors.Success;
    this._description = "[Success Description]";

    this.setColor(this._accentColor).setTitle(this._title).setDescription(this._description);
  }

  /**
   * Uses the specified template and arguments to set the title and description.
   * @param templateName - The name of the template to use.
   * @param args - Additional arguments to be used in formatting the description.
   * @returns The modified instance of the success container.
   */
  useTemplate(templateName: keyof typeof InfoMessages, ...args: any[]): SuccessContainer {
    return ApplyContainerTemplate.call<
      SuccessContainer,
      ["Info", keyof typeof InfoMessages, ...any[]],
      SuccessContainer
    >(this, "Info", templateName, ...args);
  }
}

export class UnauthorizedContainer extends BaseExtraContainer {
  constructor() {
    super();
    this._title = "Unauthorized";
    this._accentColor = Colors.Error;
    this._description = "[Unauthorized Description]";

    this.setColor(this._accentColor).setTitle(this._title).setDescription(this._description);
  }

  /**
   * Uses the specified error template and arguments to set the title and description.
   * @param templateName - The name of the error template to use.
   * @param args - Additional arguments to be used in formatting the description.
   * @returns The modified instance of the unauthorized container.
   */
  useErrTemplate(templateName: keyof typeof ErrorMessages, ...args: any[]): UnauthorizedContainer {
    return ApplyContainerTemplate.call<
      UnauthorizedContainer,
      ["Error", keyof typeof ErrorMessages, ...any[]],
      UnauthorizedContainer
    >(this, "Error", templateName, ...args);
  }
}

/**
 * Applies a template to a Container instance based on the specified template type and name.
 * @template ToT - The type of template to use. Can be "Error", "Info", or "Any".
 * @param this - The Container instance to apply the template to.
 * @param TemplateOfType - The type of template to use. Determines which message group to use.
 * @param TemplateName - The name of the template to use. The available names depend on the template type.
 * @param args - Additional arguments to format the template description.
 * @returns The input Container instance with the applied template.
 */
function ApplyContainerTemplate<
  ToT extends "Error" | "Info" | "Any",
  This extends BaseExtraContainer = BaseExtraContainer,
>(
  this: This,
  TemplateOfType: ToT,
  TemplateName: ToT extends "Error"
    ? keyof typeof ErrorMessages
    : ToT extends "Info"
      ? keyof typeof InfoMessages
      : keyof typeof InfoMessages | keyof typeof ErrorMessages,
  ...args: any[]
): This {
  const TemplateCheckerRegex = /%[scdjifoO%]/;
  const MessageGroup =
    TemplateOfType === "Error"
      ? ErrorMessages
      : TemplateOfType === "Info"
        ? InfoMessages
        : { ...InfoMessages, ...ErrorMessages };

  const Thumbnail: string | null = Object.hasOwn((MessageGroup as any)[TemplateName], "Thumb")
    ? (MessageGroup as any)[TemplateName].Thumb || null
    : this._thumbnail || null;

  const AccentColor: ColorResolvable = Object.hasOwn((MessageGroup as any)[TemplateName], "Color")
    ? (MessageGroup as any)[TemplateName].Color
    : this._accentColor;

  if (TemplateOfType === "Error") {
    const ErrorMsg = ErrorMessages[TemplateName as keyof typeof ErrorMessages];
    if (ErrorMsg.Description.match(TemplateCheckerRegex)) {
      this.setTitle(ErrorMsg.Title).setDescription(FormatString(ErrorMsg.Description, ...args));
    } else {
      this.setTitle(ErrorMsg.Title).setDescription(ErrorMsg.Description);
    }
  } else if (TemplateOfType === "Info") {
    const InfoMsg = InfoMessages[TemplateName as keyof typeof InfoMessages];
    if (InfoMsg.Description.match(TemplateCheckerRegex)) {
      this.setTitle(InfoMsg.Title).setDescription(FormatString(InfoMsg.Description, ...args));
    } else {
      this.setTitle(InfoMsg.Title).setDescription(InfoMsg.Description);
    }
  } else if ((MessageGroup as any)[TemplateName].Description.match(TemplateCheckerRegex)) {
    this.setTitle((MessageGroup as any)[TemplateName].Title).setDescription(
      FormatString((MessageGroup as any)[TemplateName].Description, ...args)
    );
  } else {
    this.setTitle((MessageGroup as any)[TemplateName].Title).setDescription(
      (MessageGroup as any)[TemplateName].Description
    );
  }

  if (Thumbnail) {
    this.setThumbnail(Thumbnail);
  }

  return this.setColor(AccentColor);
}
