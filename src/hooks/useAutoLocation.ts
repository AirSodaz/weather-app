import { useState, useEffect, useCallback, useRef } from 'react';
import { getWeather, WeatherData } from '../services/weatherApi';
import { storage } from '../utils/storage';
import { useI18n } from '../contexts/I18nContext';

export type AutoLocationStatus = 'locating' | 'success' | 'error' | 'cached' | 'denied' | 'idle';

export interface UseAutoLocationResult {
    weatherData: WeatherData | null;
    status: AutoLocationStatus;
    errorMsg: string | null;
    refreshLocation: () => Promise<void>;
}

// Global flag to track if we've already attempted auto-location in this session
let hasAttemptedLocationThisSession = false;

/**
 * Hook to manage auto-locating the user and fetching weather for their current coordinates.
 */
export function useAutoLocation(): UseAutoLocationResult {
    const { t, currentLanguage } = useI18n();
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [status, setStatus] = useState<AutoLocationStatus>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Prevent strict mode double-firing from triggering multiple geolocations
    const initialized = useRef(false);

    const loadCachedLocation = useCallback(async (): Promise<WeatherData | null> => {
        try {
            const cached: any = await storage.get('lastKnownAutoLocation');
            if (cached && cached.data && cached.lang === currentLanguage) {
                return cached.data as WeatherData;
            }
        } catch (err) {
            console.error('Failed to load cached auto location', err);
        }
        return null;
    }, [currentLanguage]);

    const saveCachedLocation = async (data: WeatherData) => {
        try {
            await storage.setAsync('lastKnownAutoLocation', {
                data,
                lang: currentLanguage,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error('Failed to save auto location', err);
        }
    };

    const fetchLocationWeather = useCallback(async (_isManualRefresh = false) => {
        setStatus('locating');
        setErrorMsg(null);

        return new Promise<void>((resolve) => {
            if (!navigator.geolocation) {
                setStatus('error');
                setErrorMsg('Geolocation not supported');
                resolve();
                return;
            }

            // Function to handle geolocation failure/denial
            const handleGeoFailure = async (err: any) => {
                console.error('Geolocation error', err);
                const cached = await loadCachedLocation();

                if (err && err.code === err.PERMISSION_DENIED) {
                    setStatus(cached ? 'cached' : 'denied');
                    setErrorMsg(cached ? 'Location denied, using last known' : 'Location access denied');
                } else {
                    setStatus(cached ? 'cached' : 'error');
                    setErrorMsg(cached ? 'Location unavailable, using last known' : 'Location unavailable');
                }

                if (cached) {
                    setWeatherData(cached);
                }
                resolve();
            };

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        const data = await getWeather('', undefined, currentLanguage, { lat: latitude, lon: longitude });
                        setWeatherData(data);
                        setStatus('success');
                        await saveCachedLocation(data);
                    } catch (err) {
                        console.error('Auto location weather fetch failed', err);
                        // Fallback to cache if possible
                        const cached = await loadCachedLocation();
                        if (cached) {
                            setWeatherData(cached);
                            setStatus('cached');
                            setErrorMsg(t.errors?.loadFailed || 'Failed to update, showing last known location');
                        } else {
                            setStatus('error');
                            setErrorMsg(t.errors?.loadFailed || 'Failed to load location weather');
                        }
                    } finally {
                        resolve();
                    }
                },
                handleGeoFailure,
                { timeout: 15000, maximumAge: 60000 }
            );
        });
    }, [currentLanguage, t.errors, loadCachedLocation]);

    useEffect(() => {
        const init = async () => {
            if (initialized.current) return;
            initialized.current = true;

            if (!hasAttemptedLocationThisSession) {
                hasAttemptedLocationThisSession = true;

                const cached = await loadCachedLocation();
                if (cached) {
                    setWeatherData(cached);
                    setStatus('cached');
                }

                await fetchLocationWeather(false);
            } else {
                // If we navigate away and back, just load from state/cache
                const cached = await loadCachedLocation();
                if (cached) {
                    setWeatherData(cached);
                    setStatus('cached');
                } else {
                    setStatus('idle');
                }
            }
        };

        init();
    }, [fetchLocationWeather, loadCachedLocation]);

    return {
        weatherData,
        status,
        errorMsg,
        refreshLocation: () => fetchLocationWeather(true)
    };
}
