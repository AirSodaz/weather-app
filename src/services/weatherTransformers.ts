import { HourlyForecast, DailyForecast, AirQuality, WeatherData } from './types';
import { formatTime, formatTimeString } from '../utils/helpers';

const DATE_SEPARATOR_REGEX = /-/g;

/**
 * Transforms OpenWeatherMap API response into WeatherData.
 */
export function transformOpenWeatherData(
    data: any,
    forecastData: any,
    aqDataRaw: any,
    use24h: boolean
): WeatherData {
    const hourlyForecast: HourlyForecast[] = [];
    const dailyForecast: DailyForecast[] = [];

    if (forecastData && forecastData.list) {
        // Process hourly forecast (next 24 hours, 8 x 3-hour intervals).
        const limit = 8;
        for (let i = 0; i < Math.min(forecastData.list.length, limit); i++) {
            const item = forecastData.list[i];
            hourlyForecast.push({
                time: formatTime(new Date(item.dt * 1000), use24h),
                temperature: Math.round(item.main.temp),
                condition: item.weather[0].description,
                icon: item.weather[0].icon
            });
        }

        // Process daily forecast (group by day).
        const dailyMap = new Map<string, { temps: number[], condition: string, icon: string }>();

        for (const item of forecastData.list) {
            const dateStr = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
            const date = dateStr.replace(DATE_SEPARATOR_REGEX, '/');

            if (!dailyMap.has(date)) {
                dailyMap.set(date, {
                    temps: [],
                    condition: item.weather[0].description,
                    icon: item.weather[0].icon
                });
            }
            dailyMap.get(date)!.temps.push(item.main.temp);
        }

        dailyMap.forEach((value, key) => {
            dailyForecast.push({
                date: key,
                tempMin: Math.round(Math.min(...value.temps)),
                tempMax: Math.round(Math.max(...value.temps)),
                condition: value.condition,
                icon: value.icon
            });
        });
    }

    let airQuality: AirQuality | undefined;
    if (aqDataRaw?.list?.length > 0) {
        const aqData = aqDataRaw.list[0];
        airQuality = {
            aqi: aqData.main.aqi,
            pm25: Math.round(aqData.components.pm2_5),
            pm10: Math.round(aqData.components.pm10),
            o3: Math.round(aqData.components.o3),
            no2: Math.round(aqData.components.no2)
        };
    }

    return {
        city: data.name,
        temperature: Math.round(data.main.temp),
        condition: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        feelsLike: Math.round(data.main.feels_like),
        pressure: data.main.pressure,
        visibility: data.visibility / 1000,
        uvIndex: 0,
        sunrise: formatTime(new Date(data.sys.sunrise * 1000), use24h),
        sunset: formatTime(new Date(data.sys.sunset * 1000), use24h),
        hourlyForecast,
        dailyForecast,
        airQuality,
        source: 'OpenWeatherMap',
        lat: data.coord.lat,
        lon: data.coord.lon
    };
}

/**
 * Transforms WeatherAPI response into WeatherData.
 */
export function transformWeatherAPIData(
    data: any,
    historyDataRaw: any,
    use24h: boolean
): WeatherData {
    const current = data.current;
    const forecast = data.forecast.forecastday;

    const hourlyForecast: HourlyForecast[] = [];
    const sourceHours = forecast[0].hour;
    const limit = 8;

    for (let i = 0; i < sourceHours.length; i += 3) {
        if (hourlyForecast.length >= limit) break;
        const item = sourceHours[i];
        hourlyForecast.push({
            time: formatTime(new Date(item.time), use24h),
            temperature: Math.round(item.temp_c),
            condition: item.condition.text,
            icon: item.condition.icon
        });
    }

    const dailyForecast: DailyForecast[] = forecast.map((item: any) => ({
        date: item.date, // YYYY-MM-DD
        tempMin: Math.round(item.day.mintemp_c),
        tempMax: Math.round(item.day.maxtemp_c),
        condition: item.day.condition.text,
        icon: item.day.condition.icon
    }));

    // Map US AQI to 1-5 scale roughly.
    const usEpaIndex = current.air_quality ? current.air_quality['us-epa-index'] : 1;

    // Process history data if available.
    if (historyDataRaw?.forecast?.forecastday?.length > 0) {
        const historyData = historyDataRaw.forecast.forecastday[0];
        dailyForecast.unshift({
            date: historyData.date, // YYYY-MM-DD
            tempMin: Math.round(historyData.day.mintemp_c),
            tempMax: Math.round(historyData.day.maxtemp_c),
            condition: historyData.day.condition.text,
            icon: historyData.day.condition.icon
        });
    }

    return {
        city: data.location.name,
        temperature: Math.round(current.temp_c),
        condition: current.condition.text,
        humidity: current.humidity,
        windSpeed: current.wind_kph / 3.6, // km/h to m/s
        feelsLike: Math.round(current.feelslike_c),
        pressure: current.pressure_mb,
        visibility: current.vis_km,
        uvIndex: current.uv,
        sunrise: formatTimeString(forecast[0].astro.sunrise, use24h),
        sunset: formatTimeString(forecast[0].astro.sunset, use24h),
        hourlyForecast,
        dailyForecast,
        airQuality: {
            aqi: usEpaIndex || 1,
            pm25: Math.round(current.air_quality?.pm2_5 || 0),
            pm10: Math.round(current.air_quality?.pm10 || 0),
            o3: Math.round(current.air_quality?.o3 || 0),
            no2: Math.round(current.air_quality?.no2 || 0)
        },
        source: 'WeatherAPI.com',
        lat: data.location.lat,
        lon: data.location.lon
    };
}

/**
 * Transforms QWeather response into WeatherData.
 */
export function transformQWeatherData(
    cityName: string,
    locationLat: number,
    locationLon: number,
    now: any,
    daily: any[],
    hourly: any[],
    air: any | null,
    sun: any | null,
    use24h: boolean
): WeatherData {
    const hourlyForecast: HourlyForecast[] = [];
    const limit = 8;

    for (let i = 0; i < hourly.length; i += 3) {
        if (hourlyForecast.length >= limit) break;
        const item = hourly[i];
        hourlyForecast.push({
            time: formatTime(new Date(item.fxTime), use24h),
            temperature: parseInt(item.temp),
            condition: item.text,
            icon: item.icon
        });
    }

    const dailyForecast: DailyForecast[] = daily.map((item: any) => ({
        date: item.fxDate, // YYYY-MM-DD
        tempMin: parseInt(item.tempMin),
        tempMax: parseInt(item.tempMax),
        condition: item.textDay,
        icon: item.iconDay
    }));

    const weatherData: WeatherData = {
        city: cityName,
        temperature: parseInt(now.temp),
        condition: now.text,
        humidity: parseInt(now.humidity),
        windSpeed: parseInt(now.windSpeed) / 3.6, // km/h to m/s
        feelsLike: parseInt(now.feelsLike),
        pressure: parseInt(now.pressure),
        visibility: parseInt(now.vis),
        uvIndex: 0,
        hourlyForecast,
        dailyForecast,
        source: 'QWeather',
        lat: locationLat,
        lon: locationLon
    };

    if (sun) {
        weatherData.sunrise = formatTime(new Date(sun.sunrise), use24h);
        weatherData.sunset = formatTime(new Date(sun.sunset), use24h);
    }

    if (air) {
        weatherData.airQuality = {
            aqi: parseInt(air.aqi),
            pm25: parseInt(air.pm2p5),
            pm10: parseInt(air.pm10),
            o3: parseInt(air.o3),
            no2: parseInt(air.no2)
        };
    }

    return weatherData;
}
