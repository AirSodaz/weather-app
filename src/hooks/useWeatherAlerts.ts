import { useState, useEffect, useCallback } from 'react';
import { WeatherData } from '../services/weatherApi';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { storage } from '../utils/storage';

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

const ALERTS_HISTORY_KEY = 'weather_alerts_history';
const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
const EVALUATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useWeatherAlerts(weatherList: WeatherData[]) {
    const [activeAlerts, setActiveAlerts] = useState<AlertInfo[]>([]);

    const checkPermission = async () => {
        let granted = await isPermissionGranted();
        if (!granted) {
            const permission = await requestPermission();
            granted = permission === 'granted';
        }
        return granted;
    };

    const dismissAlert = useCallback((city: string) => {
        setActiveAlerts(prev => prev.filter(a => a.city !== city));
    }, []);

    const evaluateAlerts = useCallback(async () => {
        if (!weatherList || weatherList.length === 0) return;

        try {
            // Load history once for all cities
            const history = await storage.get(ALERTS_HISTORY_KEY) || {};
            const now = Date.now();
            let historyUpdated = false;
            let hasPermissionChecked = false;
            let hasPermission = false;

            const newAlerts: AlertInfo[] = [];

            for (const weather of weatherList) {
                if (!weather) continue;

                let alertCondition = '';
                let alertMessage = '';

                // Prioritize native alerts from the weather provider (e.g. WeatherAPI)
                if (weather.alerts && weather.alerts.length > 0) {
                    const firstAlert = weather.alerts[0];
                    alertCondition = firstAlert.event;
                    alertMessage = `Severe weather alert: ${firstAlert.event}`;
                } else {
                    // Fallback to keyword matching on forecast/current condition

                    // Check current condition
                    const currentConditionText = weather.condition.toLowerCase();
                    const isCurrentSevere = SEVERE_WEATHER_KEYWORDS.some(keyword =>
                        currentConditionText.includes(keyword.toLowerCase())
                    );

                    if (isCurrentSevere) {
                        alertCondition = weather.condition;
                        alertMessage = `Severe weather current: ${alertCondition}`;
                    } else if (weather.hourlyForecast && weather.hourlyForecast.length > 0) {
                        // Check upcoming conditions using timestamps to evaluate what is "coming up"
                        // Look at the next few forecasts
                        const upcomingForecasts = weather.hourlyForecast.slice(0, 4);

                        for (const forecast of upcomingForecasts) {
                            const forecastCondition = forecast.condition.toLowerCase();
                            const isUpcomingSevere = SEVERE_WEATHER_KEYWORDS.some(keyword =>
                                forecastCondition.includes(keyword.toLowerCase())
                            );

                            if (isUpcomingSevere) {
                                // Simple logic: if a severe keyword exists in the near future forecast, alert.
                                // We don't want to alert for something too far out if it's not a native alert.
                                alertCondition = forecast.condition;
                                alertMessage = `Severe weather expected soon: ${alertCondition}`;
                                break;
                            }
                        }
                    }
                }

                if (alertCondition) {
                    const alertKey = `${weather.city}-${alertCondition}`;
                    const lastAlertTime = history[alertKey];

                    // Check cooldown
                    if (!lastAlertTime || (now - lastAlertTime >= ALERT_COOLDOWN_MS)) {
                        newAlerts.push({ city: weather.city, condition: alertCondition, message: alertMessage });

                        // Update history
                        history[alertKey] = now;
                        historyUpdated = true;
                    }
                }
            }

            if (newAlerts.length > 0) {
                // Update local state
                setActiveAlerts(prev => {
                    const combined = [...prev];
                    for (const newAlert of newAlerts) {
                        if (!combined.some(a => a.city === newAlert.city && a.condition === newAlert.condition)) {
                            combined.push(newAlert);
                        }
                    }
                    return combined;
                });

                // Update history in storage
                if (historyUpdated) {
                    await storage.setAsync(ALERTS_HISTORY_KEY, history);
                }

                // Send system notifications
                for (const newAlert of newAlerts) {
                    if (!hasPermissionChecked) {
                        hasPermission = await checkPermission();
                        hasPermissionChecked = true;
                    }

                    if (hasPermission) {
                        sendNotification({
                            title: `Weather Alert: ${newAlert.city}`,
                            body: newAlert.message,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to evaluate weather alerts:', error);
        }
    }, [weatherList]);

    // Evaluate on weatherList change or mount
    useEffect(() => {
        evaluateAlerts();
    }, [evaluateAlerts]);

    // Setup periodic background evaluation to catch upcoming conditions as time passes
    useEffect(() => {
        const intervalId = setInterval(() => {
            evaluateAlerts();
        }, EVALUATION_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [evaluateAlerts]);

    return { activeAlerts, dismissAlert };
}
