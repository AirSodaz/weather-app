import React from 'react';

export interface RadioOption<T> {
    value: T;
    label: string;
}

interface RadioGroupProps<T> {
    /** Label for the group */
    label: string;
    /** Optional icon to display next to the label */
    icon?: React.ReactNode;
    /** List of options to display */
    options: RadioOption<T>[];
    /** Currently selected value */
    value: T;
    /** Callback when selection changes */
    onChange: (value: T) => void;
    /** Optional help text displayed below the options */
    helpText?: string;
    /** Optional class name for the container */
    className?: string;
}

/**
 * A reusable component for selecting one option from a list using a button grid.
 */
export function RadioGroup<T extends string | number | boolean>({
    label,
    icon,
    options,
    value,
    onChange,
    helpText,
    className = ''
}: RadioGroupProps<T>): JSX.Element {
    // Map the number of options to a valid Tailwind class.
    // Tailwind needs full class names in the source to detect them.
    const gridColsClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    }[options.length] || 'grid-cols-1'; // Default to 1 column if length is unusual.

    return (
        <div className={`space-y-3 ${className}`}>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                {icon && <span>{icon}</span>}
                {label}
            </label>
            <div className={`grid ${gridColsClass} gap-2 p-1 bg-black/20 rounded-xl`}>
                {options.map((opt) => (
                    <button
                        key={String(opt.value)}
                        onClick={() => onChange(opt.value)}
                        aria-pressed={value === opt.value}
                        type="button"
                        className={`
                            py-2 rounded-lg text-sm font-medium transition-all
                            ${value === opt.value
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'}
                        `}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            {helpText && <p className="text-[10px] text-white/30">{helpText}</p>}
        </div>
    );
}
