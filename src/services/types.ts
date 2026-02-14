
/**
 * Represents hourly weather forecast data.
 */
export interface HourlyForecast {
    time: string;
    temperature: number;
    condition: string;
    icon: string;
}

/**
 * Represents daily weather forecast data.
 */
export interface DailyForecast {
    /** Date string in ISO or YYYY/MM/DD format. */
    date: string;
    tempMin: number;
    tempMax: number;
    condition: string;
    icon: string;
}

/**
 * Represents air quality data.
 */
export interface AirQuality {
    /** AQI on a 1-5 scale (or similar index). */
    aqi: number;
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
}

/**
 * Represents comprehensive weather data for a specific location.
 */
export interface WeatherData {
    city: string;
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    feelsLike: number;
    pressure: number;
    visibility: number;
    uvIndex: number;
    sunrise?: string;
    sunset?: string;
    hourlyForecast: HourlyForecast[];
    dailyForecast: DailyForecast[];
    airQuality?: AirQuality;
    source?: string;
    sourceOverride?: string;
    lat: number;
    lon: number;
}

/**
 * Represents a result from a city search.
 */
export interface CityResult {
    name: string;
    region?: string;
    country?: string;
    lat: number;
    lon: number;
    id?: string; // For QWeather
}
