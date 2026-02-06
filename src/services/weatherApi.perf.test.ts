import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeather } from './weatherApi';
import { storage } from '../utils/storage';
import axios from 'axios';

// Mocks
vi.mock('../utils/storage', () => ({
    storage: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock('../utils/config', () => ({
    getSettings: vi.fn().mockResolvedValue({
        source: 'openweathermap',
        apiKeys: { openweathermap: 'test-key' },
        autoRefreshInterval: 15,
        timeFormat: '24h'
    })
}));

vi.mock('axios');

describe('WeatherApi Performance', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Setup default mock responses
        (storage.get as any).mockResolvedValue({});
        (storage.set as any).mockResolvedValue(undefined);
        (axios.get as any).mockResolvedValue({
            data: {
                name: 'TestCity',
                main: { temp: 20, humidity: 50, feels_like: 18, pressure: 1013 },
                weather: [{ description: 'Sunny', icon: '01d' }],
                wind: { speed: 5 },
                visibility: 10000,
                sys: { sunrise: 1613450000, sunset: 1613490000 },
                coord: { lat: 51.5, lon: -0.1 }
            }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('measures storage writes during concurrent updates', async () => {
        const cities = ['London', 'Paris', 'Berlin', 'Madrid', 'Rome'];

        // Mock unique return for each city
        (axios.get as any).mockImplementation((_url: string, config: any) => {
             return Promise.resolve({
                data: {
                    name: config?.params?.q || 'City',
                    main: { temp: 20, humidity: 50, feels_like: 18, pressure: 1013 },
                    weather: [{ description: 'Sunny', icon: '01d' }],
                    wind: { speed: 5 },
                    visibility: 10000,
                    sys: { sunrise: 1613450000, sunset: 1613490000 },
                    coord: { lat: 51.5, lon: -0.1 }
                }
            });
        });

        console.log('Starting parallel requests...');
        await Promise.all(cities.map(city => getWeather(city)));

        // Should be 0 initially due to debounce
        let setCalls = (storage.set as any).mock.calls.filter((call: any[]) => call[0] === 'weather_cache_v1').length;
        console.log(`Storage set calls (immediate): ${setCalls}`);
        expect(setCalls).toBe(0);

        // Advance timers to trigger debounce
        vi.advanceTimersByTime(2500);

        setCalls = (storage.set as any).mock.calls.filter((call: any[]) => call[0] === 'weather_cache_v1').length;
        console.log(`Storage set calls (after debounce): ${setCalls}`);
        expect(setCalls).toBe(1);
    });
});
