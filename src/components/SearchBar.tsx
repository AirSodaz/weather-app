import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaLocationArrow, FaSpinner } from 'react-icons/fa';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { searchCities, CityResult } from '../services/weatherApi';
import { useI18n } from '../contexts/I18nContext';

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};

interface SearchBarProps {
    onSearch: (city: string) => Promise<boolean>;
    onLocationRequest: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onLocationRequest }) => {
    const { t, currentLanguage } = useI18n();
    const [searchCity, setSearchCity] = useState('');
    const [suggestions, setSuggestions] = useState<CityResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced search for suggestions
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchCity.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setIsLoading(false);
            return;
        }

        // Reset selection on new input
        setSelectedIndex(-1);

        searchTimeoutRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await searchCities(searchCity, currentLanguage);
                setSuggestions(results);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Failed to fetch suggestions', error);
            } finally {
                setIsLoading(false);
            }
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchCity, currentLanguage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // If suggestion is selected, use it
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSuggestionClick(suggestions[selectedIndex]);
            return;
        }

        if (!searchCity.trim()) return;

        setShowSuggestions(false);
        const success = await onSearch(searchCity);
        if (success) {
            setSearchCity('');
        }
    };

    const handleSuggestionClick = async (suggestion: CityResult) => {
        setShowSuggestions(false);
        const success = await onSearch(suggestion.name);
        if (success) {
            setSearchCity('');
            setSelectedIndex(-1);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    };

    const handleLocationClick = () => {
        setShowSuggestions(false);
        onLocationRequest();
    };

    return (
        <div ref={searchRef} className="flex-1 relative">
            <form role="search" onSubmit={handleSubmit} className="w-full flex items-center space-x-2 glass-card rounded-full px-4 py-4 transition-all focus-within:bg-white/10 focus-within:shadow-lg focus-within:ring-1 focus-within:ring-white/20">
                {isLoading ? (
                    <FaSpinner className="text-white/60 animate-spin" aria-label="Loading" />
                ) : (
                    <FaSearch className="text-white/60" aria-hidden="true" />
                )}
                <input
                    type="text"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.search?.placeholder || 'Search city...'}
                    aria-label={t.search?.placeholder || 'Search city'}
                    aria-autocomplete="list"
                    aria-controls="search-suggestions"
                    aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
                    className="bg-transparent border-none outline-none text-white placeholder-white/50 w-full text-base"
                    onFocus={() => {
                        if (searchCity.trim().length >= 2) setShowSuggestions(true);
                    }}
                />
                {searchCity && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchCity('');
                            setSuggestions([]);
                        }}
                        className="text-white/40 hover:text-white transition-colors p-1"
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </form>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
                {
                    (showSuggestions && (suggestions.length > 0 || searchCity.trim().length >= 2)) && (
                        <motion.div
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            id="search-suggestions"
                            role="listbox"
                            className="absolute top-full left-0 right-0 mt-2 glass-card rounded-2xl overflow-hidden shadow-xl z-50 backdrop-blur-xl border border-white/10"
                        >
                            {/* Current Location Option */}
                            <button
                                onClick={handleLocationClick}
                                className="w-full px-5 py-3 text-left hover:bg-white/10 text-white flex items-center gap-3 transition-colors border-b border-white/5 last:border-none"
                            >
                                <FaLocationArrow className="text-white/60" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-sm">{t.search?.currentLocation || "Use Current Location"}</span>
                                </div>
                            </button>

                            {suggestions.map((item, index) => (
                                <button
                                    key={`${item.name}-${item.lat}-${item.lon}-${index}`}
                                    id={`suggestion-${index}`}
                                    role="option"
                                    aria-selected={index === selectedIndex}
                                    onClick={() => handleSuggestionClick(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full px-5 py-3 text-left text-white flex flex-col gap-0.5 transition-colors border-b border-white/5 last:border-none ${
                                        index === selectedIndex ? 'bg-white/10' : 'hover:bg-white/10'
                                    }`}
                                >
                                    <span className="font-medium text-sm">{item.name}</span>
                                    <span className="text-xs text-white/40">
                                        {[item.region, item.country].filter(Boolean).join(', ')}
                                    </span>
                                </button>
                            ))}
                        </motion.div>
                    )
                }
            </AnimatePresence>
        </div>
    );
};

export default SearchBar;
