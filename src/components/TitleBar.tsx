import { useState, useEffect } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeClose, VscChromeRestore } from 'react-icons/vsc';
import { isTauri } from '../utils/env';

/**
 * Custom title bar component for Tauri applications.
 * Handles window dragging and window controls (minimize, maximize, close).
 * Only renders when running in a Tauri desktop environment (hides on Web and Android).
 *
 * @returns {JSX.Element | null} The title bar element or null if not applicable.
 */
function TitleBar(): JSX.Element | null {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isTauri()) return;

        let unlisten: () => void;

        const setupListener = async () => {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                // Check initial state.
                setIsMaximized(await win.isMaximized());

                // Listen for resize events to update state.
                const unlistenResize = await win.onResized(async () => {
                    setIsMaximized(await win.isMaximized());
                });
                unlisten = unlistenResize;
            } catch (e) {
                console.error("Failed to setup window listener", e);
            }
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Only show TitleBar in Tauri desktop environment, not on Android.
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (!isTauri() || isAndroid) {
        return null;
    }

    return (
        <div
            className="title-bar flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-lg"
            style={{
                WebkitAppRegion: 'drag',
                cursor: 'default'
            } as any}
        >
            <span className="text-white/90 font-medium text-sm tracking-wide pointer-events-none">Weather App</span>

            <div
                className="flex items-center space-x-1"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <button
                    onClick={async (e) => {
                        e.preventDefault();
                        const { getCurrentWindow } = await import('@tauri-apps/api/window');
                        await getCurrentWindow().minimize();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all"
                    aria-label="Minimize"
                    title="Minimize"
                >
                    <VscChromeMinimize className="text-base" />
                </button>
                <button
                    onClick={async (e) => {
                        e.preventDefault();
                        try {
                            const { getCurrentWindow } = await import('@tauri-apps/api/window');
                            const win = getCurrentWindow();
                            if (await win.isMaximized()) {
                                await win.unmaximize();
                            } else {
                                await win.maximize();
                            }
                        } catch (err) {
                            console.error("Maximize failed:", err);
                        }
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all`}
                    aria-label="Maximize"
                    title="Maximize"
                >
                    {isMaximized ? <VscChromeRestore className="text-base" /> : <VscChromeMaximize className="text-base" />}
                </button>
                <button
                    onClick={async (e) => {
                        e.preventDefault();
                        const { getCurrentWindow } = await import('@tauri-apps/api/window');
                        await getCurrentWindow().close();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-red-500/80 hover:text-white transition-all"
                    aria-label="Close"
                    title="Close"
                >
                    <VscChromeClose className="text-base" />
                </button>
            </div>
        </div>
    );
}

export default TitleBar;
