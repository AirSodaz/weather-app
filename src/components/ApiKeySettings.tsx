import { useState, useEffect, ChangeEvent } from 'react';
import { FaKey, FaSync, FaEye, FaEyeSlash } from 'react-icons/fa';
import { WeatherSource } from '../utils/config';
import { verifyConnection } from '../services/weatherApi';
import { Translations } from '../contexts/I18nContext';

/**
 * Props for the ApiKeySettings component.
 */
interface ApiKeySettingsProps {
    /** The active weather source (e.g., 'openweathermap'). */
    source: WeatherSource;
    /** The current API key value. */
    initialValue: string;
    /** Callback triggered when the API key changes. */
    onChange: (value: string) => void;
    /** Translation object. */
    t: Translations;
    /** Current language code. */
    localLanguage: string;
    /** Optional custom host for QWeather. */
    qweatherHost: string;
}

/**
 * Returns the help URL for retrieving an API key for the current source.
 *
 * @param {WeatherSource} source - The weather source.
 * @returns {string} The URL.
 */
function getApiKeyHelp(source: WeatherSource): string {
    switch (source) {
        case 'openweathermap':
            return 'https://openweathermap.org/';
        case 'weatherapi':
            return 'https://www.weatherapi.com/';
        case 'qweather':
            return 'https://dev.qweather.com/';
        default:
            return '';
    }
}

/**
 * Component for managing API keys for different weather sources.
 * Includes functionality to test the API connection.
 *
 * @param {ApiKeySettingsProps} props - The component props.
 * @returns {JSX.Element} The API key settings component.
 */
function ApiKeySettings({
    source,
    initialValue,
    onChange,
    t,
    localLanguage,
    qweatherHost
}: ApiKeySettingsProps): JSX.Element {
    const [value, setValue] = useState(initialValue);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    /**
     * Handles input changes and clears previous test results.
     *
     * @param {ChangeEvent<HTMLInputElement>} e - The change event.
     */
    function handleChange(e: ChangeEvent<HTMLInputElement>): void {
        const newValue = e.target.value;
        setValue(newValue);
        onChange(newValue);
        if (testResult) setTestResult(null);
    }

    /**
     * Tests the API connection using the current key and source.
     */
    async function handleTestConnection(): Promise<void> {
        if (!value) return;

        setTesting(true);
        setTestResult(null);

        try {
            const langParam = localLanguage === 'en' ? 'en' : 'zh';
            const success = await verifyConnection(source, value, langParam, qweatherHost);
            setTestResult(success ? 'success' : 'fail');
        } catch (e) {
            setTestResult('fail');
        } finally {
            setTesting(false);
        }
    }

    let testStatus = { text: 'Test Connection', className: 'text-blue-400 hover:text-blue-300' };
    if (testResult === 'success') {
        testStatus = { text: 'Success', className: 'text-green-400' };
    } else if (testResult === 'fail') {
        testStatus = { text: 'Failed', className: 'text-red-400' };
    }

    return (
        <div className="space-y-3 animate-fade-in">
            <label htmlFor={`api-key-${source}`} className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FaKey aria-hidden="true" /> {t.settings.apiKey}
            </label>
            <div className="relative">
                <input
                    id={`api-key-${source}`}
                    type={showKey ? "text" : "password"}
                    value={value}
                    onChange={handleChange}
                    placeholder={t.settings.apiKeyPlaceholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white transition-colors placeholder-white/20 text-sm font-mono tracking-widest focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1 rounded-full focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                    aria-label={showKey ? "Hide API Key" : "Show API Key"}
                >
                    {showKey ? <FaEyeSlash /> : <FaEye />}
                </button>
            </div>
            {source !== 'custom' && (
                <div className="flex justify-between items-center text-[10px] text-white/40 mt-1">
                    <span>{t.settings.apiKeyHelp}</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={testing || !value}
                            className={`
                                flex items-center gap-1 transition-colors font-medium rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none
                                ${testStatus.className}
                                ${testing ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            {testing && <FaSync className="animate-spin" />}
                            <span>{testStatus.text}</span>
                        </button>
                        <div className="w-px h-3 bg-white/10"></div>
                        <a href={getApiKeyHelp(source)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">
                            Get Key
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ApiKeySettings;
