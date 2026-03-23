/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    getSettingsSync: vi.fn(() => ({
        source: 'openweathermap',
        autoRefreshInterval: 0,
        enableAutoLocation: true,
    })),
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

// Mock dnd-kit sensors
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


// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('WeatherDashboard Auto Location', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mocks
        (useI18n as any).mockReturnValue({
            t: {
                refresh: { button: 'Refresh', refreshing: 'Refreshing...', lastUpdate: 'Last Update' },
                settings: { title: 'Settings' },
                search: { loading: 'Loading...', cityExists: 'City exists', locating: 'Finding your location...' },
                empty: { title: 'Empty', subtitle: 'Add a city' },
                contextMenu: { viewDetails: 'Details' },
                remove: 'Remove',
                errors: { loadFailed: 'Failed', locationDenied: 'Location denied', locationError: 'Location error' }
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
            enableAutoLocation: true,
        });

        Object.defineProperty(global.navigator, 'geolocation', {
            value: {
                getCurrentPosition: vi.fn()
            },
            writable: true
        });
    });

    it('should attempt auto-location when no cities are saved and hasAutoLocated is false', async () => {
        // Setup initial storage state
        (storage.get as any).mockImplementation((key: string) => {
            if (key === 'savedCities') return Promise.resolve([]);
            if (key === 'hasAutoLocated') return Promise.resolve(false);
            return Promise.resolve(null);
        });

        const mockGetCurrentPosition = vi.fn().mockImplementation((success, _, __) => {
            success({
                coords: { latitude: 40.7128, longitude: -74.0060 }
            });
        });
        global.navigator.geolocation.getCurrentPosition = mockGetCurrentPosition;

        (getWeather as any).mockResolvedValue({
            city: 'New York',
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
            lat: 40.7128,
            lon: -74.0060,
            source: 'openweathermap'
        });

        render(<WeatherDashboard />);

        // We don't need to await the locator text specifically, sometimes it renders instantly and completes before the await triggers
        // Wait for weather card to appear instead
        await waitFor(() => {
            expect(screen.getAllByText('New York').length).toBeGreaterThan(0);
        });

        // Verify storage set for hasAutoLocated
        expect(storage.setAsync).toHaveBeenCalledWith('hasAutoLocated', true);

        // Verify storage set for saved cities
        expect(storage.setAsync).toHaveBeenCalledWith('savedCities', expect.arrayContaining([
            expect.objectContaining({ name: 'New York' })
        ]));
    });

    it('should NOT attempt auto-location if hasAutoLocated is true', async () => {
        (storage.get as any).mockImplementation((key: string) => {
            if (key === 'savedCities') return Promise.resolve([]);
            if (key === 'hasAutoLocated') return Promise.resolve(true); // Already located
            return Promise.resolve(null);
        });

        const mockGetCurrentPosition = vi.fn();
        global.navigator.geolocation.getCurrentPosition = mockGetCurrentPosition;

        render(<WeatherDashboard />);

        // Give it time to potentially run
        await waitFor(() => {
            expect(mockGetCurrentPosition).not.toHaveBeenCalled();
        });
    });
});
