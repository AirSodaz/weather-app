import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getWeather, WeatherData } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud, FaTrash, FaCog, FaSync, FaInfoCircle, FaEllipsisV } from 'react-icons/fa';
import WeatherDetail from './WeatherDetail';
import SortableWeatherCard from './SortableWeatherCard';
import SettingsModal from './SettingsModal';
import SearchBar from './SearchBar';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { getWeatherBackground } from '../utils/weatherUtils';
import RelativeTime from './RelativeTime';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { processWithConcurrency } from '../utils/asyncUtils';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};



const contextMenuVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } }
};

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
 * State for the context menu.
 */
interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    weather: WeatherData | null;
    subMenu?: 'source' | null;
    menuStyle?: React.CSSProperties;
}

/**
 * Updates the list of saved cities in storage based on the current weather list.
 *
 * @param {WeatherData[]} list - The current list of weather data.
 * @returns {Promise<void>} A promise that resolves when storage is updated.
 */
const updateSavedCities = async (list: WeatherData[]) => {
    // Map to SavedCity format.
    const savedCities: SavedCity[] = list.map(w => ({
        name: w.city,
        source: (w as any).sourceOverride,
        lat: w.lat,
        lon: w.lon
    }));
    await storage.set('savedCities', savedCities);
};

/**
 * Props for the WeatherDashboard component.
 */
interface WeatherDashboardProps {
    /** Callback triggered when the background should change based on weather. */
    onBgChange?: (bgClass: string) => void;
    /** Ref to the background container for scroll-based effects. */
    bgContainerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Main dashboard component displaying the list of cities and weather summaries.
 * Handles adding, removing, refreshing, and viewing details of cities.
 *
 * @param {WeatherDashboardProps} props - The component props.
 * @returns {JSX.Element} The weather dashboard component.
 */
const WeatherDashboard: React.FC<WeatherDashboardProps> = ({ onBgChange, bgContainerRef }) => {
    const { t, currentLanguage } = useI18n();
    // Removed search state moved to SearchBar.
    const [weatherList, setWeatherList] = useState<WeatherData[]>([]);

    // Optimization: Use ref to hold weatherList to stabilize handleDrop callback
    // and prevent excessive re-renders of WeatherCard components (which depend on handleDrop prop).
    const weatherListRef = useRef(weatherList);
    useEffect(() => {
        weatherListRef.current = weatherList;
    }, [weatherList]);

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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);

