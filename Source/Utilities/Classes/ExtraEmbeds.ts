import {
  Message,
  EmbedData,
  MessageFlags,
  EmbedBuilder,
  ColorResolvable,
  BaseInteraction,
  ButtonInteraction,
  CommandInteraction,
  InteractionResponse,
  MessageFlagsResolvable,
  MessageComponentInteraction,
} from "discord.js";

import { ErrorMessages, InfoMessages } from "@Resources/AppMessages.js";
import { format as FormatString } from "node:util";
import { Colors, Thumbs } from "@Config/Shared.js";
import AppError from "./AppError.js";
const TemplateCheckerRegex = /%[scdjifoO%]/;

class BaseEmbed extends EmbedBuilder {
  private static readonly ComponentRemovalRegex =
    /success(?:ful(?:ly)?)?|error|cancel(?:lation|l?ed)/i;

  /**
   * Sets the description of this embed using node `util.format()`.
   * @requires {@link FormatString `node:util.format()`}
   * @param description - A tuple of data to format (by `util.format()`) and set as the description.
   */
  setDescription(...description: any[]): this {
    const Formatted = FormatString(...description);
    return super.setDescription(Formatted.match(/^(?:\s*|NaN|null|undefined)$/) ? null : Formatted);
  }

  /**
   * Replies to a given *repliable* interaction with the current properties set.
   * @param interaction - The interaction to reply to.
   * @param ephemeral - Either `true` or `false`; whether the reply should be ephemeral (private); defaults to `false`.
   * @param silent - Whether to catch any errors that might occur and ignore them. Defaults to `true`.
   */
  async replyToInteract(
    interaction: BaseInteraction & { replied: boolean; reply; followUp; editReply },
    ephemeral: boolean = false,
    silent: boolean = true,
    replyMethod?: "reply" | "editReply" | "update" | "followUp"
  ): Promise<InteractionResponse<boolean> | Message<boolean>> {
    let ReplyMethod = replyMethod ?? "reply";
    let RemoveComponents: boolean = false;
    const MsgFlags: MessageFlagsResolvable | undefined = ephemeral
      ? MessageFlags.Ephemeral
      : undefined;

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
      !interaction.message.flags.has(MessageFlags.IsComponentsV2)
    ) {
      ReplyMethod = "update";
    }

    // If the reply is about error messages, removing components of a message is necessary
    // (only if the reply method is 'edit' or 'editReply')
    if (
      this instanceof ErrorEmbed ||
      this.data.title?.match(BaseEmbed.ComponentRemovalRegex) ||
      this.data.description?.match(BaseEmbed.ComponentRemovalRegex) ||
      interaction.replied
    ) {
      RemoveComponents = true;
    }

    return interaction[ReplyMethod]({
      embeds: [this],
      flags: MsgFlags,
      content: RemoveComponents ? "" : undefined,
      components: RemoveComponents ? [] : undefined,
      files: RemoveComponents ? [] : undefined,
    })
      .catch(() => {
        if (ReplyMethod === "followUp") {
          return interaction.reply({
            flags: MsgFlags,
            embeds: [this],
          });
        } else if (
          ReplyMethod === "editReply" &&
          interaction instanceof MessageComponentInteraction &&
          !ephemeral
        ) {
          return interaction.update({
            embeds: [this],
            flags: MsgFlags,
          });
        } else {
          return interaction.followUp({
            flags: MsgFlags,
            embeds: [this],
          });
        }
      })
      .catch((err: unknown) => {
        if (silent) return null;
        else throw err;
      });
  }
}

export class InfoEmbed extends BaseEmbed {
  constructor(data?: EmbedData) {
    super(data);
    this.setColor(Colors.Info).setThumbnail(Thumbs.Info);
    if (!this.data.description) {
      this.setDescription("[Information]");
    }
    if (!this.data.title) {
      this.setTitle("Information");
    }
  }

  /**
   * Uses the specified informative template and arguments to set the title and description of it.
   * @param templateName - The name of the info template to use.
   * @param args - Additional arguments to be used in formatting the info description.
   * @returns The modified instance of the info embed.
   */
  useInfoTemplate(templateName: keyof typeof InfoMessages, ...args: any[]) {
    return ApplyTemplate.call(this, "Info", templateName, ...args);
  }
}

export class WarnEmbed extends BaseEmbed {
  constructor(data?: EmbedData) {
    super(data);
    this.setColor(Colors.Warning).setThumbnail(Thumbs.Warning);
    if (!this.data.description) {
      this.setDescription("[Warning]");
    }
    if (!this.data.title) {
      this.setTitle("Warning");
    }
  }
}

export class ErrorEmbed extends BaseEmbed {
  constructor(data?: EmbedData) {
    super(data);
    this.setColor(Colors.Error).setThumbnail(Thumbs.Error);
    if (!this.data.description) {
      this.setDescription("[Error Occurred]");
    }
    if (!this.data.title) {
      this.setTitle("Error");
    }
  }

