// Fallback to localStorage for browser environment
const localStorageFallback = {
    get: async (key: string) => {
        try {
            const value = localStorage.getItem(key);
            return value ? await new Response(value).json() : null;
        } catch {
            return null;
        }
    },
    set: async (key: string, value: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },
    delete: async (key: string) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to delete from localStorage:', e);
        }
    }
};

export const storage = {
    get: async (key: string) => {
        return localStorageFallback.get(key);
    },
    set: async (key: string, value: any) => {
        await localStorageFallback.set(key, value);
    },
    delete: async (key: string) => {
        await localStorageFallback.delete(key);
    }
};
