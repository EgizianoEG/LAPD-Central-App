import type { CollectedInteraction, SlashCommandBuilder, Collection, Snowflake } from "discord.js";
import type { TupleMinMax } from "./Global.js";

export declare module "utility-types" {
  export { NonEmptyArray, RangedArray, UnPartial, TupleMinMax };

  /** Converts properties to strings in an object excluding any specified properties. */
  export type PropertiesToString<T, Exclude extends keyof T> = {
    [K in keyof T]: K extends Exclude ? T[K] : string;
  };
}

export declare module "discord.js" {
  export interface InteractionCollector<Interaction extends CollectedInteraction>
    extends Collector<Snowflake, Interaction, [Collection<Snowflake, Interaction>]> {
    on(
      event: "end",
      listener: (collected: Collection<Snowflake, Interaction>, reason: string) => Awaitable<any>
    ): this;

    on(
      event: "collect" | "dispose" | "ignore",
      listener: (interaction: Interaction) => Awaitable<any>
    ): this;

    on(event: string, listener: (...args: any[]) => Awaitable<any>): this;
  }

  export interface Client {
    commands: Collection<string, SlashCommandObject<SlashCommandBuilder>>;
    ctx_commands: Collection<string, ContextMenuCommandObject>;
    modalListeners: Collection<string, (ModalSubmission: ModalSubmitInteraction) => any>;

    /**
     * A collection of button listeners for a specific button custom id;
     * the value could be either a function or a boolean which indicates
     * if the button is actually being listened for.
     */
    buttonListeners: Collection<string, ((ButtonInteract: ButtonInteraction) => any) | boolean>;
  }
}

declare global {}
