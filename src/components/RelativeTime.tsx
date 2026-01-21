import React, { useState, useEffect } from 'react';
import { formatRelativeTime } from '../utils/helpers';
import { useI18n } from '../contexts/I18nContext';

interface RelativeTimeProps {
    date: Date | null;
}

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
