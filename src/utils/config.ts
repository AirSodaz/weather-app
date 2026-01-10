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
    autoRefreshInterval: number; // in minutes, 0 = off
    startupView: 'home' | 'detail';
    detailViewSections: SectionConfig[];
}

const DEFAULT_SETTINGS: AppSettings = {
    source: 'openweathermap',
    customUrl: '',
    apiKeys: {
        openweathermap: import.meta.env.VITE_OPENWEATHER_API_KEY || ''
    },
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
    return { ...DEFAULT_SETTINGS, ...settings };
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    await storage.set('settings', settings);
};
