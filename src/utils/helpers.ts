/**
 * Formats a date object into a relative time string (e.g., "5 minutes ago").
 *
 * @param {Date | null} date - The date to format.
 * @param {any} t - The translation object containing localized strings.
 * @returns {string} The formatted relative time string, or an empty string if date is null.
 */
export const formatRelativeTime = (date: Date | null, t: any): string => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t.refresh.justNow;
    return t.refresh.minutesAgo.replace('{minutes}', String(diffMins));
};
