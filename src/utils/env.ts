/**
 * Checks if the application is running within the Tauri environment.
 *
 * @returns {boolean} True if running in Tauri, false otherwise.
 */
export function isTauri(): boolean {
    return (
        typeof window !== 'undefined' &&
        ((window as any).__TAURI_INTERNALS__ !== undefined ||
            (window as any).__TAURI__ !== undefined ||
            (window as any).__TAURI_IPC__ !== undefined)
    );
}

/**
 * Checks if the application is running on a mobile device.
 *
 * @returns {boolean} True if running on a mobile device.
 */
export function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
