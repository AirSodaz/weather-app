import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import { storage } from '../utils/storage';

/**
 * Supported language codes.
 */
type Language = 'en' | 'zh' | 'system';

/**
 * Type definition for the translation object based on the English locale file.
 */
export type Translations = typeof en;

const translations: Record<string, Translations> = { en, zh };

/**
 * Detects the system language.
 *
 * @returns {'en' | 'zh'} The detected language code ('en' or 'zh'). Defaults to 'en'.
 */
function getSystemLanguage(): 'en' | 'zh' {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
}

/**
 * Interface defining the shape of the I18n context.
 */
interface I18nContextType {
    /** The active translation object. */
    t: Translations;
    /** The selected language setting (may be 'system'). */
    language: Language;
    /** The currently active language code (resolved from 'system' if needed). */
    currentLanguage: 'en' | 'zh';
    /** Function to update the language setting. */
    setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
    children: ReactNode;
}

/**
 * Provider component for internationalization context.
 * Manages language state and persists it to storage.
 *
 * @param {I18nProviderProps} props - The component props.
 * @returns {JSX.Element} The provider component.
 */
export function I18nProvider({ children }: I18nProviderProps): JSX.Element {
    const [language, setLanguageState] = useState<Language>('system');
    const [currentLanguage, setCurrentLanguage] = useState<'en' | 'zh'>(getSystemLanguage());

    useEffect(() => {
        loadLanguage();
    }, []);

    useEffect(() => {
        if (language === 'system') {
            setCurrentLanguage(getSystemLanguage());
        } else {
            setCurrentLanguage(language);
        }
    }, [language]);

    /**
     * Loads the saved language setting from storage.
     */
    async function loadLanguage(): Promise<void> {
        try {
            const savedLang = await storage.get('language');
            console.log('Language loaded from storage:', savedLang);
            if (savedLang) {
                setLanguageState(savedLang as Language);
            }
        } catch (e) {
            console.error('Failed to load language setting:', e);
        }
    }

    /**
     * Updates the language setting and saves it to storage.
     *
     * @param {Language} lang - The new language setting.
     */
    async function setLanguage(lang: Language): Promise<void> {
        setLanguageState(lang);
        try {
            await storage.set('language', lang);
            console.log('Language saved:', lang);
        } catch (e) {
            console.error('Failed to save language setting:', e);
        }
    }

    const t = translations[currentLanguage];

    return (
        <I18nContext.Provider value={{ t, language, currentLanguage, setLanguage }}>
            {children}
        </I18nContext.Provider>
    );
}

/**
 * Hook to access the internationalization context.
 *
 * @returns {I18nContextType} The I18n context values.
 * @throws {Error} If used outside of an I18nProvider.
 */
export function useI18n(): I18nContextType {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}
