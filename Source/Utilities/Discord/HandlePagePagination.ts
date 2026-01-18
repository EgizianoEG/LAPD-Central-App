import { RandomString } from "@Utilities/Strings/Random.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import {
  MessageComponentInteraction,
  InteractionReplyOptions,
  StringSelectMenuBuilder,
  RepliableInteraction,
  ButtonInteraction,
  ContainerBuilder,
  ActionRowBuilder,
  DiscordAPIError,
  ComponentType,
  EmbedBuilder,
  Message,
  Colors,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputStyle,
  TextInputBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MessageFlagsResolvable,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import AppLogger from "@Utilities/Classes/AppLogger.js";
import HandleCollectorFiltering from "./HandleCollectorFilter.js";
import GetPredefinedNavButtons, { type NavButtonsActionRow } from "./GetNavButtons.js";
import ShowModalAndAwaitSubmission from "./ShowModalAwaitSubmit.js";
import HandleActionCollectorExceptions from "./HandleCompCollectorExceptions.js";
import DisableMessageComponents from "./DisableMsgComps.js";

// ---------------------------------------------------------------------------------------
const FileLabel = "Utilities:Other:HandlePagePagination.ts";
const Clamp = (Value: number, Min: number, Max: number) => Math.min(Math.max(Value, Min), Max);
interface PagePaginationOptions {
  /**
   * The components/embeds to paginate between; i.e. the pages.
   * This should be an array of at least one embed or container component.
   */
  pages: (EmbedBuilder | ContainerBuilder)[];

  /**
   * The interaction that triggered the pagination.
   * Should be repliable either by `followUp`, `reply`, or `editReply`.
   */
  interact: RepliableInteraction;

  /**
   * Whether the pages should be ephemeral (only visible to the one initiated the pagination).
   * Defaults to `false`.
   */
  ephemeral?: boolean;

  /**
   * The context of which triggered the pagination handling (used for logging errors and such).
   * e.g. `Commands:Miscellaneous:___:___`.
   */
  context?: string;

  /**
   * The duration in milliseconds for which the pagination buttons should be active.
   * If not provided, all components including pagination buttons will be active for a maximum of 14.5 minutes.
   */
  pagination_timeout?: number;

  /**
   * The custom footer text to use for the components v2 paginator using components.
   * Leave empty to only add a separator component at the bottom in the case of components v2 pagination.
   */
  cv2_footer?: string;

  /**
   * A listener function for the components v2 interactive components other than pagination buttons.
   * Could be used to handle accessory or other components in provided containers.
   * @param Interaction - The interaction that triggered the listener.
   * @param Page - The current page index.
   * @param Pages - The array of pages (containers) being paginated between.
   * @returns {any} The return value of the listener function.
   */
  cv2_comp_listener?: (
    Interaction: MessageComponentInteraction,
    Page: number,
    Pages: (EmbedBuilder | ContainerBuilder)[]
  ) => any;
}

/**
 * Handles the pagination process for a given pages array.
 * @param {PagePaginationOptions} options - The options for the pagination handler.
 * @returns This function/handler does not return anything and it handles pagination on its own.
 * @throws {RangeError} If the `pages` array is empty.
 */
