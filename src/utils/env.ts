/**
 * Checks if the application is running within the Tauri environment.
 *
 * @returns {boolean} True if running in Tauri, false otherwise.
 */
export const isTauri = (): boolean => {
    return (
        typeof window !== 'undefined' &&
        ((window as any).__TAURI_INTERNALS__ !== undefined ||
            (window as any).__TAURI__ !== undefined ||
            (window as any).__TAURI_IPC__ !== undefined)
    );
};
