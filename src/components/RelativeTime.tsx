import React, { useState, useEffect } from 'react';
import { formatRelativeTime } from '../utils/helpers';
import { useI18n } from '../contexts/I18nContext';

/**
 * Props for the RelativeTime component.
 */
interface RelativeTimeProps {
    /** The date to format relative to now. */
    date: Date | null;
}

/**
 * Displays a date as a relative time string (e.g., "5 minutes ago") that updates automatically every minute.
 *
 * @param {RelativeTimeProps} props - The component props.
 * @returns {JSX.Element} The relative time component.
 */
const RelativeTime: React.FC<RelativeTimeProps> = ({ date }) => {
    const { t } = useI18n();
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    return <>{formatRelativeTime(date, t)}</>;
};

export default RelativeTime;
