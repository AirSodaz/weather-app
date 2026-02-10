import React, { useState, useEffect, useCallback, useRef } from 'react';
import { isMobileDevice } from '../utils/env';
import { WeatherData } from '../services/weatherApi';

export interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    weather: WeatherData | null;
    menuStyle?: React.CSSProperties;
}

export interface DashboardContextMenuHook {
    contextMenu: ContextMenuState;
    setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
    confirmDelete: string | null;
    setConfirmDelete: React.Dispatch<React.SetStateAction<string | null>>;
    handleCardContextMenu: (e: React.MouseEvent, weather: WeatherData) => void;
    contextMenuRef: React.RefObject<HTMLDivElement>;
}

export function useDashboardContextMenu(): DashboardContextMenuHook {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false, x: 0, y: 0, weather: null
    });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, show: false }));
            }
        };
        if (contextMenu.show) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [contextMenu.show]);

    const handleCardContextMenu = useCallback((e: React.MouseEvent, weather: WeatherData) => {
        e.preventDefault();

        // Prevent context menu on mobile long press if not explicitly handled differently
        // We only want the custom menu on button tap for mobile, not long press (which might conflict with drag)
        if (isMobileDevice() && e.nativeEvent.type === 'contextmenu') return;

        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const menuWidth = 200;
        const menuHeight = 150;
        const padding = 3;

        const isRight = clientX + menuWidth + padding > innerWidth;
        const isBottom = clientY + menuHeight + padding > innerHeight;

        const menuStyle: React.CSSProperties = {
            transformOrigin: `${isBottom ? 'bottom' : 'top'} ${isRight ? 'right' : 'left'}`,
            [isBottom ? 'bottom' : 'top']: isBottom ? innerHeight - clientY : clientY,
            [isRight ? 'right' : 'left']: isRight ? innerWidth - clientX : clientX
        };

        setContextMenu({ show: true, x: clientX, y: clientY, weather, menuStyle });
        setConfirmDelete(null);
    }, []);

    return {
        contextMenu,
        setContextMenu,
        confirmDelete,
        setConfirmDelete,
        handleCardContextMenu,
        contextMenuRef
    };
}
