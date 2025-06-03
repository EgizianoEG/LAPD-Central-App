// Dependencies:
// -------------

import { OpenWeather as OpenWeatherConfig } from "@Config/Secrets.js";
import { WeatherDataTypings } from "@Typings/Utilities/Weather.js";
import Axios, { AxiosResponse } from "axios";
import Convert from "convert-units";

const WeatherGeoConfig = OpenWeatherConfig.WeatherGeoCoordinates;
const WeatherClient = Axios.create({
  baseURL: "https://api.openweathermap.org/data/2.5/weather",
  params: {
    lat: WeatherGeoConfig?.lat ?? 34.052235,
    lon: WeatherGeoConfig?.lon ?? -118.243683,
    appid: OpenWeatherConfig.API_Key,
  },
});

// ------------------------------------------------------------------------------------
// Functions:
// ----------
/**
 * Converts a given visibility in meters
 * @param RawVisibility Visibility distance in meters from the original request
 * @param DistanceUnit The targeted distance unit
 * @returns The converted visibility distance
 */
function ConvertVisibility(RawVisibility: number, DistanceUnit: Convert.Unit): number {
  return parseFloat(Convert(RawVisibility).from("m").to(DistanceUnit).toFixed(1));
}

/**
 * Retrieves the current weather data for a specified latitude and longitude or for the default city, Los Angeles via OpenWeather API.
 * @param Options Request and returned data options object
 * @returns A Promise that resolves to the current weather data retrieved from OpenWeather API
 */
export async function GetCurrentWeather(
  Options: WeatherDataTypings.CurrentWeatherOptions = { Units: "imperial" }
) {
  const RetrievedData = await WeatherClient.request({
    params: {
      units: Options.Units,
    },
  }).then((Res: AxiosResponse<WeatherDataTypings.RetrievedWeatherData>) => {
    for (const [Key, Value] of Object.entries(Res.data.main)) {
      Res.data.main[Key] = Math.round(Value).toString();
    }
    return Res.data as unknown as WeatherDataTypings.RetrievedWeatherData<string>;
  });

  const IsMetric = Options.Units === "metric";
  const Units = {
    Speed: IsMetric ? " km/h" : " mph",
    Degree: IsMetric ? " °C" : " °F",
    Distance: IsMetric ? " km" : " mi",
    Pressure: IsMetric ? " hPa" : " psi",
  };

  const Temperatures = {
    min: RetrievedData.main.temp_min,
    max: RetrievedData.main.temp_max,
    current: RetrievedData.main.temp,
    feels_like: RetrievedData.main.feels_like,
  };

  const WeatherData = {
    city_id: RetrievedData.id,
    city_name: RetrievedData.name,
    temp: Temperatures,
    weather: RetrievedData.weather[0],
    clouds: RetrievedData.clouds,
    humidity: RetrievedData.main.humidity,
    pressure: RetrievedData.main.pressure,
    wind: {
      speed: RetrievedData.wind.speed.toString(),
      deg: RetrievedData.wind.deg,
    },
    visibility: ConvertVisibility(
      RetrievedData.visibility,
      Units.Distance.trim() as Convert.Unit
    ).toString(),
    is_day: RetrievedData.weather[0].icon.includes("d"),
    forecast_link: `https://openweathermap.org/city/${RetrievedData.id}`,
  };

  if (Options.Formatted) {
    WeatherData.humidity += "%";
    WeatherData.visibility += Units.Distance;

    for (const Key in WeatherData.temp) {
      WeatherData.temp[Key] += Units.Degree;
    }

    if (Options.Units === "metric") {
      WeatherData.pressure += Units.Pressure;
      WeatherData.wind.speed =
        parseFloat(
          Convert(WeatherData.wind.speed as any)
            .from("m/s")
            .to(Units.Speed.trim() as Convert.Unit)
            .toFixed(1)
        ) + Units.Speed;
    } else {
      WeatherData.wind.speed += Units.Speed;
      WeatherData.pressure =
        parseFloat(
          Convert(WeatherData.pressure as any)
            .from("hPa")
            .to(Units.Pressure.trim() as Convert.Unit)
            .toFixed(1)
        ) + Units.Pressure;
    }
  }

  return WeatherData;
}
