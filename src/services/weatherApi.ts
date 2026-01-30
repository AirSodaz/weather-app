import axios from 'axios';
import { getSettings } from '../utils/config';
import { storage } from '../utils/storage';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';
const DATE_SEPARATOR_REGEX = /-/g;

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Retrieves a cached Intl.DateTimeFormat instance for the specified locale.
 *
 * @param {string} locale - The locale string (e.g., 'en-US').
 * @returns {Intl.DateTimeFormat} The formatter instance.
 */
const getTimeFormatter = (locale: string): Intl.DateTimeFormat => {
    if (!timeFormatters.has(locale)) {
        timeFormatters.set(locale, new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }));
    }
    return timeFormatters.get(locale)!;
};

interface CacheEntry {
    data: WeatherData;
    timestamp: number;
    lang: string;
    source: string;
}

interface WeatherCacheStore {
    [key: string]: CacheEntry;
}

let memoryCache: WeatherCacheStore | null = null;
let cacheLoadPromise: Promise<WeatherCacheStore> | null = null;
const CACHE_KEY = 'weather_cache_v1';

/**
 * Loads the weather cache from storage or memory.
 *
 * @returns {Promise<WeatherCacheStore>} A promise that resolves to the cache store.
 */
const getCache = async (): Promise<WeatherCacheStore> => {
    if (memoryCache) return memoryCache;
    if (cacheLoadPromise) return cacheLoadPromise;

    cacheLoadPromise = storage.get(CACHE_KEY).then(c => {
        memoryCache = c || {};
        return memoryCache!;
    }).catch(e => {
        console.error('Failed to load weather cache:', e);
        memoryCache = {};
        return memoryCache;
    });
    return cacheLoadPromise;
};

/**
 * Generates a unique cache key for a weather request.
 *
 * @param {string} city - The name of the city.
 * @param {string} source - The weather data source.
 * @param {string} lang - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @returns {string} The generated cache key.
 */
const getCacheKey = (city: string, source: string, lang: string, coords?: { lat: number, lon: number }): string => {
    if (coords) {
        return `${source}:${lang}:lat_${coords.lat.toFixed(2)}_lon_${coords.lon.toFixed(2)}`;
    }
    return `${source}:${lang}:${city.toLowerCase()}`;
};

/**
 * Constructs the API URLs for QWeather, respecting custom host configurations.
 *
 * @param {string} [customHost] - An optional custom host URL.
 * @returns {{ base: string, geo: string }} An object containing the base and geo API URLs.
 */