    /**
     * Sensors for handling drag interactions.
     * Starts drag after 8px movement to prevent accidental activation.
     */
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required before drag starts (prevents accidental drags on click)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    /**
     * Handles the end of a drag event to reorder the weather list.
     * Updates both local state and persistent storage.
     *
     * @param event - The drag end event from dnd-kit.
     */
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = weatherList.findIndex((w) => w.city === active.id);
            const newIndex = weatherList.findIndex((w) => w.city === over.id);
            const newList = arrayMove(weatherList, oldIndex, newIndex);
            setWeatherList(newList);
            updateSavedCities(newList);
        }
    }, [weatherList]);

    // Removed refs and state for search suggestions.

    const contextMenuRef = useRef<HTMLDivElement>(null); // Added ref for context menu.
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastSourceRef = useRef<string | null>(null);

    /**
     * Loads application configuration settings.
     */
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

    // Handle browser back button.
    useEffect(() => {
        const handlePopState = () => {
            if (showSettings) {
                setShowSettings(false);
            } else if (selectedCity) {
                // If we are showing detail, close it.
                setSelectedCity(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedCity, showSettings]);

    // Removed click outside listener for search suggestions (handled in SearchBar).

    // Close context menu and main menu when clicking elsewhere.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check for Context Menu.
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, show: false }));
            }
        };

        if (contextMenu.show || showMenu) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true); // Handle right click outside.
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [contextMenu.show, showMenu]);

    // Calculate dominant weather condition.
    const dominantCondition = weatherList.length > 0
        ? weatherList[0].condition
        : 'default';

    // Trigger background transition animation when condition changes.
    // Notify parent of background change.
    useEffect(() => {
        const currentBg = getWeatherBackground(dominantCondition);
        if (onBgChange) {
            onBgChange(currentBg);
        }
    }, [dominantCondition, onBgChange]);

    // Persist lastRefreshTime.
    useEffect(() => {
        if (lastRefreshTime) {
            storage.set('lastRefreshTime', lastRefreshTime.toISOString());
        }
    }, [lastRefreshTime]);

    // Save last viewed city.
    useEffect(() => {
        const saveLastViewed = async () => {
            if (selectedCity) {
                await storage.set('lastViewedCity', {
                    name: selectedCity.city,
                    source: selectedCity.sourceOverride
                });
            } else {
                // Optional: Clear or keep last viewed?
            }
        };
        saveLastViewed();
    }, [selectedCity]);

    // Auto-dismiss errors after 5 seconds.
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Handle scroll-based background animation.
    const handleScroll = useCallback(() => {
        if (!ticking.current) {
            window.requestAnimationFrame(() => {
                const container = scrollContainerRef.current;
                if (!container) {
                    ticking.current = false;
                    return;
                }

                const scrollTop = container.scrollTop;
                // Use a smaller threshold for quicker response.
                setIsScrolled(scrollTop > 10);

                const scrollHeight = container.scrollHeight - container.clientHeight;
                const scrollPercent = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;

                // Calculate gradient shift angle (0 to 45 degrees).
                const shiftAngle = scrollPercent * 45;
                // Calculate color intensity modifier (0 to 1).
                const intensity = scrollPercent;

                if (bgContainerRef && bgContainerRef.current) {
                    bgContainerRef.current.style.setProperty('--scroll-shift', `${shiftAngle}deg`);
                    bgContainerRef.current.style.setProperty('--intensity', String(intensity));
                }

                ticking.current = false;
            });

            ticking.current = true;
        }
    }, [bgContainerRef]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initialize on mount.

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    // Setup auto-refresh.
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
        // Try to load from cache first.
        try {
            const cache: any = await storage.get('weatherCache');
            const settings = await getSettings();
            const currentTimeFormat = settings.timeFormat || '24h';

            // Check if cache format is valid and language matches.
            // Strict check: if cache language doesn't match current, treat as no cache.
            // Also check timeFormat match.
            const isFormatMatch = cache?.timeFormat === currentTimeFormat;

            if (cache && cache.data && Array.isArray(cache.data) && cache.lang === currentLanguage && isFormatMatch) {
                cachedWeather = cache.data;
                setWeatherList(cachedWeather as WeatherData[]);
            } else {
                // Force refresh if language mismatch, format mismatch or cache is malformed.
                if (cache) {
                    console.log(`Cache mismatch/invalid. Lang: ${cache.lang}/${currentLanguage}, Format: ${cache.timeFormat}/${currentTimeFormat}`);
                }
                cachedWeather = null;
            }
        } catch (e) {
            console.error("Failed to load cache", e);
        }

        // Check for staleness.
        const settings = await getSettings();
        // If 0 (off), use 15 mins. Otherwise use minutes from settings.
        const thresholdMinutes = settings.autoRefreshInterval > 0 ? settings.autoRefreshInterval : 15;
        const now = new Date();
        const timeDiff = savedLastRefreshTime ? now.getTime() - savedLastRefreshTime.getTime() : Infinity;
        const isStale = timeDiff > thresholdMinutes * 60 * 1000;

        // Visual feedback based on state.
        if (!cachedWeather) {
            setLoading(true);
        } else if (isStale) {
            // If we have cache but it's stale, show spinner indicating update.
            setRefreshing(true);
        } else {
            // Fresh cache, no loading spinner needed.
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
                        5, // Limit concurrency to 5.
                        (result, index) => {
                            currentList[index] = result;
                            completedCount++;

                            // Only set state with valid items to avoid empty holes in UI.
                            // Batch updates to reduce re-renders: update every 5 items or on the last one.
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

                        // Sychronize saved city names with fetched names (e.g. localized names).
                        let namesChanged = false;
                        const newSavedData = savedData.map((item, index) => {
                            // Find corresponding result. Note: results includes nulls, validResults does not.
                            // We need to map by index from results.
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

                // Check startup view settings.
                if (settings.startupView === 'detail') {
                    const lastViewed = await storage.get('lastViewedCity');
                    if (lastViewed) {
                        const lastCityName = typeof lastViewed === 'string' ? lastViewed : lastViewed.name;

                        // Try to find by name first.
                        let targetCity = finalList.find(w => w.city === lastCityName);

                        // If not found (e.g. name changed due to language switch), try to find by index.
                        if (!targetCity) {
                            const savedIndex = savedData.findIndex(item => {
                                const name = typeof item === 'string' ? item : item.name;
                                return name === lastCityName;
                            });

                            if (savedIndex !== -1) {
                                // If we have fresh resultsWithNulls, use that.
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
                            // Push state if we are restoring from a "fresh" start (not currently viewing a city).
                            // This ensures that the back button works (returns to home) instead of exiting the app.
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

    // Re-load saved cities when language changes to refresh data in new language.
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
                        // Use coords from weather data if available.
                        const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                        const newData = await getWeather(weather.city, source, currentLanguage, coords);
                        return { ...newData, sourceOverride: source };
                    } catch (e) {
                        console.error(`Failed to refresh weather for ${weather.city}`, e);
                        return weather; // Keep old data on error.
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
                            // Don't refresh if source is manually set.
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

    const handleSearch = async (city: string): Promise<boolean> => {
        if (!city.trim()) return false;

        setError(null);
        setLoading(true);

        // Check if already exists.
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

    const handleLocationRequest = () => {
        setLoading(true);
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
    };

    const handleRemoveCity = async (cityToRemove: string) => {
        const newList = weatherList.filter(w => w.city !== cityToRemove);
        setWeatherList(newList);
        await updateSavedCities(newList);
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

            // If the updated city is currently selected, update it too.
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

        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        // Estimated menu dimensions (adjust if menu size changes)
        const menuWidth = 200;
        const menuHeight = 150;
        const padding = 3; // Safety margin from screen edge

        // Check if menu would overflow screen boundaries
        const isRight = clientX + menuWidth + padding > innerWidth;
        const isBottom = clientY + menuHeight + padding > innerHeight;

        let menuStyle: React.CSSProperties = {};

        if (isBottom && isRight) {
            // Bottom Right
            menuStyle = {
                bottom: innerHeight - clientY,
                right: innerWidth - clientX,
                transformOrigin: "bottom right"
            };
        } else if (isBottom && !isRight) {
            // Bottom Left
            menuStyle = {
                bottom: innerHeight - clientY,
                left: clientX,
                transformOrigin: "bottom left"
            };
        } else if (!isBottom && isRight) {
            // Top Right
            menuStyle = {
                top: clientY,
                right: innerWidth - clientX,
                transformOrigin: "top right"
            };
        } else {
            // Top Left (Default)
            menuStyle = {
                top: clientY,
                left: clientX,
                transformOrigin: "top left"
            };
        }

        setContextMenu({
            show: true,
            x: clientX,
            y: clientY,
            weather: weather,
            menuStyle
        });
    }, []);

    const handleDetailBack = useCallback(() => window.history.back(), []);

    const handleDetailOpenSettings = useCallback(() => {
        setShowSettings(true);
        window.history.pushState({ modal: 'settings' }, '', '');
    }, []);

    // Create a stable wrapper for handleUpdateCitySource to pass to WeatherDetail.
    const onDetailSourceChange = useCallback((source: string | undefined) => {
        if (selectedCity) {
            handleUpdateCitySource(selectedCity.city, source);
        }
    }, [selectedCity, handleUpdateCitySource]);



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
                <SearchBar onSearch={handleSearch} onLocationRequest={handleLocationRequest} />

                {/* Top Right Menu Button */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-4 glass-card rounded-full text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10"
                        aria-label="Main menu"
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
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={weatherList.map(w => w.city)}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4 pb-4">
                        <AnimatePresence mode='popLayout'>
                            {weatherList.map((weather, index) => (
                                <SortableWeatherCard
                                    key={weather.city}
                                    weather={weather}
                                    index={index}
                                    onClick={handleCardClick}
                                    onContextMenu={handleCardContextMenu}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </SortableContext>
            </DndContext>

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
                                style={contextMenu.menuStyle}
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