export default async function HandlePagePagination({
  pages: Pages,
  interact: Interact,
  ephemeral: Ephemeral = false,
  cv2_footer: CV2Footer,
  pagination_timeout: Timeout = 14.5 * 60 * 1000,
  cv2_comp_listener: CV2CompListener = undefined,
  context,
}: PagePaginationOptions): Promise<void> {
  if (Pages.length === 0) {
    throw new RangeError("The 'pages' array must contain at least one embed or container.");
  }

  const IsComponentsV2Pagination = Pages[0] instanceof ContainerBuilder;
  const NavigationButtons = GetPredefinedNavButtons(Interact, Pages.length, true, true);
  const NavigationButtonIds = new Set(
    NavigationButtons.components.map((Btn) => Btn.data.custom_id)
  );
  let MsgFlags: MessageFlagsResolvable | undefined = Ephemeral ? MessageFlags.Ephemeral : undefined;
  let CurrPageIndex = 0;

  if (IsComponentsV2Pagination) {
    MsgFlags = MsgFlags ? MsgFlags | MessageFlags.IsComponentsV2 : MessageFlags.IsComponentsV2;
    AttachComponentsV2Footer(Pages as ContainerBuilder[], CV2Footer);
    AttachComponentsV2NavButtons(Pages as ContainerBuilder[], NavigationButtons);
  }

  let PaginationReply: Message | null = await HandleInitialInteractReply(Interact, Pages, MsgFlags);
  if (Pages.length === 1 && !(IsComponentsV2Pagination && CV2CompListener)) return;

  const ComponentCollector = PaginationReply.createMessageComponentCollector({
    filter: (Btn) => HandleCollectorFiltering(Interact, Btn),
    componentType: ComponentType.Button,
    idle: 8 * 60 * 1000,
    time: Timeout,
  });

  ComponentCollector.on("collect", async (RecInteraction: MessageComponentInteraction) => {
    if (
      IsComponentsV2Pagination &&
      CV2CompListener &&
      !NavigationButtonIds.has(RecInteraction.customId)
    ) {
      return CV2CompListener(RecInteraction, CurrPageIndex, Pages);
    }

    if (!RecInteraction.isButton() || Pages.length === 1) {
      return;
    }

    let NewPageIndex: number = -1;
    if (RecInteraction.customId.includes("current")) {
      let SPIndex: number | null = null;
      if (Pages.length > 25) {
        SPIndex = await HandleModalPageSelection(Pages, CurrPageIndex, RecInteraction);
      } else {
        SPIndex = await HandleSelectMenuPageSelection(Pages, CurrPageIndex, RecInteraction);
      }

      if (SPIndex === null) return;
      NewPageIndex = SPIndex;
    }

    if (NewPageIndex === -1) {
      switch (RecInteraction.customId.split(":")[0]) {
        case "nav-next":
          NewPageIndex = Clamp(CurrPageIndex + 1, 0, Pages.length);
          break;
        case "nav-prev":
          NewPageIndex = Clamp(CurrPageIndex - 1, 0, Pages.length);
          break;
        case "nav-last":
          NewPageIndex = Pages.length - 1;
          break;
        case "nav-first":
        default:
          NewPageIndex = 0;
          break;
      }
    }

    if (NewPageIndex === CurrPageIndex) return;
    NavigationButtons.updateButtons(
      {
        first: NewPageIndex !== 0,
        last: NewPageIndex !== Pages.length - 1,
        prev: NewPageIndex !== 0,
        next: NewPageIndex !== Pages.length - 1,
      },
      NewPageIndex,
      Pages.length
    );

    if (IsComponentsV2Pagination) {
      AttachComponentsV2NavButtons(Pages as ContainerBuilder[], NavigationButtons);
    }

    try {
      const EditReplyOpts = IsComponentsV2Pagination
        ? {
            components: [Pages[NewPageIndex] as ContainerBuilder],
            allowedMentions: {},
          }
        : { embeds: [Pages[NewPageIndex] as EmbedBuilder], components: [NavigationButtons] };

      if (RecInteraction.deferred || RecInteraction.replied) {
        PaginationReply = await RecInteraction.editReply(EditReplyOpts).then((Msg) => {
          CurrPageIndex = NewPageIndex;
          return Msg;
        });
      } else {
        PaginationReply = await RecInteraction.update({
          ...EditReplyOpts,
          withResponse: true,
        }).then((Msg) => {
          CurrPageIndex = NewPageIndex;
          return Msg.resource?.message ?? null;
        });
      }
    } catch (Err: any) {
      if (Err instanceof DiscordAPIError && [50_001, 10_008].includes(Number(Err.code))) {
        return;
      }

      AppLogger.error({
        message: "An error occurred while handling page pagination;",
        label: FileLabel,
        stack: Err.stack,
        context,
      });
    }
  });

  ComponentCollector.on("end", async (Collected, EndReason: string) => {
    if (EndReason.match(/^\w+Delete/)) return;
    try {
      const LastInteract = Collected.last() ?? Interact;
      if (PaginationReply === null || Date.now() - Interact.createdTimestamp >= 14.9 * 60 * 1000) {
        return;
      }

      const EditOpts = {
        message: PaginationReply,
        components: DisableMessageComponents(
          PaginationReply.components.map((Comp) => Comp.toJSON())
        ),
      };

      await LastInteract.editReply(EditOpts).catch(async function HandleEditReplyError() {
        if (!PaginationReply?.editable || PaginationReply.flags.has(MessageFlags.Ephemeral)) return;
        return PaginationReply.edit(EditOpts);
      });
    } catch (Err: any) {
      AppLogger.error({
        message: "An error occurred while terminating pagination;",
        label: FileLabel,
        stack: Err.stack,
        context,
      });
    }
  });
}

