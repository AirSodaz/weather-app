
export const formatRelativeTime = (date: Date | null, t: any): string => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t.refresh.justNow;
    return t.refresh.minutesAgo.replace('{minutes}', String(diffMins));
};
