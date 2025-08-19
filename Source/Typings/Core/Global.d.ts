import type * as DiscordJSMask from "discord.js";
import type * as MongooseMask from "mongoose";
import type * as UtilityTypesMask from "utility-types";
import type { GeneralTypings } from "./Utilities/Generic.d.ts";
import type {
  ContextMenuCommandObject,
  SlashCommandWithOptions,
  SlashCommandInteraction,
  AnyCtxMenuCmdCallback,
  CommandObjectOptions,
  AnySlashCmdCallback,
  SlashCommandObject,
  DiscordClient,
} from "./Commands.d.ts";

declare global {
  export import DiscordJS = DiscordJSMask;
  export import Mongoose = MongooseMask;
  export import UtilityTypes = UtilityTypesMask;
  export type {
    ContextMenuCommandObject,
    SlashCommandWithOptions,
    SlashCommandInteraction,
    AnyCtxMenuCmdCallback,
    CommandObjectOptions,
    AnySlashCmdCallback,
    SlashCommandObject,
    DiscordClient,
  } from "./Commands.d.ts";

  /**
    * Defines a type that can be either undefined, null, or of type T.
    * @example
      // Expect: `string | undefined | null`
      type NullableString = Nullable<string>;
   */
  export type Nullable<T> = undefined | null | T;
  export type NonEmptyArray<T> = [T, ...T[]];
  export type UnPartial<T> = T extends Partial<infer R> ? R : T;
  export type RangedArray<T, Min extends number, Max extends number> = TupleMinMax<T, Min, Max>;

  export type PartialAllowNull<T> = {
    [P in keyof T]?: T[P] | null;
  };

  export type DeepPartialAllowNull<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartialAllowNull<T[P]> | null : T[P] | null;
  };

  /** Expands a type definition recursively. */
  export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
    ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
    : T extends object
      ? T extends infer O
        ? { [K in keyof O]: ExpandRecursively<O[K]> }
        : never
      : T;

  /** @see {@link https://stackoverflow.com/a/72522221} */
  export type TupleMinMax<
    T,
    Min extends number,
    Max extends number,
    A extends (T | undefined)[] = [],
    O extends boolean = false,
  > = O extends false
    ? Min extends A["length"]
      ? TupleMinMax<T, Min, Max, A, true>
      : TupleMinMax<T, Min, Max, [...A, T], false>
    : Max extends A["length"]
      ? A
      : TupleMinMax<T, Min, Max, [...A, T?], false>;
}
