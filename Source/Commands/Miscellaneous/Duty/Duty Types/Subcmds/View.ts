import { Guilds } from "#Typings/Utilities/Database.js";
import { Colors } from "#Config/Shared.js";
import {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  MessageFlags,
  resolveColor,
} from "discord.js";

import HandlePagePagination from "#Utilities/Discord/HandlePagePagination.js";
import GetShiftTypes from "#Utilities/Database/GetShiftTypes.js";
import Dedent from "dedent";
import Util from "node:util";

const ListFormatter = new Intl.ListFormat("en");
const DisplayedShiftTypesPerPage = 2;

// ---------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Formats an array of shift type data into a list of descriptive strings.
 * @param ShiftTypeData - An array of shift type objects containing details about each shift type.
 * @returns An array of formatted strings, each describing a shift type with its name, default status,
 *          access roles, and other relevant details.
 */
function FormatDescriptions(ShiftTypeData: Guilds.ShiftType[]): string[] {
  const Formatted: string[] = [];

  for (const ShiftType of ShiftTypeData) {
    const Template = Dedent(`
        **Name:** \`%s\`
        **Default Type:** %s
        **Access Roles** [%i]**:**
        > %s
    `);

    const ShiftTypeDesc = Util.format(
      Template,
      ShiftType.name,
      ShiftType.is_default ? "Yes" : "No",
      ShiftType.access_roles.length,
      ShiftType.access_roles.length
        ? ListFormatter.format(ShiftType.access_roles.map((RoleId) => `<@&${RoleId}>`))
        : "*Usable by all identified staff members*"
    );

    Formatted.push(ShiftTypeDesc);
  }

  return Formatted;
}

/**
 * Builds paginated containers for displaying duty shift types.
 * @param ShiftTypesData - An array of shift type objects to display.
 * @param ShiftTypesPerPage - The maximum number of shift types to display per page.
 * @returns An array of `ContainerBuilder` instances, each representing a page of shift types.
 */
function BuildSTVPages(
  ShiftTypesData: Guilds.ShiftType[],
  ShiftTypesPerPage: number
): ContainerBuilder[] {
  const SegmentedData: Guilds.ShiftType[][] = [];
  const Pages: ContainerBuilder[] = [];

  if (ShiftTypesData.length) {
    for (let Index = 0; Index < ShiftTypesData.length; Index += ShiftTypesPerPage) {
      const Data = ShiftTypesData.slice(Index, Index + ShiftTypesPerPage);
      SegmentedData.push(Data);
    }

    for (const Segment of SegmentedData) {
      const FormattedDescriptions = FormatDescriptions(Segment);
      const PageContainer = new ContainerBuilder()
        .setAccentColor(resolveColor(Colors.DarkBlue))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Created Duty Shift Types")
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider().setSpacing(2));

      FormattedDescriptions.forEach((Description, Index) => {
        PageContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(Description));
        if (Index !== FormattedDescriptions.length - 1) {
          PageContainer.addSeparatorComponents(new SeparatorBuilder().setDivider());
        }
      });

      Pages.push(PageContainer);
    }
  } else {
    Pages.push(
      new ContainerBuilder()
        .setAccentColor(resolveColor(Colors.Info))
        .addTextDisplayComponents(
          new TextDisplayBuilder({ content: "### Created Duty Shift Types" })
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider())
        .addTextDisplayComponents(
          new TextDisplayBuilder({
            content:
              "No custom duty shift types exist for this server. Currently, only the app's default shift type is available for use.",
          })
        )
    );
  }

  return Pages;
}

/**
 * Handles the command execution process for displaying all available duty shift types.
 * @param Interaction - The user command interaction.
 */
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  await Interaction.deferReply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });

  const GuildShiftTypes = await GetShiftTypes(Interaction.guildId);
  const Pages = BuildSTVPages(GuildShiftTypes, DisplayedShiftTypesPerPage);
  return HandlePagePagination({
    pages: Pages,
    ephemeral: true,
    interact: Interaction,
  });
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandSubcommandBuilder()
    .setName("view")
    .setDescription("Lists all present server-created duty types."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
