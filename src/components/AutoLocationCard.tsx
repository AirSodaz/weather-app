import { memo } from 'react';
import { motion } from 'framer-motion';
import { FaLocationArrow, FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import { WeatherData } from '../services/weatherApi';
import WeatherCard from './WeatherCard';
import { AutoLocationStatus } from '../hooks/useAutoLocation';

interface AutoLocationCardProps {
    weatherData: WeatherData | null;
    status: AutoLocationStatus;
    errorMsg: string | null;
    onClick: (weather: WeatherData) => void;
    onFocusSearch?: () => void;
}

function AutoLocationCard({ weatherData, status, errorMsg, onClick, onFocusSearch }: AutoLocationCardProps): JSX.Element {

    const isLocating = status === 'locating';

    // If no data and not locating, show an empty state or error state
    if (!weatherData && !isLocating) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative glass-card rounded-3xl p-6 flex flex-col items-center justify-center h-full w-full max-w-2xl min-h-[200px]"
            >
                <div className="text-white/60 mb-4 text-center">
                    <FaLocationArrow className="text-4xl mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-lg">{errorMsg || "Location unavailable"}</p>
                    <p className="text-sm mt-1">Please enable location services or search for a city.</p>
                </div>
                {onFocusSearch && (
                    <button
                        onClick={onFocusSearch}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors"
                    >
                        <FaSearch className="text-sm" />
                        <span>Search City</span>
                    </button>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={!isLocating ? { scale: 1.02, y: -4, boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)' } : undefined}
            whileTap={!isLocating ? { scale: 0.98 } : undefined}
            onClick={() => weatherData && onClick(weatherData)}
            className={`
                relative glass-card rounded-3xl p-6 flex flex-col h-full w-full max-w-2xl
                group transition-all
                focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none
                ${weatherData && !isLocating ? 'cursor-pointer' : 'cursor-default'}
                ${isLocating && !weatherData ? 'min-h-[200px] flex items-center justify-center' : ''}
            `}
        >
            {/* Status Header */}
            <div className="absolute top-4 left-6 flex items-center gap-2 z-10 bg-black/20 px-3 py-1 rounded-full text-xs font-medium text-white/90 backdrop-blur-sm">
                {isLocating && (
                    <div className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                )}
                {!isLocating && status === 'success' && <FaLocationArrow className="text-[10px]" />}
                {!isLocating && (status === 'error' || status === 'denied') && <FaExclamationTriangle className="text-yellow-400 text-[10px]" />}
                {!isLocating && status === 'cached' && <FaLocationArrow className="text-white/60 text-[10px]" />}

                <span>
                    {isLocating && 'Locating...'}
                    {!isLocating && status === 'success' && 'Current Location'}
                    {!isLocating && status === 'cached' && 'Last Known Location'}
                    {!isLocating && status === 'error' && 'Location Unavailable'}
                    {!isLocating && status === 'denied' && 'Location Denied'}
                </span>
            </div>

            {/* Error Message below header if we have data but also an error (e.g., using cache) */}
            {errorMsg && weatherData && !isLocating && (
                <div className="absolute top-12 left-6 text-[10px] text-yellow-300/80 z-10 max-w-[80%] truncate">
                    {errorMsg}
                </div>
            )}

            {isLocating && !weatherData ? (
                <div className="text-white/60 flex flex-col items-center">
                    <p className="animate-pulse">Finding your location...</p>
                </div>
            ) : weatherData ? (
                <div className="mt-8 relative z-0">
                    <WeatherCard weather={weatherData} />
                </div>
            ) : null}

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
}

export default memo(AutoLocationCard);
