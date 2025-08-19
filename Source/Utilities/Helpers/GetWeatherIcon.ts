/* eslint-disable sonarjs/no-duplicate-string */
// Credits for icons goes to Meteocons, Bas Milius, https://github.com/basmilius/weather-icons
import { Icons } from "@Config/Shared.js";

const IconMap = {
  200: {
    day: "thunderstorms-day-rain",
    night: "thunderstorms-night-rain",
  },
  201: {
    day: "thunderstorms-day-rain",
    night: "thunderstorms-night-rain",
  },
  202: {
    day: "thunderstorms-day-overcast-rain",
    night: "thunderstorms-night-overcast-rain",
  },
  210: {
    day: "thunderstorms-day",
    night: "thunderstorms-night",
  },
  211: {
    day: "thunderstorms",
    night: "thunderstorms",
  },
  212: {
    day: "thunderstorms-overcast",
    night: "thunderstorms-overcast",
  },
  221: {
    day: "thunderstorms-overcast",
    night: "thunderstorms-overcast",
  },
  230: {
    day: "thunderstorms-day-rain",
    night: "thunderstorms-night-rain",
  },
  231: {
    day: "thunderstorms-day-rain",
    night: "thunderstorms-night-rain",
  },
  232: {
    day: "thunderstorms-day-rain",
    night: "thunderstorms-night-rain",
  },
  300: {
    day: "partly-cloudy-day-drizzle",
    night: "partly-cloudy-night-drizzle",
  },
  301: {
    day: "partly-cloudy-day-drizzle",
    night: "partly-cloudy-night-drizzle",
  },
  302: {
    day: "overcast-day-drizzle",
    night: "overcast-night-drizzle",
  },
  310: {
    day: "overcast-day-drizzle",
    night: "overcast-night-drizzle",
  },
  311: {
    day: "drizzle",
    night: "drizzle",
  },
  312: {
    day: "overcast-drizzle",
    night: "overcast-drizzle",
  },
  313: {
    day: "overcast-drizzle",
    night: "overcast-drizzle",
  },
  314: {
    day: "overcast-rain",
    night: "overcast-rain",
  },
  321: {
    day: "overcast-rain",
    night: "overcast-rain",
  },
  500: {
    day: "partly-cloudy-day-rain",
    night: "partly-cloudy-night-rain",
  },
  501: {
    day: "partly-cloudy-day-rain",
    night: "partly-cloudy-night-rain",
  },
  502: {
    day: "overcast-day-rain",
    night: "overcast-night-rain",
  },
  503: {
    day: "overcast-day-rain",
    night: "overcast-night-rain",
  },
  504: {
    day: "overcast-rain",
    night: "overcast-rain",
  },
  511: {
    day: "sleet",
    night: "sleet",
  },
  520: {
    day: "partly-cloudy-day-rain",
    night: "partly-cloudy-night-rain",
  },
  521: {
    day: "partly-cloudy-day-rain",
    night: "partly-cloudy-night-rain",
  },
  522: {
    day: "overcast-day-rain",
    night: "overcast-night-rain",
  },
  531: {
    day: "overcast-day-rain",
    night: "overcast-night-rain",
  },
  600: {
    day: "partly-cloudy-day-snow",
    night: "partly-cloudy-night-snow",
  },
  601: {
    day: "partly-cloudy-day-snow",
    night: "partly-cloudy-night-snow",
  },
  602: {
    day: "overcast-day-snow",
    night: "overcast-night-snow",
  },
  611: {
    day: "partly-cloudy-day-sleet",
    night: "partly-cloudy-night-sleet",
  },
  612: {
    day: "partly-cloudy-day-sleet",
    night: "partly-cloudy-night-sleet",
  },
  613: {
    day: "overcast-day-sleet",
    night: "overcast-night-sleet",
  },
  615: {
    day: "partly-cloudy-day-sleet",
    night: "partly-cloudy-night-sleet",
  },
  616: {
    day: "partly-cloudy-day-sleet",
    night: "partly-cloudy-night-sleet",
  },
  620: {
    day: "partly-cloudy-day-snow",
    night: "partly-cloudy-night-snow",
  },
  621: {
    day: "partly-cloudy-day-snow",
    night: "partly-cloudy-night-snow",
  },
  622: {
    day: "overcast-snow",
    night: "overcast-snow",
  },
  701: {
    day: "mist",
    night: "mist",
  },
  711: {
    day: "partly-cloudy-day-smoke",
    night: "partly-cloudy-night-smoke",
  },
  721: {
    day: "haze-day",
    night: "haze-night",
  },
  731: {
    day: "dust-day",
    night: "dust-night",
  },
  741: {
    day: "fog-day",
    night: "fog-night",
  },
  751: {
    day: "dust-day",
    night: "dust-night",
  },
  761: {
    day: "dust-day",
    night: "dust-night",
  },
  762: {
    day: "overcast-smoke",
    night: "overcast-smoke",
  },
  771: {
    day: "wind",
    night: "wind",
  },
  781: {
    day: "tornado",
    night: "tornado",
  },
  800: {
    day: "clear-day",
    night: "clear-night",
  },
  801: {
    day: "partly-cloudy-day",
    night: "partly-cloudy-night",
  },
  802: {
    day: "partly-cloudy-day",
    night: "partly-cloudy-night",
  },
  803: {
    day: "overcast-day",
    night: "overcast-night",
  },
  804: {
    day: "overcast-day",
    night: "overcast-night",
  },
};

/**
 * Returns the corresponding animated weather icon of the given weather code
 * @param ConditionCode - The condition code to return its corresponding animated weather icon
 * @param IsDaytime - Whether the current time is daytime
 * @return Animated weather icon link if the corresponding condition found; otherwise, N/A static icon link
 */
export default function GetWeatherIcon(ConditionCode: string | number, IsDaytime: boolean): string {
  const ConditionCodeDesc = IsDaytime ? IconMap[ConditionCode].day : IconMap[ConditionCode].night;
  return (
    Icons.Weather.Animated.find((IconLink) => {
      return new RegExp(`/${ConditionCodeDesc}.gif`).exec(IconLink);
    }) ?? "https://i.ibb.co/HrCdjmK/not-available.png"
  );
}
