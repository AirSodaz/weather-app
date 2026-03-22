import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherData } from '../services/weatherApi';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

// Thresholds for severe weather alerts
const SEVERE_WEATHER_KEYWORDS = [
    'heavy rain', 'torrential rain', 'storm', 'thunderstorm', 'lightning', 'hail',
    'blizzard', 'heavy snow', 'snowstorm', 'tornado', 'hurricane', 'typhoon', 'cyclone',
    'severe', 'extreme', 'warning', 'alert', 'danger',
    // Chinese keywords
    '暴雨', '大暴雨', '特大暴雨', '雷阵雨', '雷暴', '冰雹',
    '暴雪', '大暴雪', '特大暴雪', '龙卷风', '台风', '飓风',
    '严重', '极端', '预警', '危险'
];

interface AlertInfo {
    city: string;
    condition: string;
    message: string;
}

export function useWeatherAlerts(weatherList: WeatherData[]) {
    const [activeAlerts, setActiveAlerts] = useState<AlertInfo[]>([]);

    // Store history of alerted cities + conditions to avoid spamming
    const alertedHistoryRef = useRef<Set<string>>(new Set());

    const checkPermission = async () => {
        let granted = await isPermissionGranted();
        if (!granted) {
            const permission = await requestPermission();
            granted = permission === 'granted';
        }
        return granted;
    };

    const triggerAlert = useCallback(async (city: string, condition: string) => {
        const alertKey = `${city}-${condition}`;

        // Don't alert if we've already alerted for this city + condition in the current session
        if (alertedHistoryRef.current.has(alertKey)) {
            return;
        }

        const message = `Severe weather expected: ${condition}`;
        const newAlert: AlertInfo = { city, condition, message };

        // Update local state
        setActiveAlerts(prev => {
            if (prev.some(a => a.city === city && a.condition === condition)) return prev;
            return [...prev, newAlert];
        });

        alertedHistoryRef.current.add(alertKey);

        // System Notification
        const hasPermission = await checkPermission();
        if (hasPermission) {
            sendNotification({
                title: `Weather Alert: ${city}`,
                body: message,
            });
        }
    }, []);

    const dismissAlert = useCallback((city: string) => {
        setActiveAlerts(prev => prev.filter(a => a.city !== city));
    }, []);

    useEffect(() => {
        if (!weatherList || weatherList.length === 0) return;

        // Check each city's current condition (or near future if available)
        weatherList.forEach(weather => {
            if (!weather) return;

            const conditionText = weather.condition.toLowerCase();
            const isSevere = SEVERE_WEATHER_KEYWORDS.some(keyword => conditionText.includes(keyword.toLowerCase()));

            if (isSevere) {
                triggerAlert(weather.city, weather.condition);
            }
        });
    }, [weatherList, triggerAlert]);

    return { activeAlerts, dismissAlert };
}