// ---------------------------------------------------------------------------------------
// Utility:
// --------
async function HandleSelectMenuPageSelection(
  Pages: (EmbedBuilder | ContainerBuilder)[],
  CurrentIndex: number,
  BtnInteract: ButtonInteraction
): Promise<number | null> {
  await BtnInteract.deferUpdate().catch(() => null);
  const PageSelectMenu = GetPageSelectMenu(BtnInteract, Pages.length, CurrentIndex);
  const PromptContainer = new ContainerBuilder()
    .setAccentColor(Colors.Greyple)
    .addTextDisplayComponents(
      new TextDisplayBuilder({
        content: "### Page Selection",
      })
    )
    .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: 1 }))
    .addTextDisplayComponents(
      new TextDisplayBuilder({
        content: "Please select a page to view from the dropdown menu below.",
      })
    )
    .addActionRowComponents(PageSelectMenu);

  const PromptMsg = await BtnInteract.followUp({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [PromptContainer],
    withResponse: true,
  });

  const MenuSelection = await PromptMsg.awaitMessageComponent({
    time: 8 * 60 * 1000,
    componentType: ComponentType.StringSelect,
    filter: (IC) =>
      IC.user.id === BtnInteract.user.id &&
      IC.customId === PageSelectMenu.components[0].data.custom_id,
  }).catch((Err) => HandleActionCollectorExceptions(Err, BtnInteract));

  if (!MenuSelection) return null;
  MenuSelection.deferUpdate()
    .then(() => MenuSelection.deleteReply())
    .catch(() => null);

  return Number.parseInt(MenuSelection.values[0], 10);
}

async function HandleModalPageSelection(
  Pages: (EmbedBuilder | ContainerBuilder)[],
  CurrentIndex: number,
  BtnInteract: ButtonInteraction
): Promise<number | null> {
  const PageSelectModal = GetPageSelectModal(BtnInteract, Pages.length, CurrentIndex);
  const ModalSubmission = await ShowModalAndAwaitSubmission(
    BtnInteract,
    PageSelectModal,
    5 * 60 * 1000
  );

  if (!ModalSubmission) return null;
  const InputPageNum = ModalSubmission.fields.getTextInputValue("page-num");
  const ParsedNumber = Number.parseInt(InputPageNum, 10);

  if (Number.isNaN(ParsedNumber) || !InputPageNum.match(/^\d+$/) || ParsedNumber < 1) {
    await new ErrorEmbed()
      .useErrTemplate("InvalidPageNumber")
      .replyToInteract(ModalSubmission, true);
    return null;
  }

  if (ParsedNumber > Pages.length) {
    await new ErrorEmbed().useErrTemplate("PageNotFoundWN").replyToInteract(ModalSubmission, true);
    return null;
  }

  ModalSubmission.deferUpdate();
  return ParsedNumber - 1;
}

