import axios from 'axios';
import { getSettings } from '../utils/config';
import { storage } from '../utils/storage';
import { WeatherData, CityResult } from './types';
import {
    transformOpenWeatherData,
    transformWeatherAPIData,
    transformQWeatherData
} from './weatherTransformers';

// Export types for consumers
export type { WeatherData, CityResult, HourlyForecast, DailyForecast, AirQuality } from './types';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';
const CACHE_KEY = 'weather_cache_v1';
const CACHE_SAVE_DEBOUNCE_MS = 2000;

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

/**
 * Manages weather data caching with memory buffering and debounced storage persistence.
 */
class WeatherCacheManager {
    private memoryCache: WeatherCacheStore | null = null;
    private cacheLoadPromise: Promise<WeatherCacheStore> | null = null;
    private saveCacheTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Loads the weather cache from storage or memory.
     */
    private async getCache(): Promise<WeatherCacheStore> {
        if (this.memoryCache) return this.memoryCache;
        if (this.cacheLoadPromise) return this.cacheLoadPromise;

        this.cacheLoadPromise = (async () => {
            try {
                const c = await storage.get(CACHE_KEY);
                this.memoryCache = c || {};
            } catch (e) {
                console.error('Failed to load weather cache:', e);
                this.memoryCache = {};
            }
            return this.memoryCache!;
        })();
        return this.cacheLoadPromise;
    }

    /**
     * Persists the cache to storage with debouncing.
     */
    private saveCacheDebounced(cache: WeatherCacheStore) {
        if (this.saveCacheTimeout) {
            clearTimeout(this.saveCacheTimeout);
        }
        this.saveCacheTimeout = setTimeout(async () => {
            this.saveCacheTimeout = null;
            try {
                await storage.set(CACHE_KEY, cache);
            } catch (e) {
                console.warn('Failed to save weather cache:', e);
            }
        }, CACHE_SAVE_DEBOUNCE_MS);
    }

    /**
     * Generates a unique cache key for a weather request.
     */
    private getCacheKey(city: string, source: string, lang: string, coords?: { lat: number, lon: number }): string {
        if (coords) {
            return `${source}:${lang}:lat_${coords.lat.toFixed(2)}_lon_${coords.lon.toFixed(2)}`;
        }
        return `${source}:${lang}:${city.toLowerCase()}`;
    }

    /**
     * Retrieves weather data from cache if valid.
     */
    public async getWeatherCache(
        city: string,
        source: string,
        lang: string,
        coords: { lat: number, lon: number } | undefined,
        ttl: number,
        currentTimeFormat: '24h' | '12h'
    ): Promise<WeatherData | null> {
        try {
            const cache = await this.getCache();
            const key = this.getCacheKey(city, source, lang, coords);
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

    /**
     * Sets weather data to cache.
     */
    public async setWeatherCache(
        city: string,
        source: string,
        lang: string,
        coords: { lat: number, lon: number } | undefined,
        data: WeatherData,
        currentTimeFormat: '24h' | '12h'
    ): Promise<void> {
        try {
            const cache = await this.getCache();
            const key = this.getCacheKey(city, source, lang, coords);
            cache[key] = {
                data: data,
                timestamp: Date.now(),
                lang,
                source,
                timeFormat: currentTimeFormat
            };
            this.saveCacheDebounced(cache);
        } catch (e) {
            console.warn('Failed to update cache:', e);
        }
    }
}

// Singleton instance
const weatherCacheManager = new WeatherCacheManager();

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
 * Fetches weather data from OpenWeatherMap.
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
 * Fetches weather data from WeatherAPI.com.
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
 * Fetches weather data from QWeather.
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
    const cachedData = await weatherCacheManager.getWeatherCache(city, sourceToUse, lang, coords, ttl, currentTimeFormat);
    if (cachedData) {
        return cachedData;
    }

    let weatherData: WeatherData;

    if (sourceToUse === 'custom' && settings.customUrl) {
        weatherData = await fetchCustom(city, settings.customUrl, settings.apiKeys.custom, lang);
    } else if (sourceToUse && (sourceToUse in settings.apiKeys)) {
        const apiKey = settings.apiKeys[sourceToUse as keyof typeof settings.apiKeys];
        if (!apiKey) throw new Error(`API key for ${sourceToUse} is invalid or missing.`);

        switch (sourceToUse) {
            case 'openweathermap':
                weatherData = await fetchOpenWeatherMap(city, apiKey, lang, coords, use24h);
                break;
            case 'weatherapi':
                weatherData = await fetchWeatherAPI(city, apiKey, lang, coords, use24h);
                break;
            case 'qweather':
                weatherData = await fetchQWeather(city, apiKey, lang, settings.qweatherHost, coords, use24h);
                break;
            default:
                throw new Error('Unknown weather source');
        }
    } else {
        throw new Error('Please configure a weather source and API key in settings.');
    }

    // Save to cache
    await weatherCacheManager.setWeatherCache(city, sourceToUse, lang, coords, weatherData, currentTimeFormat);

    return weatherData;
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
                return true;
            default:
                throw new Error('Unknown source');
        }

        return result.length > 0;
    } catch (e) {
        console.error('Verification failed:', e);
        return false;
    }
}
