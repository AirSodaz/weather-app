import { storage } from './storage';

export type WeatherSource = 'openweathermap' | 'weatherapi' | 'qweather' | 'custom';

export type DetailSectionId = 'hourly' | 'daily' | 'airQuality' | 'stats' | 'sunrise';

export interface SectionConfig {
    id: DetailSectionId;
    visible: boolean;
}

export interface AppSettings {
    source: WeatherSource;
    customUrl?: string;
    apiKeys: {
        openweathermap?: string;
        weatherapi?: string;
        qweather?: string;
        custom?: string;
    };
    qweatherHost?: string; // Optional custom host for QWeather
    autoRefreshInterval: number; // in minutes, 0 = off
    startupView: 'home' | 'detail';
    detailViewSections: SectionConfig[];
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
    ]
};

export const getSettings = async (): Promise<AppSettings> => {
    const settings = await storage.get('settings');
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

    // Deep merge apiKeys to preserve defaults (env vars) if not present in settings
    mergedSettings.apiKeys = {
        ...DEFAULT_SETTINGS.apiKeys,
        ...(settings?.apiKeys || {})
    };

    // If stored key is empty but env var exists, prefer env var
    // This fixes the case where an empty key might have been saved
    if (!mergedSettings.apiKeys.qweather && DEFAULT_SETTINGS.apiKeys.qweather) {
        mergedSettings.apiKeys.qweather = DEFAULT_SETTINGS.apiKeys.qweather;
    }

    return mergedSettings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    await storage.set('settings', settings);
};
