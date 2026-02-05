import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getWeather, WeatherData } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud, FaTrash, FaCog, FaSync, FaInfoCircle, FaEllipsisV, FaCheck } from 'react-icons/fa';
import WeatherDetail from './WeatherDetail';
import SortableWeatherCard from './SortableWeatherCard';
import SettingsModal from './SettingsModal';
import SearchBar from './SearchBar';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { getWeatherBackground } from '../utils/weatherUtils';
import { isMobileDevice } from '../utils/env';
import RelativeTime from './RelativeTime';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { processWithConcurrency } from '../utils/asyncUtils';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
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
    menuStyle?: React.CSSProperties;
}

/**
 * Updates the list of saved cities in storage based on the current weather list.
 *
 * @param {WeatherData[]} list - The current list of weather data.
 * @returns {Promise<void>} A promise that resolves when storage is updated.
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
function WeatherDashboard({ onBgChange, bgContainerRef }: WeatherDashboardProps): JSX.Element {
    const { t, currentLanguage } = useI18n();
    const [weatherList, setWeatherList] = useState<WeatherData[]>([]);

    // Optimization: Use ref to hold weatherList to stabilize handleDrop callback
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
        show: false, x: 0, y: 0, weather: null
    });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);

    /**
     * Sensors for handling drag interactions.
     */
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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

    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [enableHardwareAcceleration, setEnableHardwareAcceleration] = useState(true);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastSourceRef = useRef<string | null>(null);

    const loadAppConfig = async () => {
        const settings = await getSettings();
        setDetailViewSections(settings.detailViewSections || []);
        setEnableHardwareAcceleration(settings.enableHardwareAcceleration ?? true);
        if (lastSourceRef.current === null) {
            lastSourceRef.current = settings.source;
        }
    };

    useEffect(() => { loadAppConfig(); }, []);

    // Handle browser back button
    useEffect(() => {
        const handlePopState = () => {
            if (showSettings) setShowSettings(false);
            else if (selectedCity) setSelectedCity(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedCity, showSettings]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, show: false }));
            }
        };
        if (contextMenu.show || showMenu) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [contextMenu.show, showMenu]);

    const dominantCondition = weatherList.length > 0 ? weatherList[0].condition : 'default';

    useEffect(() => {
        if (onBgChange) onBgChange(getWeatherBackground(dominantCondition));
    }, [dominantCondition, onBgChange]);

    useEffect(() => {
        if (lastRefreshTime) storage.setAsync('lastRefreshTime', lastRefreshTime.toISOString());
    }, [lastRefreshTime]);

    useEffect(() => {
        const saveLastViewed = async () => {
            if (selectedCity) {
                await storage.setAsync('lastViewedCity', {
                    name: selectedCity.city,
                    source: selectedCity.sourceOverride
                });
            }
        };
        saveLastViewed();
    }, [selectedCity]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Handle scroll-based background animation
    const handleScroll = useCallback(() => {
        if (!ticking.current) {
            window.requestAnimationFrame(() => {
                const container = scrollContainerRef.current;
                if (!container) {
                    ticking.current = false;
                    return;
                }
                const scrollTop = container.scrollTop;
                setIsScrolled(scrollTop > 10);
                const scrollHeight = container.scrollHeight - container.clientHeight;
                const scrollPercent = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;

                if (bgContainerRef && bgContainerRef.current) {
                    bgContainerRef.current.style.setProperty('--scroll-shift', `${scrollPercent * 45}deg`);
                    bgContainerRef.current.style.setProperty('--intensity', String(scrollPercent));
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
        handleScroll();
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

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
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        };
    }, [setupAutoRefresh]);

    const refreshCitiesGeneric = useCallback(async (
        listToRefresh: WeatherData[],
        transform: (weather: WeatherData) => Promise<WeatherData>,
        onComplete?: (results: WeatherData[]) => Promise<void>
    ) => {
        if (listToRefresh.length === 0 || refreshing) return;

        setRefreshing(true);
        let completedCount = 0;
        let pendingUpdates: WeatherData[] = [];

        try {
            const results = await processWithConcurrency(
                listToRefresh,
                transform,
                5,
                (result) => {
                    pendingUpdates.push(result);
                    completedCount++;

                    // Batch updates
                    if (completedCount % 5 === 0) {
                        const batch = [...pendingUpdates];
                        pendingUpdates = [];
                        setWeatherList(prev => {
                            const updateMap = new Map(batch.map(u => [u.city, u]));
                            return prev.map(w => updateMap.get(w.city) || w);
                        });
                    }
                }
            );

            // Flush remaining updates
            if (pendingUpdates.length > 0) {
                setWeatherList(prev => {
                    const updateMap = new Map(pendingUpdates.map(u => [u.city, u]));
                    return prev.map(w => updateMap.get(w.city) || w);
                });
            }

            setLastRefreshTime(new Date());
            if (onComplete) await onComplete(results);

        } finally {
            setRefreshing(false);
        }
    }, [refreshing]);

    const refreshAllCities = useCallback(async () => {
        await refreshCitiesGeneric(weatherList, async (weather) => {
            try {
                const source = weather.sourceOverride;
                const coords = (weather.lat && weather.lon) ? { lat: weather.lat, lon: weather.lon } : undefined;
                const newData = await getWeather(weather.city, source, currentLanguage, coords);
                return { ...newData, sourceOverride: source };
            } catch (e) {
                console.error(`Failed to refresh weather for ${weather.city}`, e);
                return weather;
            }
        });
    }, [weatherList, refreshCitiesGeneric, currentLanguage]);

    const refreshDefaultSourceCities = useCallback(async () => {
        await refreshCitiesGeneric(weatherList, async (weather) => {
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
    }, [weatherList, refreshCitiesGeneric, currentLanguage]);

    const loadSavedCities = async () => {
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

            // 3. Determine Status (Loading vs Refreshing)
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
            let finalList = cachedWeather || [];
            let results: (WeatherData | null)[] | undefined;

            if (shouldFetch) {
                let currentList = (cachedWeather && cachedWeather.length === savedData.length)
                                  ? [...cachedWeather]
                                  : new Array(savedData.length).fill(null);

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
                            setWeatherList(currentList.filter(w => w !== null) as WeatherData[]);
                        }
                    }
                );

                const validResults = results.filter((w): w is WeatherData => w !== null);
                if (validResults.length > 0) {
                    finalList = validResults;
                    setWeatherList(validResults);
                    setLastRefreshTime(new Date());

                    // Sync names if changed (e.g. localization)
                    const newSavedData = savedData.map((item, idx) => {
                        const weather = results![idx];
                        if (!weather) return item;

                        const name = typeof item === 'string' ? item : item.name;
                        if (name !== weather.city) {
                            return typeof item === 'string' ? weather.city : { ...item, name: weather.city };
                        }
                        return item;
                    });

                    // Check deep equality loosely or just save if any changed
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

            // 6. Handle Startup View
            if (settings.startupView === 'detail') {
                 handleStartupDetailView(finalList, savedData, results);
            }

        } catch (err) {
            console.error("Failed to load saved cities", err);
            setError(t.errors?.loadFailed || "Failed to load");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleStartupDetailView = async (
        finalList: WeatherData[],
        savedData: (string | SavedCity)[],
        results?: (WeatherData | null)[]
    ) => {
        const lastViewed = await storage.get('lastViewedCity');
        if (!lastViewed) return;

        const lastCityName = typeof lastViewed === 'string' ? lastViewed : lastViewed.name;
        let targetCity = finalList.find(w => w.city === lastCityName);

        if (!targetCity) {
            const savedIndex = savedData.findIndex(item => {
                const name = typeof item === 'string' ? item : item.name;
                return name === lastCityName;
            });

            if (savedIndex !== -1) {
                if (results && results[savedIndex]) {
                    targetCity = results[savedIndex] as WeatherData;
                } else if (!results && finalList.length === savedData.length) {
                    targetCity = finalList[savedIndex];
                }
            }
        }

        if (targetCity) {
            setSelectedCity(targetCity);
            if (!selectedCity) {
                window.history.pushState({ city: targetCity.city }, '', '');
            }
        }
    };

    // Reload saved cities when language changes
    useEffect(() => { loadSavedCities(); }, [currentLanguage]);

    const handleSearch = async (city: string): Promise<boolean> => {
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

            const newList = weatherList.map(w => w.city === city ? { ...newData, sourceOverride: source } : w);
            setWeatherList(newList);
            await updateSavedCities(newList);

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
        if (isMobileDevice() && e.type === 'contextmenu') return;

        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const menuWidth = 200;
        const menuHeight = 150;
        const padding = 3;

        const isRight = clientX + menuWidth + padding > innerWidth;
        const isBottom = clientY + menuHeight + padding > innerHeight;

        // Use Math min/max to clamp logic if needed, but the boolean isRight/isBottom is clear here.
        // Simplified the assignment.
        const menuStyle: React.CSSProperties = {
            transformOrigin: `${isBottom ? 'bottom' : 'top'} ${isRight ? 'right' : 'left'}`,
            [isBottom ? 'bottom' : 'top']: isBottom ? innerHeight - clientY : clientY,
            [isRight ? 'right' : 'left']: isRight ? innerWidth - clientX : clientX
        };

        setContextMenu({ show: true, x: clientX, y: clientY, weather, menuStyle });
        setConfirmDelete(null);
    }, []);

    const handleDetailBack = useCallback(() => window.history.back(), []);

    const handleDetailOpenSettings = useCallback(() => {
        setShowSettings(true);
        window.history.pushState({ modal: 'settings' }, '', '');
    }, []);

    const onDetailSourceChange = useCallback((source: string | undefined) => {
        if (selectedCity) handleUpdateCitySource(selectedCity.city, source);
    }, [selectedCity, handleUpdateCitySource]);

    const weatherIds = useMemo(() => weatherList.map(w => w.city), [weatherList]);

    return (
        <div ref={scrollContainerRef} className="flex-1 flex flex-col items-center overflow-y-auto text-white">
            {/* Header / Search Section */}
            <div className={`sticky top-0 z-50 w-full max-w-2xl flex items-center gap-3 transition-all duration-500 ease-in-out px-4 sm:px-0 ${isScrolled ? 'py-3' : 'py-6'}`}>
                <SearchBar onSearch={handleSearch} onLocationRequest={handleLocationRequest} isLoading={loading} />

                {/* Top Right Menu Button */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
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
                                        onClick={() => { refreshAllCities(); setShowMenu(false); }}
                                        disabled={refreshing}
                                        className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors disabled:opacity-50"
                                    >
                                        <FaSync className={`text-blue-300 ${refreshing ? 'animate-spin' : ''}`} />
                                        {refreshing ? t.refresh.refreshing : t.refresh.button}
                                    </button>
                                    <button
                                        onClick={() => { setShowSettings(true); window.history.pushState({ modal: 'settings' }, '', ''); setShowMenu(false); }}
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
            {loading && weatherList.length === 0 && (
                <div className="text-center py-10 animate-pulse text-sm">{t.search.loading}</div>
            )}
            {refreshing && (
                <div className="text-center py-2 text-sm text-white/70">{t.refresh.refreshing}</div>
            )}

            {/* Weather Cards */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={weatherIds} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4 pb-4">
                        <AnimatePresence mode='popLayout'>
                            {weatherList.map((weather, index) => (
                                <SortableWeatherCard
                                    key={weather.city}
                                    weather={weather}
                                    index={index}
                                    onClick={handleCardClick}
                                    onContextMenu={handleCardContextMenu}
                                    enableHardwareAcceleration={enableHardwareAcceleration}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </SortableContext>
            </DndContext>

            {!loading && weatherList.length === 0 && (
                <div className="text-white/60 mt-16 text-center font-light animate-fade-in">
                    <FaCloud className="text-6xl mx-auto mb-4 animate-float" />
                    <p>{t.empty.title}</p>
                    <p className="text-sm">{t.empty.subtitle}</p>
                </div>
            )}

            <AnimatePresence>
                {selectedCity && (
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
                )}
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
                {contextMenu.show && contextMenu.weather && (
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
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirmDelete === contextMenu.weather?.city) {
                                    if (contextMenu.weather) handleRemoveCity(contextMenu.weather.city);
                                    setContextMenu(prev => ({ ...prev, show: false }));
                                    setConfirmDelete(null);
                                } else {
                                    setConfirmDelete(contextMenu.weather?.city || null);
                                }
                            }}
                            className={`menu-item ${confirmDelete === contextMenu.weather?.city ? 'bg-red-500/20 text-red-200' : 'menu-item-danger'}`}
                        >
                            <span className="menu-item-icon">
                                {confirmDelete === contextMenu.weather?.city
                                    ? <FaCheck className="text-red-400" />
                                    : <FaTrash className="text-red-400" />
                                }
                            </span>
                            {confirmDelete === contextMenu.weather?.city ? `${t.remove}?` : t.remove}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default WeatherDashboard;
