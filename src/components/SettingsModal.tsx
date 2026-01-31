import React, { useState, useEffect, useRef } from 'react';
import { isTauri } from '../utils/env';
import { AppSettings, getSettings, saveSettings, WeatherSource, SectionConfig } from '../utils/config';
import { useI18n } from '../contexts/I18nContext';
import {
    FaTimes, FaSave, FaCog, FaGlobe, FaClock, FaDesktop,
    FaSync, FaCloud, FaGripLines, FaCheckSquare, FaSquare, FaList, FaGithub, FaBolt
} from 'react-icons/fa';
import packageJson from '../../package.json';
import { motion, Variants } from 'framer-motion';
import ApiKeySettings from './ApiKeySettings';
import { Select } from './ui/Select';

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
    /** Whether the modal is currently open. */
    isOpen: boolean;
    /** Callback function to close the modal. */
    onClose: () => void;
    /** Optional callback triggered when settings are saved. */
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

/**
 * Modal component for configuring application settings.
 * Allows users to change language, weather source, API keys, auto-refresh interval, and UI preferences.
 *
 * @param {SettingsModalProps} props - The component props.
 * @returns {JSX.Element} The settings modal component.
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsChange }) => {
    const { t, language, setLanguage } = useI18n();
    const isTauriEnv = isTauri();
    const [localLanguage, setLocalLanguage] = useState(language);
    const [source, setSource] = useState<WeatherSource>('openweathermap');
    const [customUrl, setCustomUrl] = useState('');
    const [qweatherHost, setQWeatherHost] = useState('');

    // Use Ref for API keys to prevent re-renders on every keystroke.
    const apiKeysRef = useRef<{ [key in WeatherSource]?: string }>({});

    const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
    const [startupView, setStartupView] = useState<'home' | 'detail'>('detail');
    const [detailViewSections, setDetailViewSections] = useState<SectionConfig[]>([]);
    const [timeFormat, setTimeFormat] = useState<'24h' | '12h'>('24h');
    const [enableHardwareAcceleration, setEnableHardwareAcceleration] = useState(true);
    const [loading, setLoading] = useState(false);

    // Drag and drop state.
    const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
    const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            setLocalLanguage(language);
        }
    }, [isOpen]);

    /**
     * Loads current settings from storage.
     */
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
        setTimeFormat(settings.timeFormat || '24h');
        setEnableHardwareAcceleration(settings.enableHardwareAcceleration ?? true);
        setLoading(false);
    };

    /**
     * Saves the modified settings to storage and updates the application state.
     */
    const handleSave = async () => {
        setLoading(true);
        const newSettings: AppSettings = {
            source,
            customUrl,
            qweatherHost,
            apiKeys: apiKeysRef.current,
            autoRefreshInterval,
            startupView,
            detailViewSections,
            timeFormat,
            enableHardwareAcceleration
        };
        await saveSettings(newSettings);
        setLanguage(localLanguage);
        setLoading(false);
        onSettingsChange?.();
        onClose();
    };

    // Section Drag Handlers.

    /**
     * Handles the start of a drag operation for a detail view section.
     *
     * @param {React.DragEvent<HTMLDivElement>} e - The drag event.
     * @param {number} index - The index of the section being dragged.
     */
    const handleSectionDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedSectionIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // e.dataTransfer.setDragImage(e.currentTarget, 20, 20); // Optional custom drag image.
    };

    /**
     * Handles the drag over event to update the drop target indicator.
     *
     * @param {React.DragEvent<HTMLDivElement>} e - The drag event.
     * @param {number} index - The index of the section being dragged over.
     */
    const handleSectionDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (draggedSectionIndex === null) return;
        if (draggedSectionIndex !== index) {
            setDragOverSectionIndex(index);
        }
    };

    /**
     * Handles the drop event to reorder the sections.
     *
     * @param {React.DragEvent<HTMLDivElement>} e - The drag event.
     * @param {number} dropIndex - The index where the item is dropped.
     */
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

    /**
     * Toggles the visibility of a detail view section.
     *
     * @param {number} index - The index of the section to toggle.
     */
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
                style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                }}
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

                    <Select
                        label={t.settings.weatherSource}
                        icon={<FaCloud />}
                        value={source}
                        onChange={(val) => setSource(val as WeatherSource)}
                        options={[
                            { value: 'openweathermap', label: t.settings.openWeatherMap },
                            { value: 'weatherapi', label: t.settings.weatherapi },
                            { value: 'qweather', label: t.settings.qweather },
                            { value: 'custom', label: t.settings.custom }
                        ]}
                    />

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

                    <Select
                        label={t.settings.autoRefresh}
                        icon={<FaClock />}
                        value={autoRefreshInterval}
                        onChange={(val) => setAutoRefreshInterval(val as number)}
                        options={refreshOptions.map(mins => ({
                            value: mins,
                            label: mins === 0
                                ? t.settings.autoRefreshOff
                                : t.settings.autoRefreshMinutes.replace('{minutes}', String(mins))
                        }))}
                        direction="up"
                    />

                    {/* Startup View */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaDesktop /> {t.settings.startupView}
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl">
                            {[
                                { val: 'detail' as const, label: t.settings.startupViewDetail },
                                { val: 'home' as const, label: t.settings.startupViewHome }
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => setStartupView(opt.val)}
                                    className={`
                                        py-2 rounded-lg text-sm font-medium transition-all
                                        ${startupView === opt.val ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}
                                    `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    <Select
                        label={t.settings.timeFormat}
                        icon={<FaClock />}
                        value={timeFormat}
                        onChange={(val) => setTimeFormat(val as '24h' | '12h')}
                        options={[
                            { value: '24h', label: t.settings.timeFormat24 },
                            { value: '12h', label: t.settings.timeFormat12 }
                        ]}
                        direction="up"
                    />

                    <div className="w-full h-px bg-white/5" />

                    {/* Hardware Acceleration Toggle */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                            <FaBolt /> {t.settings.hardwareAcceleration}
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl">
                            {[
                                { val: true, label: 'ON' },
                                { val: false, label: 'OFF' }
                            ].map(opt => (
                                <button
                                    key={String(opt.val)}
                                    onClick={() => setEnableHardwareAcceleration(opt.val)}
                                    className={`
                                        py-2 rounded-lg text-sm font-medium transition-all
                                        ${enableHardwareAcceleration === opt.val ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}
                                    `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-white/30">{t.settings.hardwareAccelerationHelp}</p>
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
