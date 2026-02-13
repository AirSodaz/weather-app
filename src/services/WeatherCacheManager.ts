import { storage } from '../utils/storage';

const CACHE_KEY = 'weather_cache_v1';
const CACHE_SAVE_DEBOUNCE_MS = 2000;

/**
 * Represents a cached weather data entry.
 * Using generic T for data type to avoid circular dependency before type extraction.
 */
export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    lang: string;
    source: string;
    timeFormat?: '24h' | '12h';
}

export interface WeatherCacheStore<T = any> {
    [key: string]: CacheEntry<T>;
}

export class WeatherCacheManager {
    private memoryCache: WeatherCacheStore | null = null;
    private loadPromise: Promise<WeatherCacheStore> | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    private static instance: WeatherCacheManager;

    private constructor() {}

    public static getInstance(): WeatherCacheManager {
        if (!WeatherCacheManager.instance) {
            WeatherCacheManager.instance = new WeatherCacheManager();
        }
        return WeatherCacheManager.instance;
    }

    /**
     * Loads the weather cache from storage or memory.
     */
    async get(): Promise<WeatherCacheStore> {
        if (this.memoryCache) return this.memoryCache;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const c = await storage.get(CACHE_KEY);
                this.memoryCache = c || {};
            } catch (e) {
                console.error('Failed to load weather cache:', e);
                this.memoryCache = {};
            }
            return this.memoryCache!;
        })();
        return this.loadPromise;
    }

    /**
     * Persists the cache to storage with debouncing.
     */
    save(cache: WeatherCacheStore) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(async () => {
            this.saveTimeout = null;
            try {
                await storage.set(CACHE_KEY, cache);
            } catch (e) {
                console.warn('Failed to save weather cache:', e);
            }
        }, CACHE_SAVE_DEBOUNCE_MS);
    }

    /**
     * Helper to get cached weather data.
     */
    async getWeather<T = any>(
        key: string,
        ttl: number,
        currentTimeFormat: '24h' | '12h'
    ): Promise<T | null> {
        try {
            const cache = await this.get();
            const now = Date.now();

            if (cache[key]) {
                const entry = cache[key];
                const isFormatMatch = entry.timeFormat === currentTimeFormat;

                if (now - entry.timestamp < ttl && isFormatMatch) {
                    console.log(`[Cache Hit] Returning cached weather data for ${key}`);
                    return entry.data as T;
                } else {
                    delete cache[key]; // Clean up expired
                }
            }
        } catch (e) {
            console.warn('Cache check failed:', e);
        }
        return null;
    }

    /**
     * Helper to set weather data to cache.
     */
    async setWeather<T = any>(
        key: string,
        data: T,
        lang: string,
        source: string,
        currentTimeFormat: '24h' | '12h'
    ): Promise<void> {
        try {
            const cache = await this.get();
            cache[key] = {
                data: data,
                timestamp: Date.now(),
                lang,
                source,
                timeFormat: currentTimeFormat
            };
            this.save(cache);
        } catch (e) {
            console.warn('Failed to update cache:', e);
        }
    }
}

export const weatherCacheManager = WeatherCacheManager.getInstance();
