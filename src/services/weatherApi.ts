import axios from 'axios';
import { getSettings } from '../utils/config';
// Localized strings removed to be handled by UI
// import en from '../locales/en.json';
// import zh from '../locales/zh.json';
// const locales = { en, zh };
// Keeping imports commented out or just removing them. Removing is cleaner.

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const WEATHERAPI_BASE_URL = 'https://api.weatherapi.com/v1';
const QWEATHER_BASE_URL = 'https://devapi.qweather.com/v7';

export interface HourlyForecast {
    time: string;
    temperature: number;
    condition: string;
    icon: string;
}

export interface DailyForecast {
    date: string; // ISO or YYYY/MM/DD
    // dayName: string; // Removed, handled by UI
    tempMin: number;
    tempMax: number;
    condition: string;
    icon: string;
}

export interface AirQuality {
    aqi: number; // 1-5 scale
    // aqiLabel: string; // Removed, handled by UI
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
}

const fetchOpenWeatherMap = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<WeatherData> => {
    console.log('Using OpenWeatherMap API', lang);
    const apiLang = lang === 'zh' ? 'zh_cn' : 'en';
    // const locale = lang === 'zh' ? 'zh-CN' : 'en-US'; // Not needed for date formatting anymore if we use ISO
    const locale = 'en-US'; // Use fixed locale for standard date parsing, or better yet, construct ISO manually
    try {
        // Get current weather
        const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
            params: {
                q: city,
                appid: apiKey,
                units: 'metric',
                lang: apiLang
            }
        });

        const data = response.data;

        // Get forecast data
        let hourlyForecast: HourlyForecast[] = [];
        let dailyForecast: DailyForecast[] = [];

        try {
            const forecastResponse = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
                params: {
                    q: city,
                    appid: apiKey,
                    units: 'metric',
                    lang: apiLang
                }
            });

            const forecastData = forecastResponse.data;

            // Process hourly forecast (next 24 hours, 8 x 3-hour intervals)
            hourlyForecast = forecastData.list.slice(0, 8).map((item: any) => ({
                time: new Date(item.dt * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                temperature: Math.round(item.main.temp),
                condition: item.weather[0].main,
                icon: item.weather[0].icon
            }));

            // Process daily forecast (group by day)
            const dailyMap = new Map<string, any>();
            forecastData.list.forEach((item: any) => {
                // Use fixed locale to ensure YYYY/MM/DD or similar if we use toLocaleDateString
                // But safer to just take YYYY-MM-DD from item.dt_txt if available? 
                // OWM 5 day forecast has `dt_txt`: "2022-08-30 09:00:00"
                const dateStr = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
                const date = dateStr.replace(/-/g, '/'); // YYYY/MM/DD standard? Or keep YYYY-MM-DD? Let's use YYYY/MM/DD to match other APIs in this app logic
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, {
                        temps: [],
                        condition: item.weather[0].main,
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
        } catch (e) {
            console.error('Failed to fetch forecast:', e);
        }

        // Get air quality data (requires lat/lon)
        let airQuality: AirQuality | undefined;
        try {
            const aqResponse = await axios.get(`${OPENWEATHER_BASE_URL}/air_pollution`, {
                params: {
                    lat: data.coord.lat,
                    lon: data.coord.lon,
                    appid: apiKey
                }
            });

            const aqData = aqResponse.data.list[0];
            // const t = locales[lang];
            // const aqiLabels = t.aqi.levels;
            airQuality = {
                aqi: aqData.main.aqi,
                // aqiLabel: aqiLabels[aqData.main.aqi - 1] || t.aqi.unknown,
                pm25: Math.round(aqData.components.pm2_5),
                pm10: Math.round(aqData.components.pm10),
                o3: Math.round(aqData.components.o3),
                no2: Math.round(aqData.components.no2)
            };
        } catch (e) {
            console.error('Failed to fetch air quality:', e);
        }

        const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

        return {
            city: data.name,
            temperature: Math.round(data.main.temp),
            condition: data.weather[0].main,
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
            source: 'OpenWeatherMap'
        };
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from OpenWeatherMap: ${error.response?.data?.message || error.message}`);
    }
};

const fetchWeatherAPI = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<WeatherData> => {
    console.log('Using WeatherAPI.com', lang);
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    try {
        const response = await axios.get(`${WEATHERAPI_BASE_URL}/forecast.json`, {
            params: {
                key: apiKey,
                q: city,
                days: 7,
                aqi: 'yes',
                alerts: 'no',
                lang: lang
            }
        });

        const data = response.data;
        const current = data.current;
        const forecast = data.forecast.forecastday;

        const hourlyForecast: HourlyForecast[] = forecast[0].hour.filter((_: any, i: number) => i % 3 === 0).slice(0, 8).map((item: any) => ({
            time: new Date(item.time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            temperature: Math.round(item.temp_c),
            condition: item.condition.text,
            icon: item.condition.icon
        }));

        const dailyForecast: DailyForecast[] = forecast.map((item: any) => {
            return {
                date: item.date, // YYYY-MM-DD
                tempMin: Math.round(item.day.mintemp_c),
                tempMax: Math.round(item.day.maxtemp_c),
                condition: item.day.condition.text,
                icon: item.day.condition.icon
            };
        });

        // Map US AQI to 1-5 scale roughly
        const usEpaIndex = current.air_quality ? current.air_quality['us-epa-index'] : 1;
        // const aqiLabels = t.aqi.levels;

        // Check if we can fetch yesterday's weather
        try {
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const dt = yesterdayDate.toISOString().substring(0, 10);

            const historyResponse = await axios.get(`${WEATHERAPI_BASE_URL}/history.json`, {
                params: {
                    key: apiKey,
                    q: city,
                    dt: dt
                }
            });

            const historyData = historyResponse.data.forecast.forecastday[0];
            if (historyData) {
                dailyForecast.unshift({
                    date: historyData.date, // YYYY-MM-DD
                    // dayName: t.date.relative.yesterday,
                    tempMin: Math.round(historyData.day.mintemp_c),
                    tempMax: Math.round(historyData.day.maxtemp_c),
                    condition: historyData.day.condition.text,
                    icon: historyData.day.condition.icon
                });
            }
        } catch (e) {
            console.error('Failed to fetch WeatherAPI history:', e);
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
                // aqiLabel: aqiLabels[(usEpaIndex || 1) - 1] || t.aqi.unknown,
                pm25: Math.round(current.air_quality?.pm2_5 || 0),
                pm10: Math.round(current.air_quality?.pm10 || 0),
                o3: Math.round(current.air_quality?.o3 || 0),
                no2: Math.round(current.air_quality?.no2 || 0)
            },
            source: 'WeatherAPI.com'
        };
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from WeatherAPI: ${error.response?.data?.error?.message || error.message}`);
    }
};