const getQWeatherUrls = (customHost?: string): { base: string, geo: string } => {
    // Priority: Custom Host (param) > Env Var > Default.
    let host = customHost || import.meta.env.VITE_QWEATHER_API_HOST;
    if (host) {
        // Remove protocol if present (http:// or https://).
        host = host.replace(/^https?:\/\//, '');
        // Remove trailing slash if present.
        host = host.replace(/\/$/, '');

        return {
            base: `https://${host}/v7`,
            geo: `https://${host}/geo/v2`
        };
    }
    return {
        base: 'https://devapi.qweather.com/v7',
        geo: 'https://geoapi.qweather.com/v2'
    };
};

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
 * Fetches weather data from OpenWeatherMap.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
const fetchOpenWeatherMap = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh', coords?: { lat: number, lon: number }): Promise<WeatherData> => {
    console.log('Using OpenWeatherMap API', lang, coords ? `with coords: ${coords.lat},${coords.lon}` : '');
    const apiLang = lang === 'zh' ? 'zh_cn' : 'en';
    const locale = 'en-US'; // Use fixed locale for standard date parsing.

    const params: any = {
        appid: apiKey,
        units: 'metric',
        lang: apiLang
    };

    if (coords) {
        params.lat = coords.lat;
        params.lon = coords.lon;
    } else {
        params.q = city;
    }

    try {
        // Start concurrent requests where possible.

        // 1. Current Weather (Mandatory).
        const weatherPromise = axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
            params: params
        });

        // 2. Forecast (Optional).
        const forecastPromise = axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
            params: params
        }).then(res => res.data).catch(e => {
            console.error('Failed to fetch forecast:', e);
            return null;
        });

        // 3. Air Quality (Optional, requires coords).
        // If coords are already known, start this request immediately.
        let aqPromise: Promise<any> | null = null;
        if (coords) {
            aqPromise = axios.get(`${OPENWEATHER_BASE_URL}/air_pollution`, {
                params: {
                    lat: coords.lat,
                    lon: coords.lon,
                    appid: apiKey
                }
            }).then(res => res.data).catch(e => {
                console.error('Failed to fetch air quality:', e);
                return null;
            });
        }

        // Await mandatory weather data.
        const weatherResponse = await weatherPromise;
        const data = weatherResponse.data;

        // If we didn't start AQ request yet (because we didn't have coords), start it now using data from weather response.
        if (!aqPromise) {
            aqPromise = axios.get(`${OPENWEATHER_BASE_URL}/air_pollution`, {
                params: {
                    lat: data.coord.lat,
                    lon: data.coord.lon,
                    appid: apiKey
                }
            }).then(res => res.data).catch(e => {
                console.error('Failed to fetch air quality:', e);
                return null;
            });
        }

        // Await optional data.
        const [forecastData, aqDataRaw] = await Promise.all([forecastPromise, aqPromise]);

        // Process forecast data.
        let hourlyForecast: HourlyForecast[] = [];
        let dailyForecast: DailyForecast[] = [];

        if (forecastData) {
            // Process hourly forecast (next 24 hours, 8 x 3-hour intervals).
            if (forecastData.list) {
                const timeFormatter = getTimeFormatter(locale);
                const limit = 8;
                for (let i = 0; i < forecastData.list.length; i++) {
                    if (hourlyForecast.length >= limit) break;
                    const item = forecastData.list[i];
                    hourlyForecast.push({
                        time: timeFormatter.format(new Date(item.dt * 1000)),
                        temperature: Math.round(item.main.temp),
                        condition: item.weather[0].description,
                        icon: item.weather[0].icon
                    });
                }

                // Process daily forecast (group by day).
                const dailyMap = new Map<string, any>();
                forecastData.list.forEach((item: any) => {
                    const dateStr = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
                    const date = dateStr.replace(DATE_SEPARATOR_REGEX, '/');
                    if (!dailyMap.has(date)) {
                        dailyMap.set(date, {
                            temps: [],
                            condition: item.weather[0].description,
                            icon: item.weather[0].icon,
                            dt: item.dt
                        });
                    }
                    dailyMap.get(date).temps.push(item.main.temp);
                });

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
        }

        // Process air quality data.
        let airQuality: AirQuality | undefined;
        if (aqDataRaw && aqDataRaw.list && aqDataRaw.list.length > 0) {
            const aqData = aqDataRaw.list[0];
            airQuality = {
                aqi: aqData.main.aqi,
                pm25: Math.round(aqData.components.pm2_5),
                pm10: Math.round(aqData.components.pm10),
                o3: Math.round(aqData.components.o3),
                no2: Math.round(aqData.components.no2)
            };
        }

        const timeFormatter = getTimeFormatter(locale);
        const sunrise = timeFormatter.format(new Date(data.sys.sunrise * 1000));
        const sunset = timeFormatter.format(new Date(data.sys.sunset * 1000));

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
            sunrise,
            sunset,
            hourlyForecast,
            dailyForecast,
            airQuality,
            source: 'OpenWeatherMap',
            lat: data.coord.lat,
            lon: data.coord.lon
        };
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from OpenWeatherMap: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Fetches weather data from WeatherAPI.com.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
const fetchWeatherAPI = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh', coords?: { lat: number, lon: number }): Promise<WeatherData> => {
    console.log('Using WeatherAPI.com', lang, coords ? `with coords: ${coords.lat},${coords.lon}` : '');
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';

    // WeatherAPI supports "lat,lon" as q parameter.
    const query = coords ? `${coords.lat},${coords.lon}` : city;

    try {
        // Start concurrent requests.

        // 1. Forecast (Mandatory).
        const forecastPromise = axios.get(`${WEATHERAPI_BASE_URL}/forecast.json`, {
            params: {
                key: apiKey,
                q: query,
                days: 7,
                aqi: 'yes',
                alerts: 'no',
                lang: lang
            }
        });

        // 2. History (Optional).
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const dt = yesterdayDate.toISOString().substring(0, 10);

        const historyPromise = axios.get(`${WEATHERAPI_BASE_URL}/history.json`, {
            params: {
                key: apiKey,
                q: query, // Use same query (coords or city) for history.
                dt: dt
            }
        }).then(res => res.data).catch(e => {
            console.error('Failed to fetch WeatherAPI history:', e);
            return null;
        });

        const [response, historyDataRaw] = await Promise.all([forecastPromise, historyPromise]);

        const data = response.data;
        const current = data.current;
        const forecast = data.forecast.forecastday;

        const timeFormatter = getTimeFormatter(locale);
        const hourlyForecast: HourlyForecast[] = [];
        const sourceHours = forecast[0].hour;
        const limit = 8;

        for (let i = 0; i < sourceHours.length; i += 3) {
            if (hourlyForecast.length >= limit) break;
            const item = sourceHours[i];
            hourlyForecast.push({
                time: timeFormatter.format(new Date(item.time)),
                temperature: Math.round(item.temp_c),
                condition: item.condition.text,
                icon: item.condition.icon
            });
        }

        const dailyForecast: DailyForecast[] = forecast.map((item: any) => {
            return {
                date: item.date, // YYYY-MM-DD
                tempMin: Math.round(item.day.mintemp_c),
                tempMax: Math.round(item.day.maxtemp_c),
                condition: item.day.condition.text,
                icon: item.day.condition.icon
            };
        });

        // Map US AQI to 1-5 scale roughly.
        const usEpaIndex = current.air_quality ? current.air_quality['us-epa-index'] : 1;

        // Process history data if available.
        if (historyDataRaw && historyDataRaw.forecast && historyDataRaw.forecast.forecastday && historyDataRaw.forecast.forecastday.length > 0) {
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
            sunrise: forecast[0].astro.sunrise,
            sunset: forecast[0].astro.sunset,
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
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from WeatherAPI: ${error.response?.data?.error?.message || error.message}`);
    }
};

/**
 * Fetches weather data from QWeather.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {string} [host] - Optional custom host.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
const fetchQWeather = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh', host?: string, coords?: { lat: number, lon: number }): Promise<WeatherData> => {
    console.log('Using QWeather API', lang, host ? `with custom host: ${host}` : '', coords ? `with coords: ${coords.lat},${coords.lon}` : '');
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    try {
        const { base: qBaseUrl, geo: qGeoUrl } = getQWeatherUrls(host);

        // QWeather geo API supports "lon,lat" (note order!) for location lookup.
        const locationQuery = coords ? `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}` : city;

        // Helpers to generate requests.
        const getWeatherRequests = (loc: string) => [
            axios.get(`${qBaseUrl}/weather/now`, { params: { location: loc, key: apiKey, lang: lang } }),
            axios.get(`${qBaseUrl}/weather/7d`, { params: { location: loc, key: apiKey, lang: lang } }),
            axios.get(`${qBaseUrl}/weather/24h`, { params: { location: loc, key: apiKey, lang: lang } })
        ];

        const getOptionalRequests = (loc: string) => [
            axios.get(`${qBaseUrl}/air/now`, { params: { location: loc, key: apiKey, lang: lang } }),
            axios.get(`${qBaseUrl}/astronomy/sun`, { params: { location: loc, key: apiKey, date: new Date().toISOString().substring(0, 10), lang: lang } })
        ];

        let lookupRes;
        let weatherRes: any[];
        let optionalRes: PromiseSettledResult<any>[];

        if (coords) {
            // Parallelize everything if coords are available.
            const lookupPromise = axios.get(`${qGeoUrl}/city/lookup`, {
                params: { location: locationQuery, key: apiKey, lang: lang }
            });

            // Use coords for weather requests directly.
            const weatherPromise = Promise.all(getWeatherRequests(locationQuery));
            const optionalPromise = Promise.allSettled(getOptionalRequests(locationQuery));

            [lookupRes, weatherRes, optionalRes] = await Promise.all([
                lookupPromise,
                weatherPromise,
                optionalPromise
            ]);
        } else {
            // Must lookup first to get ID/validate city.
            lookupRes = await axios.get(`${qGeoUrl}/city/lookup`, {
                params: { location: locationQuery, key: apiKey, lang: lang }
            });

            if (lookupRes.data.code !== '200') {
                throw new Error(`Location not found: ${lookupRes.data.code}`);
            }

            const locationId = lookupRes.data.location[0].id;

            [weatherRes, optionalRes] = await Promise.all([
                Promise.all(getWeatherRequests(locationId)),
                Promise.allSettled(getOptionalRequests(locationId))
            ]);
        }

        if (lookupRes.data.code !== '200') {
            throw new Error(`Location not found: ${lookupRes.data.code}`);
        }

        const cityName = lookupRes.data.location[0].name;
        const locationLat = parseFloat(lookupRes.data.location[0].lat);
        const locationLon = parseFloat(lookupRes.data.location[0].lon);

        const [nowRes, dailyRes, hourlyRes] = weatherRes;
        const [airRes, sunRes] = optionalRes;

        const now = nowRes.data.now;
        const daily = dailyRes.data.daily;
        const hourly = hourlyRes.data.hourly;

        let air = null;
        if (airRes.status === 'fulfilled' && airRes.value.data.code === '200') {
            air = airRes.value.data.now;
        }

        let sun = null;
        if (sunRes.status === 'fulfilled' && sunRes.value.data.code === '200') {
            sun = sunRes.value.data;
        }

        const timeFormatter = getTimeFormatter(locale);
        const hourlyForecast: HourlyForecast[] = [];
        const limit = 8;

        for (let i = 0; i < hourly.length; i += 3) {
            if (hourlyForecast.length >= limit) break;
            const item = hourly[i];
            hourlyForecast.push({
                time: timeFormatter.format(new Date(item.fxTime)),
                temperature: parseInt(item.temp),
                condition: item.text,
                icon: item.icon // QWeather icon code.
            });
        }

        const dailyForecast: DailyForecast[] = daily.map((item: any) => {
            return {
                date: item.fxDate, // YYYY-MM-DD
                tempMin: parseInt(item.tempMin),
                tempMax: parseInt(item.tempMax),
                condition: item.textDay,
                icon: item.iconDay
            };
        });

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
            weatherData.sunrise = sun.sunrise;
            weatherData.sunset = sun.sunset;
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

    } catch (error: any) {
        console.error('API Error details:', error.response?.data);
        console.error('API Error message:', error.message);
        throw new Error(`Failed to fetch from QWeather: ${error.response?.data?.code || error.message}`);
    }
};

/**
 * Fetches weather data from a custom URL.
 *
 * @param {string} city - The city name.
 * @param {string} url - The custom API URL.
 * @param {string} [apiKey] - The optional API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails or response format is invalid.
 */
const fetchCustom = async (city: string, url: string, apiKey?: string, lang: 'zh' | 'en' = 'zh'): Promise<WeatherData> => {
    console.log('Using Custom API', lang);
    try {
        const response = await axios.get(url, {
            params: {
                city: city,
                key: apiKey,
                lang: lang
            }
        });

        const data = response.data;
        // Basic validation to ensure it looks like WeatherData.
        if (!data.city || !data.temperature || !data.hourlyForecast || !data.dailyForecast) {
            throw new Error('Response does not match WeatherData interface');
        }

        return data as WeatherData;
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from Custom URL: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Main function to fetch weather data from the configured or specified source.
 * Handles caching, source selection, and fallback logic.
 *
 * @param {string} city - The city name.
 * @param {string} [preferredSource] - Optionally override the configured source.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates for precise lookup.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If no API key is configured or the fetch fails.
 */
export const getWeather = async (city: string, preferredSource?: string, lang: 'zh' | 'en' = 'zh', coords?: { lat: number, lon: number }): Promise<WeatherData> => {
    const settings = await getSettings();
    console.log('Current settings:', settings);

    // Determine TTL (default 15 mins if 0 or undefined).
    const ttlMinutes = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
    const ttl = ttlMinutes * 60 * 1000;

    let sourceToUse = preferredSource || settings.source;
    if (settings.source === 'custom' && settings.customUrl) {
        sourceToUse = 'custom';
    }

    // Check cache.
    try {
        const cache = await getCache();
        const key = getCacheKey(city, sourceToUse, lang, coords);
        const now = Date.now();

        if (cache[key]) {
            const entry = cache[key];
            if (now - entry.timestamp < ttl) {
                console.log(`[Cache Hit] Returning cached weather data for ${key}`);
                return entry.data;
            } else {
                console.log(`[Cache Expired] ${key} expired (age: ${now - entry.timestamp}ms, ttl: ${ttl}ms)`);
                delete cache[key];
            }
        } else {
            console.log(`[Cache Miss] ${key}`);
        }
    } catch (e) {
        console.warn('Cache check failed, proceeding to fetch:', e);
    }

    let weatherData: WeatherData;

    if (sourceToUse === 'custom' && settings.customUrl) {
        weatherData = await fetchCustom(city, settings.customUrl, settings.apiKeys.custom, lang);
    } else {
        // Cast sourceToUse to allow indexing if it matches one of the known keys.
        if (sourceToUse && (sourceToUse in settings.apiKeys)) {
            const apiKey = settings.apiKeys[sourceToUse as keyof typeof settings.apiKeys];

            if (!apiKey) {
                throw new Error(`API key for ${sourceToUse} is invalid or missing.`);
            }

            switch (sourceToUse) {
                case 'openweathermap':
                    weatherData = await fetchOpenWeatherMap(city, apiKey, lang, coords);
                    break;
                case 'weatherapi':
                    weatherData = await fetchWeatherAPI(city, apiKey, lang, coords);
                    break;
                case 'qweather':
                    weatherData = await fetchQWeather(city, apiKey, lang, settings.qweatherHost, coords);
                    break;
                default:
                    throw new Error('Unknown weather source');
            }
        } else {
            throw new Error('Please configure a weather source and API key in settings.');
        }
    }

    // Save to cache.
    try {
        const cache = await getCache();
        const key = getCacheKey(city, sourceToUse, lang, coords);
        cache[key] = {
            data: weatherData,
            timestamp: Date.now(),
            lang,
            source: sourceToUse
        };
        // Persist (fire and forget).
        storage.set(CACHE_KEY, cache).catch(e => console.error('Failed to save cache:', e));
    } catch (e) {
        console.warn('Failed to update cache:', e);
    }

    return weatherData;
};

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

/**
 * Searches for cities using OpenWeatherMap.
 *
 * @param {string} query - The search query.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @returns {Promise<CityResult[]>} A promise that resolves to an array of city results.
 */
const searchOpenWeatherMap = async (query: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> => {
    try {
        const response = await axios.get(`https://api.openweathermap.org/geo/1.0/direct`, {
            params: {
                q: query,
                limit: 5,
                appid: apiKey
            }
        });
        return response.data.map((item: any) => ({
            name: item.local_names?.[lang] || item.local_names?.[lang === 'zh' ? 'zh_cn' : 'en'] || item.name,
            region: item.state,
            country: item.country,
            lat: item.lat,
            lon: item.lon
        }));
    } catch (e) {
        console.error('OWM Search Error', e);
        return [];
    }
};

