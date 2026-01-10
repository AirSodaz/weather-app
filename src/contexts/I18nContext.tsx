import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import { storage } from '../utils/storage';

type Language = 'en' | 'zh' | 'system';
type Translations = typeof en;

const translations: Record<string, Translations> = { en, zh };

// Detect system language
const getSystemLanguage = (): 'en' | 'zh' => {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
};

interface I18nContextType {
    t: Translations;
    language: Language;
    currentLanguage: 'en' | 'zh';
    setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

    const loadLanguage = async () => {
        try {
            const savedLang = await storage.get('language');
            if (savedLang) {
                setLanguageState(savedLang as Language);
            }
        } catch (e) {
            console.error('Failed to load language setting:', e);
        }
    };

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        try {
            await storage.set('language', lang);
        } catch (e) {
            console.error('Failed to save language setting:', e);
        }
    };

    const t = translations[currentLanguage];

    return (
        <I18nContext.Provider value={{ t, language, currentLanguage, setLanguage }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
};
