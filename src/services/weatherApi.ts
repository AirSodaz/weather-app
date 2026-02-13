import axios from 'axios';
import { getSettings } from '../utils/config';
import { formatTime, formatTimeString } from '../utils/helpers';
import { weatherCacheManager } from './WeatherCacheManager';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';
const DATE_SEPARATOR_REGEX = /-/g;

// Export interfaces for use in other files
export interface HourlyForecast {
    time: string;
    temperature: number;
    condition: string;
    icon: string;
}

export interface DailyForecast {
    date: string;
    tempMin: number;
    tempMax: number;
    condition: string;
    icon: string;
}

export interface AirQuality {
    aqi: number;
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
}

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
 * Generates a unique cache key for a weather request.
 */
function getCacheKey(city: string, source: string, lang: string, coords?: { lat: number, lon: number }): string {
    if (coords) {
        return `${source}:${lang}:lat_${coords.lat.toFixed(2)}_lon_${coords.lon.toFixed(2)}`;
    }
    return `${source}:${lang}:${city.toLowerCase()}`;
}

function getQWeatherUrls(customHost?: string): { base: string, geo: string } {
    let host = customHost || import.meta.env.VITE_QWEATHER_API_HOST;

    if (!host) {
        return {
            base: 'https://devapi.qweather.com/v7',
            geo: 'https://geoapi.qweather.com/v2'
        };
    }

    host = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
        base: `https://${host}/v7`,
        geo: `https://${host}/geo/v2`
    };
}

/**
 * Helper to process daily forecast from OpenWeatherMap list.
 */
