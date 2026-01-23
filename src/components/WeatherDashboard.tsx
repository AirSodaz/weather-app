import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getWeather, WeatherData, searchCities, CityResult } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud, FaSearch, FaTrash, FaCog, FaSync, FaInfoCircle, FaEllipsisV, FaLocationArrow } from 'react-icons/fa';
import WeatherDetail from './WeatherDetail';
import WeatherCard from './WeatherCard';
import SettingsModal from './SettingsModal';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { getWeatherBackground } from '../utils/weatherUtils';
import RelativeTime from './RelativeTime';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { processWithConcurrency } from '../utils/asyncUtils';

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};



const contextMenuVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, transformOrigin: "top left" }, // Dynamic origin handling would be better but fixed is ok
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } }
};

interface SavedCity {
    name: string;
    source?: string;
    lat?: number;
    lon?: number;
}

interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    weather: WeatherData | null;
    subMenu?: 'source' | null;
}






interface WeatherDashboardProps {
    onBgChange?: (bgClass: string) => void;
    bgContainerRef?: React.RefObject<HTMLDivElement>;
}

const WeatherDashboard: React.FC<WeatherDashboardProps> = ({ onBgChange, bgContainerRef }) => {
    const { t, currentLanguage } = useI18n();
    const [searchCity, setSearchCity] = useState('');
    const [weatherList, setWeatherList] = useState<WeatherData[]>([]);
    const [selectedCity, setSelectedCity] = useState<WeatherData | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false, x: 0, y: 0, weather: null, subMenu: null
    });
    const [showMenu, setShowMenu] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // const [scrollStyle, setScrollStyle] = useState<React.CSSProperties>({}); // Removed in favor of direct ref manipulation
    const [suggestions, setSuggestions] = useState<CityResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null); // Added ref for context menu
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastSourceRef = useRef<string | null>(null);

    const loadAppConfig = async () => {
        const settings = await getSettings();
        setDetailViewSections(settings.detailViewSections || []);
        if (lastSourceRef.current === null) {
            lastSourceRef.current = settings.source;
        }
    };

    useEffect(() => {
        loadAppConfig();
    }, []);

    // Handle browser back button
    useEffect(() => {
        const handlePopState = () => {
            if (showSettings) {
                setShowSettings(false);
            } else if (selectedCity) {
                // If we are showing detail, close it
                setSelectedCity(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedCity, showSettings]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced search for suggestions
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchCity.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const results = await searchCities(searchCity, currentLanguage);
                setSuggestions(results);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Failed to fetch suggestions', error);
            }
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchCity, currentLanguage]);

    // Close context menu and main menu when clicking elsewhere
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check for Context Menu
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, show: false }));
            }

            // Check for Main Menu (existing logic was just closing it on any click)
            // We can keep the behavior simple: close if clicking outside
            // Note: Main menu handling might need its own ref if we want to be precise, 
            // but for now let's just ensure we don't break existing 'click to close' behavior for it.
            // Start of removed block
            // if (showMenu) {
            //    setShowMenu(false);
            // }
            // End of removed block
        };

        if (contextMenu.show || showMenu) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true); // Handle right click outside
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [contextMenu.show, showMenu]);

    // Calculate dominant weather condition
    const dominantCondition = weatherList.length > 0
        ? weatherList[0].condition
        : 'default';

    // Trigger background transition animation when condition changes
    // Notify parent of background change
    useEffect(() => {
        const currentBg = getWeatherBackground(dominantCondition);
        if (onBgChange) {
            onBgChange(currentBg);
        }
    }, [dominantCondition, onBgChange]);

    // Persist lastRefreshTime
    useEffect(() => {
        if (lastRefreshTime) {
            storage.set('lastRefreshTime', lastRefreshTime.toISOString());
        }
    }, [lastRefreshTime]);

    // Save last viewed city
    useEffect(() => {
        const saveLastViewed = async () => {
            if (selectedCity) {
                await storage.set('lastViewedCity', {
                    name: selectedCity.city,
                    source: selectedCity.sourceOverride
                });
            } else {
                // Optional: Clear or keep last viewed? 
                // Keeping it allows "restore last even if I closed it before quitting"
                // But let's assume we update it to what is currently open.
                // If we want "startup view = detail", we should probably only track when a detail IS open.
            }
        };
        saveLastViewed();
    }, [selectedCity]);

    // Auto-dismiss errors after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Handle scroll-based background animation
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Use a smaller threshold for quicker response
        setIsScrolled(container.scrollTop > 10);

        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight - container.clientHeight;
        const scrollPercent = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;

        // Calculate gradient shift angle (0 to 45 degrees)
        const shiftAngle = scrollPercent * 45;
        // Calculate color intensity modifier (0 to 1)
        const intensity = scrollPercent;

        if (bgContainerRef && bgContainerRef.current) {
            bgContainerRef.current.style.setProperty('--scroll-shift', `${shiftAngle}deg`);
            bgContainerRef.current.style.setProperty('--intensity', String(intensity));
        }
    }, [bgContainerRef]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initialize on mount

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    // Setup auto-refresh
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
    }, []);

    // Cache weatherList whenever it changes
    useEffect(() => {
        if (weatherList.length > 0) {
            storage.set('weatherCache', {
                lang: currentLanguage,
                data: weatherList
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weatherList]);

    useEffect(() => {
        loadSavedCities();
        setupAutoRefresh();

        return () => {
            if (autoRefreshRef.current) {
                clearInterval(autoRefreshRef.current);
            }
        };
    }, [setupAutoRefresh]);

    const loadSavedCities = async () => {
        let cachedWeather: WeatherData[] | null = null;
        let savedLastRefreshTime: Date | null = null;

        // Try to load last refresh time
        try {
            const timeStr = await storage.get('lastRefreshTime');
            if (timeStr) {
                savedLastRefreshTime = new Date(timeStr);
                setLastRefreshTime(savedLastRefreshTime);
            }
        } catch (e) {
            console.error("Failed to load last refresh time", e);
        }
        // Try to load from cache first
        // Try to load from cache first
        try {
            const cache: any = await storage.get('weatherCache');
            // Check if cache format is valid and language matches
            // Strict check: if cache language doesn't match current, treat as no cache
            if (cache && cache.data && Array.isArray(cache.data) && cache.lang === currentLanguage) {
                cachedWeather = cache.data;
                setWeatherList(cachedWeather as WeatherData[]);
            } else if (!cache || !cache.lang || cache.lang !== currentLanguage) {
                // Force refresh if language mismatch or cache is malformed/missing language info
                // console.log('Cache language mismatch or missing, forcing refresh');
                cachedWeather = null;
            } else if (Array.isArray(cache)) {
                // Backward compatibility: Old cache format was just an array
                // If simple array, assume it's valid but might be wrong language if we can't tell.
                // But we should probably discard old format if we want strict language support.
                // For now, let's assume it's invalid if we want to force language.
                // cachedWeather = cache;
                // Actually better to discard old cache to force correct language load
                console.log("Cache ignored due to old format, forcing refresh for correct language.");
                cachedWeather = null;
            }
        } catch (e) {
            console.error("Failed to load cache", e);
        }

        // Check for staleness
        const settings = await getSettings();
        // If 0 (off), use 15 mins. Otherwise use minutes from settings.
        const thresholdMinutes = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
        const now = new Date();
        const timeDiff = savedLastRefreshTime ? now.getTime() - savedLastRefreshTime.getTime() : Infinity;
        const isStale = timeDiff > thresholdMinutes * 60 * 1000;

        // Visual feedback based on state
        if (!cachedWeather) {
            setLoading(true);
        } else if (isStale) {
            // If we have cache but it's stale, show spinner indicating update
            setRefreshing(true);
        } else {
            // Fresh cache, no loading spinner needed
            setLoading(false);
            setRefreshing(false);

            // If we have fresh cache, we might still want to load saved cities list just to be sure we have the correct "selected" city logic
            // But we shouldn't trigger a FETCH.
            // The logic below continues... we need to wrap the fetch part.
        }

        try {
            const savedData: (string | SavedCity)[] = (await storage.get('savedCities')) || [];

            if (savedData.length > 0) {
                // Determine if we should fetch
                // We should fetch if:
                // 1. We have no cache
                // 2. OR the data is stale

                const shouldFetch = !cachedWeather || isStale;
                let finalList: WeatherData[] = cachedWeather || [];

                let results: (WeatherData | null)[] | undefined;

                if (shouldFetch) {
                    // Initialize currentList with cached data if available and lengths match,
                    // otherwise use empty placeholders. This allows progressive updates to replace old data.
                    let currentList: (WeatherData | null)[] = [];
                    if (cachedWeather && cachedWeather.length === savedData.length) {
                        currentList = [...cachedWeather];
                    } else {
                        currentList = new Array(savedData.length).fill(null);
                    }

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
                        5, // Limit concurrency to 5
                        (result, index) => {
                            // Progressive update: Update the specific item and refresh state
                            // We only update if we have a valid result (or we can update to null if failed, but UI might not like it)
                            // Ideally we keep the old data if failed? But here we are loading fresh.
                            // If result is null (failed), we keep it null in currentList?
                            currentList[index] = result;

                            // Only set state with valid items to avoid empty holes in UI
                            const validSoFar = currentList.filter(w => w !== null) as WeatherData[];
                            setWeatherList(validSoFar);
                        }
                    );

                    const validResults = results.filter((w) => w !== null) as WeatherData[];

                    if (validResults.length > 0) {
                        finalList = validResults;
                        setWeatherList(validResults);
                        setLastRefreshTime(new Date());

                        // Sychronize saved city names with fetched names (e.g. localized names)
                        let namesChanged = false;
                        const newSavedData = savedData.map((item, index) => {
                            // Find corresponding result. Note: results includes nulls, validResults does not.
                            // We need to map by index from results
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
                            console.log('Updating saved cities with localized names');
                            storage.set('savedCities', newSavedData);
                        }
                    }
                }

                // Check startup view settings
                if (settings.startupView === 'detail') {
                    const lastViewed = await storage.get('lastViewedCity');
                    if (lastViewed) {
                        const lastCityName = typeof lastViewed === 'string' ? lastViewed : lastViewed.name;

                        // Try to find by name first
                        let targetCity = finalList.find(w => w.city === lastCityName);

                        // If not found (e.g. name changed due to language switch), try to find by index
                        if (!targetCity) {
                            const savedIndex = savedData.findIndex(item => {
                                const name = typeof item === 'string' ? item : item.name;
                                return name === lastCityName;
                            });

                            if (savedIndex !== -1) {
                                // If we have fresh resultsWithNulls, use that
                                if (results && results[savedIndex]) {
                                    targetCity = results[savedIndex] as WeatherData;
                                }
                                // Fallback: If using cache and lists align?
                                else if (!results && finalList.length === savedData.length) {
                                    targetCity = finalList[savedIndex];
                                }
                            }
                        }

                        if (targetCity) {
                            setSelectedCity(targetCity);
                            // Push state if we are restoring from a "fresh" start (not currently viewing a city)
                            // This ensures that the back button works (returns to home) instead of exiting the app
                            if (!selectedCity) {
                                window.history.pushState({ city: targetCity.city }, '', '');
                            }
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
    };

    // Re-load saved cities when language changes to refresh data in new language
    useEffect(() => {
        loadSavedCities();
    }, [currentLanguage]);

    const refreshAllCities = useCallback(async () => {
        if (weatherList.length === 0 || refreshing) return;

        setRefreshing(true);
        try {
            const results = await processWithConcurrency(
                weatherList,
                async (weather) => {
                    try {
                        const source = (weather as any).sourceOverride;
                        // Use coords from weather data if available
                        const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                        const newData = await getWeather(weather.city, source, currentLanguage, coords);
                        return { ...newData, sourceOverride: source };
                    } catch (e) {
                        console.error(`Failed to refresh weather for ${weather.city}`, e);
                        return weather; // Keep old data on error
                    }
                },
                5,
                (result) => {
                    setWeatherList(prev => prev.map(w => w.city === result.city ? result : w));
                }
            );
            setWeatherList(results);
            setLastRefreshTime(new Date());
        } finally {
            setRefreshing(false);
        }
    }, [weatherList, refreshing, currentLanguage]);

    const refreshDefaultSourceCities = useCallback(async () => {
        if (weatherList.length === 0 || refreshing) return;

        setRefreshing(true);
        try {
            const results = await processWithConcurrency(
                weatherList,
                async (weather) => {
                    try {
                        const source = (weather as any).sourceOverride;
                        if (source) {
                            // Don't refresh if source is manually set
                            return weather;
                        }
                        const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                        const newData = await getWeather(weather.city, undefined, currentLanguage, coords);
                        return { ...newData, sourceOverride: undefined };
                    } catch (e) {
                        console.error(`Failed to refresh weather for ${weather.city}`, e);
                        return weather;
                    }
                },
                5,
                (result) => {
                    setWeatherList(prev => prev.map(w => w.city === result.city ? result : w));
                }
            );
            setWeatherList(results);
            setLastRefreshTime(new Date());
            await updateSavedCities(results);
        } finally {
            setRefreshing(false);
        }
    }, [weatherList, refreshing, currentLanguage]);

    const handleSearch = async (e?: React.FormEvent, cityOverride?: string) => {
        if (e) e.preventDefault();
        const cityToSearch = cityOverride || searchCity;

        if (!cityToSearch.trim()) return;

        // Hide suggestions immediately
        setShowSuggestions(false);

        setError(null);
        setLoading(true);

        // Check if already exists
        if (weatherList.some(w => w.city.toLowerCase() === cityToSearch.toLowerCase())) {
            setError(t.search.cityExists);
            setLoading(false);
            return;
        }

        try {
            const data = await getWeather(cityToSearch, undefined, currentLanguage);
            const newList = [...weatherList, data];
            setWeatherList(newList);
            await updateSavedCities(newList);
            setSearchCity('');
            setLastRefreshTime(new Date());
        } catch (err) {
            setError(t.search.error);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: CityResult) => {
        const query = suggestion.name;
        setSearchCity(query);
        handleSearch(undefined, query);
    };

    const handleRemoveCity = async (cityToRemove: string) => {
        const newList = weatherList.filter(w => w.city !== cityToRemove);
        setWeatherList(newList);
        await updateSavedCities(newList);
    };

    const updateSavedCities = async (list: WeatherData[]) => {
        // Map to SavedCity format
        const savedCities: SavedCity[] = list.map(w => ({
            name: w.city,
            source: (w as any).sourceOverride,
            lat: w.lat,
            lon: w.lon
        }));
        await storage.set('savedCities', savedCities);
    };

    const handleUpdateCitySource = useCallback(async (city: string, source: string | undefined) => {
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
            await updateSavedCities(newList);

            // If the updated city is currently selected, update it too
            if (selectedCity && selectedCity.city === city) {
                setSelectedCity({ ...newData, sourceOverride: source });
            }
        } catch (err) {
            console.error('Failed to switch source', err);
            setError(t.errors?.loadFailed || 'Switch failed');
        } finally {
            setLoading(false);
        }
    }, [weatherList, currentLanguage, selectedCity, t.errors]);

    const handleSettingsChange = async () => {
        setupAutoRefresh();
        loadAppConfig();
        const settings = await getSettings();
        if (lastSourceRef.current && lastSourceRef.current !== settings.source) {
            await refreshDefaultSourceCities();
        }
        lastSourceRef.current = settings.source;
    };

    const handleCardClick = useCallback((weather: WeatherData) => {
        setSelectedCity(weather);
        window.history.pushState({ city: weather.city }, '', '');
    }, []);

    const handleCardContextMenu = useCallback((e: React.MouseEvent, weather: WeatherData) => {
        e.preventDefault();
        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            weather: weather
        });
    }, []);

    const handleDetailBack = useCallback(() => window.history.back(), []);

    const handleDetailOpenSettings = useCallback(() => {
        setShowSettings(true);
        window.history.pushState({ modal: 'settings' }, '', '');
    }, []);

    // Create a stable wrapper for handleUpdateCitySource to pass to WeatherDetail
    const onDetailSourceChange = useCallback((source: string | undefined) => {
        if (selectedCity) {
            handleUpdateCitySource(selectedCity.city, source);
        }
    }, [selectedCity, handleUpdateCitySource]);

    // Drag and drop handlers
    const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    }, [draggedIndex]);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOverIndex(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newList = [...weatherList];
        const [draggedItem] = newList.splice(draggedIndex, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setWeatherList(newList);
        await updateSavedCities(newList);
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, [draggedIndex, weatherList]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, []);

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 flex flex-col items-center overflow-y-auto text-white"
        >

            {/* Header / Search Section */}
            <div
                className={`sticky top-0 z-50 w-full max-w-2xl flex items-center gap-3 transition-all duration-500 ease-in-out px-4 sm:px-0
                ${isScrolled
                        ? 'py-3'
                        : 'py-6'
                    }`}
            >
                {/* Search Bar */}
                <div ref={searchRef} className="flex-1 relative">
                    <form onSubmit={(e) => handleSearch(e)} className="w-full flex items-center space-x-2 glass-card rounded-full px-4 py-4 transition-all focus-within:bg-white/10 focus-within:shadow-lg focus-within:ring-1 focus-within:ring-white/20">
                        <FaSearch className="text-white/60" />
                        <input
                            type="text"
                            value={searchCity}
                            onChange={(e) => setSearchCity(e.target.value)}
                            placeholder={t.search.placeholder}
                            className="bg-transparent border-none outline-none text-white placeholder-white/50 w-full text-base"
                            onFocus={() => {
                                setShowSuggestions(true);
                            }}
                        />
                        {searchCity && (
                            <button
                                type="button"
                                onClick={() => setSearchCity('')}
                                className="text-white/40 hover:text-white transition-colors p-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </form>

                    {/* Suggestions Dropdown */}
                    <AnimatePresence>
                        {
                            (showSuggestions) && (
                                <motion.div
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="absolute top-full left-0 right-0 mt-2 glass-card rounded-2xl overflow-hidden shadow-xl z-50 backdrop-blur-xl border border-white/10"
                                >
                                    {/* Current Location Option */}
                                    <button
                                        onClick={() => {
                                            setShowSuggestions(false);
                                            setLoading(true);
                                            navigator.geolocation.getCurrentPosition(
                                                async (position) => {
                                                    try {
                                                        const { latitude, longitude } = position.coords;
                                                        // Use reverse geocoding or just fetch weather by coords
                                                        // getWeather supports coords but we ideally want a city name to display initially
                                                        // if we just pass coords, the API usually returns the city name which is great.

                                                        // Check if already exists by fuzzy coord match? 
                                                        // Actually, let's just fetch it. The existing check uses city name.
                                                        // We'll rely on the returned city name from API to check duplicates after fetch if we want strictness,
                                                        // but handleSearch logic does pre-check.
                                                        // Let's modify handleSearch or just do it here inline for clarity.

                                                        const data = await getWeather('', undefined, currentLanguage, { lat: latitude, lon: longitude });

                                                        if (weatherList.some(w => w.city.toLowerCase() === data.city.toLowerCase())) {
                                                            setError(t.search.cityExists);
                                                        } else {
                                                            const newList = [...weatherList, data];
                                                            setWeatherList(newList);
                                                            await updateSavedCities(newList);
                                                            setLastRefreshTime(new Date());
                                                        }
                                                    } catch (err) {
                                                        console.error("Geolocation weather fetch failed", err);
                                                        setError(t.errors?.loadFailed || "Failed to load location");
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                },
                                                (err) => {
                                                    console.error("Geolocation error", err);
                                                    setError("Location access denied or unavailable");
                                                    setLoading(false);
                                                },
                                                { timeout: 10000 }
                                            );
                                        }}
                                        className="w-full px-5 py-3 text-left hover:bg-white/10 text-white flex items-center gap-3 transition-colors border-b border-white/5 last:border-none"
                                    >
                                        <FaLocationArrow className="text-white/60" />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-sm">{t.search?.currentLocation || "Use Current Location"}</span>
                                        </div>
                                    </button>

                                    {suggestions.map((item, index) => (
                                        <button
                                            key={`${item.name}-${item.lat}-${item.lon}-${index}`}
                                            onClick={() => handleSuggestionClick(item)}
                                            className="w-full px-5 py-3 text-left hover:bg-white/10 text-white flex flex-col gap-0.5 transition-colors border-b border-white/5 last:border-none"
                                        >
                                            <span className="font-medium text-sm">{item.name}</span>
                                            <span className="text-xs text-white/40">
                                                {[item.region, item.country].filter(Boolean).join(', ')}
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            )
                        }
                    </AnimatePresence>
                </div>

                {/* Top Right Menu Button */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-4 glass-card rounded-full text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10"
                    >
                        <FaEllipsisV className="text-xl" />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                                <motion.div
                                    key="dashboard-menu"
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="absolute right-0 top-full mt-3 w-56 glass-card rounded-2xl py-2 shadow-2xl flex flex-col z-50 border border-white/10 backdrop-blur-xl"
                                >
                                    {lastRefreshTime && (
                                        <div className="px-5 py-3 text-sm font-medium text-white/40 border-b border-white/10 uppercase tracking-wider">
                                            {t.refresh.lastUpdate}: <RelativeTime date={lastRefreshTime} />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            refreshAllCities();
                                            setShowMenu(false);
                                        }}
                                        disabled={refreshing}
                                        className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors disabled:opacity-50"
                                    >
                                        <FaSync className={`text-blue-300 ${refreshing ? 'animate-spin' : ''}`} />
                                        {refreshing ? t.refresh.refreshing : t.refresh.button}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettings(true);
                                            window.history.pushState({ modal: 'settings' }, '', '');
                                            setShowMenu(false);
                                        }}
                                        className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                                    >
                                        <FaCog className="text-slate-300" />
                                        {t.settings.title}
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {error && <div className="mb-4 text-red-200 bg-red-500/20 glass px-4 py-2 rounded-lg text-sm">{error}</div>}

            {
                loading && weatherList.length === 0 && (
                    <div className="text-center py-10 animate-pulse text-sm">{t.search.loading}</div>
                )
            }

            {
                refreshing && (
                    <div className="text-center py-2 text-sm text-white/70">{t.refresh.refreshing}</div>
                )
            }

            {/* Weather Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4 pb-4">
                <AnimatePresence mode='popLayout'>
                    {weatherList.map((weather, index) => (
                        <WeatherCard
                            key={weather.city}
                            layoutId={`weather-card-${weather.city}`}
                            weather={weather}
                            index={index}
                            draggable={true}
                            onClick={handleCardClick}
                            onContextMenu={handleCardContextMenu}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedIndex === index}
                            isDragOver={dragOverIndex === index}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {
                !loading && weatherList.length === 0 && (
                    <div className="text-white/60 mt-16 text-center font-light animate-fade-in">
                        <FaCloud className="text-6xl mx-auto mb-4 animate-float" />
                        <p>{t.empty.title}</p>
                        <p className="text-sm">{t.empty.subtitle}</p>
                    </div>
                )
            }

            <AnimatePresence>
                {
                    selectedCity && (
                        <WeatherDetail
                            key={selectedCity.city}
                            layoutId={`weather-card-${selectedCity.city}`}
                            weather={selectedCity}
                            lastRefreshTime={lastRefreshTime}
                            onBack={handleDetailBack}
                            onSourceChange={onDetailSourceChange}
                            onRefresh={refreshAllCities}
                            onOpenSettings={handleDetailOpenSettings}
                            sections={detailViewSections}
                        />
                    )
                }
            </AnimatePresence>

            <AnimatePresence>
                {showSettings && (
                    <SettingsModal
                        key="settings-modal"
                        isOpen={showSettings}
                        onClose={() => window.history.back()}
                        onSettingsChange={handleSettingsChange}
                    />
                )}
            </AnimatePresence>

            {/* Context Menu */}
            <AnimatePresence>
                {
                    contextMenu.show && contextMenu.weather && (
                        <>
                            <motion.div
                                ref={contextMenuRef}
                                key={`${contextMenu.x}-${contextMenu.y}-${contextMenu.weather.city}`}
                                variants={contextMenuVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="fixed z-[100] glass-card rounded-3xl py-2 min-w-[200px] border border-white/20"
                                style={{ left: contextMenu.x, top: contextMenu.y }}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => {
                                        setSelectedCity(contextMenu.weather);
                                        setContextMenu(prev => ({ ...prev, show: false }));
                                    }}
                                    className="menu-item"
                                >
                                    <span className="menu-item-icon"><FaInfoCircle className="text-blue-400" /></span>
                                    {t.contextMenu?.viewDetails || 'View Details'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (contextMenu.weather) {
                                            handleRemoveCity(contextMenu.weather.city);
                                        }
                                        setContextMenu(prev => ({ ...prev, show: false }));
                                    }}
                                    className="menu-item menu-item-danger"
                                >
                                    <span className="menu-item-icon"><FaTrash className="text-red-400" /></span>
                                    {t.remove}
                                </button>
                            </motion.div>
                        </>
                    )
                }
            </AnimatePresence>
        </div>
    );
};

export default WeatherDashboard;