async function HandleInitialInteractReply(
  Interact: RepliableInteraction,
  Pages: (EmbedBuilder | ContainerBuilder)[],
  Flags?: InteractionReplyOptions["flags"]
): Promise<Message> {
  let ReplyMethod: "reply" | "followUp" | "editReply";
  const NavigationButtons = GetPredefinedNavButtons(Interact, Pages.length, true, true);
  const ResponseOpts: InteractionReplyOptions =
    Pages[0] instanceof ContainerBuilder ? { components: [Pages[0]] } : { embeds: [Pages[0]] };

  if (Pages.length > 1 && ResponseOpts.embeds) {
    ResponseOpts.components = [NavigationButtons];
  }

  if (Interact.deferred) {
    ReplyMethod = "editReply";
  } else if (Interact.replied) {
    ReplyMethod = "followUp";
  } else {
    ReplyMethod = "reply";
  }

  if (ReplyMethod === "reply") {
    return Interact.reply({
      ...ResponseOpts,
      withResponse: true,
      allowedMentions: {},
      flags: Flags,
    }).then((Resp) => Resp.resource!.message!);
  } else if (ReplyMethod === "followUp") {
    return Interact.followUp({
      ...ResponseOpts,
      allowedMentions: {},
      flags: Flags,
    });
  } else {
    return Interact.editReply({
      ...ResponseOpts,
      flags: Flags ? (Flags as number) & ~MessageFlags.Ephemeral : undefined,
      allowedMentions: {},
    });
  }
}

function GetPageSelectMenu(
  BtnInteract: ButtonInteraction,
  TotalPages: number,
  CurrPageIndex: number
) {
  const SelectMenuActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`paginate-page-select:${BtnInteract.user.id}:${RandomString(3)}`)
      .setPlaceholder("Select a page...")
      .setMinValues(1)
      .setMaxValues(1)
  );

  for (let i = 0; i < TotalPages && i < 25; i++) {
    SelectMenuActionRow.components[0].addOptions(
      new StringSelectMenuOptionBuilder()
        .setDefault(i === CurrPageIndex)
        .setLabel(`Page ${i + 1}`)
        .setValue(`${i}`)
    );
  }

  return SelectMenuActionRow;
}

function GetPageSelectModal(
  BtnInteract: ButtonInteraction,
  TotalPages: number,
  CurrPageIndex: number
) {
  return new ModalBuilder()
    .setTitle("Page Selection")
    .setCustomId(`paginate-page-select:${BtnInteract.user.id}:${RandomString(3)}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Page Number")
        .setDescription(`Enter a page number between 1 and ${TotalPages}.`)
        .setTextInputComponent(
          new TextInputBuilder()
            .setPlaceholder("Page number here...")
            .setCustomId("page-num")
            .setStyle(TextInputStyle.Short)
            .setValue(`${CurrPageIndex + 1}`)
            .setMinLength(1)
            .setMaxLength(TotalPages.toString().length)
            .setRequired(true)
        )
    );
}

function AttachComponentsV2NavButtons(
  Pages: ContainerBuilder[],
  NavButtonsAR: NavButtonsActionRow
): void {
  const PagesLength = Pages.length;
  for (const Page of Pages) {
    if (PagesLength > 1) {
      if (Page.components.at(-1)?.data.type === ComponentType.ActionRow) {
        Page.spliceComponents(-1, 1);
      }

      Page.addActionRowComponents(NavButtonsAR);
    }
  }
}

function AttachComponentsV2Footer(Pages: ContainerBuilder[], FooterText?: string): void {
  for (const Page of Pages) {
    if (Pages.length > 1) Page.addSeparatorComponents(new SeparatorBuilder({ divider: true }));
    if (FooterText)
      Page.addTextDisplayComponents(new TextDisplayBuilder({ content: `-# ${FooterText}` }));
  }
}