/**
 * Searches for cities using WeatherAPI.com.
 *
 * @param {string} query - The search query.
 * @param {string} apiKey - The API key.
 * @returns {Promise<CityResult[]>} A promise that resolves to an array of city results.
 */
const searchWeatherAPI = async (query: string, apiKey: string): Promise<CityResult[]> => {
    try {
        const response = await axios.get(`${WEATHERAPI_BASE_URL}/search.json`, {
            params: {
                key: apiKey,
                q: query
            }
        });
        return response.data.map((item: any) => ({
            name: item.name,
            region: item.region,
            country: item.country,
            lat: item.lat,
            lon: item.lon
        }));
    } catch (e) {
        console.error('WeatherAPI Search Error', e);
        return [];
    }
};

/**
 * Searches for cities using QWeather.
 *
 * @param {string} query - The search query.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {string} [host] - Optional custom host.
 * @returns {Promise<CityResult[]>} A promise that resolves to an array of city results.
 */
const searchQWeather = async (query: string, apiKey: string, lang: 'zh' | 'en' = 'zh', host?: string): Promise<CityResult[]> => {
    try {
        const { geo: qGeoUrl } = getQWeatherUrls(host);
        const response = await axios.get(`${qGeoUrl}/city/lookup`, {
            params: {
                location: query,
                key: apiKey,
                lang: lang
            }
        });
        if (response.data.code !== '200') return [];
        return response.data.location.map((item: any) => ({
            name: item.name,
            region: item.adm1,
            country: item.country,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            id: item.id
        }));
    } catch (e) {
        console.error('QWeather Search Error', e);
        return [];
    }
};


