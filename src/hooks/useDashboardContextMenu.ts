import { useState, useRef, useEffect, useCallback } from 'react';
import { WeatherData } from '../services/weatherApi';
import { isMobileDevice } from '../utils/env';

export interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    weather: WeatherData | null;
    menuStyle?: React.CSSProperties;
}

export interface DashboardContextMenuHook {
    contextMenu: ContextMenuState;
    confirmDelete: string | null;
    setConfirmDelete: (city: string | null) => void;
    handleCardContextMenu: (e: React.MouseEvent, weather: WeatherData) => void;
    contextMenuRef: React.RefObject<HTMLDivElement>;
    closeContextMenu: () => void;
}

export function useDashboardContextMenu(): DashboardContextMenuHook {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false, x: 0, y: 0, weather: null
    });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, show: false }));
        setConfirmDelete(null);
    }, []);

    const handleCardContextMenu = useCallback((e: React.MouseEvent, weather: WeatherData) => {
        e.preventDefault();

        // On mobile, prevent native context menu to avoid conflict with long-press drag
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                closeContextMenu();
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
    }, [contextMenu.show, closeContextMenu]);

    return {
        contextMenu,
        confirmDelete,
        setConfirmDelete,
        handleCardContextMenu,
        contextMenuRef,
        closeContextMenu
    };
}
