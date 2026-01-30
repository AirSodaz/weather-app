import React, { memo } from 'react';
import { FaSun, FaCloud, FaCloudRain, FaSnowflake, FaWind, FaTint, FaSmog } from 'react-icons/fa';
import { WeatherData } from '../services/weatherApi';
import { motion } from 'framer-motion';
import { getWeatherCategory, WeatherCategory } from '../utils/weatherUtils';

/**
 * Props for the WeatherCard component.
 */
interface WeatherCardProps {
    /** The weather data to display. */
    weather: WeatherData;
    /** Callback triggered when the card is clicked. */
    onClick: (weather: WeatherData) => void;
    /** Callback triggered when the card is right-clicked. */
    onContextMenu: (e: React.MouseEvent, weather: WeatherData) => void;
    /** Whether the card is draggable. */
    draggable?: boolean;
    /** Callback for drag start event. */
    onDragStart?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    /** Callback for drag over event. */
    onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
    /** Callback for drag enter event. */
    onDragEnter?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    /** Callback for drag leave event. */
    onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
    /** Callback for drop event. */
    onDrop?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    /** Callback for drag end event. */
    onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
    /** Whether the card is currently being dragged. */
    isDragging?: boolean;
    /** Whether an item is being dragged over the card. */
    isDragOver?: boolean;
    /** The index of the card in the list. */
    index: number;
    /** Shared layout ID for Framer Motion animations. */
    layoutId?: string;
}

/**
 * Renders the appropriate weather icon based on the condition string.
 *
 * @param {object} props - Component props.
 * @param {string} props.condition - The weather condition string.
 * @param {string} [props.className] - Optional CSS classes.
 * @returns {JSX.Element} The icon component.
 */
const WeatherIcon: React.FC<{ condition: string; className?: string }> = ({ condition, className = "text-5xl" }) => {
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

/**
 * A draggable card component displaying a summary of weather data for a city.
 * Supports keyboard navigation and shared element transitions.
 *
 * @param {WeatherCardProps} props - The component props.
 * @returns {JSX.Element} The weather card component.
 */
const WeatherCard: React.FC<WeatherCardProps> = memo(({
    weather,
    onClick,
    onContextMenu,
    draggable,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd,
    isDragging,
    isDragOver,
    index,
    layoutId
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(weather);
        }
    };

    return (
        <motion.div
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            layoutId={layoutId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
                layout: { duration: 0.3, delay: 0 }, // Instant start for shared element transition.
                opacity: { duration: 0.3, delay: index * 0.1 },
                y: { duration: 0.3, delay: index * 0.1 }
            }}
            draggable={draggable}
            onClick={() => onClick(weather)}
            onContextMenu={(e) => onContextMenu(e, weather)}
            onDragStart={(e: any) => onDragStart && onDragStart(e, index)}
            onDragOver={(e: any) => onDragOver && onDragOver(e)}
            onDragEnter={(e: any) => onDragEnter && onDragEnter(e, index)}
            onDragLeave={(e: any) => onDragLeave && onDragLeave(e)}
            onDrop={(e: any) => onDrop && onDrop(e, index)}
            onDragEnd={(e: any) => onDragEnd && onDragEnd(e)}
            className={`
                relative glass-card rounded-3xl p-6 flex flex-col h-full
                cursor-pointer
                hover:shadow-2xl
                group
                will-change-transform
                transition-transform duration-300 ease-out
                hover:scale-[1.02] hover:-translate-y-1
                active:scale-[0.98]
                focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none
                ${isDragging ? 'dragging' : ''}
                ${isDragOver ? 'drag-over' : ''}
            `}
        >
            {/* Main Content */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <motion.h2
                        layoutId={`${layoutId}-city`}
                        className="text-2xl font-bold tracking-tight mb-1 text-white group-hover:text-white/90 transition-colors line-clamp-2 overflow-hidden"
                    >
                        {weather.city}
                    </motion.h2>
                    <motion.p
                        layoutId={`${layoutId}-condition`}
                        className="text-sm font-medium text-white/60 capitalize tracking-wide flex items-center gap-2"
                    >
                        {weather.condition}
                        {weather.sourceOverride && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10">
                                {weather.sourceOverride === 'openweathermap' ? 'OWM' :
                                    weather.sourceOverride === 'weatherapi' ? 'WAPI' : 'QW'}
                            </span>
                        )}
                    </motion.p>
                </div>
                <div className="pl-4">
                    <motion.div layoutId={`${layoutId}-icon`}>
                        <WeatherIcon condition={weather.condition} className="text-5xl drop-shadow-lg" />
                    </motion.div>
                </div>
            </div>

            {/* Temperature */}
            <div className="mb-6 mt-auto">
                <motion.span
                    layoutId={`${layoutId}-temp`}
                    className="text-7xl font-light tracking-tighter text-white inline-block"
                >
                    {Math.round(weather.temperature)}°
                </motion.span>
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

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
});

export default WeatherCard;
