import { type ColorResolvable, Colors as DiscordColors } from "discord.js";
import { env as Env } from "node:process";
import AppLogger from "@Utilities/Classes/AppLogger.js";

/**
 * Environment variable override for emoji configurations.
 *
 * @description
 * This allows customizing emoji IDs through an environment variable.
 * The APP_EMOJIS environment variable must be a JSON string that:
 * - Contains all the same keys as the default Emojis object
 * - Can use single quotes (which will be converted to double quotes)
 * - Is at least 1300 characters long to ensure it's kind of valid
 *   Emojis object when parsed with all the keys existing
 *
 * @example
 * ```py
 * # Example environment variable format:
 * APP_EMOJIS='{"Online":"<:CustomOnline:1234567890>","Offline":"<:CustomOffline:1234567890>",...}'
 * ```
 */
let EnvAppEmojis: typeof SharedData.Emojis | null = null;
try {
  EnvAppEmojis =
    Env.APP_EMOJIS && Env.APP_EMOJIS.length >= 1300
      ? (JSON.parse(Env.APP_EMOJIS.replace(/['"]+/g, '"')) as typeof SharedData.Emojis)
      : null;

  if (EnvAppEmojis !== null) {
    AppLogger.info({
      message: "Environment emojis loaded successfully.",
      label: "Config:Shared.ts",
      emojis: EnvAppEmojis,
    });
  }
} catch {
  EnvAppEmojis = null;
}

const SharedData = {
  Images: {
    LAPD_Logo: "https://i.ibb.co/HxqT7Xz/LAPD-Logo-2.png",
    LAPD_Header: "https://i.ibb.co/fXsLH03/LAPD-Header-500.jpg",

    // Credits goes to Sapphire bot for that divider :)
    FooterDivider: "https://i.ibb.co/6HWMHFS/Horizontal-Divider.png",
  },

  Colors: {
    Info: "#3498DB",
    Success: "#28a745",
    Warning: "#E67E22",
    Error: "#ED4245",
    RealGold: "#FFBC45",

    ShiftOn: "#1F9D4B",
    ShiftOff: "#DB2626",
    ShiftVoid: "#4E5052",
    ShiftBreak: "#FE8C2A",
    ShiftNatural: "#C2D1E6",

    // Cancelled color is only used in logging messages; leave requests uses LOARequestDenied when cancelled.
    LOARequestCancelled: "#C2D1E6",
    LOARequestEnded: "#CA2222",
    LOARequestDenied: "#CA2222",
    LOARequestPending: "#F2A265",
    LOARequestApproved: "#227F46",

    ...DiscordColors,
  },

  Thumbs: {
    Info: "https://i.ibb.co/Fztk9dQ/Info-Icon-48.png",
    Warning: "https://i.ibb.co/D9ffPMx/Warning-Icon-48.png",
    Error: "https://i.ibb.co/tqk15t2/Error-Icon-48.png",
    Success: "https://i.ibb.co/TmYLkf4/Checkmark-Icon-48.png",
    Unauthorized: "https://i.ibb.co/DYM3Wcq/Blocked-Icon-48.png",

    AvatarMale: "https://i.ibb.co/m0fyKh1/Male-Avatar-Placeholder.png",
    AvatarFemale: "https://i.ibb.co/Lr37RGx/Female-Avatar-Placeholder.png",

    RobloxAvatarMale: "https://i.ibb.co/LzrzMwr2/Roblox-Thumb-Male-Unknown.png",
    RobloxAvatarFemale: "https://i.ibb.co/pB1wLmhY/Roblox-Thumb-Female-Unknown.png",

    UnknownImage: "https://placehold.co/254x254/F7F8F9/202428/png?text=%3F",
    Transparent: "https://i.ibb.co/qFtywJK/Transparent.png",
  },

  // Attribution & Credits;
  // Some of these icons are from the following sources: Flaticon, Iconfinder, Iconscout, and Icons8
  // Some other icons have been modified or created from scratch.
  Emojis: {
    Online: "<:Online:1185771482656297010>",
    Offline: "<:Offline:1185771486460526714>",
    Idle: "<:Idle:1185771485185445918>",

    Notes: "<:Notes:1363577814594621492>",
    PoliceHat: "<:PoliceHat:1363577816033263728>",
    Eyewitness: "<:Eyewitness:1363577811360813146>",
    Fingerprint: "<:Fingerprint:1363577813063565604>",
    StatusChange: "<:Status:1363577818226626902>",

    FileEdit: "<:FileEdit:1185790827809738803>",
    FileDelete: "<:FileDelete:1185785834058813480>",
    Trash: "<:Trash:1185785496757088286>",
    LoadingGrey: "<a:DualRingGrey:1354207612706623741>",
    LoadingBlue: "<a:DualRingBlue:1294539916759400448>",
    LoadingGold: "<a:DualRingGold:1294539933754855425>",

    GearColored: "<:Gear:1368202985372516554>",
    MediaStop: "<:MediaStop:1220887197398470780>",
    WhitePlus: "<:WhitePlus:1270733376533434471>",
    WhiteCheck: "<:WhiteCheck:1272950397044133999>",
    WhiteCross: "<:Crossed:1271079415027073114>",
    WhiteBack: "<:TurnBack:1277740862821896272>",
    WhiteInfo: "<:WhiteInfo:1376235794586534029>",
    StopWatch: "<:Time:1185414712670826557>",
    LosAngeles: "<:LosAngeles:1185406541709463652>",
    HamburgerList: "<:Menu:1185793738212114484>",

    TimeClockIn: "<:ClockIn30:1361004247348412436>",
    TimeClockOut: "<:ClockOut30:1361004249026265160>",
    TimeClockPause: "<:ClockPause30:1361004251261833337>",

    ClockPlus: "<:ClockPlus:1212227997059518545>",
    ClockMinus: "<:ClockMinus:1212228013375234058>",
    ClockReset: "<:ClockReset:1212228189112369153>",
    ClockSet: "<:ClockSet:1212228029116456960>",

    NavNext: "<:ArrowForward:1185405403715084319>",
    NavPrev: "<:ArrowBackward:1185405400489672816>",
    NavFirst: "<:ArrowFirst:1185405401836040242>",
    NavLast: "<:ArrowLast:1185405405409595423>",
  },

  Icons: {
    Signature: "https://i.ibb.co/LrjhMS6/Sign-Icon-50.png",
    OpenWeather: "https://i.ibb.co/CPPbHPL/Open-Weather-48.png",

    Weather: {
      Animated: [
        "https://i.ibb.co/HtXrGDW/mist.gif",
        "https://i.ibb.co/sQBk6KH/hail.gif",
        "https://i.ibb.co/FqrYXms/sleet.gif",
        "https://i.ibb.co/2N7nhr9/cloudy.gif",
        "https://i.ibb.co/R7YvGB8/tornado.gif",
        "https://i.ibb.co/YckP8fD/fog-day.gif",
        "https://i.ibb.co/tz024r8/drizzle.gif",
        "https://i.ibb.co/tCBGwMx/overcast.gif",
        "https://i.ibb.co/Xy1pyCV/haze-day.gif",
        "https://i.ibb.co/q56MmbD/dust-day.gif",
        "https://i.ibb.co/xCB7PPC/fog-night.gif",
        "https://i.ibb.co/SBmZPwf/clear-day.gif",
        "https://i.ibb.co/5sPYP9s/haze-night.gif",
        "https://i.ibb.co/yNVStfp/dust-night.gif",
        "https://i.ibb.co/nR0cJFQ/clear-night.gif",
        "https://i.ibb.co/9bHGRgc/overcast-fog.gif",
        "https://i.ibb.co/f26y7Xm/overcast-day.gif",
        "https://i.ibb.co/ZLF3GR3/thunderstorms.gif",
        "https://i.ibb.co/3FWV3kM/overcast-snow.gif",
        "https://i.ibb.co/QPRvk2g/overcast-rain.gif",
        "https://i.ibb.co/9YdZs1C/overcast-haze.gif",
        "https://i.ibb.co/F68g3nZ/overcast-hail.gif",
        "https://i.ibb.co/yqy5XVV/overcast-smoke.gif",
        "https://i.ibb.co/bdfgrgH/overcast-sleet.gif",
        "https://i.ibb.co/ZMwVThv/overcast-night.gif",
        "https://i.ibb.co/LgyYc3f/overcast-drizzle.gif",
        "https://i.ibb.co/bgzCygW/overcast-day-fog.gif",
        "https://i.ibb.co/3dgYM5R/thunderstorms-day.gif",
        "https://i.ibb.co/TDfQX1G/partly-cloudy-day.gif",
        "https://i.ibb.co/DDK3KX4/overcast-day-snow.gif",
        "https://i.ibb.co/jWLDtJm/overcast-day-rain.gif",
        "https://i.ibb.co/XS78KDZ/overcast-day-haze.gif",
        "https://i.ibb.co/sHQP9wC/overcast-day-hail.gif",
        "https://i.ibb.co/FbzQBNd/thunderstorms-snow.gif",
        "https://i.ibb.co/ySVpH3b/thunderstorms-rain.gif",
        "https://i.ibb.co/8PPggdt/overcast-night-fog.gif",
        "https://i.ibb.co/bv8Cx3C/overcast-day-smoke.gif",
        "https://i.ibb.co/x2jf68G/overcast-day-sleet.gif",
        "https://i.ibb.co/RbKHdp9/thunderstorms-night.gif",
        "https://i.ibb.co/YLp9S2K/partly-cloudy-night.gif",
        "https://i.ibb.co/DKrHQ24/overcast-night-snow.gif",
        "https://i.ibb.co/dB6xXb9/overcast-night-rain.gif",
        "https://i.ibb.co/4KS1dQn/overcast-night-haze.gif",
        "https://i.ibb.co/0mzNnZr/overcast-night-hail.gif",
        "https://i.ibb.co/1dhyhgD/overcast-night-smoke.gif",
        "https://i.ibb.co/CMcYhYX/overcast-night-sleet.gif",
        "https://i.ibb.co/s3tw60L/overcast-day-drizzle.gif",
        "https://i.ibb.co/J3NR52d/partly-cloudy-day-fog.gif",
        "https://i.ibb.co/ZS4tHvb/thunderstorms-overcast.gif",
        "https://i.ibb.co/LxV7KcQ/thunderstorms-day-snow.gif",
        "https://i.ibb.co/Gx3HTQv/thunderstorms-day-rain.gif",
        "https://i.ibb.co/Brd8nZF/partly-cloudy-day-snow.gif",
        "https://i.ibb.co/CBPdDvN/partly-cloudy-day-rain.gif",
        "https://i.ibb.co/nc45MCy/partly-cloudy-day-haze.gif",
        "https://i.ibb.co/HT7Yjck/partly-cloudy-day-hail.gif",
        "https://i.ibb.co/jfTGkqd/overcast-night-drizzle.gif",
        "https://i.ibb.co/8Yk5FN5/partly-cloudy-night-fog.gif",
        "https://i.ibb.co/mCnZhK2/partly-cloudy-day-smoke.gif",
        "https://i.ibb.co/FJXMnDr/partly-cloudy-day-sleet.gif",
        "https://i.ibb.co/M2Sy1Tz/thunderstorms-night-snow.gif",
        "https://i.ibb.co/3mxrVnF/thunderstorms-night-rain.gif",
        "https://i.ibb.co/NSxGqfy/partly-cloudy-night-snow.gif",
        "https://i.ibb.co/6YGkrjP/partly-cloudy-night-rain.gif",
        "https://i.ibb.co/gzS5ZvC/partly-cloudy-night-haze.gif",
        "https://i.ibb.co/svFQf6c/partly-cloudy-night-hail.gif",
        "https://i.ibb.co/rMbNyg5/partly-cloudy-night-smoke.gif",
        "https://i.ibb.co/BztM0sK/partly-cloudy-night-sleet.gif",
        "https://i.ibb.co/51pLNRm/partly-cloudy-day-drizzle.gif",
        "https://i.ibb.co/ZM1HvLk/thunderstorms-day-overcast.gif",
        "https://i.ibb.co/yPXTtFN/thunderstorms-overcast-snow.gif",
        "https://i.ibb.co/jwBWHhM/thunderstorms-overcast-rain.gif",
        "https://i.ibb.co/4mYVPnk/partly-cloudy-night-drizzle.gif",
        "https://i.ibb.co/kyzwK5k/thunderstorms-night-overcast.gif",
        "https://i.ibb.co/6Z7DqBN/thunderstorms-day-overcast-snow.gif",
        "https://i.ibb.co/5WCW2zc/thunderstorms-day-overcast-rain.gif",
        "https://i.ibb.co/9nTsPYD/thunderstorms-night-overcast-snow.gif",
        "https://i.ibb.co/wLWG3cT/thunderstorms-night-overcast-rain.gif",
      ],
    },
  },
};

type ColorsType = Record<keyof typeof SharedData.Colors, ColorResolvable>;
interface SharedConfig extends Omit<typeof SharedData, "Colors"> {
  Colors: ColorsType;
}

/**
 * Apply environment emoji configuration if available.
 *
 * @description
 * This overrides the default emoji configuration with values from the environment.
 * The override mechanism exists because:
 * 1. Discord emoji IDs are server[mutual]-specific
 * 2. Different deployment environments may require different emoji sets
 * 3. It allows customization without code changes
 */
SharedData.Emojis = EnvAppEmojis ?? SharedData.Emojis;
export const Icons = SharedData.Icons;
export const Emojis = SharedData.Emojis;
export const Images = SharedData.Images;
export const Thumbs = SharedData.Thumbs;
export const Colors = SharedData.Colors as ColorsType;
export default SharedData as SharedConfig;
