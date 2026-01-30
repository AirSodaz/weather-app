/// <reference types="vite/client" />

/**
 * Extends the global Window interface to include custom properties and methods.
 */
interface Window {
    /**
     * Custom storage interface (if applicable, e.g., exposed via Tauri bridge).
     */
    store: {
        /**
         * Retrieves a value from the store.
         * @param {string} key - The key to retrieve.
         * @returns {Promise<any>} A promise resolving to the value.
         */
        get: (key: string) => Promise<any>;
        /**
         * Sets a value in the store.
         * @param {string} key - The key to set.
         * @param {any} value - The value to set.
         * @returns {Promise<void>} A promise resolving when the operation is complete.
         */
        set: (key: string, value: any) => Promise<void>;
        /**
         * Deletes a value from the store.
         * @param {string} key - The key to delete.
         * @returns {Promise<void>} A promise resolving when the operation is complete.
         */
        delete: (key: string) => Promise<void>;
    };
    /**
     * Custom window controls interface.
     */
    windowControls?: {
        /** Minimizes the window. */
        minimize: () => void;
        /** Maximizes or restores the window. */
        maximize: () => void;
        /** Closes the window. */
        close: () => void;
    };
}
