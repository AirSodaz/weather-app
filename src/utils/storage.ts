import SerializationWorker from '../workers/serialization.worker?worker';

// Worker Management
let workerInstance: Worker | null = null;
let msgId = 0;
const pendingResolvers = new Map<number, { resolve: (val: string) => void, reject: (err: any) => void }>();

const getSerializerWorker = () => {
    if (!workerInstance) {
        workerInstance = new SerializationWorker();
        workerInstance.onmessage = (e) => {
            const { id, json, success, error } = e.data;
            const resolver = pendingResolvers.get(id);
            if (resolver) {
                if (success) resolver.resolve(json);
                else resolver.reject(new Error(error));
                pendingResolvers.delete(id);
            }
        };
    }
    return workerInstance;
};

const stringifyAsync = (data: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        const id = msgId++;
        pendingResolvers.set(id, { resolve, reject });
        getSerializerWorker().postMessage({ id, data });
    });
};

// Fallback to localStorage for browser environment
const localStorageFallback = {
    get: async (key: string) => {
        try {
            const value = localStorage.getItem(key);
            // Use Response.json() to parse off main thread where possible
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
    setAsync: async (key: string, value: any) => {
        try {
            // Offload serialization to worker
            const json = await stringifyAsync(value);
            localStorage.setItem(key, json);
        } catch (e) {
            console.error('Failed to save to localStorage (worker):', e);
            // Fallback to main thread if worker fails
            localStorage.setItem(key, JSON.stringify(value));
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
    setAsync: async (key: string, value: any) => {
        await localStorageFallback.setAsync(key, value);
    },
    delete: async (key: string) => {
        await localStorageFallback.delete(key);
    }
};
