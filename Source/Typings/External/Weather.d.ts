export namespace WeatherDataTypings {
  /**
   * Represents the options for retrieving current weather data.
   */
  export interface CurrentWeatherOptions {
    Units?: "metric" | "imperial";
    Latitude?: number;
    Longitude?: number;
    Formatted?: boolean;
  }

  /**
   * Represents fetched weather data from OpenWeather API.
   */
  export interface CurrentWeatherData {
    /** The name of the city with the given latitude and longitude */
    city_name: string;

    /** The id number of the city retrieved from OpenWeather */
    city_id: number;

    /** The object containing all temperature data */
    temp: TemperatureData;
    visibility: string;
    humidity: string;
    pressure: string;
    wind: WindData;
    clouds: CloudData;
    weather: Weather;

    /** Boolean indication whether the current local time of the requested latitude and longitude is day or not */
    is_day: boolean;

    /** The OpenWeather forecast link for the requested city/long-lat */
    forecast_link: string;
  }

  /**
   * Represents weather data retrieved from OpenWeather API.
   */
  export interface RetrievedWeatherData<MVTypes extends number | string = number> {
    /** The coordinates of the location. */
    coord: Coordinates;

    /** An array of weather details. */
    weather: Weather[];

    /** The data source. */
    base: string;

    /** The main weather data. */
    main: MainData<MVTypes>;

    /** The visibility in meters. */
    visibility: number;

    /** The wind data. */
    wind: WindData;

    /** The cloud data. */
    clouds: CloudData;

    /** The timestamp of the retrieved data. */
    dt: number;

    /** System-related data. */
    sys: SystemData;

    /** The timezone offset in seconds. */
    timezone: number;

    /** The city ID. */
    id: number;

    /** The city name. */
    name: string;

    /** The response code. */
    cod: number;
  }

  /**
   * Represents temperature data.
   */
  export interface TemperatureData {
    min: string;
    max: string;
    current: string;
    feels_like: string;
  }

  /**
   * Represents wind data.
   */
  export interface WindData {
    speed: number | string;
    deg: number;
  }

  /**
   * Represents cloud data.
   */
  export interface CloudData {
    all: number;
  }

  /**
   * Represents weather details.
   */
  export interface Weather {
    /** The weather condition ID. */
    id: number;

    /** The main weather category. */
    main: string;

    /** The description of the weather condition. */
    description: string;

    /** The weather icon ID. */
    icon: string;
  }

  /**
   * Represents main weather data.
   */
  export interface MainData<VType extends number | string = number> {
    temp: VType;
    feels_like: VType;
    temp_min: VType;
    temp_max: VType;
    pressure: VType;
    humidity: VType;
  }

  /**
   * Represents geographical coordinates.
   */
  export interface Coordinates {
    lon: number;
    lat: number;
  }

  /**
   * Represents system-related data.
   */
  export interface SystemData {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  }
}
