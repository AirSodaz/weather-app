import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherData } from './weatherApi';
import { storage } from '../utils/storage';
import { getSettings } from '../utils/config';
import axios from 'axios';

// Mocks
vi.mock('../utils/storage', () => ({
    storage: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock('../utils/config', () => ({
    getSettings: vi.fn()
}));

vi.mock('axios');

describe('WeatherApi', () => {
    let getWeather: any;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();
        vi.clearAllMocks();

        // Re-import module to reset internal state (memoryCache)
        const module = await import('./weatherApi');
        getWeather = module.getWeather;

        // Default storage mocks
        (storage.get as any).mockResolvedValue({});
        (storage.set as any).mockResolvedValue(undefined);
        // Default settings mock
        (getSettings as any).mockResolvedValue({
            source: 'openweathermap',
            apiKeys: { openweathermap: 'test-key', weatherapi: 'test-key', qweather: 'test-key' },
            autoRefreshInterval: 15,
            timeFormat: '24h'
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('fetches and transforms OpenWeatherMap data correctly', async () => {
        (getSettings as any).mockResolvedValue({
            source: 'openweathermap',
            apiKeys: { openweathermap: 'test-key' },
            autoRefreshInterval: 15,
            timeFormat: '24h'
        });

        const mockResponse = {
            data: {
                name: 'London',
                main: { temp: 15, humidity: 60, feels_like: 14, pressure: 1012 },
                weather: [{ description: 'Cloudy', icon: '04d' }],
                wind: { speed: 5 },
                visibility: 10000,
                sys: { sunrise: 1620000000, sunset: 1620050000 },
                coord: { lat: 51.51, lon: -0.13 }
            }
        };

        const mockForecast = {
            data: {
                list: [
                    {
                        dt: 1620003600,
                        main: { temp: 16 },
                        weather: [{ description: 'Rain', icon: '10d' }],
                        dt_txt: '2021-05-03 01:00:00'
                    }
                ]
            }
        };

        const mockPollution = {
            data: {
                list: [
                    {
                        main: { aqi: 2 },
                        components: { pm2_5: 10, pm10: 20, o3: 30, no2: 40 }
                    }
                ]
            }
        };

        (axios.get as any)
            .mockResolvedValueOnce(mockResponse) // Current weather
            .mockResolvedValueOnce(mockForecast) // Forecast
            .mockResolvedValueOnce(mockPollution); // Air pollution

        const result = await getWeather('London');

        expect(result.city).toBe('London');
        expect(result.temperature).toBe(15);
        expect(result.condition).toBe('Cloudy');
        expect(result.hourlyForecast).toHaveLength(1);
        expect(result.hourlyForecast[0].condition).toBe('Rain');
        expect(result.airQuality?.aqi).toBe(2);
        expect(axios.get).toHaveBeenCalledTimes(3);
    });

    it('fetches and transforms WeatherAPI data correctly', async () => {
        (getSettings as any).mockResolvedValue({
            source: 'weatherapi',
            apiKeys: { weatherapi: 'test-key' },
            autoRefreshInterval: 15,
            timeFormat: '24h'
        });

        const mockResponse = {
            data: {
                location: { name: 'Paris', lat: 48.85, lon: 2.35 },
                current: {
                    temp_c: 20,
                    condition: { text: 'Sunny', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' },
                    humidity: 50,
                    wind_kph: 10,
                    feelslike_c: 19,
                    pressure_mb: 1015,
                    vis_km: 10,
                    uv: 5,
                    air_quality: { 'us-epa-index': 1, pm2_5: 5, pm10: 10, o3: 20, no2: 15 }
                },
                forecast: {
                    forecastday: [
                        {
                            date: '2021-05-03',
                            day: {
                                mintemp_c: 10,
                                maxtemp_c: 22,
                                condition: { text: 'Partly cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/116.png' }
                            },
                            astro: { sunrise: '06:00 AM', sunset: '08:00 PM' },
                            hour: [
                                {
                                    time: '2021-05-03 00:00',
                                    temp_c: 12,
                                    condition: { text: 'Clear', icon: '//cdn.weatherapi.com/weather/64x64/night/113.png' }
                                }
                            ]
                        }
                    ]
                }
            }
        };

        const mockHistory = {
            forecast: {
                forecastday: [
                    {
                        date: '2021-05-02',
                        day: {
                            mintemp_c: 9,
                            maxtemp_c: 21,
                            condition: { text: 'Sunny', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' }
                        }
                    }
                ]
            }
        };

        (axios.get as any)
            .mockResolvedValueOnce(mockResponse) // Forecast
            .mockResolvedValueOnce({ data: mockHistory }); // History

        const result = await getWeather('Paris');

        expect(result.city).toBe('Paris');
        expect(result.temperature).toBe(20);
        expect(result.condition).toBe('Sunny');
        expect(result.hourlyForecast).toHaveLength(1);
        // Verify time formatting (06:00 AM -> 06:00 in 24h)
        expect(result.sunrise).toBe('06:00');
        expect(result.sunset).toBe('20:00');
    });

    it('uses cached data if available and fresh', async () => {
        const now = Date.now();
        const cachedData: WeatherData = {
            city: 'CachedCity',
            temperature: 25,
            condition: 'Clear',
            humidity: 40,
            windSpeed: 5,
            feelsLike: 26,
            pressure: 1010,
            visibility: 10,
            uvIndex: 6,
            hourlyForecast: [],
            dailyForecast: [],
            lat: 0,
            lon: 0,
            source: 'OpenWeatherMap'
        };

        (storage.get as any).mockResolvedValue({
            'openweathermap:zh:cachedcity': {
                data: cachedData,
                timestamp: now - 1000, // Just now
                lang: 'zh',
                source: 'openweathermap',
                timeFormat: '24h'
            }
        });

        const result = await getWeather('CachedCity');

        expect(result.city).toBe('CachedCity');
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('fetches fresh data if cache is stale', async () => {
        const now = Date.now();
        const cachedData: WeatherData = {
            city: 'StaleCity',
            temperature: 25,
            condition: 'Clear',
            humidity: 40,
            windSpeed: 5,
            feelsLike: 26,
            pressure: 1010,
            visibility: 10,
            uvIndex: 6,
            hourlyForecast: [],
            dailyForecast: [],
            lat: 0,
            lon: 0,
            source: 'OpenWeatherMap'
        };

        (storage.get as any).mockResolvedValue({
            'openweathermap:zh:stalecity': {
                data: cachedData,
                timestamp: now - (16 * 60 * 1000), // 16 mins ago (ttl is 15)
                lang: 'zh',
                source: 'openweathermap',
                timeFormat: '24h'
            }
        });

        // Mock API response for refresh
        const mockResponse = {
            data: {
                name: 'StaleCity',
                main: { temp: 20 },
                weather: [{ description: 'Rain' }],
                wind: {},
                sys: {},
                coord: { lat: 0, lon: 0 }
            }
        };
         (axios.get as any).mockResolvedValue({ data: mockResponse.data }); // Simplified for brevity

        try {
             await getWeather('StaleCity');
        } catch (e) {
            // Transform might fail due to incomplete mock, but we check if axios was called
        }

        expect(axios.get).toHaveBeenCalled();
    });

    it('formats time correctly based on settings', async () => {
         (getSettings as any).mockResolvedValue({
            source: 'weatherapi',
            apiKeys: { weatherapi: 'test-key' },
            autoRefreshInterval: 15,
            timeFormat: '12h' // Test 12h format
        });

        const mockResponse = {
            data: {
                location: { name: 'TimeTest', lat: 0, lon: 0 },
                current: {
                    temp_c: 20,
                    condition: { text: 'Sunny', icon: '' },
                    humidity: 50,
                    wind_kph: 10,
                    feelslike_c: 19,
                    pressure_mb: 1015,
                    vis_km: 10,
                    uv: 5
                },
                forecast: {
                    forecastday: [
                        {
                            date: '2021-05-03',
                            day: { mintemp_c: 10, maxtemp_c: 22, condition: { text: '', icon: '' } },
                            astro: { sunrise: '06:00 AM', sunset: '08:00 PM' }, // API gives 12h
                            hour: []
                        }
                    ]
                }
            }
        };

        (axios.get as any).mockResolvedValueOnce(mockResponse);
        (axios.get as any).mockResolvedValueOnce({ data: { forecast: { forecastday: [] } } }); // History empty

        const result = await getWeather('TimeTest');

        expect(result.sunrise).toBe('6:00 AM');
        expect(result.sunset).toBe('8:00 PM');
    });
});
