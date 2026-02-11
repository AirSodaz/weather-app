import axios from 'axios';
import { getSettings } from '../utils/config';
import { storage } from '../utils/storage';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';
const DATE_SEPARATOR_REGEX = /-/g;
const CACHE_KEY = 'weather_cache_v1';

/**
 * Helper to format hours and minutes into a string.
 */
function formatHoursMinutes(hours: number, minutes: number, use24h: boolean): string {
    const minStr = minutes.toString().padStart(2, '0');

    if (use24h) {
        return `${hours.toString().padStart(2, '0')}:${minStr}`;
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minStr} ${ampm}`;
}

/**
 * Formats a date object to HH:mm string.
 *
 * @param {Date} date - The date to format.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {string} The formatted time string.
 */
function formatTime(date: Date, use24h: boolean = true): string {
    return formatHoursMinutes(date.getHours(), date.getMinutes(), use24h);
}

/**
 * Formats a time string (e.g., "05:00 AM" or "13:00") to the desired format.
 * Assuming input is either 12h with AM/PM or 24h.
 *
 * @param {string} timeStr - The time string to format.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {string} The formatted time string.
 */
function formatTimeString(timeStr: string, use24h: boolean = true): string {
    let hours = 0;
    let minutes = 0;
    const is12hInput = /AM|PM/i.test(timeStr);

    if (is12hInput) {
        const [time, modifier] = timeStr.split(' ');
        const [h, m] = time.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);

        if (hours === 12) hours = 0;
        if (modifier?.toUpperCase() === 'PM') hours += 12;
    } else {
        const [h, m] = timeStr.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
    }

    return formatHoursMinutes(hours, minutes, use24h);
}

interface CacheEntry {
    data: WeatherData;
    timestamp: number;
    lang: string;
    source: string;
    timeFormat?: '24h' | '12h';
}

interface WeatherCacheStore {
    [key: string]: CacheEntry;
}

class WeatherCacheManager {
    private memoryCache: WeatherCacheStore | null = null;
    private loadPromise: Promise<WeatherCacheStore> | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly DEBOUNCE_MS = 2000;

    private async getStore(): Promise<WeatherCacheStore> {
        if (this.memoryCache) return this.memoryCache;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const c = await storage.get(CACHE_KEY);
                this.memoryCache = c || {};
            } catch (e) {
                console.error('Failed to load weather cache:', e);
                this.memoryCache = {};
            }
            return this.memoryCache!;
        })();
        return this.loadPromise;
    }

    private saveDebounced(store: WeatherCacheStore) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(async () => {
            this.saveTimeout = null;
            try {
                await storage.set(CACHE_KEY, store);
            } catch (e) {
                console.warn('Failed to save weather cache:', e);
            }
        }, this.DEBOUNCE_MS);
    }

    private getKey(city: string, source: string, lang: string, coords?: { lat: number, lon: number }): string {
        if (coords) {
            return `${source}:${lang}:lat_${coords.lat.toFixed(2)}_lon_${coords.lon.toFixed(2)}`;
        }
        return `${source}:${lang}:${city.toLowerCase()}`;
    }

    public async get(
        city: string,
        source: string,
        lang: string,
        coords: { lat: number, lon: number } | undefined,
        ttl: number,
        currentTimeFormat: '24h' | '12h'
    ): Promise<WeatherData | null> {
        try {
            const cache = await this.getStore();
            const key = this.getKey(city, source, lang, coords);
            const now = Date.now();

            if (cache[key]) {
                const entry = cache[key];
                const isFormatMatch = entry.timeFormat === currentTimeFormat;

                if (now - entry.timestamp < ttl && isFormatMatch) {
                    console.log(`[Cache Hit] Returning cached weather data for ${key}`);
                    return entry.data;
                } else {
                    delete cache[key]; // Clean up expired
                }
            }
        } catch (e) {
            console.warn('Cache check failed:', e);
        }
        return null;
    }

    public async set(
        city: string,
        source: string,
        lang: string,
        coords: { lat: number, lon: number } | undefined,
        data: WeatherData,
        currentTimeFormat: '24h' | '12h'
    ): Promise<void> {
        try {
            const cache = await this.getStore();
            const key = this.getKey(city, source, lang, coords);
            cache[key] = {
                data: data,
                timestamp: Date.now(),
                lang,
                source,
                timeFormat: currentTimeFormat
            };
            this.saveDebounced(cache);
        } catch (e) {
            console.warn('Failed to update cache:', e);
        }
    }
}

const weatherCache = new WeatherCacheManager();

/**
 * Constructs the API URLs for QWeather, respecting custom host configurations.
 *
 * @param {string} [customHost] - An optional custom host URL.
 * @returns {{ base: string, geo: string }} An object containing the base and geo API URLs.
 */
function getQWeatherUrls(customHost?: string): { base: string, geo: string } {
    let host = customHost || import.meta.env.VITE_QWEATHER_API_HOST;

    if (!host) {
        return {
            base: 'https://devapi.qweather.com/v7',
            geo: 'https://geoapi.qweather.com/v2'
        };
    }

    // Normalize host
    host = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
        base: `https://${host}/v7`,
        geo: `https://${host}/geo/v2`
    };
}

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
 * Transforms OpenWeatherMap API response into WeatherData.
 */
