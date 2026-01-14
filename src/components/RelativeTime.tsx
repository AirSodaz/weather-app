import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { formatRelativeTime } from '../utils/helpers';

interface RelativeTimeProps {
    date: Date | null;
    label?: string;
}

/**
 * RelativeTime component
 *
 * Optimization: This component isolates the minute-by-minute re-rendering logic
 * required for relative time displays (e.g., "5 minutes ago").
 * By moving this logic here, we prevent the parent components (like WeatherDashboard)
 * from re-rendering the entire tree every minute.
 */
const RelativeTime: React.FC<RelativeTimeProps> = ({ date, label }) => {
    const { t } = useI18n();
    // Force re-render every minute to update the relative time string
    const [, setTick] = useState(0);

    useEffect(() => {
        // Use window.setInterval to ensure we get a number ID (browser environment)
        // and avoid potential conflicts with NodeJS.Timeout types if they exist.
        const interval = window.setInterval(() => {
            setTick(t => t + 1);
        }, 60000);

        return () => window.clearInterval(interval);
    }, []);

    if (!date) return null;

    return (
        <span>
             {label ? `${label}: ` : ''}{formatRelativeTime(date, t)}
        </span>
    );
};

export default RelativeTime;