/**
 * Searches for cities based on the configured weather source.
 *
 * @param {string} query - The search query.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @returns {Promise<CityResult[]>} A promise that resolves to an array of city results.
 */
export const searchCities = async (query: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> => {
    const settings = await getSettings();
    if (!settings.source || !settings.apiKeys[settings.source]) return [];

    const apiKey = settings.apiKeys[settings.source]!;

    switch (settings.source) {
        case 'openweathermap':
            return searchOpenWeatherMap(query, apiKey, lang);
        case 'weatherapi':
            return searchWeatherAPI(query, apiKey);
        case 'qweather':
            return searchQWeather(query, apiKey, lang, settings.qweatherHost);
        default:
            return [];
    }
};

/**
 * Verifies the connection to a specific weather source using the provided API key.
 *
 * @param {string} source - The weather source to verify.
 * @param {string} apiKey - The API key to test.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {string} [host] - Optional custom host (for QWeather).
 * @returns {Promise<boolean>} A promise that resolves to true if connection is successful, false otherwise.
 */
export const verifyConnection = async (source: string, apiKey: string, lang: 'zh' | 'en' = 'zh', host?: string): Promise<boolean> => {
    try {
        let result: any[] = [];
        const testQuery = 'Beijing'; // Standard test city.

        switch (source) {
            case 'openweathermap':
                result = await searchOpenWeatherMap(testQuery, apiKey, lang);
                break;
            case 'weatherapi':
                result = await searchWeatherAPI(testQuery, apiKey);
                break;
            case 'qweather':
                result = await searchQWeather(testQuery, apiKey, lang, host);
                break;
            case 'custom':
                // For custom, we can't easily test without a URL, but we assume it works if we can fetch.
                // We'll skip for now or require URL.
                return true;
            default:
                throw new Error('Unknown source');
        }

        return result.length > 0;
    } catch (e) {
        console.error('Verification failed:', e);
        return false;
    }
};
