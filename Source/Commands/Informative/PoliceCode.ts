import {
  ApplicationIntegrationType,
  AutocompleteInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

import { TenCodes, ElevenCodes, LiteralCodes } from "@Resources/RadioCodes.js";
import { PoliceCodeToWords, TitleCase } from "@Utilities/Strings/Converters.js";
import { ErrorEmbed } from "@Utilities/Classes/ExtraEmbeds.js";
import { Colors } from "@Config/Shared.js";
import AutocompleteRadioCode from "@Utilities/Autocompletion/RadioCode.js";
const AllCodes = [...TenCodes, ...ElevenCodes, ...LiteralCodes];
// ---------------------------------------------------------------------------------------

async function Callback(Interaction: SlashCommandInteraction) {
  let IsPrivate = Interaction.options.getBoolean("private", false);
  const CodeTyped = Interaction.options.getString("code", true);
  const CodeFound = AllCodes.find(
    (CodeObj) => CodeObj.code.toLowerCase() === CodeTyped.match(/(.+) \(.+\)/)?.[1].toLowerCase()
  );

  if (!CodeFound) {
    return new ErrorEmbed().useErrTemplate("UnknownRadioCode").replyToInteract(Interaction, true);
  }

  IsPrivate = typeof IsPrivate === "boolean" ? IsPrivate : true;
  const Title = PoliceCodeToWords(CodeFound.code);
  const ResponseEmbed = new EmbedBuilder()
    .setDescription(CodeFound.description)
    .setColor(Colors.Info)
    .setTitle(Title);

  if (CodeFound.title) {
    ResponseEmbed.setTitle(`${Title} — ${TitleCase(CodeFound.title, true)}`);
  }

  if (CodeFound.usage_contexts?.length) {
    const UContexts = CodeFound.usage_contexts.map((u) => {
      if (typeof u === "string") {
        return `- ${u}`;
      } else {
        return `- ${u.title}\n ${u.description}`;
      }
    });

    ResponseEmbed.addFields({
      name: "Usage Contexts",
      value: UContexts.join("\n"),
      inline: false,
    });
  }

  if (CodeFound.notes?.length) {
    const Notes = CodeFound.notes.map((n) => {
      if (typeof n === "string") {
        return `- ${n}`;
      } else {
        return `- ${n.title}\n ${n.description}`;
      }
    });

    ResponseEmbed.addFields({
      name: "Notes",
      value: Notes.join("\n"),
      inline: false,
    });
  }

  if (CodeFound.usage_examples?.length) {
    const Examples = CodeFound.usage_examples.map((u) => {
      if (typeof u === "string") {
        return `- ${u}`;
      } else {
        return `- ${u.title}\n ${u.description}`;
      }
    });

    ResponseEmbed.addFields({
      name: "Examples Of Utilization",
      value: Examples.join("\n"),
      inline: false,
    });
  }

  if (CodeFound.references?.length) {
    ResponseEmbed.addFields({
      name: "References",
      value: CodeFound.references.map((n) => (n.match(/^\d+\.\s*/) ? n : `- ${n}`)).join("\n"),
      inline: false,
    });
  }

  return Interaction.reply({
    embeds: [ResponseEmbed],
    flags: IsPrivate === true ? MessageFlags.Ephemeral : undefined,
  });
}

async function Autocomplete(Interaction: AutocompleteInteraction) {
  const { name, value } = Interaction.options.getFocused(true);
  const Suggestions = name === "code" ? AutocompleteRadioCode(value.trim()) : [];
  return Interaction.respond(Suggestions);
}

// ---------------------------------------------------------------------------------------
// Command structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  callback: Callback,
  autocomplete: Autocomplete,
  data: new SlashCommandBuilder()
    .setName("police-code")
    .setDescription("Look up detailed information about a police radio code.")
    .addStringOption((Option) =>
      Option.setName("code")
        .setDescription("Enter the police radio code you want to look up.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption((Option) =>
      Option.setName("private")
        .setDescription("Show the response only to you. Defaults to true.")
        .setRequired(false)
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