  /**
   * Sets the footer of the error embed with the provided error Id.
   * @param ErrorId - The error Id to display in the footer.
   * @returns The modified instance of the error embed.
   */
  setErrorId(ErrorId: string): this {
    return this.setFooter({ text: `Error ID: ${ErrorId}` });
  }

  /**
   * Uses the specified error object for the embed's title and description.
   * @param {AppError | Error} Err - The error object to use.
   * @returns The modified instance of the error embed.
   */
  useErrClass(Err: AppError | Error) {
    if (Err instanceof AppError) {
      return this.setTitle(Err.title).setDescription(Err.message);
    } else {
      return this.setTitle("Error").setDescription(Err.message);
    }
  }

  /**
   * Uses the specified error template and arguments to set the title and description of the error.
   * @param templateName - The name of the error template to use.
   * @param args - Additional arguments to be used in formatting the error description.
   * @returns The modified instance of the error embed.
   */
  useErrTemplate(templateName: keyof typeof ErrorMessages, ...args: any[]): ErrorEmbed {
    return ApplyTemplate.call<
      ErrorEmbed,
      ["Error", keyof typeof ErrorMessages, ...any[]],
      ErrorEmbed
    >(this, "Error", templateName, ...args);
  }
}

export class SuccessEmbed extends BaseEmbed {
  constructor(data?: EmbedData) {
    super(data);
    this.setColor(Colors.Success).setThumbnail(Thumbs.Success);
    if (!this.data.description) {
      this.setDescription("[Succeeded]");
    }
    if (!this.data.title) {
      this.setTitle("Success");
    }
  }

  /**
   * Uses the specified error template and arguments to set the title and description of the error.
   * @param templateName - The name of the error template to use.
   * @param args - Additional arguments to be used in formatting the error description.
   * @returns The modified instance of the error embed.
   */
  useTemplate(templateName: keyof typeof InfoMessages, ...args: any[]): SuccessEmbed {
    return ApplyTemplate.call<
      SuccessEmbed,
      ["Info", keyof typeof InfoMessages, ...any[]],
      SuccessEmbed
    >(this, "Info", templateName, ...args);
  }
}

export class UnauthorizedEmbed extends BaseEmbed {
  constructor(data?: EmbedData) {
    super(data);
    this.setColor(Colors.Error).setThumbnail(Thumbs.Unauthorized);
    if (!this.data.description) {
      this.setDescription("[Unauthorized Action]");
    }
    if (!this.data.title) {
      this.setTitle("Unauthorized");
    }
  }

  /**
   * Uses the specified error template and arguments to set the title and description of the error.
   * @param templateName - The name of the error template to use.
   * @param args - Additional arguments to be used in formatting the error description.
   * @returns The modified instance of the error embed.
   */
  useErrTemplate(templateName: keyof typeof ErrorMessages, ...args: any[]): UnauthorizedEmbed {
    return ApplyTemplate.call<
      UnauthorizedEmbed,
      ["Error", keyof typeof ErrorMessages, ...any[]],
      UnauthorizedEmbed
    >(this, "Error", templateName, ...args);
  }
}

/**
 * Applies a template to an EmbedBuilder instance based on the specified template type and name.
 * @template TOT - The type of template to use. Can be "Error", "Info", or "Any".
 * @param this - The EmbedBuilder instance to apply the template to.
 * @param TemplateOfType - The type of template to use. Determines which message group to use.
 * @param TemplateName - The name of the template to use. The available names depend on the template type.
 * @param args - Additional arguments to format the template description.
 * @returns The input EmbedBuilder instance with the applied template.
 */
function ApplyTemplate<TOT extends "Error" | "Info" | "Any", This extends BaseEmbed = BaseEmbed>(
  this: This,
  TemplateOfType: TOT,
  TemplateName: TOT extends "Error"
    ? keyof typeof ErrorMessages
    : TOT extends "Info"
      ? keyof typeof InfoMessages
      : keyof typeof InfoMessages | keyof typeof ErrorMessages,
  ...args: any[]
): This {
  const MessageGroup =
    TemplateOfType === "Error"
      ? ErrorMessages
      : TemplateOfType === "Info"
        ? InfoMessages
        : { ...InfoMessages, ...ErrorMessages };

  const Thumbnail: string | null = Object.hasOwn((MessageGroup as any)[TemplateName], "Thumb")
    ? (MessageGroup as any)[TemplateName].Thumb || null
    : this.data.thumbnail?.url || null;

  const EmbedColor: ColorResolvable = Object.hasOwn((MessageGroup as any)[TemplateName], "Color")
    ? (MessageGroup as any)[TemplateName].Color
    : this.data.color;

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

  return this.setColor(EmbedColor).setThumbnail(Thumbnail);
}
