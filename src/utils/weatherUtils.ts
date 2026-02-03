/**
 * Enum representing broad categories of weather conditions.
 * Used for simplifying logic related to UI themes and backgrounds.
 */
export enum WeatherCategory {
    Sunny = 'sunny',
    Rainy = 'rainy',
    Snowy = 'snowy',
    Cloudy = 'cloudy',
    Mist = 'mist',
    Unknown = 'unknown'
}

const SUNNY_REGEX = /sunny|clear|晴/i;
const RAINY_REGEX = /rain|drizzle|thunder|雨|雷/i;
const SNOWY_REGEX = /snow|sleet|blizzard|雪|冰/i;
const CLOUDY_REGEX = /cloud|overcast|云|阴/i;
const MIST_REGEX = /mist|fog|haze|smoke|dust|sand|ash|squall|tornado|薄雾|雾|霾/i;

/**
 * Categorizes a weather condition string into a `WeatherCategory`.
 *
 * @param {string} condition - The raw weather condition string (e.g., "Light Rain").
 * @returns {WeatherCategory} The corresponding weather category.
 */
export function getWeatherCategory(condition: string): WeatherCategory {
    if (!condition) return WeatherCategory.Unknown;
    if (SUNNY_REGEX.test(condition)) return WeatherCategory.Sunny;
    if (RAINY_REGEX.test(condition)) return WeatherCategory.Rainy;
    if (SNOWY_REGEX.test(condition)) return WeatherCategory.Snowy;
    if (CLOUDY_REGEX.test(condition)) return WeatherCategory.Cloudy;
    if (MIST_REGEX.test(condition)) return WeatherCategory.Mist;
    return WeatherCategory.Unknown;
}

/**
 * Determines the CSS background class based on the weather condition.
 *
 * @param {string} condition - The raw weather condition string.
 * @returns {string} The CSS class name for the background.
 */
export function getWeatherBackground(condition: string): string {
    const category = getWeatherCategory(condition);
    switch (category) {
        case WeatherCategory.Sunny: return 'bg-sunny';
        case WeatherCategory.Rainy: return 'bg-rainy';
        case WeatherCategory.Snowy: return 'bg-snowy';
        case WeatherCategory.Cloudy: return 'bg-cloudy';
        case WeatherCategory.Mist: return 'bg-mist';
        default: return 'bg-default';
    }
}

/**
 * Returns the tailwind text color class corresponding to the Air Quality Index (AQI).
 *
 * @param {number} aqi - The AQI value (1-5).
 * @returns {string} The tailwind text color class.
 */
export function getAqiColor(aqi: number): string {
    const colors = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-purple-400', 'text-rose-900'];
    return colors[aqi - 1] || 'text-gray-400';
}
