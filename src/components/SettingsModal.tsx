import React, { useState, useEffect, useRef } from 'react';
import { isTauri } from '../utils/env';
import { AppSettings, getSettings, saveSettings, WeatherSource, SectionConfig } from '../utils/config';
import { useI18n } from '../contexts/I18nContext';
import {
    FaTimes, FaSave, FaCog, FaGlobe, FaClock, FaDesktop,
    FaSync, FaCloud, FaInfoCircle, FaGripLines, FaCheckSquare, FaSquare, FaList, FaGithub
} from 'react-icons/fa';
import packageJson from '../../package.json';
import { motion, Variants } from 'framer-motion';
import ApiKeySettings from './ApiKeySettings';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChange?: () => void;
}

const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

const modalVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: "spring", duration: 0.5, bounce: 0.3 }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 10,
        transition: { duration: 0.3 }
    }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsChange }) => {
    const { t, language, setLanguage } = useI18n();
    const isTauriEnv = isTauri();
    const [localLanguage, setLocalLanguage] = useState(language);
    const [source, setSource] = useState<WeatherSource>('openweathermap');
    const [customUrl, setCustomUrl] = useState('');
    const [qweatherHost, setQWeatherHost] = useState('');

    // Use Ref for API keys to prevent re-renders on every keystroke
    const apiKeysRef = useRef<{ [key in WeatherSource]?: string }>({});

    const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
    const [startupView, setStartupView] = useState<'home' | 'detail'>('detail');
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [loading, setLoading] = useState(false);

    // Drag and drop state
    const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
    const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            setLocalLanguage(language);
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        const settings = await getSettings();
        setSource(settings.source);
        setCustomUrl(settings.customUrl || '');
        setQWeatherHost(settings.qweatherHost || '');
        apiKeysRef.current = settings.apiKeys || {};
        setAutoRefreshInterval(settings.autoRefreshInterval || 0);
        setStartupView(settings.startupView || 'detail');
        setDetailViewSections(settings.detailViewSections || []);
        setLoading(false);
    };

    const handleSave = async () => {
        setLoading(true);
        const newSettings: AppSettings = {
            source,
            customUrl,
            qweatherHost,
            apiKeys: apiKeysRef.current,
            autoRefreshInterval,
            startupView,
            detailViewSections
        };
        await saveSettings(newSettings);
        setLanguage(localLanguage);
        setLoading(false);
        onSettingsChange?.();
        onClose();
    };

    // Section Drag Handlers
    const handleSectionDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedSectionIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // e.dataTransfer.setDragImage(e.currentTarget, 20, 20); // Optional custom drag image
    };

    const handleSectionDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (draggedSectionIndex === null) return;
        if (draggedSectionIndex !== index) {
            setDragOverSectionIndex(index);
        }
    };

    const handleSectionDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
        e.preventDefault();
        if (draggedSectionIndex === null) return;

        const newSections = [...detailViewSections];
        const [movedItem] = newSections.splice(draggedSectionIndex, 1);
        newSections.splice(dropIndex, 0, movedItem);

        setDetailViewSections(newSections);
        setDraggedSectionIndex(null);
        setDragOverSectionIndex(null);
    };

    const toggleSectionVisibility = (index: number) => {
        const newSections = [...detailViewSections];
        newSections[index].visible = !newSections[index].visible;
        setDetailViewSections(newSections);
    };

    const refreshOptions = [0, 5, 10, 15, 30, 60];

    return (
        <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md ${isTauriEnv ? 'pt-12' : ''}`}
            onClick={onClose}
        >
            <motion.div
                onClick={(e) => e.stopPropagation()}
                variants={modalVariants}
                className="glass-dark border-0 sm:border border-white/10 
                rounded-none sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-md sm:max-h-[90vh] 
                shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5">
                            <FaCog className="text-lg text-slate-300" aria-hidden="true" />
                        </div>
                        {t.settings.title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        aria-label="Close"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {/* Language Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaGlobe /> {t.settings.language}
                        </label>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-black/20 rounded-xl">
                            {[
                                { val: 'system', label: 'Auto' },
                                { val: 'en', label: 'EN' },
                                { val: 'zh', label: '中文' }
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => setLocalLanguage(opt.val as any)}
                                    className={`
                                        py-2 rounded-lg text-sm font-medium transition-all
                                        ${localLanguage === opt.val ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}
                                    `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    <div className="space-y-3 z-50 relative">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaCloud /> {t.settings.weatherSource}
                        </label>
                        <div className="relative group">
                            <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-left flex items-center justify-between transition-colors">
                                <span>
                                    {source === 'openweathermap' ? t.settings.openWeatherMap :
                                        source === 'weatherapi' ? t.settings.weatherapi :
                                            source === 'qweather' ? t.settings.qweather :
                                                t.settings.custom}
                                </span>
                                <span className="text-xs opacity-50">▼</span>
                            </button>
                            <div className="absolute top-full left-0 right-0 mt-2 glass-dark rounded-2xl border border-white/10 shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                {[
                                    { val: 'openweathermap', label: t.settings.openWeatherMap },
                                    { val: 'weatherapi', label: t.settings.weatherapi },
                                    { val: 'qweather', label: t.settings.qweather },
                                    { val: 'custom', label: t.settings.custom }
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setSource(opt.val as WeatherSource)}
                                        className={`w-full px-4 py-3 text-left hover:bg-white/10 flex items-center justify-between
                                            ${source === opt.val ? 'text-blue-300 bg-white/5' : 'text-white'}
                                        `}
                                    >
                                        {opt.label}
                                        {source === opt.val && <FaInfoCircle className="text-xs" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Custom URL Input */}
                    {source === 'custom' && (
                        <div className="space-y-3 animate-fade-in">
                            <label htmlFor="settings-custom-url" className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                                {t.settings.apiUrl}
                            </label>
                            <input
                                id="settings-custom-url"
                                type="text"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder={t.settings.apiUrlPlaceholder}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition-colors placeholder-white/20 text-sm font-mono"
                                aria-describedby="settings-custom-url-help"
                            />
                            <p id="settings-custom-url-help" className="text-[10px] text-white/30">{t.settings.apiUrlHelp}</p>
                        </div>
                    )}

                    {/* QWeather Host Input */}
                    {source === 'qweather' && (
                        <div className="space-y-3 animate-fade-in">
                            <label htmlFor="settings-qweather-host" className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                <FaGlobe aria-hidden="true" /> {t.settings.qweatherHost}
                            </label>
                            <input
                                id="settings-qweather-host"
                                type="text"
                                value={qweatherHost}
                                onChange={(e) => setQWeatherHost(e.target.value)}
                                placeholder={t.settings.qweatherHostPlaceholder}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition-colors placeholder-white/20 text-sm font-mono"
                                aria-describedby="settings-qweather-host-help"
                            />
                            <p id="settings-qweather-host-help" className="text-[10px] text-white/30">{t.settings.qweatherHostHelp}</p>
                        </div>
                    )}

                    {/* API Key Input */}
                    <ApiKeySettings
                        key={source}
                        source={source}
                        initialValue={apiKeysRef.current[source] || ''}
                        onChange={(val) => { apiKeysRef.current[source] = val; }}
                        t={t}
                        localLanguage={localLanguage}
                        qweatherHost={qweatherHost}
                    />

                    <div className="w-full h-px bg-white/5" />

                    {/* Detail View Customization */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2"><FaList /> {t.settings.detailView}</span>
                            <span className="text-[10px] opacity-70 font-normal normal-case">{t.settings.detailViewHelp}</span>
                        </label>
                        <div className="space-y-2">
                            {detailViewSections.map((section, index) => (
                                <div
                                    key={section.id}
                                    draggable
                                    onDragStart={(e) => handleSectionDragStart(e, index)}
                                    onDragOver={(e) => handleSectionDragOver(e, index)}
                                    onDrop={(e) => handleSectionDrop(e, index)}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5
                                        transition-all cursor-move group hover:bg-white/10
                                        ${draggedSectionIndex === index ? 'opacity-50' : ''}
                                        ${dragOverSectionIndex === index ? 'border-blue-500/50 bg-blue-500/10' : ''}
                                    `}
                                >
                                    <FaGripLines className="text-white/30 group-hover:text-white/50" />
                                    <span className="flex-1 text-sm font-medium">
                                        {t.detailSections?.[section.id] || section.id}
                                    </span>
                                    <button
                                        onClick={() => toggleSectionVisibility(index)}
                                        className="text-white/70 hover:text-white transition-colors p-1"
                                    >
                                        {section.visible ? <FaCheckSquare className="text-blue-400" /> : <FaSquare className="text-white/20" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    {/* Auto Refresh Interval */}
                    <div className="space-y-3 z-40 relative">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaClock /> {t.settings.autoRefresh}
                        </label>
                        <div className="relative group">
                            <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-left flex items-center justify-between transition-colors">
                                <span>
                                    {autoRefreshInterval === 0
                                        ? t.settings.autoRefreshOff
                                        : t.settings.autoRefreshMinutes.replace('{minutes}', String(autoRefreshInterval))}
                                </span>
                                <span className="text-xs opacity-50">▼</span>
                            </button>
                            <div className="absolute top-full left-0 right-0 mt-2 glass-dark rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-h-60 overflow-y-auto">
                                {refreshOptions.map((mins) => (
                                    <button
                                        key={mins}
                                        onClick={() => setAutoRefreshInterval(mins)}
                                        className={`w-full px-4 py-3 text-left hover:bg-white/10 flex items-center justify-between
                                            ${autoRefreshInterval === mins ? 'text-blue-300 bg-white/5' : 'text-white'}
                                        `}
                                    >
                                        {mins === 0
                                            ? t.settings.autoRefreshOff
                                            : t.settings.autoRefreshMinutes.replace('{minutes}', String(mins))}
                                        {autoRefreshInterval === mins && <FaInfoCircle className="text-xs opacity-0" />} {/* Spacer/Icon placeholder */}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Startup View */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaDesktop /> {t.settings.startupView}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStartupView('detail')}
                                className={`
                                    p-3 rounded-xl text-left border transition-all flex flex-col gap-1
                                    ${startupView === 'detail'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-white'
                                        : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                                    }
                                `}
                            >
                                <span className="font-medium text-sm">{t.settings.startupViewDetail}</span>
                                <span className="text-[10px] opacity-60">{t.settings.lastOpenedCity}</span>
                            </button>
                            <button
                                onClick={() => setStartupView('home')}
                                className={`
                                    p-3 rounded-xl text-left border transition-all flex flex-col gap-1
                                    ${startupView === 'home'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-white'
                                        : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                                    }
                                `}
                            >
                                <span className="font-medium text-sm">{t.settings.startupViewHome}</span>
                                <span className="text-[10px] opacity-60">{t.settings.cityList}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 mt-2 flex justify-between items-center flex-shrink-0">
                    <a
                        href="https://github.com/AirSodaz/weather-app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/20 hover:text-white/50 transition-colors text-[10px] font-mono flex items-center gap-2"
                    >
                        <FaGithub className="text-lg" />
                        v{packageJson.version}
                    </a>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="
                            bg-white text-black hover:bg-gray-200 
                            font-bold py-3 px-8 rounded-xl shadow-lg shadow-white/5
                            transform active:scale-95 transition-all flex items-center gap-2
                        "
                    >
                        {loading ? <FaSync className="animate-spin" /> : <FaSave />}
                        {t.settings.save}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettingsModal;
