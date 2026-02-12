import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WeatherData } from '../services/weatherApi';
import { getSettings, SectionConfig } from '../utils/config';
import { FaCloud, FaTrash, FaInfoCircle, FaCheck } from 'react-icons/fa';
import WeatherDetail from './WeatherDetail';
import SortableWeatherCard from './SortableWeatherCard';
import SettingsModal from './SettingsModal';
import SearchBar from './SearchBar';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';
import { getWeatherBackground } from '../utils/weatherUtils';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { useWeatherList } from '../hooks/useWeatherList';
import { useDashboardContextMenu } from '../hooks/useDashboardContextMenu';
import { useWeatherDragDrop } from '../hooks/useWeatherDragDrop';
import DashboardMenu from './DashboardMenu';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

const contextMenuVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } }
};

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

    const [selectedCity, setSelectedCity] = useState<WeatherData | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Custom Hooks
    const {
        contextMenu,
        confirmDelete,
        setConfirmDelete,
        handleCardContextMenu,
        closeContextMenu
    } = useDashboardContextMenu();

    const { sensors, handleDragEnd } = useWeatherDragDrop(weatherList, reorderCities);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);
    const hasCheckedStartup = useRef(false);
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
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                closeContextMenu();
            }
        };
        if (contextMenu.show) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [contextMenu.show, closeContextMenu]);

    const dominantCondition = weatherList.length > 0 ? weatherList[0].condition : 'default';

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
            {/* Header / Search Section */}
            <div className={`sticky top-0 z-50 w-full max-w-2xl flex items-center gap-3 transition-all duration-500 ease-in-out px-4 sm:px-0 ${isScrolled ? 'py-3' : 'py-6'}`}>
                <SearchBar onSearch={handleSearch} onLocationRequest={handleLocationRequest} isLoading={loading} />

                {/* Top Right Menu */}
                <DashboardMenu
                    refreshing={refreshing}
                    lastRefreshTime={lastRefreshTime}
                    onRefresh={refreshAllCities}
                    onSettings={() => {
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
                                closeContextMenu();
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
                                    if (contextMenu.weather) handleRemoveCityWrapper(contextMenu.weather.city);
                                    closeContextMenu();
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
