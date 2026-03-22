import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WeatherData } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud } from 'react-icons/fa';
import WeatherDetail from './WeatherDetail';
import SortableWeatherCard from './SortableWeatherCard';
import SettingsModal from './SettingsModal';
import SearchBar from './SearchBar';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { getWeatherBackground } from '../utils/weatherUtils';
import { AnimatePresence } from 'framer-motion';
import { useWeatherList } from '../hooks/useWeatherList';
import { useDashboardContextMenu } from '../hooks/useDashboardContextMenu';
import { useWeatherAlerts } from '../hooks/useWeatherAlerts';
import DashboardMenu from './DashboardMenu';
import DashboardContextMenu from './DashboardContextMenu';
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

interface WeatherDashboardProps {
    onBgChange?: (bgClass: string) => void;
    bgContainerRef?: React.RefObject<HTMLDivElement>;
}

function WeatherDashboard({ onBgChange, bgContainerRef }: WeatherDashboardProps): JSX.Element {
    const { t } = useI18n();
    const {
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
    } = useWeatherList();

    const { activeAlerts, dismissAlert } = useWeatherAlerts(weatherList);

    const [selectedCity, setSelectedCity] = useState<WeatherData | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const {
        contextMenu,
        confirmDelete,
        setConfirmDelete,
        contextMenuRef,
        handleCardContextMenu,
        closeContextMenu
    } = useDashboardContextMenu();

    const [showMenu, setShowMenu] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);
    const hasCheckedStartup = useRef(false);

    // Sensors for drag interactions
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
            reorderCities(oldIndex, newIndex);
        }
    }, [weatherList, reorderCities]);

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

    // Handle startup view
    useEffect(() => {
        const checkStartup = async () => {
            if (loading || hasCheckedStartup.current) return;

            const settings = await getSettings();
            if (settings.startupView === 'detail') {
                 const lastViewed = await storage.get('lastViewedCity');
                 if (lastViewed) {
                     const name = typeof lastViewed === 'string' ? lastViewed : lastViewed.name;
                     const target = weatherList.find(w => w.city === name);
                     if (target) {
                         setSelectedCity(target);
                     }
                 }
            }
            hasCheckedStartup.current = true;
        };
        checkStartup();
    }, [loading, weatherList]);

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
        const handleClickOutside = () => {
            // Note: Context menu closing is handled internally by useDashboardContextMenu
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [showMenu]);

    const dominantCondition = weatherList.length > 0 ? weatherList[0].condition : 'default';
    const hasOfflineData = weatherList.some(w => w.isOffline) || (selectedCity?.isOffline ?? false);

    useEffect(() => {
        if (onBgChange) onBgChange(getWeatherBackground(dominantCondition));
    }, [dominantCondition, onBgChange]);

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

    const handleSearch = async (city: string) => {
        return await addCity(city);
    };

    const handleLocationRequest = async () => {
        await addCityByLocation();
    };

    const handleRemoveCityWrapper = async (cityToRemove: string) => {
        await removeCity(cityToRemove);
    };

    const handleUpdateCitySourceWrapper = useCallback(async (city: string, source: string | undefined) => {
        const newData = await updateCitySource(city, source);
        if (newData && selectedCity && selectedCity.city === city) {
            setSelectedCity(newData);
        }
    }, [updateCitySource, selectedCity]);

    const handleSettingsChange = async () => {
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

    const handleDetailBack = useCallback(() => window.history.back(), []);

    const handleDetailOpenSettings = useCallback(() => {
        setShowSettings(true);
        window.history.pushState({ modal: 'settings' }, '', '');
    }, []);

    const onDetailSourceChange = useCallback((source: string | undefined) => {
        if (selectedCity) handleUpdateCitySourceWrapper(selectedCity.city, source);
    }, [selectedCity, handleUpdateCitySourceWrapper]);

    const weatherIds = useMemo(() => weatherList.map(w => w.city), [weatherList]);

    return (
        <div ref={scrollContainerRef} className="flex-1 flex flex-col items-center overflow-y-auto text-white">
            {hasOfflineData && (
                <div className="w-full bg-yellow-500/80 text-white text-center py-1 text-sm font-medium sticky top-0 z-[60]">
                    No network connection. Showing last cached data.
                </div>
            )}

            {activeAlerts.length > 0 && (
                <div className="w-full bg-red-500/90 text-white text-center py-2 text-sm font-medium sticky top-0 z-[60] flex flex-col items-center gap-1 shadow-md">
                    {activeAlerts.map(alert => (
                        <div key={`${alert.city}-${alert.condition}`} className="flex items-center gap-2 justify-center w-full px-4">
                            <span>⚠️ {alert.city}: {alert.message}</span>
                            <button
                                onClick={() => dismissAlert(alert.city)}
                                className="ml-auto bg-black/20 hover:bg-black/30 text-white px-2 py-0.5 rounded text-xs transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {/* Header / Search Section */}
            <div className={`sticky ${hasOfflineData ? 'top-7' : 'top-0'} z-50 w-full max-w-2xl flex items-center gap-3 transition-all duration-500 ease-in-out px-4 sm:px-0 ${isScrolled ? 'py-3' : 'py-6'}`}>
                <SearchBar onSearch={handleSearch} onLocationRequest={handleLocationRequest} isLoading={loading} />

                {/* Top Right Menu Button */}
                <DashboardMenu
                    showMenu={showMenu}
                    setShowMenu={setShowMenu}
                    lastRefreshTime={lastRefreshTime}
                    refreshing={refreshing}
                    onRefreshAll={refreshAllCities}
                    onOpenSettings={() => {
                        setShowSettings(true);
                        window.history.pushState({ modal: 'settings' }, '', '');
                    }}
                />
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
                    <DashboardContextMenu
                        key={`${contextMenu.x}-${contextMenu.y}-${contextMenu.weather.city}`}
                        contextMenu={contextMenu}
                        contextMenuRef={contextMenuRef}
                        confirmDelete={confirmDelete}
                        onViewDetails={() => {
                            setSelectedCity(contextMenu.weather);
                            closeContextMenu();
                        }}
                        onDeleteClick={(e) => {
                            e.stopPropagation();
                            if (confirmDelete === contextMenu.weather?.city) {
                                if (contextMenu.weather) handleRemoveCityWrapper(contextMenu.weather.city);
                                closeContextMenu();
                            } else {
                                setConfirmDelete(contextMenu.weather?.city || null);
                            }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default WeatherDashboard;
