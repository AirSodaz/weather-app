import { useState, useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';

export function useIsMaximized() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateState = async () => {
            try {
                // Check initial state
                setIsMaximized(await appWindow.isMaximized());
            } catch (error) {
                console.error('Failed to check maximized state:', error);
            }
        };

        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            try {
                // Listen for window resize events
                unlisten = await appWindow.onResized(async () => {
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
