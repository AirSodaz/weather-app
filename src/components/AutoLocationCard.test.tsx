import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AutoLocationCard from './AutoLocationCard';
import { WeatherData } from '../services/weatherApi';

/** @vitest-environment jsdom */

const mockWeatherData: WeatherData = {
    city: 'New York',
    temperature: 20,
    condition: 'Sunny',
    humidity: 50,
    windSpeed: 10,
    isOffline: false,
    hourlyForecast: [],
    dailyForecast: [],
    feelsLike: 20,
    pressure: 1012,
    visibility: 10,
    uvIndex: 5,
    lat: 40.7128,
    lon: -74.0060
};

describe('AutoLocationCard', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders "Locating..." state', () => {
        render(
            <AutoLocationCard
                weatherData={null}
                status="locating"
                errorMsg={null}
                onClick={() => {}}
            />
        );
        expect(screen.getByText('Locating...')).toBeDefined();
        expect(screen.getByText('Finding your location...')).toBeDefined();
    });

    it('renders error state and search button when location denied and no cache', () => {
        const onFocusSearch = vi.fn();
        render(
            <AutoLocationCard
                weatherData={null}
                status="denied"
                errorMsg="Location access denied"
                onClick={() => {}}
                onFocusSearch={onFocusSearch}
            />
        );
        expect(screen.getByText('Location access denied')).toBeDefined();
        const searchBtn = screen.getByText('Search City');
        expect(searchBtn).toBeDefined();

        fireEvent.click(searchBtn);
        expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it('renders weather data successfully', () => {
        const onClick = vi.fn();
        render(
            <AutoLocationCard
                weatherData={mockWeatherData}
                status="success"
                errorMsg={null}
                onClick={onClick}
            />
        );
        expect(screen.getByText('Current Location')).toBeDefined();
        // The WeatherCard should render the city name with zero-width spaces
        const cityElements = screen.getAllByText(/New York/);
        expect(cityElements.length).toBeGreaterThan(0);

        // Simulating a click on the card wrapper
        const cardWrapper = screen.getByText('Current Location').parentElement;
        if (cardWrapper) fireEvent.click(cardWrapper);

        expect(onClick).toHaveBeenCalledWith(mockWeatherData);
    });

    it('renders cached location with warning', () => {
        render(
            <AutoLocationCard
                weatherData={mockWeatherData}
                status="cached"
                errorMsg="Location denied, using last known"
                onClick={() => {}}
            />
        );
        expect(screen.getByText('Last Known Location')).toBeDefined();
        expect(screen.getByText('Location denied, using last known')).toBeDefined();
        const cityElements = screen.getAllByText(/New York/);
        expect(cityElements.length).toBeGreaterThan(0);
    });
});
