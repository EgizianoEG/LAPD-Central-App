// Dependencies:
// -------------
import GetWeatherIcon from "@Utilities/Other/GetWeatherIcon.js";
import { Icons, Emojis } from "@Config/Shared.js";
import { GetCurrentWeather } from "@Utilities/Other/WeatherData.js";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  Colors,
} from "discord.js";

// ---------------------------------------------------------------------------------------
async function Callback(Interaction: SlashCommandInteraction<"raw">) {
  const Units: any = Interaction.options.getString("units") ?? "imperial";
  const IsPrivate: boolean = Interaction.options.getBoolean("private") ?? false;

  const WeatherData = await GetCurrentWeather({ Formatted: true, Units });
  const LocalDateTime = new Date().toLocaleString(["en-US"], {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  });

  const WeatherEmbed = new EmbedBuilder()
    .setURL(WeatherData.forecast_link)
    .setTitle(Emojis.LosAngeles + "\u{2000}" + "Weather")
    .setColor(Colors.Greyple)
    .setFooter({ text: "Powered by OpenWeather", iconURL: Icons.OpenWeather })
    .setDescription("Current weather in the city of Los Angeles, California\n")
    .setThumbnail(GetWeatherIcon(WeatherData.weather.id, WeatherData.is_day))
    .setTimestamp(Interaction.createdTimestamp)
    .setFields(
      {
        name: "Date and Time",
        value: LocalDateTime,
      },
      {
        name: "Condition",
        value: WeatherData.weather.main,
        inline: true,
      },
      {
        name: "Temperature",
        value: WeatherData.temp.current,
        inline: true,
      },
      {
        name: "Feels Like",
        value: WeatherData.temp.feels_like,
        inline: true,
      },
      {
        name: "Humidity",
        value: WeatherData.humidity,
        inline: true,
      },
      {
        name: "Wind Speed",
        value: WeatherData.wind.speed,
        inline: true,
      },
      {
        name: "Visibility",
        value: `~${WeatherData.visibility}`,
        inline: true,
      }
    );

  return Interaction.reply({
    embeds: [WeatherEmbed],
    flags: IsPrivate ? MessageFlags.Ephemeral : undefined,
  });
}

// ----------------s-----------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject: SlashCommandObject<any> = {
  callback: Callback,
  options: { cooldown: 5 },
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Check the current weather in the city of Los Angeles.")
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .addStringOption((Option) =>
      Option.setName("units").setDescription("Units of measurement.").addChoices(
        {
          name: "metric",
          value: "metric",
        },
        {
          name: "imperial",
          value: "imperial",
        }
      )
    )
    .addBooleanOption((Option) =>
      Option.setName("private").setDescription(
        "Whether to send the response as ephemeral only to you. Defaults to false."
      )
    ),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
