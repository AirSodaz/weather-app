import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getWeather, WeatherData } from '../services/weatherApi';
import { getSettings } from '../utils/config';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { processWithConcurrency } from '../utils/asyncUtils';
import { arrayMove } from '@dnd-kit/sortable';

interface SavedCity {
    name: string;
    source?: string;
    lat?: number;
    lon?: number;
}

/**
 * Hook to manage the list of weather cities, including fetching, caching, and persistence.
 */
export function useWeatherList() {
    const { t, currentLanguage } = useI18n();
    const [weatherList, setWeatherList] = useState<WeatherData[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isAutoLocating, setIsAutoLocating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    // Optimization: Use ref to hold weatherList to stabilize callbacks
    const weatherListRef = useRef(weatherList);
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const weatherMap = useMemo(() => {
        const map = new Map<string, WeatherData>();
        for (const w of weatherList) {
            map.set(w.city, w);
        }
        return map;
    }, [weatherList]);

    const weatherCitiesSet = useMemo(() => {
        const set = new Set<string>();
        for (const w of weatherList) {
            set.add(w.city.toLowerCase());
        }
        return set;
    }, [weatherList]);

    useEffect(() => {
        weatherListRef.current = weatherList;
    }, [weatherList]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    /**
     * Updates the list of saved cities in storage based on the current weather list.
     */
    const updateSavedCities = async (list: WeatherData[]) => {
        const savedCities: SavedCity[] = list.map(w => ({
            name: w.city,
            source: w.sourceOverride,
            lat: w.lat,
            lon: w.lon
        }));
        await storage.setAsync('savedCities', savedCities);
    };

    /**
     * Generic helper to refresh a list of cities with concurrency.
     */
    const refreshCitiesGeneric = useCallback(async (
        listToRefresh: WeatherData[],
        transform: (weather: WeatherData) => Promise<WeatherData>,
        onComplete?: (updatedList: WeatherData[]) => Promise<void>
    ) => {
        if (listToRefresh.length === 0 || refreshing) return;

        setRefreshing(true);

        try {
            const results = await processWithConcurrency(
                listToRefresh,
                transform,
                5
            );

            const updateMap = new Map<string, WeatherData>();
            for (const u of results) {
                updateMap.set(u.city, u);
            }

            const updatedList = weatherListRef.current.map(w => updateMap.get(w.city) || w);
            setWeatherList(updatedList);

            setLastRefreshTime(new Date());
            if (onComplete) await onComplete(updatedList);

        } finally {
            setRefreshing(false);
        }
    }, [refreshing]);

    const refreshAllCities = useCallback(async () => {
        await refreshCitiesGeneric(weatherListRef.current, async (weather) => {
            try {
                const source = weather.sourceOverride;
                const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                const newData = await getWeather(weather.city, source, currentLanguage, coords);
                return { ...newData, sourceOverride: source };
            } catch (e) {
                console.error(`Failed to refresh weather for ${weather.city}`, e);
                return weather;
            }
        }, async (updatedList) => {
            await updateSavedCities(updatedList);
        });
    }, [refreshCitiesGeneric, currentLanguage]);

    const refreshDefaultSourceCities = useCallback(async () => {
        await refreshCitiesGeneric(weatherListRef.current, async (weather) => {
            if (weather.sourceOverride) return weather;
            try {
                const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                const newData = await getWeather(weather.city, undefined, currentLanguage, coords);
                return { ...newData, sourceOverride: undefined };
            } catch (e) {
                console.error(`Failed to refresh weather for ${weather.city}`, e);
                return weather;
            }
        }, async (updatedList) => {
            await updateSavedCities(updatedList);
        });
    }, [refreshCitiesGeneric, currentLanguage]);

    const setupAutoRefresh = useCallback(async () => {
        if (autoRefreshRef.current) {
            clearInterval(autoRefreshRef.current);
            autoRefreshRef.current = null;
        }
        const settings = await getSettings();
        if (settings.autoRefreshInterval > 0) {
            autoRefreshRef.current = setInterval(() => {
                refreshAllCities();
            }, settings.autoRefreshInterval * 60000);
        }
    }, [refreshAllCities]);

    const loadSavedCities = useCallback(async () => {
        try {
            // 1. Load Last Refresh Time
            const timeStr = await storage.get('lastRefreshTime');
            const savedLastRefreshTime = timeStr ? new Date(timeStr) : null;
            if (savedLastRefreshTime) setLastRefreshTime(savedLastRefreshTime);

            // 2. Load and Validate Cache
            const settings = await getSettings();
            const cache: any = await storage.get('weatherCache');
            const currentTimeFormat = settings.timeFormat || '24h';

            const isCacheValid = cache &&
                                 cache.data &&
                                 Array.isArray(cache.data) &&
                                 cache.lang === currentLanguage &&
                                 cache.timeFormat === currentTimeFormat;

            let cachedWeather = isCacheValid ? (cache.data as WeatherData[]) : null;
            if (cachedWeather) setWeatherList(cachedWeather);

            // 3. Determine Status
            const ttl = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
            const now = new Date();
            const isStale = !savedLastRefreshTime || (now.getTime() - savedLastRefreshTime.getTime() > ttl * 60000);

            if (!cachedWeather) setLoading(true);
            else if (isStale) setRefreshing(true);
            else {
                setLoading(false);
                setRefreshing(false);
            }

            // 4. Load Saved Cities List
            const savedData: (string | SavedCity)[] = (await storage.get('savedCities')) || [];
            if (savedData.length === 0) {
                setWeatherList([]);
                setLoading(false);
                setRefreshing(false);

                // Trigger auto-location if we have no saved cities and haven't tried before
                const hasAutoLocated = await storage.get('hasAutoLocated');
                if (!hasAutoLocated && settings.enableAutoLocation !== false) {
                    await storage.setAsync('hasAutoLocated', true);
                    // We don't await this so it runs in background and updates state when done
                    // Do not reject the promise completely so we don't cause an unhandled rejection,
                    // just catch and warn.
                    addCityByLocation().catch(e => console.warn('Auto-location on startup failed:', e));
                }

                return;
            }

            // 5. Fetch Data if needed
            const shouldFetch = !cachedWeather || isStale;

            if (shouldFetch) {
                const results = await processWithConcurrency(
                    savedData,
                    async (item): Promise<WeatherData | null> => {
                        const cityName = typeof item === 'string' ? item : item.name;
                        const source = typeof item === 'string' ? undefined : item.source;
                        const coords = typeof item === 'string' ? undefined : (item.lat && item.lon ? { lat: item.lat, lon: item.lon } : undefined);
                        try {
                            const data = await getWeather(cityName, source, currentLanguage, coords);
                            return { ...data, sourceOverride: source };
                        } catch (e) {
                            console.error(`Failed to load weather for ${cityName}`, e);
                            return null;
                        }
                    },
                    5
                );

                const validResults = results.filter((w): w is WeatherData => w !== null);
                if (validResults.length > 0) {
                    setWeatherList(validResults);
                    setLastRefreshTime(new Date());

                    // Sync names if changed
                    const newSavedData = savedData.map((item, idx) => {
                        const weather = results![idx];
                        if (!weather) return item;

                        const name = typeof item === 'string' ? item : item.name;
                        if (name !== weather.city) {
                            return typeof item === 'string' ? weather.city : { ...item, name: weather.city };
                        }
                        return item;
                    });

                    const hasChanges = savedData.some((item, i) => {
                         const oldName = typeof item === 'string' ? item : item.name;
                         const newName = typeof newSavedData[i] === 'string' ? newSavedData[i] : (newSavedData[i] as SavedCity).name;
                         return oldName !== newName;
                    });

                    if (hasChanges) {
                        storage.set('savedCities', newSavedData);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load saved cities", err);
            setError(t.errors?.loadFailed || "Failed to load");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentLanguage, t.errors]);

    const addCity = async (city: string): Promise<boolean> => {
        if (!city.trim()) return false;
        setError(null);
        setLoading(true);

        if (weatherCitiesSet.has(city.toLowerCase())) {
            setError(t.search.cityExists);
            setLoading(false);
            return false;
        }

        try {
            const data = await getWeather(city, undefined, currentLanguage);
            const newList = [...weatherList, data];
            setWeatherList(newList);
            await updateSavedCities(newList);
            setLastRefreshTime(new Date());
            return true;
        } catch (err) {
            setError(t.search.error);
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const addCityByLocation = async () => {
        setLoading(true);
        setIsAutoLocating(true);
        return new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        const data = await getWeather('', undefined, currentLanguage, { lat: latitude, lon: longitude });

                        if (weatherCitiesSet.has(data.city.toLowerCase())) {
                            setError(t.search.cityExists);
                        } else {
                            const newList = [...weatherList, data];
                            setWeatherList(newList);
                            await updateSavedCities(newList);
                            setLastRefreshTime(new Date());
                        }
                        resolve();
                    } catch (err) {
                        console.error("Geolocation weather fetch failed", err);
                        setError(t.errors?.locationError || "Failed to determine location");
                        resolve(); // Resolve anyway to avoid unhandled rejection
                    } finally {
                        setLoading(false);
                        setIsAutoLocating(false);
                    }
                },
                (err) => {
                    console.error("Geolocation error", err);
                    setError(t.errors?.locationDenied || "Location access denied or unavailable");
                    setLoading(false);
                    setIsAutoLocating(false);
                    resolve(); // Resolve anyway to avoid unhandled rejection
                },
                { timeout: 10000 }
            );
        });
    };

    const removeCity = async (cityToRemove: string) => {
        const newList = weatherList.filter(w => w.city !== cityToRemove);
        setWeatherList(newList);
        await updateSavedCities(newList);
    };

    const updateCitySource = useCallback(async (city: string, source: string | undefined) => {
        setLoading(true);
        try {
            const currentCity = weatherMap.get(city);
            const coords = (currentCity?.lat && currentCity?.lon) ? { lat: currentCity.lat, lon: currentCity.lon } : undefined;
            const newData = await getWeather(city, source, currentLanguage, coords);

            const newList = weatherList.map(w => w.city === city ? { ...newData, sourceOverride: source } : w);
            setWeatherList(newList);
            await updateSavedCities(newList);

            return { ...newData, sourceOverride: source };
        } catch (err) {
            console.error('Failed to switch source', err);
            setError(t.errors?.loadFailed || 'Switch failed');
            return null;
        } finally {
            setLoading(false);
        }
    }, [weatherList, currentLanguage, t.errors]);

    const reorderCities = useCallback((oldIndex: number, newIndex: number) => {
        const newList = arrayMove(weatherList, oldIndex, newIndex);
        setWeatherList(newList);
        updateSavedCities(newList);
    }, [weatherList]);

    // Initial load and auto refresh setup
    useEffect(() => {
        loadSavedCities();
        setupAutoRefresh();
        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        };
    }, [setupAutoRefresh, loadSavedCities]);

    // Save cache when list changes
    useEffect(() => {
        if (weatherList.length > 0) {
            const timer = setTimeout(async () => {
                const settings = await getSettings();
                storage.setAsync('weatherCache', {
                    lang: currentLanguage,
                    data: weatherList,
                    timeFormat: settings.timeFormat
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [weatherList, currentLanguage]);

    // Save last refresh time
    useEffect(() => {
        if (lastRefreshTime) storage.setAsync('lastRefreshTime', lastRefreshTime.toISOString());
    }, [lastRefreshTime]);

    return {
        weatherList,
        loading,
        refreshing,
        isAutoLocating,
        error,
        lastRefreshTime,
        addCity,
        addCityByLocation,
        removeCity,
        updateCitySource,
        refreshAllCities,
        refreshDefaultSourceCities,
        reorderCities
    };
}
