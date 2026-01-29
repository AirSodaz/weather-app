import React, { useState, useEffect } from 'react';
import { FaKey, FaSync } from 'react-icons/fa';
import { WeatherSource } from '../utils/config';
import { verifyConnection } from '../services/weatherApi';

interface ApiKeySettingsProps {
    source: WeatherSource;
    initialValue: string;
    onChange: (value: string) => void;
    t: any;
    localLanguage: string;
    qweatherHost: string;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({
    source,
    initialValue,
    onChange,
    t,
    localLanguage,
    qweatherHost
}) => {
    const [value, setValue] = useState(initialValue);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange(newValue);
        if (testResult) setTestResult(null);
    };

    const handleTestConnection = async () => {
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
    };

    const getApiKeyHelp = () => {
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
    };

    return (
        <div className="space-y-3 animate-fade-in">
            <label htmlFor={`api-key-${source}`} className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FaKey aria-hidden="true" /> {t.settings.apiKey}
            </label>
            <input
                id={`api-key-${source}`}
                type="password"
                value={value}
                onChange={handleChange}
                placeholder={t.settings.apiKeyPlaceholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition-colors placeholder-white/20 text-sm font-mono tracking-widest"
            />
            {source !== 'custom' && (
                <div className="flex justify-between items-center text-[10px] text-white/40 mt-1">
                    <span>{t.settings.apiKeyHelp}</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={testing || !value}
                            className={`
                                flex items-center gap-1 transition-colors font-medium
                                ${testResult === 'success' ? 'text-green-400' :
                                    testResult === 'fail' ? 'text-red-400' :
                                        'text-blue-400 hover:text-blue-300'}
                                ${testing ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            {testing && <FaSync className="animate-spin" />}
                            {testResult === 'success' ? (
                                <span>Success</span>
                            ) : testResult === 'fail' ? (
                                <span>Failed</span>
                            ) : (
                                <span>Test Connection</span>
                            )}
                        </button>
                        <div className="w-px h-3 bg-white/10"></div>
                        <a href={getApiKeyHelp()} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">
                            Get Key
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeySettings;
