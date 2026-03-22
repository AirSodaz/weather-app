import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AutoLocationCard from './AutoLocationCard';
import { WeatherData } from '../services/weatherApi';

/** @vitest-environment jsdom */

const mockWeatherData: WeatherData = {
    city: 'Current Location',
    temperature: 20,
    condition: 'Sunny',
    humidity: 50,
    windSpeed: 10,
    feelsLike: 22,
    pressure: 1012,
    visibility: 10,
    uvIndex: 5,
    hourlyForecast: [],
    dailyForecast: [],
    lat: 0,
    lon: 0,
    isAutoLocation: true,
};

describe('AutoLocationCard', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders locating state correctly', () => {
        const props = {
            weather: { ...mockWeatherData, condition: '', autoLocationStatus: 'locating' as const },
            onClick: vi.fn(),
            onManualSearch: vi.fn(),
        };
        render(<AutoLocationCard {...props} />);

        expect(screen.getByText('Locating...')).toBeDefined();
        expect(screen.getByText('Fetching your location...')).toBeDefined();
    });

    it('renders success state correctly', () => {
        const props = {
            weather: { ...mockWeatherData, city: 'London', autoLocationStatus: 'success' as const },
            onClick: vi.fn(),
            onManualSearch: vi.fn(),
        };
        render(<AutoLocationCard {...props} />);

        expect(screen.getByText('Current Location')).toBeDefined();
        // Since WeatherCard is nested and handles city display, we expect it to render
        expect(screen.getByText('London')).toBeDefined();
    });

    it('renders error state correctly', () => {
        const props = {
            weather: { ...mockWeatherData, condition: '', autoLocationStatus: 'error' as const },
            onClick: vi.fn(),
            onManualSearch: vi.fn(),
        };
        render(<AutoLocationCard {...props} />);

        expect(screen.getByText('Location error')).toBeDefined();
        expect(screen.getByText('Unable to determine location. Please search manually.')).toBeDefined();
    });

    it('renders denied state correctly', () => {
        const props = {
            weather: { ...mockWeatherData, condition: '', autoLocationStatus: 'denied' as const },
            onClick: vi.fn(),
            onManualSearch: vi.fn(),
        };
        render(<AutoLocationCard {...props} />);

        expect(screen.getByText('Location denied')).toBeDefined();
        expect(screen.getByText('Unable to determine location. Please search manually.')).toBeDefined();
    });

    it('renders fallback state correctly', () => {
        const props = {
            weather: { ...mockWeatherData, city: 'Paris', autoLocationStatus: 'fallback' as const },
            onClick: vi.fn(),
            onManualSearch: vi.fn(),
        };
        render(<AutoLocationCard {...props} />);

        expect(screen.getByText('Last known location')).toBeDefined();
        expect(screen.getByText('Paris')).toBeDefined();
    });

    it('calls onManualSearch when search button is clicked', () => {
        const onManualSearch = vi.fn();
        const props = {
            weather: { ...mockWeatherData, autoLocationStatus: 'error' as const },
            onClick: vi.fn(),
            onManualSearch,
        };
        render(<AutoLocationCard {...props} />);

        const searchButton = screen.getByTitle('Search manually');
        fireEvent.click(searchButton);

        expect(onManualSearch).toHaveBeenCalled();
    });
});
