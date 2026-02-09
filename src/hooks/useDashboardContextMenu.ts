import { useState, useCallback } from 'react';
import { WeatherData } from '../services/weatherApi';
import { isMobileDevice } from '../utils/env';

export interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    weather: WeatherData | null;
    menuStyle?: React.CSSProperties;
}

/**
 * Hook to manage the dashboard context menu state and positioning.
 */
export function useDashboardContextMenu() {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false, x: 0, y: 0, weather: null
    });

    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const handleCardContextMenu = useCallback((e: React.MouseEvent, weather: WeatherData) => {
        e.preventDefault();
        // Prevent context menu on mobile long-press if it conflicts with drag
        if (isMobileDevice() && e.type === 'contextmenu') return;

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
        setConfirmDelete(null); // Reset confirm delete state when opening a new menu
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, show: false }));
        setConfirmDelete(null);
    }, []);

    return {
        contextMenu,
        setContextMenu,
        confirmDelete,
        setConfirmDelete,
        handleCardContextMenu,
        closeContextMenu
    };
}
