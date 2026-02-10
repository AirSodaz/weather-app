import { memo } from 'react';
import { FaSun, FaCloud, FaCloudRain, FaSnowflake, FaSmog } from 'react-icons/fa';
import { getWeatherCategory, WeatherCategory } from '../utils/weatherUtils';

export interface WeatherIconProps {
    condition: string;
    className?: string;
}

/**
 * Renders the appropriate weather icon based on the condition string.
 *
 * @param {WeatherIconProps} props - Component props.
 * @returns {JSX.Element} The icon component.
 */
function WeatherIcon({ condition, className = "text-5xl" }: WeatherIconProps): JSX.Element {
    const category = getWeatherCategory(condition);
    switch (category) {
        case WeatherCategory.Sunny:
            return <FaSun className={`${className} text-amber-300 animate-spin-slow`} aria-hidden="true" />;
        case WeatherCategory.Rainy:
            return <FaCloudRain className={`${className} text-blue-300 animate-float`} aria-hidden="true" />;
        case WeatherCategory.Snowy:
            return <FaSnowflake className={`${className} text-white animate-float`} aria-hidden="true" />;
        case WeatherCategory.Mist:
            return <FaSmog className={`${className} text-gray-300 animate-float`} aria-hidden="true" />;
        default:
            return <FaCloud className={`${className} text-gray-200 animate-float`} aria-hidden="true" />;
    }
}

export default memo(WeatherIcon);