function processOpenWeatherDaily(list: any[]): DailyForecast[] {
    const dailyMap = new Map<string, { temps: number[], condition: string, icon: string }>();

    for (const item of list) {
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

    const dailyForecast: DailyForecast[] = [];
    dailyMap.forEach((value, key) => {
        dailyForecast.push({
            date: key,
            tempMin: Math.round(Math.min(...value.temps)),
            tempMax: Math.round(Math.max(...value.temps)),
            condition: value.condition,
            icon: value.icon
        });
    });
    return dailyForecast;
}

function transformOpenWeatherData(
    data: any,
    forecastData: any,
    aqDataRaw: any,
    use24h: boolean
): WeatherData {
    const hourlyForecast: HourlyForecast[] = [];

    if (forecastData?.list) {
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
    }

    const dailyForecast = forecastData?.list ? processOpenWeatherDaily(forecastData.list) : [];

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
        date: item.date,
        tempMin: Math.round(item.day.mintemp_c),
        tempMax: Math.round(item.day.maxtemp_c),
        condition: item.day.condition.text,
        icon: item.day.condition.icon
    }));

    if (historyDataRaw?.forecast?.forecastday?.length > 0) {
        const historyData = historyDataRaw.forecast.forecastday[0];
        dailyForecast.unshift({
            date: historyData.date,
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
        windSpeed: current.wind_kph / 3.6,
        feelsLike: Math.round(current.feelslike_c),
        pressure: current.pressure_mb,
        visibility: current.vis_km,
        uvIndex: current.uv,
        sunrise: formatTimeString(forecast[0].astro.sunrise, use24h),
        sunset: formatTimeString(forecast[0].astro.sunset, use24h),
        hourlyForecast,
        dailyForecast,
        airQuality: {
            aqi: (current.air_quality && current.air_quality['us-epa-index']) || 1,
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
            params: { key: apiKey, q: query, days: 7, aqi: 'yes', alerts: 'no', lang }
        });

        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const dt = yesterdayDate.toISOString().substring(0, 10);

        const historyPromise = axios.get(`${WEATHERAPI_BASE_URL}/history.json`, {
            params: { key: apiKey, q: query, dt }
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
        date: item.fxDate,
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
        windSpeed: parseInt(now.windSpeed) / 3.6,
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
            const lookupPromise = axios.get(`${qGeoUrl}/city/lookup`, { params: { location: locationQuery, key: apiKey, lang } });
            const weatherPromise = Promise.all(getWeatherRequests(locationQuery));
            const optionalPromise = Promise.allSettled(getOptionalRequests(locationQuery));
            [lookupRes, weatherRes, optionalRes] = await Promise.all([lookupPromise, weatherPromise, optionalPromise]);
        } else {
            lookupRes = await axios.get(`${qGeoUrl}/city/lookup`, { params: { location: locationQuery, key: apiKey, lang } });
            if (lookupRes.data.code !== '200') throw new Error(`Location not found: ${lookupRes.data.code}`);

            const locationId = lookupRes.data.location[0].id;
            [weatherRes, optionalRes] = await Promise.all([
                Promise.all(getWeatherRequests(locationId)),
                Promise.allSettled(getOptionalRequests(locationId))
            ]);
        }

        if (lookupRes.data.code !== '200') throw new Error(`Location not found: ${lookupRes.data.code}`);

        const cityName = lookupRes.data.location[0].name;
        const locationLat = parseFloat(lookupRes.data.location[0].lat);
        const locationLon = parseFloat(lookupRes.data.location[0].lon);
        const [nowRes, dailyRes, hourlyRes] = weatherRes;
        const [airRes, sunRes] = optionalRes;

        const air = (airRes.status === 'fulfilled' && airRes.value.data.code === '200') ? airRes.value.data.now : null;
        const sun = (sunRes.status === 'fulfilled' && sunRes.value.data.code === '200') ? sunRes.value.data : null;

        return transformQWeatherData(cityName, locationLat, locationLon, nowRes.data.now, dailyRes.data.daily, hourlyRes.data.hourly, air, sun, use24h);
    } catch (error: any) {
        console.error('API Error details:', error.response?.data);
        throw new Error(`Failed to fetch from QWeather: ${error.response?.data?.code || error.message}`);
    }
}

async function fetchCustom(
    city: string,
    url: string,
    apiKey?: string,
    lang: 'zh' | 'en' = 'zh'
): Promise<WeatherData> {
    console.log('Using Custom API', lang);
    try {
        const response = await axios.get(url, { params: { city, key: apiKey, lang } });
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

// Provider strategy type definition
type WeatherProvider = (
    city: string,
    apiKey: string,
    lang: 'zh' | 'en',
    coords: { lat: number, lon: number } | undefined,
    use24h: boolean,
    host?: string
) => Promise<WeatherData>;

const weatherProviders: Record<string, WeatherProvider> = {
    openweathermap: (city, key, lang, coords, use24h) => fetchOpenWeatherMap(city, key, lang, coords, use24h),
    weatherapi: (city, key, lang, coords, use24h) => fetchWeatherAPI(city, key, lang, coords, use24h),
    qweather: (city, key, lang, coords, use24h, host) => fetchQWeather(city, key, lang, host, coords, use24h),
};

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
    const cacheKey = getCacheKey(city, sourceToUse, lang, coords);
    const cachedData = await weatherCacheManager.getWeather<WeatherData>(cacheKey, ttl, currentTimeFormat);
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
        if (provider) {
            weatherData = await provider(city, apiKey, lang, coords, use24h, settings.qweatherHost);
        } else {
            throw new Error('Unknown weather source');
        }
    } else {
        throw new Error('Please configure a weather source and API key in settings.');
    }

    // Save to cache
    await weatherCacheManager.setWeather(cacheKey, weatherData, lang, sourceToUse, currentTimeFormat);

    return weatherData;
}

export interface CityResult {
    name: string;
    region?: string;
    country?: string;
    lat: number;
    lon: number;
    id?: string;
}

async function searchOpenWeatherMap(query: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> {
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

async function searchQWeather(query: string, apiKey: string, lang: 'zh' | 'en' = 'zh', host?: string): Promise<CityResult[]> {
    try {
        const { geo: qGeoUrl } = getQWeatherUrls(host);
        const response = await axios.get(`${qGeoUrl}/city/lookup`, { params: { location: query, key: apiKey, lang } });
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

export async function searchCities(query: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> {
    const settings = await getSettings();
    if (!settings.source || !settings.apiKeys[settings.source]) return [];
    const apiKey = settings.apiKeys[settings.source]!;

    const providers: Record<string, Function> = {
        openweathermap: searchOpenWeatherMap,
        weatherapi: (q: string, k: string) => searchWeatherAPI(q, k),
        qweather: (q: string, k: string) => searchQWeather(q, k, lang, settings.qweatherHost)
    };

    const searchFn = providers[settings.source];
    return searchFn ? searchFn(query, apiKey, lang) : [];
}

export async function verifyConnection(
    source: string,
    apiKey: string,
    lang: 'zh' | 'en' = 'zh',
    host?: string
): Promise<boolean> {
    try {
        let result: any[] = [];
        const testQuery = 'Beijing';

        const strategies: Record<string, () => Promise<any[]>> = {
            openweathermap: () => searchOpenWeatherMap(testQuery, apiKey, lang),
            weatherapi: () => searchWeatherAPI(testQuery, apiKey),
            qweather: () => searchQWeather(testQuery, apiKey, lang, host),
            custom: async () => [true]
        };

        if (strategies[source]) {
            result = await strategies[source]();
        } else {
            throw new Error('Unknown source');
        }

        return result.length > 0;
    } catch (e) {
        console.error('Verification failed:', e);
        return false;
    }
}
