import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * A hook that tracks whether the current Tauri window is maximized.
 *
 * @returns {boolean} True if the window is maximized, false otherwise.
 */
export function useIsMaximized(): boolean {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateState = async () => {
            try {
                // Check initial state.
                setIsMaximized(await getCurrentWindow().isMaximized());
            } catch (error) {
                console.error('Failed to check maximized state:', error);
            }
        };

        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            try {
                // Listen for window resize events.
                unlisten = await getCurrentWindow().onResized(async () => {
                    updateState();
                });
            } catch (error) {
                console.error('Failed to setup resize listener:', error);
            }
        };

        updateState();
        setupListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    return isMaximized;
}
