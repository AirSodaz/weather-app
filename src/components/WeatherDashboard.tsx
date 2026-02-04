import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WeatherData } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud, FaTrash, FaCog, FaSync, FaInfoCircle, FaEllipsisV } from 'react-icons/fa';
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
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useWeatherCities } from '../hooks/useWeatherCities';

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
    const { t } = useI18n();
    const {
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
        setupAutoRefresh
    } = useWeatherCities();

    const [selectedCity, setSelectedCity] = useState<WeatherData | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false, x: 0, y: 0, weather: null, subMenu: null
    });
    const [showMenu, setShowMenu] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);

    /**
     * Sensors for handling drag interactions.
     * Mouse: Starts after 10px movement.
     * Touch: Requires press and hold (250ms) with 5px tolerance to distinguish from scrolling.
     */
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
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
            reorderCities(active.id as string, over.id as string);
        }
    }, [reorderCities]);

    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [enableHardwareAcceleration, setEnableHardwareAcceleration] = useState(true);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastSourceRef = useRef<string | null>(null);
    const restoredLastView = useRef(false);

    /**
     * Loads application configuration settings.
     */
    const loadAppConfig = async () => {
        const settings = await getSettings();
        setDetailViewSections(settings.detailViewSections || []);
        setEnableHardwareAcceleration(settings.enableHardwareAcceleration ?? true);
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

    // Save last viewed city.
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

    // Auto-dismiss errors after 5 seconds.
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

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

    // Restore last viewed city on load (from startupView setting)
    useEffect(() => {
        const restoreLastViewed = async () => {
            if (restoredLastView.current || weatherList.length === 0) return;

            restoredLastView.current = true;
            const settings = await getSettings();

            if (settings.startupView === 'detail' && !selectedCity) {
                 const lastViewed = await storage.get('lastViewedCity');
                 if (lastViewed) {
                    const lastCityName = typeof lastViewed === 'string' ? lastViewed : lastViewed.name;
                    const targetCity = weatherList.find(w => w.city === lastCityName);

                    if (targetCity) {
                        setSelectedCity(targetCity);
                        // Push state if we are restoring from a "fresh" start (not currently viewing a city).
                        if (!window.history.state?.city) {
                            window.history.pushState({ city: targetCity.city }, '', '');
                        }
                    }
                 }
            }
        };
        restoreLastViewed();
    }, [weatherList, selectedCity]);

    const handleLocationRequest = () => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await addCityByLocation(latitude, longitude);
            },
            (err) => {
                console.error("Geolocation error", err);
                setError("Location access denied or unavailable");
            },
            { timeout: 10000 }
        );
    };

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

        // On mobile, prevent the context menu from showing on long-press (which fires contextmenu)
        // to avoid conflict with the long-press drag gesture.
        // The menu can still be accessed via the ellipsis button (which fires a click event).
        const isMobile = isMobileDevice();
        if (isMobile && e.type === 'contextmenu') {
            return;
        }

        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        // Estimated menu dimensions (adjust if menu size changes)
        const menuWidth = 200;
        const menuHeight = 150;
        const padding = 3; // Safety margin from screen edge

        // Check if menu would overflow screen boundaries
        const isRight = clientX + menuWidth + padding > innerWidth;
        const isBottom = clientY + menuHeight + padding > innerHeight;

        const menuStyle: React.CSSProperties = {
            transformOrigin: `${isBottom ? 'bottom' : 'top'} ${isRight ? 'right' : 'left'}`
        };

        if (isBottom) menuStyle.bottom = innerHeight - clientY;
        else menuStyle.top = clientY;

        if (isRight) menuStyle.right = innerWidth - clientX;
        else menuStyle.left = clientX;

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
    const onDetailSourceChange = useCallback(async (source: string | undefined) => {
        if (selectedCity) {
            const updatedCity = await updateCitySource(selectedCity.city, source);
            if (updatedCity) {
                 setSelectedCity(updatedCity);
            }
        }
    }, [selectedCity, updateCitySource]);

    // Optimization: Memoize the list of IDs for SortableContext.
    const weatherIds = useMemo(() => weatherList.map(w => w.city), [weatherList]);

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
                <SearchBar
                    onSearch={addCity}
                    onLocationRequest={handleLocationRequest}
                    isLoading={loading}
                />

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
                                            refreshAll();
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
                    items={weatherIds}
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
                                    enableHardwareAcceleration={enableHardwareAcceleration}
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
                            onRefresh={refreshAll}
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
                                            removeCity(contextMenu.weather.city);
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
}

export default WeatherDashboard;
