import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonStyle } from "discord.js";
import { RandomString } from "@Utilities/Strings/Random.js";
import { Emojis } from "@Config/Shared.js";

export type NavButtonsActionRow = ActionRowBuilder<
  ButtonBuilder & { data: { custom_id: string } }
> & {
  /**
   * Updates the disabled state of the navigation buttons
   * @param ButtonsToEnable
   * - A map where keys are the buttons to set its state ("first", "last", "next", and "prev")
   * and values are the disabled state (A boolean value).
   * @param CurrPageIndex - The current page index. `0` by default.
   * @param PageCount - The total page count. `1` by default.
   * @returns The updated ActionRow instance.
   */
  updateButtons(
    ButtonsToEnable: { [key: string]: boolean | undefined },
    CurrPageIndex?: number,
    PageCount?: number
  ): NavButtonsActionRow;
};

/**
 * Returns a DiscordJS ActionRow instance contains five predefined navigation buttons.
 * @param Interaction - The command interaction initiated the execution.
 * @param [TotalPages=1] - The total number of pages could be shown; defaults to `1`.
 * @param [AddUniqueIds=false] - Should the function add an additional unique identifier to the end of the buttons' custom ids?
 * @param [EnablePageSelect=false] - Should the function enable the page number button?
 * @returns A DiscordJS ActionRow instance that contains five predefined navigation buttons as the following:
 * - All disabled buttons;
 * - All primary buttons except the page number button;
 * - Button custom ids are in the format `nav-[first|prev|current|next|last]:[UserIdOfCommandInteraction]`;
 */
export default function GetPredefinedNavButtons(
  Interaction: BaseInteraction,
  TotalPages: number = 1,
  AddUniqueIds: boolean = false,
  EnablePageSelect: boolean = false
) {
  const ARInstance = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("first")
      .setEmoji(Emojis.NavFirst)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("prev")
      .setEmoji(Emojis.NavPrev)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("current")
      .setLabel("Page: 1/" + TotalPages)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!EnablePageSelect),
    new ButtonBuilder()
      .setCustomId("next")
      .setEmoji(Emojis.NavNext)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),
    new ButtonBuilder()
      .setCustomId("last")
      .setEmoji(Emojis.NavLast)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false)
  ) as NavButtonsActionRow;

  ARInstance.components.forEach((Button) => {
    if (AddUniqueIds) {
      Button.setCustomId(`nav-${Button.data.custom_id}:${Interaction.user.id}:${RandomString(4)}`);
    } else {
      Button.setCustomId(`nav-${Button.data.custom_id}:${Interaction.user.id}`);
    }
  });

  ARInstance.updateButtons = function UpdateNavigationButtons(
    ButtonsToEnable: { [key: string]: boolean | undefined },
    CurrPageIndex = 0,
    PageCount = 1
  ) {
    const ButtonMap = { first: 0, last: 4, next: 3, prev: 1 };
    this.components[2].setLabel(`Page: ${CurrPageIndex + 1}/${PageCount}`);
    for (const [Name, Enabled] of Object.entries(ButtonsToEnable)) {
      this.components[ButtonMap[Name]].setDisabled(!Enabled);
    }
    return this;
  };

  return ARInstance;
}
