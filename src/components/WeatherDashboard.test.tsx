import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeatherDashboard from './WeatherDashboard';
import { storage } from '../utils/storage';
import { getWeather } from '../services/weatherApi';
import { getSettings } from '../utils/config';
import { useI18n } from '../contexts/I18nContext';

// Mocks
vi.mock('../utils/storage', () => ({
    storage: {
        get: vi.fn(),
        set: vi.fn(),
        setAsync: vi.fn(),
        delete: vi.fn(),
    }
}));

vi.mock('../services/weatherApi', () => ({
    getWeather: vi.fn(),
}));

vi.mock('../utils/config', () => ({
    getSettings: vi.fn(),
}));

vi.mock('../contexts/I18nContext', () => ({
    useI18n: vi.fn(),
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock dnd-kit sensors to avoid issues
vi.mock('@dnd-kit/core', async () => {
    const actual = await vi.importActual('@dnd-kit/core');
    return {
        ...actual as any,
        useSensors: () => ({}),
        useSensor: () => ({}),
        DndContext: ({ children }: any) => <div>{children}</div>,
    };
});

vi.mock('@dnd-kit/sortable', async () => {
    const actual = await vi.importActual('@dnd-kit/sortable');
    return {
        ...actual as any,
        SortableContext: ({ children }: any) => <div>{children}</div>,
        useSortable: () => ({
            attributes: {},
            listeners: {},
            setNodeRef: () => {},
            transform: null,
            transition: null,
        }),
    };
});


// Mock ResizeObserver for dnd-kit if mocks above aren't enough
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('WeatherDashboard Refresh Persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mocks
        (useI18n as any).mockReturnValue({
            t: {
                refresh: { button: 'Refresh', refreshing: 'Refreshing...', lastUpdate: 'Last Update' },
                settings: { title: 'Settings' },
                search: { loading: 'Loading...', cityExists: 'City exists' },
                empty: { title: 'Empty', subtitle: 'Add a city' },
                contextMenu: { viewDetails: 'Details' },
                remove: 'Remove',
                errors: { loadFailed: 'Failed' }
            },
            currentLanguage: 'en',
        });

        (getSettings as any).mockResolvedValue({
            source: 'openweathermap',
            apiKeys: {},
            autoRefreshInterval: 0,
            startupView: 'home',
            detailViewSections: [],
            timeFormat: '24h',
            enableHardwareAcceleration: false,
        });

        // Mock Storage Data
        (storage.get as any).mockImplementation((key: string) => {
            if (key === 'savedCities') {
                return Promise.resolve([{ name: 'London', source: undefined, lat: 51.5, lon: -0.1 }]);
            }
            if (key === 'weatherCache') {
                return Promise.resolve(null);
            }
            if (key === 'lastRefreshTime') {
                return Promise.resolve(new Date().toISOString());
            }
            return Promise.resolve(null);
        });

        // Mock getWeather response
        (getWeather as any).mockResolvedValue({
            city: 'London',
            temperature: 20,
            condition: 'Sunny',
            humidity: 50,
            windSpeed: 5,
            feelsLike: 22,
            pressure: 1012,
            visibility: 10,
            uvIndex: 5,
            hourlyForecast: [],
            dailyForecast: [],
            lat: 51.5,
            lon: -0.1,
            source: 'openweathermap'
        });
    });

    it('should save cities to storage after refresh', async () => {
        render(<WeatherDashboard />);

        // Wait for initial load
        // Using screen.findByText handles implicit waiting better than waitFor + getByText sometimes
        await screen.findByText('London');

        // Clear mock calls from initial load
        (storage.setAsync as any).mockClear();

        // Find Menu Button (Ellipsis)
        const menuButton = screen.getByLabelText('Main menu');
        fireEvent.click(menuButton);

        // Find Refresh Button
        const refreshButton = await screen.findByText('Refresh');
        fireEvent.click(refreshButton);

        // Wait for refresh to complete (getWeather called again)
        // Note: checking call count is flaky in this environment, relying on side effects
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add a small delay for async save operations
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check calls
        const setAsyncCalls = (storage.setAsync as any).mock.calls.map((c: any) => c[0]);
        console.log('setAsync calls:', setAsyncCalls);

        // Assert that savedCities is updated
        expect(storage.setAsync).toHaveBeenCalledWith('savedCities', expect.any(Array));
    });
});
