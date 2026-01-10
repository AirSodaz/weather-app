import React, { useState, useEffect } from 'react';
import { FaMinus, FaTimes, FaRegSquare } from 'react-icons/fa';

const TitleBar: React.FC = () => {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        // Check after component mounts (when preload has injected windowControls)
        setIsElectron(typeof window !== 'undefined' && window.windowControls !== undefined);
    }, []);

    const handleMinimize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.windowControls?.minimize();
    };

    const handleMaximize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.windowControls?.maximize();
    };

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.windowControls?.close();
    };

    return (
        <div
            className="title-bar flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-lg"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <span className="text-white/90 font-medium text-sm tracking-wide">Weather Widget</span>
            {/* Only show window controls in Electron */}
            {isElectron && (
                <div
                    className="flex items-center space-x-1"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <button
                        onClick={handleMinimize}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all"
                        aria-label="Minimize"
                    >
                        <FaMinus className="text-xs" />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-all"
                        aria-label="Maximize"
                    >
                        <FaRegSquare className="text-xs" />
                    </button>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:bg-red-500/80 hover:text-white transition-all"
                        aria-label="Close"
                    >
                        <FaTimes className="text-sm" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default TitleBar;
