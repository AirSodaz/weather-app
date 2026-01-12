import React from 'react';
import { FaMinus, FaTimes, FaRegSquare } from 'react-icons/fa';

const TitleBar: React.FC = () => {
    // Only show TitleBar in Tauri environment
    if (typeof window === 'undefined' || !(window as any).__TAURI__) {
        return null;
    }

    return (
        <div
            className="title-bar flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-lg"
            data-tauri-drag-region
            style={{
                WebkitAppRegion: 'drag',
                cursor: 'default' // Add default cursor to indicate it's not text
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
                        const { appWindow } = await import('@tauri-apps/api/window');
                        appWindow.minimize();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all"
                    aria-label="Minimize"
                >
                    <FaMinus className="text-xs" />
                </button>
                <button
                    onClick={async (e) => {
                        e.preventDefault();
                        const { appWindow } = await import('@tauri-apps/api/window');
                        appWindow.toggleMaximize();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all"
                    aria-label="Maximize"
                >
                    <FaRegSquare className="text-xs" />
                </button>
                <button
                    onClick={async (e) => {
                        e.preventDefault();
                        const { appWindow } = await import('@tauri-apps/api/window');
                        appWindow.close();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-red-500/80 hover:text-white transition-all"
                    aria-label="Close"
                >
                    <FaTimes className="text-sm" />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
