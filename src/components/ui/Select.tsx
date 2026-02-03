import React, { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { FaChevronDown, FaCheck } from 'react-icons/fa';

export interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps {
    /** Optional label to display above the select box */
    label?: React.ReactNode;
    /** Current selected value */
    value: string | number;
    /** Array of options */
    options: SelectOption[];
    /** Callback when value changes */
    onChange: (value: any) => void;
    /** Direction to open the dropdown. Defaults to 'down'. */
    direction?: 'up' | 'down';
    /** Optional icon to display next to the label */
    icon?: React.ReactNode;
}

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }
};

const dropdownVariantsUp: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } }
};

export const Select: React.FC<SelectProps> = ({
    label,
    value,
    options,
    onChange,
    direction = 'down',
    icon
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const selectId = useId();

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const index = options.findIndex(opt => opt.value === value);
            const focusIndex = index >= 0 ? index : 0;
            requestAnimationFrame(() => {
                optionsRef.current[focusIndex]?.focus();
            });
        } else if (isOpen === false && document.activeElement && containerRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus();
        }
    }, [isOpen]);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
        }
    };

    const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (index + 1) % options.length;
            optionsRef.current[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (index - 1 + options.length) % options.length;
            optionsRef.current[prevIndex]?.focus();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus();
        } else if (e.key === 'Tab') {
            setIsOpen(false);
        }
    };

    return (
        <div className="space-y-3 relative z-10" ref={containerRef}>
            {label && (
                <label htmlFor={selectId} className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                    {icon} {label}
                </label>
            )}

            <div className="relative">
                <button id={selectId}
                    ref={triggerRef}
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={handleTriggerKeyDown}
                    className={`
                        w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                        text-white text-left flex items-center justify-between transition-all duration-200
                        hover:bg-white/10 focus:outline-none focus:border-blue-500/50
                        text-sm font-mono
                        ${isOpen ? 'bg-white/10 border-blue-500/50 ring-1 ring-blue-500/20' : ''}
                    `}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className="truncate mr-2">{selectedOption?.label}</span>
                    <FaChevronDown
                        className={`text-xs opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            variants={direction === 'up' ? dropdownVariantsUp : dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className={`
                                absolute left-0 right-0 z-50
                                glass-dark rounded-xl border border-white/10 shadow-2xl overflow-hidden
                                max-h-60 overflow-y-auto
                                ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}
                            `}
                        >
                            <div className="py-1" role="listbox">
                                {options.map((option, index) => (
                                    <button
                                        key={option.value}
                                        ref={el => optionsRef.current[index] = el}
                                        onClick={() => handleSelect(option.value)}
                                        onKeyDown={(e) => handleOptionKeyDown(e, index)}
                                        className={`
                                            w-full px-4 py-3 text-left flex items-center justify-between
                                            transition-colors duration-150 group outline-none
                                            focus:bg-white/10 focus:text-white text-sm font-mono
                                            ${value === option.value ? 'bg-blue-500/20 text-blue-200' : 'text-white/80 hover:bg-white/10 hover:text-white'}
                                        `}
                                        role="option"
                                        aria-selected={value === option.value}
                                        tabIndex={-1}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {value === option.value && (
                                            <FaCheck className="text-xs text-blue-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
