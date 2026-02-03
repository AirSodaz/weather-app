import { storage } from './storage';

/**
 * Supported weather data providers.
 */
export type WeatherSource = 'openweathermap' | 'weatherapi' | 'qweather' | 'custom';

/**
 * Identifiers for different sections in the weather detail view.
 */
export type DetailSectionId = 'hourly' | 'daily' | 'airQuality' | 'stats' | 'sunrise';

/**
 * Configuration for a detail view section.
 */
export interface SectionConfig {
    /** Unique identifier for the section. */
    id: DetailSectionId;
    /** Whether the section is currently visible. */
    visible: boolean;
}

/**
 * Application settings structure.
 */
export interface AppSettings {
    /** The currently selected weather data source. */
    source: WeatherSource;
    /** Custom API URL for the 'custom' source. */
    customUrl?: string;
    /** API keys for different providers. */
    apiKeys: {
        openweathermap?: string;
        weatherapi?: string;
        qweather?: string;
        custom?: string;
    };
    /** Optional custom host for QWeather (e.g., for dev/subscription tiers). */
    qweatherHost?: string;
    /** Auto-refresh interval in minutes. 0 indicates auto-refresh is disabled. */
    autoRefreshInterval: number;
    /** The preferred view to show on application startup. */
    startupView: 'home' | 'detail';
    /** Configuration for the order and visibility of detail view sections. */
    detailViewSections: SectionConfig[];
    /** Preferred time format. */
    timeFormat: '24h' | '12h';
    /** Whether to enable hardware acceleration for animations. */
    enableHardwareAcceleration: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    source: 'openweathermap',
    customUrl: '',
    apiKeys: {
        openweathermap: import.meta.env.VITE_OPENWEATHER_API_KEY || '',
        qweather: import.meta.env.VITE_QWEATHER_API_KEY || ''
    },
    qweatherHost: import.meta.env.VITE_QWEATHER_API_HOST || '',
    autoRefreshInterval: 0,
    startupView: 'detail',
    detailViewSections: [
        { id: 'hourly', visible: true },
        { id: 'daily', visible: true },
        { id: 'airQuality', visible: true },
        { id: 'stats', visible: true },
        { id: 'sunrise', visible: true }
    ],
    timeFormat: '24h',
    enableHardwareAcceleration: true
};

// Caching mechanism to avoid frequent storage reads (which involve worker messaging)
let cachedSettings: AppSettings | null = null;
let settingsPromise: Promise<AppSettings> | null = null;
let configVersion = 0;

/**
 * Retrieves the application settings from storage, merging with defaults.
 * Uses in-memory caching and promise deduplication to optimize performance.
 *
 * @returns {Promise<AppSettings>} A promise that resolves to the current application settings.
 */
export function getSettings(): Promise<AppSettings> {
    if (cachedSettings) {
        return Promise.resolve(cachedSettings);
    }

    if (settingsPromise) {
        return settingsPromise;
    }

    const currentVersion = configVersion;

    settingsPromise = (async () => {
        try {
            const settings = await storage.get('settings');
            const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

            // Deep merge apiKeys to preserve defaults (env vars) if not present in settings.
            mergedSettings.apiKeys = {
                ...DEFAULT_SETTINGS.apiKeys,
                ...(settings?.apiKeys || {})
            };

            // If stored key is empty but env var exists, prefer env var.
            // This fixes the case where an empty key might have been saved.
            if (!mergedSettings.apiKeys.qweather && DEFAULT_SETTINGS.apiKeys.qweather) {
                mergedSettings.apiKeys.qweather = DEFAULT_SETTINGS.apiKeys.qweather;
            }

            // Only update cache if version hasn't changed (no concurrent save)
            if (currentVersion === configVersion) {
                cachedSettings = mergedSettings;
            }

            return mergedSettings;
        } finally {
            // Only clear promise if version hasn't changed
            if (currentVersion === configVersion) {
                settingsPromise = null;
            }
        }
    })();

    return settingsPromise;
}

/**
 * Saves the application settings to storage.
 * Invalidates the in-memory cache to ensure consistency.
 *
 * @param {AppSettings} settings - The settings object to save.
 * @returns {Promise<void>} A promise that resolves when the settings are saved.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
    configVersion++; // Invalidate in-flight getSettings
    cachedSettings = null; // Invalidate cache
    settingsPromise = null; // Invalidate current promise
    await storage.set('settings', settings);
}
