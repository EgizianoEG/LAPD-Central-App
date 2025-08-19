import { ErrorMessages } from "@Resources/AppMessages.js";
import { format as FormatString } from "node:util";

export interface AppErrorOptions {
  /** Error code; defaults to `1`.
   *   - `0`: A fatal error,
   *   - `1`: Non-fatal error,
   *   - `2`: Warning matter error.
   */
  code?: 0 | 1 | 2;

  /** The title for the error. This is mainly used for errors showed in embeds; defaults to "Application Error". */
  title?: string;

  /** The error message and description; defaults to "Unknown Error". */
  message?: string;

  /**
   * Whether or not the error can be shown to the end user.
   * Defaults to:
   *  - `true` when using a name of a template for the Options parameter,
   *  - `false` when using an object with details about the error (this object).
   */
  showable?: boolean;

  /** Custom stack trace to set. */
  stack?: string;

  /** A predefined template to use for title and message properties. */
  template?: keyof typeof ErrorMessages;

  /** Additional arguments to use in formatting the error message. Different between templates. */
  template_args?: any[];
}

export default class AppError extends Error {
  readonly is_showable: boolean = false;
  readonly name: string = "AppError";
  readonly title: string = "Application Error";
  readonly message: string = "An unspecified error occurred.";
  readonly code: number = 1;

  /**
   * The extended error class that should be used around the application/bot codebase.
   * @param Options - Options for the error object. Can be a template name or an object with details about the error.
   */
  constructor(Options: AppErrorOptions | keyof typeof ErrorMessages) {
    if (typeof Options === "string") {
      Options = {
        template: Options,
        showable: true,
      };
    }

    super(Options.message);
    this.code = Options.code ?? this.code;
    this.title = Options.title ?? this.title;
    this.message = Options.message ?? this.message;
    this.is_showable = !!Options.showable;

    if (Options.template) {
      this.title = ErrorMessages[Options.template].Title;
      this.message = ErrorMessages[Options.template].Description;
      if (Options.template_args && this.message.match(/%[scdjifoO%]/)) {
        this.message = FormatString(this.message, ...Options.template_args);
      }
    }

    if (Options.stack) {
      this.stack = Options.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
