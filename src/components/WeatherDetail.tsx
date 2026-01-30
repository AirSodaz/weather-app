import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { isTauri } from '../utils/env';
import { WeatherData } from '../services/weatherApi';
import {
    FaArrowLeft, FaTint, FaWind, FaCompressArrowsAlt, FaEye,
    FaSun, FaCloud, FaCloudRain, FaSnowflake, FaSmog, FaMoon,
    FaEllipsisV, FaSync, FaCog, FaInfoCircle, FaClock, FaCalendarAlt
} from 'react-icons/fa';
import { useI18n } from '../contexts/I18nContext';
import RelativeTime from './RelativeTime';
import { SectionConfig, DetailSectionId } from '../utils/config';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { getWeatherBackground, getWeatherCategory, WeatherCategory } from '../utils/weatherUtils';

interface WeatherDetailProps {
    weather: WeatherData;
    lastRefreshTime?: Date | null;
    onBack: () => void;
    onSourceChange?: (source: string | undefined) => void;
    onRefresh?: () => void;
    onOpenSettings?: () => void;
    sections?: SectionConfig[];
    layoutId?: string;
}

const DATE_SPLIT_REGEX = /[-/]/;

// Get weather icon based on condition
// Get weather icon based on condition
const WeatherIcon: React.FC<{ condition: string; className?: string }> = ({ condition, className = "text-6xl" }) => {
    const category = getWeatherCategory(condition);
    switch (category) {
        case WeatherCategory.Sunny:
            return <FaSun className={`${className} text-amber-300 animate-spin-slow`} />;
        case WeatherCategory.Rainy:
            return <FaCloudRain className={`${className} text-blue-300 animate-float`} />;
        case WeatherCategory.Snowy:
            return <FaSnowflake className={`${className} text-white animate-float`} />;
        case WeatherCategory.Mist:
            return <FaSmog className={`${className} text-gray-300 animate-float`} />;
        default:
            return <FaCloud className={`${className} text-gray-200 animate-float`} />;
    }
};

// Get AQI color and label
const getAqiColor = (aqi: number): string => {
    const colors = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-purple-400', 'text-rose-900'];
    return colors[aqi - 1] || 'text-gray-400';
};

// Animation variants for staggered children
// Animation variants for staggered children
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1,
            when: "beforeChildren"
        }
    },
    exit: {
        opacity: 1, // Keep container visible during shrink
        transition: {
            when: "afterChildren",
            duration: 0.2
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.1 } // Fast fade out on exit
    }
};

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};

const sectionsContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            when: "beforeChildren"
        }
    }
};

