
export const formatRelativeTime = (date: Date | null, t: any): string => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t.refresh.justNow;
    return t.refresh.minutesAgo.replace('{minutes}', String(diffMins));
};

// Helper function to get background class based on weather condition
export const getWeatherBackground = (condition: string): string => {
    const c = condition.toLowerCase();
    if (c.includes('sunny') || c.includes('clear') || c.includes('晴')) return 'bg-sunny';
    if (c.includes('rain') || c.includes('drizzle') || c.includes('thunder') || c.includes('雨') || c.includes('雷')) return 'bg-rainy';
    if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard') || c.includes('雪') || c.includes('冰')) return 'bg-snowy';
    if (c.includes('cloud') || c.includes('overcast') || c.includes('云') || c.includes('阴')) return 'bg-cloudy';
    return 'bg-default';
};
