import SerializationWorker from '../workers/serialization.worker?worker';

// Worker Management
let workerInstance: Worker | null = null;
let msgId = 0;
// Updated resolver type to accept any return value (string for stringify, any for parse)
const pendingResolvers = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

/**
 * Retrieves the existing serialization worker or creates a new one if it does not exist.
 *
 * @returns {Worker} The serialization worker instance.
 */
function getSerializerWorker(): Worker {
    if (!workerInstance) {
        workerInstance = new SerializationWorker();
        workerInstance.onmessage = (e) => {
            const { id, result, success, error } = e.data;
            const resolver = pendingResolvers.get(id);
            if (resolver) {
                if (success) resolver.resolve(result);
                else resolver.reject(new Error(error));
                pendingResolvers.delete(id);
            }
        };
    }
    return workerInstance;
}

/**
 * Serializes data to a JSON string asynchronously using a web worker.
 *
 * @param {any} data - The data to serialize.
 * @returns {Promise<string>} A promise that resolves to the JSON string.
 */
function stringifyAsync(data: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const id = msgId++;
        pendingResolvers.set(id, { resolve, reject });
        getSerializerWorker().postMessage({ id, type: 'stringify', data });
    });
}

/**
 * Parses a JSON string asynchronously using a web worker.
 *
 * @param {string} json - The JSON string to parse.
 * @returns {Promise<any>} A promise that resolves to the parsed data.
 */
function parseAsync(json: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = msgId++;
        pendingResolvers.set(id, { resolve, reject });
        getSerializerWorker().postMessage({ id, type: 'parse', data: json });
    });
}

// Fallback to localStorage for browser environment.
const localStorageFallback = {
    /**
     * Retrieves a value from local storage.
     * Uses the worker to parse JSON off the main thread.
     *
     * @param {string} key - The key to retrieve.
     * @returns {Promise<any>} A promise that resolves to the parsed value or null if not found.
     */
    get: async (key: string): Promise<any> => {
        try {
            const value = localStorage.getItem(key);
            if (!value) return null;
            return await parseAsync(value);
        } catch (e) {
            console.error('Failed to load/parse from localStorage:', e);
            return null;
        }
    },

    /**
     * Saves a value to local storage.
     * Uses the worker to stringify JSON off the main thread to prevent blocking.
     *
     * @param {string} key - The key to save.
     * @param {any} value - The value to save.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    set: async (key: string, value: any): Promise<void> => {
        try {
            const json = await stringifyAsync(value);
            localStorage.setItem(key, json);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    /**
     * Saves a value to local storage asynchronously using a worker for serialization.
     * (Alias for set, as set is now also async/worker-backed).
     *
     * @param {string} key - The key to save.
     * @param {any} value - The value to save.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    setAsync: async (key: string, value: any): Promise<void> => {
        await localStorageFallback.set(key, value);
    },

    /**
     * Deletes a value from local storage.
     *
     * @param {string} key - The key to delete.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    delete: async (key: string): Promise<void> => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to delete from localStorage:', e);
        }
    }
};

export const storage = {
    /**
     * Retrieves a value from storage.
     *
     * @param {string} key - The key to retrieve.
     * @returns {Promise<any>} A promise that resolves to the retrieved value.
     */
    get: async (key: string): Promise<any> => {
        return localStorageFallback.get(key);
    },

    /**
     * Saves a value to storage.
     *
     * @param {string} key - The key to save.
     * @param {any} value - The value to save.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    set: async (key: string, value: any): Promise<void> => {
        await localStorageFallback.set(key, value);
    },

    /**
     * Saves a value to storage asynchronously, optimizing for large data.
     *
     * @param {string} key - The key to save.
     * @param {any} value - The value to save.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    setAsync: async (key: string, value: any): Promise<void> => {
        await localStorageFallback.setAsync(key, value);
    },

    /**
     * Deletes a value from storage.
     *
     * @param {string} key - The key to delete.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    delete: async (key: string): Promise<void> => {
        await localStorageFallback.delete(key);
    }
};
