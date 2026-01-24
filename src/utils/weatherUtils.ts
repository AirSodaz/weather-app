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

export const getWeatherCategory = (condition: string): WeatherCategory => {
    if (!condition) return WeatherCategory.Unknown;
    if (SUNNY_REGEX.test(condition)) return WeatherCategory.Sunny;
    if (RAINY_REGEX.test(condition)) return WeatherCategory.Rainy;
    if (SNOWY_REGEX.test(condition)) return WeatherCategory.Snowy;
    if (CLOUDY_REGEX.test(condition)) return WeatherCategory.Cloudy;
    if (MIST_REGEX.test(condition)) return WeatherCategory.Mist;
    return WeatherCategory.Unknown;
};

export const getWeatherBackground = (condition: string): string => {
    const category = getWeatherCategory(condition);
    switch (category) {
        case WeatherCategory.Sunny: return 'bg-sunny';
        case WeatherCategory.Rainy: return 'bg-rainy';
        case WeatherCategory.Snowy: return 'bg-snowy';
        case WeatherCategory.Cloudy: return 'bg-cloudy';
        case WeatherCategory.Mist: return 'bg-mist';
        default: return 'bg-default';
    }
};