const fetchQWeather = async (city: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<WeatherData> => {
    console.log('Using QWeather API', lang);
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    try {
        // Need to lookup Location ID first
        const geoResponse = await axios.get(`https://geoapi.qweather.com/v2/city/lookup`, {
            params: {
                location: city,
                key: apiKey,
                lang: lang
            }
        });

        if (geoResponse.data.code !== '200') {
            throw new Error(`Location not found: ${geoResponse.data.code}`);
        }

        const locationId = geoResponse.data.location[0].id;
        const cityName = geoResponse.data.location[0].name;

        // Parallel requests for weather data
        const [nowRes, dailyRes, hourlyRes, airRes, sunRes] = await Promise.all([
            axios.get(`${QWEATHER_BASE_URL}/weather/now`, { params: { location: locationId, key: apiKey, lang: lang } }),
            axios.get(`${QWEATHER_BASE_URL}/weather/7d`, { params: { location: locationId, key: apiKey, lang: lang } }),
            axios.get(`${QWEATHER_BASE_URL}/weather/24h`, { params: { location: locationId, key: apiKey, lang: lang } }),
            axios.get(`${QWEATHER_BASE_URL}/air/now`, { params: { location: locationId, key: apiKey, lang: lang } }),
            axios.get(`${QWEATHER_BASE_URL}/astronomy/sun`, { params: { location: locationId, key: apiKey, date: new Date().toISOString().substring(0, 10), lang: lang } })
        ]);

        const now = nowRes.data.now;
        const daily = dailyRes.data.daily;
        const hourly = hourlyRes.data.hourly;
        const air = airRes.data.now;
        const sun = sunRes.data;

        // QWeather Icons mapping needs actual icon URLs or local assets. 
        // For now using OpenWeatherMap icons or generic names? 
        // Or we can rely on numbers and map them in frontend, but here we return strings.
        // Let's just pass the icon code, assuming frontend handles it or we map common ones.
        // Actually the current app uses some icon strings. 'cloud', 'sun' etc or OpenWeatherMap icon codes.
        // Let's try to map some QWeather codes to OpenWeather-style descriptions or keep them simple.
        // Ideally we should use the icon code provided by QWeather and handle it in UI.
        // But to keep compatibility with current UI which might expect specific strings... 
        // The WeatherCard.tsx probably uses weather icon component or image.
        // Let's check WeatherCard.tsx later. For now, pass the condition text.

        const hourlyForecast: HourlyForecast[] = hourly.filter((_: any, i: number) => i % 3 === 0).slice(0, 8).map((item: any) => ({
            time: new Date(item.fxTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            temperature: parseInt(item.temp),
            condition: item.text,
            icon: item.icon // QWeather icon code
        }));

        const dailyForecast: DailyForecast[] = daily.map((item: any) => {
            // const date = new Date(item.fxDate);
            return {
                date: item.fxDate, // YYYY-MM-DD
                // dayName,
                tempMin: parseInt(item.tempMin),
                tempMax: parseInt(item.tempMax),
                condition: item.textDay,
                icon: item.iconDay
            };
        });

        return {
            city: cityName,
            temperature: parseInt(now.temp),
            condition: now.text,
            humidity: parseInt(now.humidity),
            windSpeed: parseInt(now.windSpeed) / 3.6, // km/h to m/s. Wait, QWeather is km/h? yes.
            feelsLike: parseInt(now.feelsLike),
            pressure: parseInt(now.pressure),
            visibility: parseInt(now.vis),
            uvIndex: 0, // Not in basic weather/now
            sunrise: sun.sunrise,
            sunset: sun.sunset,
            hourlyForecast,
            dailyForecast,
            airQuality: {
                aqi: parseInt(air.aqi),
                // aqiLabel: air.category,
                pm25: parseInt(air.pm2p5),
                pm10: parseInt(air.pm10),
                o3: parseInt(air.o3),
                no2: parseInt(air.no2)
            },
            source: 'QWeather'
        };

    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from QWeather: ${error.response?.data?.code || error.message}`);
    }
};

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
        // Basic validation to ensure it looks like WeatherData
        if (!data.city || !data.temperature || !data.hourlyForecast || !data.dailyForecast) {
            throw new Error('Response does not match WeatherData interface');
        }

        return data as WeatherData;
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch from Custom URL: ${error.response?.data?.message || error.message}`);
    }
};

export const getWeather = async (city: string, preferredSource?: string, lang: 'zh' | 'en' = 'zh'): Promise<WeatherData> => {
    const settings = await getSettings();
    console.log('Current settings:', settings);

    if (settings.source === 'custom' && settings.customUrl) {
        return fetchCustom(city, settings.customUrl, settings.apiKeys.custom, lang);
    }

    const sourceToUse = preferredSource || settings.source;

    // Cast sourceToUse to allow indexing if it matches one of the known keys
    if (sourceToUse && (sourceToUse in settings.apiKeys)) {
        const apiKey = settings.apiKeys[sourceToUse as keyof typeof settings.apiKeys];

        if (!apiKey) {
            throw new Error(`API key for ${sourceToUse} is invalid or missing.`);
        }

        switch (sourceToUse) {
            case 'openweathermap':
                return fetchOpenWeatherMap(city, apiKey, lang);
            case 'weatherapi':
                return fetchWeatherAPI(city, apiKey, lang);
            case 'qweather':
                return fetchQWeather(city, apiKey, lang);
            default:
                throw new Error('Unknown weather source');
        }
    }

    throw new Error('Please configure a weather source and API key in settings.');
};

export interface CityResult {
    name: string;
    region?: string;
    country?: string;
    lat: number;
    lon: number;
    id?: string; // For QWeather
}

const searchOpenWeatherMap = async (query: string, apiKey: string): Promise<CityResult[]> => {
    try {
        const response = await axios.get(`https://api.openweathermap.org/geo/1.0/direct`, {
            params: {
                q: query,
                limit: 5,
                appid: apiKey
            }
        });
        return response.data.map((item: any) => ({
            name: item.name,
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

const searchQWeather = async (query: string, apiKey: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> => {
    try {
        const response = await axios.get(`https://geoapi.qweather.com/v2/city/lookup`, {
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

export const searchCities = async (query: string, lang: 'zh' | 'en' = 'zh'): Promise<CityResult[]> => {
    const settings = await getSettings();
    if (!settings.source || !settings.apiKeys[settings.source]) return [];

    const apiKey = settings.apiKeys[settings.source]!;

    switch (settings.source) {
        case 'openweathermap':
            return searchOpenWeatherMap(query, apiKey); // OWM search doesn't support lang clearly like others, but returns local names if available
        case 'weatherapi':
            return searchWeatherAPI(query, apiKey);
        case 'qweather':
            return searchQWeather(query, apiKey, lang);
        default:
            return [];
    }
};
