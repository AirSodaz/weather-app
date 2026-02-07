import React, { memo, useCallback } from 'react';
import { FaWind, FaTint, FaEllipsisV } from 'react-icons/fa';
import { WeatherData } from '../services/weatherApi';
import WeatherIcon from './WeatherIcon';

/**
 * Props for the WeatherCard component.
 */
interface WeatherCardProps {
    /** The weather data to display. */
    weather: WeatherData;
    /** Optional callback to show actions menu. */
    onShowActions?: (e: React.MouseEvent) => void;
}

const SOURCE_LABELS: Record<string, string> = {
    openweathermap: 'OWM',
    weatherapi: 'WAPI',
    qweather: 'QW'
};

/**
 * Helper to get the display label for a weather source.
 *
 * @param {string} source - The source identifier.
 * @returns {string} The display label.
 */
function getSourceLabel(source: string): string {
    return SOURCE_LABELS[source] || 'QW';
}

/**
 * A card component displaying a summary of weather data for a city.
 * Used inside Reorder.Item for drag-to-reorder functionality.
 *
 * @param {WeatherCardProps} props - The component props.
 * @returns {JSX.Element} The weather card content.
 */
function WeatherCard({
    weather,
    onShowActions
}: WeatherCardProps): JSX.Element {

    const handleActionsClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onShowActions?.(e);
    }, [onShowActions]);

    return (
        <>
            {/* Actions Button */}
            {onShowActions && (
                <button
                    onClick={handleActionsClick}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white rounded-full transition-colors hover:bg-white/10 active:scale-95 focus-visible:bg-white/20 focus-visible:outline-none z-10"
                    aria-label="More actions"
                >
                    <FaEllipsisV />
                </button>
            )}

            {/* Main Content */}
            <div className="flex justify-between items-start mb-6 gap-4">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold tracking-tight mb-1 text-white group-hover:text-white/90 transition-colors line-clamp-2 overflow-hidden pr-12">
                        {weather.city.replace(/\//g, '/\u200B')}
                    </h2>
                    <p className="text-sm font-medium text-white/60 capitalize tracking-wide flex items-center gap-2">
                        {weather.condition}
                        {weather.sourceOverride && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10">
                                {getSourceLabel(weather.sourceOverride)}
                            </span>
                        )}
                    </p>
                </div>
                <div className="mt-8 shrink-0">
                    <WeatherIcon condition={weather.condition} className="text-6xl drop-shadow-lg" />
                </div>
            </div>

            {/* Temperature */}
            <div className="mb-6 mt-auto">
                <span className="text-7xl font-light tracking-tighter text-white inline-block">
                    {Math.round(weather.temperature)}°
                </span>
            </div>

            {/* Footer Metrics */}
            <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-white/70">
                    <FaTint className="text-blue-300/80" />
                    <span className="text-sm font-medium">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                    <FaWind className="text-slate-300/80" />
                    <span className="text-sm font-medium">{weather.windSpeed.toFixed(2)} km/h</span>
                </div>
            </div>
        </>
    );
}

export default memo(WeatherCard);
