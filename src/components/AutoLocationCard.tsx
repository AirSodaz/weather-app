import { memo } from 'react';
import { FaLocationArrow, FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import { WeatherData } from '../services/weatherApi';
import WeatherCard from './WeatherCard';

interface AutoLocationCardProps {
    weather: WeatherData;
    onClick: (weather: WeatherData) => void;
    onManualSearch?: () => void;
}

function AutoLocationCard({ weather, onClick, onManualSearch }: AutoLocationCardProps): JSX.Element {
    const status = weather.autoLocationStatus;

    let StatusIcon = FaLocationArrow;
    let statusText = 'Current Location';
    let statusColor = 'text-white/60';

    if (status === 'locating') {
        statusText = 'Locating...';
        statusColor = 'text-white/40 animate-pulse';
    } else if (status === 'denied' || status === 'error') {
        StatusIcon = FaExclamationTriangle;
        statusText = status === 'denied' ? 'Location denied' : 'Location error';
        statusColor = 'text-red-300/80';
    } else if (status === 'fallback') {
        statusText = 'Last known location';
        statusColor = 'text-yellow-300/80';
    }

    return (
        <div
            className={`
                relative glass-card rounded-3xl p-6 flex flex-col h-full
                cursor-pointer group will-change-transform
                focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none
                transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl
                ${status === 'locating' ? 'opacity-80 pointer-events-none' : ''}
            `}
            onClick={() => {
                if (status !== 'locating' && weather.condition) {
                    onClick(weather);
                }
            }}
        >
            <div className="absolute top-4 left-6 flex items-center gap-2 z-10">
                <StatusIcon className={`text-sm ${statusColor} ${status === 'locating' ? 'animate-bounce' : ''}`} />
                <span className={`text-xs font-semibold tracking-wider uppercase ${statusColor}`}>
                    {statusText}
                </span>
            </div>

            {onManualSearch && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onManualSearch();
                    }}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white rounded-full transition-colors hover:bg-white/10 active:scale-95 focus-visible:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none z-10"
                    aria-label="Search manually"
                    title="Search manually"
                >
                    <FaSearch />
                </button>
            )}

            <div className="mt-4 flex-1 flex flex-col">
                {weather.condition ? (
                    <WeatherCard weather={weather} />
                ) : (
                    <div className="flex-1 flex items-center justify-center min-h-[150px]">
                        <p className="text-white/60 text-sm text-center">
                            {status === 'locating' ? 'Fetching your location...' : 'Unable to determine location. Please search manually.'}
                        </p>
                    </div>
                )}
            </div>

            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>
    );
}

export default memo(AutoLocationCard);