function transformOpenWeatherData(
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
 * Fetches weather data from OpenWeatherMap.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
async function fetchOpenWeatherMap(
    city: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    coords?: { lat: number, lon: number },
    use24h: boolean = true
): Promise<WeatherData> {
    console.log('Using OpenWeatherMap API', lang, coords ? `with coords: ${coords.lat},${coords.lon}` : '');
    const apiLang = lang === 'zh' ? 'zh_cn' : 'en';

    const params: Record<string, string | number> = {
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

    const fetchOptional = async (url: string, p: any) => {
        try {
            const res = await axios.get(url, { params: p });
            return res.data;
        } catch (e) {
            console.error(`Failed to fetch optional data from ${url}:`, e);
            return null;
        }
    };

    try {
        const weatherPromise = axios.get(`${OPENWEATHER_BASE_URL}/weather`, { params });
        const forecastPromise = fetchOptional(`${OPENWEATHER_BASE_URL}/forecast`, params);

        // Optimistically start AQ fetch if coords known
        let aqPromise: Promise<any> | null = null;
        if (coords) {
            aqPromise = fetchOptional(`${OPENWEATHER_BASE_URL}/air_pollution`, {
                lat: coords.lat,
                lon: coords.lon,
                appid: apiKey
            });
        }

        const weatherResponse = await weatherPromise;
        const data = weatherResponse.data;

        // If not started yet, fetch AQ now using returned coords
        if (!aqPromise) {
            aqPromise = fetchOptional(`${OPENWEATHER_BASE_URL}/air_pollution`, {
                lat: data.coord.lat,
                lon: data.coord.lon,
                appid: apiKey
            });
        }

        const [forecastData, aqDataRaw] = await Promise.all([forecastPromise, aqPromise]);

        return transformOpenWeatherData(data, forecastData, aqDataRaw, use24h);
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from OpenWeatherMap: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Transforms WeatherAPI response into WeatherData.
 */
function transformWeatherAPIData(
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
 * Fetches weather data from WeatherAPI.com.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
async function fetchWeatherAPI(
    city: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    coords?: { lat: number, lon: number },
    use24h: boolean = true
): Promise<WeatherData> {
    console.log('Using WeatherAPI.com', lang, coords ? `with coords: ${coords.lat},${coords.lon}` : '');

    const query = coords ? `${coords.lat},${coords.lon}` : city;

    try {
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

        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const dt = yesterdayDate.toISOString().substring(0, 10);

        const historyPromise = axios.get(`${WEATHERAPI_BASE_URL}/history.json`, {
            params: { key: apiKey, q: query, dt: dt }
        }).then(res => res.data).catch(e => {
            console.error('Failed to fetch WeatherAPI history:', e);
            return null;
        });

        const [response, historyDataRaw] = await Promise.all([forecastPromise, historyPromise]);
        return transformWeatherAPIData(response.data, historyDataRaw, use24h);
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from WeatherAPI: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Transforms QWeather response into WeatherData.
 */
function transformQWeatherData(
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

/**
 * Fetches weather data from QWeather.
 *
 * @param {string} city - The city name.
 * @param {string} apiKey - The API key.
 * @param {'zh' | 'en'} [lang='zh'] - The language code.
 * @param {string} [host] - Optional custom host.
 * @param {{ lat: number, lon: number }} [coords] - Optional coordinates.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {Promise<WeatherData>} A promise that resolves to the weather data.
 * @throws {Error} If the API request fails.
 */
async function fetchQWeather(
    city: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    host?: string,
    coords?: { lat: number, lon: number },
    use24h: boolean = true
): Promise<WeatherData> {
    console.log('Using QWeather API', lang, host ? `with custom host: ${host}` : '', coords ? `with coords: ${coords.lat},${coords.lon}` : '');

    try {
        const { base: qBaseUrl, geo: qGeoUrl } = getQWeatherUrls(host);
        const locationQuery = coords ? `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}` : city;

        const getWeatherRequests = (loc: string) => [
            axios.get(`${qBaseUrl}/weather/now`, { params: { location: loc, key: apiKey, lang } }),
            axios.get(`${qBaseUrl}/weather/7d`, { params: { location: loc, key: apiKey, lang } }),
            axios.get(`${qBaseUrl}/weather/24h`, { params: { location: loc, key: apiKey, lang } })
        ];

        const getOptionalRequests = (loc: string) => [
            axios.get(`${qBaseUrl}/air/now`, { params: { location: loc, key: apiKey, lang } }),
            axios.get(`${qBaseUrl}/astronomy/sun`, { params: { location: loc, key: apiKey, date: new Date().toISOString().substring(0, 10), lang } })
        ];

        let lookupRes;
        let weatherRes: any[];
        let optionalRes: PromiseSettledResult<any>[];

        if (coords) {
            const lookupPromise = axios.get(`${qGeoUrl}/city/lookup`, {
                params: { location: locationQuery, key: apiKey, lang }
            });
            const weatherPromise = Promise.all(getWeatherRequests(locationQuery));
            const optionalPromise = Promise.allSettled(getOptionalRequests(locationQuery));

            [lookupRes, weatherRes, optionalRes] = await Promise.all([lookupPromise, weatherPromise, optionalPromise]);
        } else {
            lookupRes = await axios.get(`${qGeoUrl}/city/lookup`, {
                params: { location: locationQuery, key: apiKey, lang }
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

        return transformQWeatherData(
            cityName,
            locationLat,
            locationLon,
            now,
            daily,
            hourly,
            air,
            sun,
            use24h
        );

    } catch (error: any) {
        console.error('API Error details:', error.response?.data);
        throw new Error(`Failed to fetch from QWeather: ${error.response?.data?.code || error.message}`);
    }
}

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
async function fetchCustom(
    city: string,
    url: string,
    apiKey?: string,
    lang: 'zh' | 'en' = 'zh'
): Promise<WeatherData> {
    console.log('Using Custom API', lang);
    try {
        const response = await axios.get(url, {
            params: { city, key: apiKey, lang }
        });

        const data = response.data;
        if (!data.city || !data.temperature || !data.hourlyForecast || !data.dailyForecast) {
            throw new Error('Response does not match WeatherData interface');
        }

        return data as WeatherData;
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from Custom URL: ${error.response?.data?.message || error.message}`);
    }
}

type WeatherFetcher = (city: string, apiKey: string, lang: 'zh' | 'en', host: string | undefined, coords?: { lat: number, lon: number }, use24h?: boolean) => Promise<WeatherData>;

const weatherProviders: Record<string, WeatherFetcher> = {
    openweathermap: (city, key, lang, _, coords, use24h) => fetchOpenWeatherMap(city, key, lang, coords, use24h),
    weatherapi: (city, key, lang, _, coords, use24h) => fetchWeatherAPI(city, key, lang, coords, use24h),
    qweather: (city, key, lang, host, coords, use24h) => fetchQWeather(city, key, lang, host, coords, use24h)
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
export async function getWeather(
    city: string,
    preferredSource?: string,
    lang: 'zh' | 'en' = 'zh',
    coords?: { lat: number, lon: number }
): Promise<WeatherData> {
    const settings = await getSettings();
    console.log('Current settings:', settings);

    const ttlMinutes = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
    const ttl = ttlMinutes * 60 * 1000;

    let sourceToUse = preferredSource || settings.source;
    if (settings.source === 'custom' && settings.customUrl) {
        sourceToUse = 'custom';
    }

    const currentTimeFormat = settings.timeFormat || '24h';
    const use24h = currentTimeFormat !== '12h';

    // Try to get from cache
    const cachedData = await weatherCache.get(city, sourceToUse, lang, coords, ttl, currentTimeFormat);
    if (cachedData) {
        return cachedData;
    }

    let weatherData: WeatherData;

    if (sourceToUse === 'custom' && settings.customUrl) {
        weatherData = await fetchCustom(city, settings.customUrl, settings.apiKeys.custom, lang);
    } else if (sourceToUse && (sourceToUse in settings.apiKeys)) {
        const apiKey = settings.apiKeys[sourceToUse as keyof typeof settings.apiKeys];
        if (!apiKey) throw new Error(`API key for ${sourceToUse} is invalid or missing.`);

        const provider = weatherProviders[sourceToUse];
        if (!provider) throw new Error('Unknown weather source');

        weatherData = await provider(city, apiKey, lang, settings.qweatherHost, coords, use24h);
    } else {
        throw new Error('Please configure a weather source and API key in settings.');
    }

    // Save to cache
    await weatherCache.set(city, sourceToUse, lang, coords, weatherData, currentTimeFormat);

    return weatherData;
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

/**
 * Searches for cities using OpenWeatherMap.
 */
async function searchOpenWeatherMap(
    query: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh'
): Promise<CityResult[]> {
    try {
        const response = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
            params: { q: query, limit: 5, appid: apiKey }
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
}

/**
 * Searches for cities using WeatherAPI.com.
 */
async function searchWeatherAPI(query: string, apiKey: string): Promise<CityResult[]> {
    try {
        const response = await axios.get(`${WEATHERAPI_BASE_URL}/search.json`, {
            params: { key: apiKey, q: query }
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
}

/**
 * Searches for cities using QWeather.
 */
async function searchQWeather(
    query: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    host?: string
): Promise<CityResult[]> {
    try {
        const { geo: qGeoUrl } = getQWeatherUrls(host);
        const response = await axios.get(`${qGeoUrl}/city/lookup`, {
            params: { location: query, key: apiKey, lang }
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
}

type CitySearcher = (query: string, apiKey: string, lang: 'zh' | 'en', host?: string) => Promise<CityResult[]>;

const citySearchers: Record<string, CitySearcher> = {
    openweathermap: (q, k, l) => searchOpenWeatherMap(q, k, l),
    weatherapi: (q, k) => searchWeatherAPI(q, k),
    qweather: (q, k, l, h) => searchQWeather(q, k, l, h)
};

/**
 * Searches for cities based on the configured weather source.
 */
export async function searchCities(
    query: string,
    lang: 'zh' | 'en' = 'zh'
): Promise<CityResult[]> {
    const settings = await getSettings();
    if (!settings.source || !settings.apiKeys[settings.source]) return [];

    const apiKey = settings.apiKeys[settings.source]!;

    const searcher = citySearchers[settings.source];
    if (searcher) {
        return searcher(query, apiKey, lang, settings.qweatherHost);
    }
    return [];
}

/**
 * Verifies the connection to a specific weather source using the provided API key.
 */
export async function verifyConnection(
    source: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    host?: string
): Promise<boolean> {
    try {
        if (source === 'custom') return true;

        const searcher = citySearchers[source];
        if (!searcher) throw new Error('Unknown source');

        const testQuery = 'Beijing'; // Standard test city.
        const result = await searcher(testQuery, apiKey, lang, host);

        return result.length > 0;
    } catch (e) {
        console.error('Verification failed:', e);
        return false;
    }
}
