import { useState, useEffect, useCallback, useRef } from 'react';
import { getWeather, WeatherData } from '../services/weatherApi';
import { getSettings } from '../utils/config';
import { storage } from '../utils/storage';
import { processWithConcurrency } from '../utils/asyncUtils';
import { arrayMove } from '@dnd-kit/sortable';
import { useI18n } from '../contexts/I18nContext';

/**
 * Represents a saved city in local storage.
 */
interface SavedCity {
    name: string;
    source?: string;
    lat?: number;
    lon?: number;
}

/**
 * Updates the list of saved cities in storage based on the current weather list.
 *
 * @param {WeatherData[]} list - The current list of weather data.
 * @returns {Promise<void>} A promise that resolves when storage is updated.
 */
const updateSavedCitiesStorage = async (list: WeatherData[]) => {
    // Map to SavedCity format.
    const savedCities: SavedCity[] = list.map(w => ({
        name: w.city,
        source: (w as any).sourceOverride,
        lat: w.lat,
        lon: w.lon
    }));
    await storage.setAsync('savedCities', savedCities);
};

export function useWeatherCities() {
    const { t, currentLanguage } = useI18n();
    const [weatherList, setWeatherList] = useState<WeatherData[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    // Optimization: Use ref to hold weatherList to stabilize callbacks
    const weatherListRef = useRef(weatherList);
    useEffect(() => {
        weatherListRef.current = weatherList;
    }, [weatherList]);

    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Persist lastRefreshTime.
    useEffect(() => {
        if (lastRefreshTime) {
            storage.setAsync('lastRefreshTime', lastRefreshTime.toISOString());
        }
    }, [lastRefreshTime]);

    // Cache weatherList whenever it changes.
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

    const loadSavedCities = useCallback(async () => {
        let cachedWeather: WeatherData[] | null = null;
        let savedLastRefreshTime: Date | null = null;

        // Try to load last refresh time.
        try {
            const timeStr = await storage.get('lastRefreshTime');
            if (timeStr) {
                savedLastRefreshTime = new Date(timeStr);
                setLastRefreshTime(savedLastRefreshTime);
            }
        } catch (e) {
            console.error("Failed to load last refresh time", e);
        }

        // Try to load from cache first.
        try {
            const cache: any = await storage.get('weatherCache');
            const settings = await getSettings();
            const currentTimeFormat = settings.timeFormat || '24h';

            const isFormatMatch = cache?.timeFormat === currentTimeFormat;

            if (cache && cache.data && Array.isArray(cache.data) && cache.lang === currentLanguage && isFormatMatch) {
                cachedWeather = cache.data;
                setWeatherList(cachedWeather as WeatherData[]);
            } else {
                cachedWeather = null;
            }
        } catch (e) {
            console.error("Failed to load cache", e);
        }

        // Check for staleness.
        const settings = await getSettings();
        const thresholdMinutes = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
        const now = new Date();
        const timeDiff = savedLastRefreshTime ? now.getTime() - savedLastRefreshTime.getTime() : Infinity;
        const isStale = timeDiff > thresholdMinutes * 60 * 1000;

        if (!cachedWeather) {
            setLoading(true);
        } else if (isStale) {
            setRefreshing(true);
        } else {
            setLoading(false);
            setRefreshing(false);
        }

        try {
            const savedData: (string | SavedCity)[] = (await storage.get('savedCities')) || [];

            if (savedData.length > 0) {
                const shouldFetch = !cachedWeather || isStale;
                let finalList: WeatherData[] = cachedWeather || [];

                let results: (WeatherData | null)[] | undefined;

                if (shouldFetch) {
                    let currentList: (WeatherData | null)[] = [];
                    if (cachedWeather && cachedWeather.length === savedData.length) {
                        currentList = [...cachedWeather];
                    } else {
                        currentList = new Array(savedData.length).fill(null);
                    }

                    let completedCount = 0;

                    results = await processWithConcurrency(
                        savedData,
                        async (item) => {
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
                        5,
                        (result, index) => {
                            currentList[index] = result;
                            completedCount++;
                            if (completedCount % 5 === 0 || completedCount === savedData.length) {
                                const validSoFar = currentList.filter(w => w !== null) as WeatherData[];
                                setWeatherList(validSoFar);
                            }
                        }
                    );

                    const validResults = results.filter((w) => w !== null) as WeatherData[];

                    if (validResults.length > 0) {
                        finalList = validResults;
                        setWeatherList(validResults);
                        setLastRefreshTime(new Date());

                        // Synchronize saved city names with fetched names.
                        let namesChanged = false;
                        const newSavedData = savedData.map((item, index) => {
                            const weatherData = results![index];
                            if (weatherData && weatherData.city) {
                                const currentName = typeof item === 'string' ? item : item.name;
                                if (currentName !== weatherData.city) {
                                    namesChanged = true;
                                    if (typeof item === 'string') {
                                        return weatherData.city;
                                    } else {
                                        return { ...item, name: weatherData.city };
                                    }
                                }
                            }
                            return item;
                        });

                        if (namesChanged) {
                            storage.set('savedCities', newSavedData);
                        }
                    }
                }
            } else {
                setWeatherList([]);
            }
        } catch (err) {
            console.error("Failed to load saved cities", err);
            setError(t.errors?.loadFailed || "Failed to load");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentLanguage, t.errors]);

    const refreshCitiesGeneric = useCallback(async (
        listToRefresh: WeatherData[],
        transform: (weather: WeatherData) => Promise<WeatherData>,
        onComplete?: (results: WeatherData[]) => Promise<void>
    ) => {
        if (listToRefresh.length === 0 || refreshing) return;

        setRefreshing(true);
        let pendingUpdates: WeatherData[] = [];
        let completedCount = 0;

        try {
            const results = await processWithConcurrency(
                listToRefresh,
                transform,
                5,
                (result) => {
                    pendingUpdates.push(result);
                    completedCount++;

                    if (completedCount % 5 === 0) {
                        const updatesToApply = [...pendingUpdates];
                        pendingUpdates = [];
                        setWeatherList(prev => {
                            const updateMap = new Map(updatesToApply.map(u => [u.city, u]));
                            return prev.map(w => updateMap.get(w.city) || w);
                        });
                    }
                }
            );

            if (pendingUpdates.length > 0) {
                setWeatherList(prev => {
                    const updateMap = new Map(pendingUpdates.map(u => [u.city, u]));
                    return prev.map(w => updateMap.get(w.city) || w);
                });
            }
            setLastRefreshTime(new Date());

            if (onComplete) {
                await onComplete(results);
            }
        } finally {
            setRefreshing(false);
        }
    }, [refreshing]);

    const refreshAll = useCallback(async () => {
        await refreshCitiesGeneric(weatherList, async (weather) => {
            try {
                const source = (weather as any).sourceOverride;
                const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                const newData = await getWeather(weather.city, source, currentLanguage, coords);
                return { ...newData, sourceOverride: source };
            } catch (e) {
                console.error(`Failed to refresh weather for ${weather.city}`, e);
                return weather;
            }
        }, undefined);
    }, [weatherList, refreshCitiesGeneric, currentLanguage]);

    const refreshDefaultSourceCities = useCallback(async () => {
        await refreshCitiesGeneric(weatherList, async (weather) => {
            try {
                const source = (weather as any).sourceOverride;
                if (source) {
                    return weather;
                }
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
            await updateSavedCitiesStorage(listToSave);
        });
    }, [weatherList, refreshCitiesGeneric, currentLanguage]);

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
            await updateSavedCitiesStorage(newList);
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

    const addCityByLocation = async (lat: number, lon: number): Promise<boolean> => {
        setLoading(true);
        try {
            const data = await getWeather('', undefined, currentLanguage, { lat, lon });

            if (weatherList.some(w => w.city.toLowerCase() === data.city.toLowerCase())) {
                setError(t.search.cityExists);
                return false;
            } else {
                const newList = [...weatherList, data];
                setWeatherList(newList);
                await updateSavedCitiesStorage(newList);
                setLastRefreshTime(new Date());
                return true;
            }
        } catch (err) {
            console.error("Geolocation weather fetch failed", err);
            setError(t.errors?.loadFailed || "Failed to load location");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const removeCity = async (cityToRemove: string) => {
        const newList = weatherList.filter(w => w.city !== cityToRemove);
        setWeatherList(newList);
        await updateSavedCitiesStorage(newList);
    };

    const updateCitySource = useCallback(async (city: string, source: string | undefined) => {
        setLoading(true);
        try {
            const currentCity = weatherList.find(w => w.city === city);
            const coords = (currentCity?.lat && currentCity?.lon) ? { lat: currentCity.lat, lon: currentCity.lon } : undefined;
            const newData = await getWeather(city, source, currentLanguage, coords);
            const newList = weatherList.map(w =>
                w.city === city
                    ? { ...newData, sourceOverride: source }
                    : w
            );
            setWeatherList(newList);
            await updateSavedCitiesStorage(newList);
            return { ...newData, sourceOverride: source };
        } catch (err) {
            console.error('Failed to switch source', err);
            setError(t.errors?.loadFailed || 'Switch failed');
            return null;
        } finally {
            setLoading(false);
        }
    }, [weatherList, currentLanguage, t.errors]);

    const reorderCities = useCallback((activeId: string, overId: string) => {
        const oldIndex = weatherList.findIndex((w) => w.city === activeId);
        const newIndex = weatherList.findIndex((w) => w.city === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
            const newList = arrayMove(weatherList, oldIndex, newIndex);
            setWeatherList(newList);
            updateSavedCitiesStorage(newList);
        }
    }, [weatherList]);

    const setupAutoRefresh = useCallback(async () => {
        if (autoRefreshRef.current) {
            clearInterval(autoRefreshRef.current);
            autoRefreshRef.current = null;
        }

        const settings = await getSettings();
        if (settings.autoRefreshInterval > 0) {
            autoRefreshRef.current = setInterval(() => {
                refreshAll();
            }, settings.autoRefreshInterval * 60000);
        }
    }, [refreshAll]);

    useEffect(() => {
        loadSavedCities();
        setupAutoRefresh();

        return () => {
            if (autoRefreshRef.current) {
                clearInterval(autoRefreshRef.current);
            }
        };
    }, [loadSavedCities, setupAutoRefresh]);

    // Re-load saved cities when language changes to refresh data in new language.
    // Note: loadSavedCities dependency on currentLanguage handles this.

    return {
        weatherList,
        loading,
        refreshing,
        error,
        setError,
        lastRefreshTime,
        addCity,
        addCityByLocation,
        removeCity,
        updateCitySource,
        reorderCities,
        refreshAll,
        refreshDefaultSourceCities,
        setupAutoRefresh,
        loadSavedCities
    };
}
