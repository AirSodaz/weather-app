import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { WeatherData } from '../services/weatherApi';
import WeatherCard from './WeatherCard';

/**
 * Props for the SortableWeatherCard component.
 */
interface SortableWeatherCardProps {
    /** The weather data object to display. */
    weather: WeatherData;
    /** The index of the card in the list, used for staggered animation delays. */
    index: number;
    /** Callback fired when the card is clicked. */
    onClick: (weather: WeatherData) => void;
    /** Callback fired when the card is right-clicked (context menu). */
    onContextMenu: (e: React.MouseEvent, weather: WeatherData) => void;
}

/**
 * A wrapper component that makes WeatherCard sortable using @dnd-kit.
 * Handles drag-and-drop interactions and animations.
 *
 * @param {SortableWeatherCardProps} props - The component props.
 * @returns {JSX.Element} The sortable weather card component.
 */
const SortableWeatherCard: React.FC<SortableWeatherCardProps> = ({
    weather,
    index,
    onClick,
    onContextMenu,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: weather.city });

    // Combine dnd-kit transform with custom styles
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        touchAction: 'none',
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            layoutId={`weather-card-${weather.city}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{
                opacity: isDragging ? 0.8 : 1,
                y: 0,
                scale: isDragging ? 1.05 : 1,
                boxShadow: isDragging
                    ? '0 20px 40px rgba(0, 0, 0, 0.3)'
                    : '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                zIndex: isDragging ? 50 : 0,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
                layout: { duration: 0.3, delay: 0 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                boxShadow: { duration: 0.2 },
                y: { duration: 0.3, delay: index * 0.05 }
            }}
            whileHover={!isDragging ? {
                scale: 1.02,
                y: -4,
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)'
            } : undefined}
            whileTap={!isDragging ? { scale: 0.98 } : undefined}
            className={`
                relative glass-card rounded-3xl p-6 flex flex-col h-full
                cursor-grab active:cursor-grabbing
                group
                will-change-transform
                focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none
                ${isDragging ? 'cursor-grabbing' : ''}
            `}
            {...attributes}
            {...listeners}
            onClick={() => onClick(weather)}
            onContextMenu={(e) => onContextMenu(e, weather)}
        >
            <WeatherCard
                weather={weather}
                onShowActions={(e) => onContextMenu(e, weather)}
            />

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
};

export default SortableWeatherCard;