const WeatherDetail: React.FC<WeatherDetailProps> = memo(({
    weather,
    lastRefreshTime,
    onBack,
    onSourceChange,
    onRefresh,
    onOpenSettings,
    sections,
    layoutId
}) => {
    const { t } = useI18n();
    const [showMenu, setShowMenu] = useState(false);
    const [subMenu, setSubMenu] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ticking = useRef(false);
    // Removed scrollStyle state to prevent re-renders on scroll
    const [isScrolled, setIsScrolled] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const isTauriEnv = isTauri();

    // Optimized: Defer heavy content rendering by a single tick
    // This allows the initial shared layout animation frame to start immediately without jank
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 50); // Small 50ms delay is imperceptible but allows animation momentum to start
        return () => clearTimeout(timer);
    }, []);


    // Optimized: Memoize daily forecast names to prevent expensive date parsing on every render
    const dailyForecastWithNames = useMemo(() => {
        if (!weather.dailyForecast) return [];

        const getDayName = (dateStr: string, index: number) => {
            if (index === 0) return t.date.relative.today;
            if (index === 1) return t.date.relative.tomorrow;
            try {
                const parts = dateStr.split(DATE_SPLIT_REGEX);
                if (parts.length >= 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const day = parseInt(parts[2]);
                    const date = new Date(year, month, day);
                    return t.date.days[date.getDay()];
                }
            } catch (e) {
                console.error('Date parse error', e);
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            return t.date.days[date.getDay()];
        };

        return weather.dailyForecast.slice(0, 7).map((day, i) => ({
            ...day,
            dayName: getDayName(day.date, i)
        }));
    }, [weather.dailyForecast, t]);

    const getAqiLabel = (aqi: number) => {
        return t.aqi.levels[aqi - 1] || t.aqi.unknown;
    };

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
                const scrollHeight = container.scrollHeight - container.clientHeight;
                const scrollPercent = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;

                const shiftAngle = scrollPercent * 45;
                const intensity = scrollPercent;

                // Directly update CSS variables to avoid expensive re-renders
                container.style.setProperty('--scroll-shift', `${shiftAngle}deg`);
                container.style.setProperty('--intensity', String(intensity));

                setIsScrolled(scrollTop > 200);

                ticking.current = false;
            });

            ticking.current = true;
        }
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    const handleClose = () => {
        onBack();
    };

    const renderSection = (id: DetailSectionId) => {
        switch (id) {
            case 'hourly':
                return weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                    <motion.div variants={itemVariants} key="hourly" className="w-full glass-card rounded-3xl p-6 mb-6">
                        <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                            <FaClock className="text-gray-300" />
                            {t.weather.hourlyForecast}
                        </h3>
                        <div className="flex gap-6 overflow-x-auto pb-4 pt-2 -mx-2 px-2 snap-x">
                            {weather.hourlyForecast.map((item, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[60px] snap-center">
                                    <span className="text-xs text-white/50 mb-3">{item.time}</span>
                                    <WeatherIcon condition={item.condition} className="text-2xl mb-3" />
                                    <span className="font-bold text-lg">{Math.round(item.temperature)}°</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'daily':
                return dailyForecastWithNames.length > 0 && (
                    <motion.div variants={itemVariants} key="daily" className="w-full glass-card rounded-3xl p-6 mb-6">
                        <h3 className="text-base font-semibold flex items-center gap-2 mb-6">
                            <FaCalendarAlt className="text-gray-300" />
                            {t.weather.dailyForecast}
                        </h3>
                        <div className="space-y-4">
                            {dailyForecastWithNames.map((day, i) => (
                                <div key={i} className="flex items-center justify-between group hover:bg-white/5 p-2 rounded-xl transition-colors -mx-2">
                                    <div className="w-24">
                                        <span className="font-medium block">
                                            {day.dayName}
                                        </span>
                                        <span className="text-xs text-white/40">{day.date}</span>
                                    </div>

                                    <div className="flex-1 flex justify-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <WeatherIcon condition={day.condition} className="text-xl" />
                                            <span className="text-[10px] text-white/40 capitalize">{day.condition}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 w-32 justify-end">
                                        <span className="text-white/40 w-8 text-right font-medium">{Math.round(day.tempMin)}°</span>
                                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                            <div
                                                className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-400 to-amber-400 rounded-full opacity-80"
                                                style={{
                                                    left: '10%', // Ideally calculated based on min/max of the week
                                                    right: '10%'
                                                }}
                                            />
                                        </div>
                                        <span className="font-bold w-8 text-right">{Math.round(day.tempMax)}°</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'airQuality':
                return weather.airQuality && (
                    <motion.div variants={itemVariants} key="airQuality" className="w-full glass-card rounded-3xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-semibold flex items-center gap-2">
                                <FaSmog className="text-gray-300" />
                                <span className="text-base font-semibold flex items-center gap-2">
                                    {t.weather.airQuality}
                                </span>
                            </h3>
                            <span className={`px-3 py-1 rounded-full bg-white/10 text-sm font-bold ${getAqiColor(weather.airQuality.aqi)}`}>
                                {getAqiLabel(weather.airQuality.aqi)}
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { label: 'PM2.5', value: weather.airQuality.pm25 },
                                { label: 'PM10', value: weather.airQuality.pm10 },
                                { label: 'O₃', value: weather.airQuality.o3 },
                                { label: 'NO₂', value: weather.airQuality.no2 },
                            ].map((item) => (
                                <div key={item.label} className="text-center p-3 rounded-xl bg-white/5">
                                    <span className="text-xs text-white/40 block mb-1">{item.label}</span>
                                    <span className="font-semibold text-lg">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'stats':
                return (
                    <motion.div variants={itemVariants} key="stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full mb-6">
                        <div className="glass-card rounded-2xl p-5 flex flex-col items-start relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaTint className="text-6xl" />
                            </div>
                            <div className="relative z-10">
                                <span className="text-xs uppercase tracking-wider text-white/50 mb-1 block">{t.weather.humidity}</span>
                                <span className="text-2xl font-bold">{weather.humidity}%</span>
                            </div>
                        </div>
                        <div className="glass-card rounded-2xl p-5 flex flex-col items-start relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaWind className="text-6xl" />
                            </div>
                            <div className="relative z-10">
                                <span className="text-xs uppercase tracking-wider text-white/50 mb-1 block">{t.weather.wind}</span>
                                <span className="text-2xl font-bold">{weather.windSpeed.toFixed(2)} km/h</span>
                            </div>
                        </div>
                        <div className="glass-card rounded-2xl p-5 flex flex-col items-start relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaCompressArrowsAlt className="text-6xl" />
                            </div>
                            <div className="relative z-10">
                                <span className="text-xs uppercase tracking-wider text-white/50 mb-1 block">{t.weather.pressure}</span>
                                <span className="text-2xl font-bold">{weather.pressure} hPa</span>
                            </div>
                        </div>
                        <div className="glass-card rounded-2xl p-5 flex flex-col items-start relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaEye className="text-6xl" />
                            </div>
                            <div className="relative z-10">
                                <span className="text-xs uppercase tracking-wider text-white/50 mb-1 block">{t.weather.visibility}</span>
                                <span className="text-2xl font-bold">{weather.visibility} km</span>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'sunrise':
                return weather.sunrise && weather.sunset && (
                    <motion.div variants={itemVariants} key="sunrise" className="w-full glass-card rounded-3xl p-6 mb-6 flex justify-around items-center">
                        <div className="flex flex-col items-center gap-2">
                            <FaSun className="text-3xl text-amber-300" />
                            <div className="text-center">
                                <span className="text-xs text-white/50 uppercase tracking-widest block mb-0.5">{t.weather.sunrise}</span>
                                <span className="text-xl font-medium">{weather.sunrise}</span>
                            </div>
                        </div>
                        <div className="w-px h-12 bg-white/10"></div>
                        <div className="flex flex-col items-center gap-2">
                            <FaMoon className="text-3xl text-indigo-300" />
                            <div className="text-center">
                                <span className="text-xs text-white/50 uppercase tracking-widest block mb-0.5">{t.weather.sunset}</span>
                                <span className="text-xl font-medium">{weather.sunset}</span>
                            </div>
                        </div>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    // Determine sections to show
    // If no sections prop is provided, show all in default order (backward compatibility/fallback)
    const effectiveSections: SectionConfig[] = sections && sections.length > 0
        ? sections
        : [
            { id: 'hourly', visible: true },
            { id: 'daily', visible: true },
            { id: 'airQuality', visible: true },
            { id: 'stats', visible: true },
            { id: 'sunrise', visible: true }
        ];

    return (
        <motion.div
            layoutId={layoutId} // Hero transition linkage
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            ref={scrollContainerRef}
            className={`
                absolute inset-0 z-50 flex flex-col text-white overflow-y-auto 
                weather-bg ${getWeatherBackground(weather.condition)}
                will-change-transform
                ${isTauriEnv ? 'pt-12' : ''}
            `}
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            {/* Header */}
            <div className="w-full flex items-center justify-between p-6 sticky top-0 z-50 transition-all duration-300">
                <button
                    onClick={handleClose}
                    className="p-4 glass-card rounded-full transition-all hover:bg-white/20 hover:scale-105 active:scale-95 group"
                    aria-label={t.back}
                >
                    <FaArrowLeft className="text-xl group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-300 glass-card px-6 py-2 rounded-full backdrop-blur-md border border-white/10 ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                    <span className="font-bold text-lg leading-tight shadow-sm text-white">{weather.city}</span>
                    <span className="text-xs font-medium opacity-80 text-white/90">{Math.round(weather.temperature)}° | {weather.condition}</span>
                </div>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-4 glass-card rounded-full text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
                    >
                        <FaEllipsisV className="text-xl" />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                                <motion.div
                                    key="detail-menu"
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="absolute right-0 top-full mt-3 w-56 glass-card rounded-2xl py-2 shadow-2xl flex flex-col z-50"
                                >
                                    {lastRefreshTime && (
                                        <div className="px-5 py-3 text-sm font-medium text-white/40 border-b border-white/10 uppercase tracking-wider">
                                            {t.refresh.lastUpdate}: <RelativeTime date={lastRefreshTime} />
                                        </div>
                                    )}

                                    {onRefresh && (
                                        <button
                                            onClick={() => {
                                                onRefresh();
                                                setShowMenu(false);
                                            }}
                                            className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                                        >
                                            <FaSync className="text-blue-300" />
                                            {t.refresh.button}
                                        </button>
                                    )}

                                    {onOpenSettings && (
                                        <button
                                            onClick={() => {
                                                onOpenSettings();
                                                setShowMenu(false);
                                            }}
                                            className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                                        >
                                            <FaCog className="text-slate-300" />
                                            {t.settings.title}
                                        </button>
                                    )}

                                    <div className="border-t border-white/5 my-1"></div>

                                    {/* Data Source Submenu */}
                                    {onSourceChange && (
                                        <div
                                            className="relative group w-full"
                                            onMouseLeave={() => setSubMenu(null)}
                                        >
                                            <button
                                                className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center justify-between group-hover:bg-white/10 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSubMenu(subMenu === 'source' ? null : 'source');
                                                }}
                                                onMouseEnter={() => window.innerWidth >= 640 && setSubMenu('source')}
                                            >
                                                <span className="flex items-center gap-3">
                                                    <FaCloud className="text-gray-300" />
                                                    {t.settings.weatherSource}
                                                </span>
                                                <span className={`text-xs text-white/50 transition-transform duration-200 ${subMenu === 'source' ? 'rotate-90 sm:rotate-0' : ''}`}>▸</span>
                                            </button>

                                            {subMenu === 'source' && (
                                                <>
                                                    {/* Mobile Submenu (Inline, simpler style) */}
                                                    <div className="block sm:hidden bg-white/5 rounded-xl mx-2 mb-2 overflow-hidden animate-fade-in">
                                                        <div className="px-4 py-2 text-xs text-white/40 uppercase tracking-widest font-semibold border-b border-white/5">
                                                            {t.switchSource}
                                                        </div>
                                                        {['openweathermap', 'weatherapi', 'qweather'].map((src) => (
                                                            <button
                                                                key={src}
                                                                onClick={async () => {
                                                                    if (onSourceChange) {
                                                                        onSourceChange(src);
                                                                        setShowMenu(false);
                                                                    }
                                                                }}
                                                                className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between active:bg-white/10 transition-colors
                                                                ${weather.source === src || weather.sourceOverride === src ? 'text-blue-300 bg-white/5' : 'text-white/80'}
                                                            `}
                                                            >
                                                                <span>
                                                                    {src === 'openweathermap' ? t.settings.openWeatherMap :
                                                                        src === 'weatherapi' ? t.settings.weatherapi :
                                                                            t.settings.qweather}
                                                                </span>
                                                                {(weather.source === src || weather.sourceOverride === src) && <FaInfoCircle className="text-xs" />}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => {
                                                                if (onSourceChange) {
                                                                    onSourceChange(undefined);
                                                                    setShowMenu(false);
                                                                }
                                                            }}
                                                            className={`w-full px-4 py-3 text-left text-sm flex items-center gap-2 text-white/50 italic active:bg-white/10 transition-colors`}
                                                        >
                                                            <span>{t.default || 'Default (Global)'}</span>
                                                        </button>
                                                    </div>

                                                    {/* Desktop Submenu (Popup, Glass Card style) */}
                                                    <div
                                                        className="hidden sm:block absolute right-full top-0 mr-1 glass-card rounded-2xl py-2 shadow-2xl min-w-[160px] animate-context-menu z-[110]"
                                                        onMouseEnter={() => setSubMenu('source')}
                                                    >
                                                        <div className="px-5 py-1.5 text-xs text-white/40 uppercase tracking-widest font-semibold">
                                                            {t.switchSource}
                                                        </div>
                                                        {['openweathermap', 'weatherapi', 'qweather'].map((src) => (
                                                            <button
                                                                key={src}
                                                                onClick={() => {
                                                                    if (onSourceChange) {
                                                                        onSourceChange(src);
                                                                        setShowMenu(false);
                                                                    }
                                                                }}
                                                                className={`w-full px-5 py-2.5 text-left text-base flex items-center justify-between hover:bg-white/10 transition-colors
                                                                ${weather.source === src || weather.sourceOverride === src ? 'text-blue-300 bg-white/5' : 'text-white/80'}
                                                            `}
                                                            >
                                                                <span>
                                                                    {src === 'openweathermap' ? t.settings.openWeatherMap :
                                                                        src === 'weatherapi' ? t.settings.weatherapi :
                                                                            t.settings.qweather}
                                                                </span>
                                                                {(weather.source === src || weather.sourceOverride === src) && <FaInfoCircle className="text-xs" />}
                                                            </button>
                                                        ))}
                                                        <div className="border-t border-white/5 my-1"></div>
                                                        <button
                                                            onClick={() => {
                                                                if (onSourceChange) {
                                                                    onSourceChange(undefined);
                                                                    setShowMenu(false);
                                                                }
                                                            }}
                                                            className={`w-full px-5 py-2.5 text-left text-base flex items-center gap-2 hover:bg-white/10 text-white/50 italic transition-colors`}
                                                        >
                                                            <span>{t.default || 'Default (Global)'}</span>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center px-4 sm:px-6 pb-12 w-full max-w-4xl mx-auto">
                {/* Main Weather Info */}
                <motion.div variants={itemVariants} className="text-center mb-10 w-full">
                    <motion.h1
                        layoutId={`${layoutId}-city`}
                        className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-md"
                    >
                        {weather.city}
                    </motion.h1>
                    <motion.p
                        layoutId={`${layoutId}-condition`}
                        className="text-lg font-medium text-white/80 capitalize mb-6 drop-shadow-sm"
                    >
                        {weather.condition}
                    </motion.p>

                    <div className="flex flex-col items-center justify-center mb-6">
                        <motion.div layoutId={`${layoutId}-icon`}>
                            <WeatherIcon condition={weather.condition} className="text-8xl mb-4 drop-shadow-2xl" />
                        </motion.div>
                        <motion.span
                            layoutId={`${layoutId}-temp`}
                            className="text-9xl font-thin tracking-tighter leading-none ml-4 drop-shadow-lg inline-block"
                        >
                            {Math.round(weather.temperature)}°
                        </motion.span>
                    </div>

                    <div className="glass-card text-white/80 text-sm font-medium tracking-wide inline-block px-6 py-2 rounded-full border border-white/10">
                        {t.weather.feelsLike} <span className="text-white font-bold ml-1">{Math.round(weather.feelsLike)}°</span>
                    </div>
                </motion.div>

                {/* Dynamic Sections */}
                {/* Dynamic Sections - Render only when ready */}
                {isReady && (
                    <motion.div
                        variants={sectionsContainerVariants}
                        initial="hidden"
                        animate="visible"
                        className="w-full"
                    >
                        {effectiveSections.filter(s => s.visible).map(section => renderSection(section.id))}
                    </motion.div>
                )}

                {/* Source Display Footer */}
                <motion.div variants={itemVariants} className="mt-8 text-center relative z-20">
                    <div className="glass-card text-white/80 text-sm font-medium tracking-wide inline-flex items-center gap-2 px-6 py-2 rounded-full border border-white/10">
                        {t.weather.source}: <span className="text-white font-bold">{weather.source}</span>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
});

export default WeatherDetail;

