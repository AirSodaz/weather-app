/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeatherCard from './WeatherCard';
import { WeatherData } from '../services/weatherApi';

// Mock WeatherIcon to avoid complexity
vi.mock('./WeatherIcon', () => ({
    default: ({ condition }: { condition: string }) => <div data-testid="weather-icon">{condition}</div>
}));

describe('WeatherCard Accessibility', () => {
    const mockWeather: WeatherData = {
        city: 'London',
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
        lat: 51.5,
        lon: -0.1,
        source: 'openweathermap'
    };

    it('renders the actions button with a descriptive aria-label including city name', () => {
        render(<WeatherCard weather={mockWeather} onShowActions={() => {}} />);

        // We expect the label to be "More actions for London"
        const button = screen.getByLabelText('More actions for London');
        expect(button).toBeTruthy();
    });
});
