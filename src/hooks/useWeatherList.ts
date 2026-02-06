import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    // Optimization: Use ref to hold weatherList to stabilize callbacks
    const weatherListRef = useRef(weatherList);
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        onComplete?: (results: WeatherData[]) => Promise<void>
    ) => {
        if (listToRefresh.length === 0 || refreshing) return;

        setRefreshing(true);

        try {
            const results = await processWithConcurrency(
                listToRefresh,
                transform,
                5
            );

            setWeatherList(prev => {
                const updateMap = new Map(results.map(u => [u.city, u]));
                return prev.map(w => updateMap.get(w.city) || w);
            });

            setLastRefreshTime(new Date());
            if (onComplete) await onComplete(results);

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
        }, async (results) => {
            const resultsMap = new Map(results.map(r => [r.city, r]));
            const listToSave = weatherListRef.current.map(current =>
                resultsMap.get(current.city) || current
            );
            await updateSavedCities(listToSave);
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
        }, async (results) => {
            const resultsMap = new Map(results.map(r => [r.city, r]));
            const listToSave = weatherListRef.current.map(current =>
                resultsMap.get(current.city) || current
            );
            await updateSavedCities(listToSave);
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

        if (weatherList.some(w => w.city.toLowerCase() === city.toLowerCase())) {
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
        return new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        const data = await getWeather('', undefined, currentLanguage, { lat: latitude, lon: longitude });

                        if (weatherList.some(w => w.city.toLowerCase() === data.city.toLowerCase())) {
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
                        setError(t.errors?.loadFailed || "Failed to load location");
                        reject(err);
                    } finally {
                        setLoading(false);
                    }
                },
                (err) => {
                    console.error("Geolocation error", err);
                    setError("Location access denied or unavailable");
                    setLoading(false);
                    reject(err);
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
            const currentCity = weatherList.find(w => w.city === city);
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
