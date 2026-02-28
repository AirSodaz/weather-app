import { Translations } from '../contexts/I18nContext';

/**
 * Formats a date object into a relative time string (e.g., "5 minutes ago").
 *
 * @param {Date | null} date - The date to format.
 * @param {Translations} t - The translation object containing localized strings.
 * @returns {string} The formatted relative time string, or an empty string if date is null.
 */
export function formatRelativeTime(date: Date | null, t: Translations): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t.refresh.justNow;
    return t.refresh.minutesAgo.replace('{minutes}', String(diffMins));
}

/**
 * Formats a date object to HH:mm string.
 *
 * @param {Date} date - The date to format.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {string} The formatted time string.
 */
export function formatTime(date: Date, use24h: boolean = true): string {
    return new Intl.DateTimeFormat('en-US', {
        hour: use24h ? '2-digit' : 'numeric',
        minute: '2-digit',
        hour12: !use24h,
    }).format(date);
}

/**
 * Formats a time string (e.g., "05:00 AM" or "13:00") to the desired format.
 *
 * @param {string} timeStr - The time string to format.
 * @param {boolean} [use24h=true] - Whether to use 24-hour format.
 * @returns {string} The formatted time string.
 */
export function formatTimeString(timeStr: string, use24h: boolean = true): string {
    let hours = 0;
    let minutes = 0;
    const is12hInput = /AM|PM/i.test(timeStr);

    if (is12hInput) {
        const [time, modifier] = timeStr.split(' ');
        const [h, m] = time.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);

        if (hours === 12) hours = 0;
        if (modifier?.toUpperCase() === 'PM') hours += 12;
    } else {
        const [h, m] = timeStr.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
    }

    const date = new Date();
    date.setHours(hours, minutes);
    return formatTime(date, use24h);
}
