/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DashboardMenu from './DashboardMenu';
import { useI18n } from '../contexts/I18nContext';

// Mock I18nContext
vi.mock('../contexts/I18nContext', () => ({
    useI18n: vi.fn(),
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    Variants: {},
}));

// Mock RelativeTime
vi.mock('./RelativeTime', () => ({
    default: ({ date }: { date: Date }) => <span>{date.toLocaleTimeString()}</span>,
}));

describe('DashboardMenu', () => {
    const mockSetShowMenu = vi.fn();
    const mockRefreshAllCities = vi.fn();
    const mockOnSettingsClick = vi.fn();

    const defaultProps = {
        showMenu: false,
        setShowMenu: mockSetShowMenu,
        refreshAllCities: mockRefreshAllCities,
        refreshing: false,
        lastRefreshTime: new Date('2023-01-01T12:00:00'),
        onSettingsClick: mockOnSettingsClick,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useI18n as any).mockReturnValue({
            t: {
                refresh: { button: 'Refresh', refreshing: 'Refreshing...', lastUpdate: 'Last Update' },
                settings: { title: 'Settings' },
            }
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('renders the menu button', () => {
        render(<DashboardMenu {...defaultProps} />);
        expect(screen.getByLabelText('Main menu')).toBeTruthy();
    });

    it('toggles menu on button click', () => {
        render(<DashboardMenu {...defaultProps} />);
        fireEvent.click(screen.getByLabelText('Main menu'));
        expect(mockSetShowMenu).toHaveBeenCalledWith(true);
    });

    it('displays menu content when showMenu is true', () => {
        render(<DashboardMenu {...defaultProps} showMenu={true} />);
        expect(screen.getByText('Settings')).toBeTruthy();
        expect(screen.getByText('Refresh')).toBeTruthy();
        expect(screen.getByText(/Last Update/)).toBeTruthy();
    });

    it('calls refreshAllCities on refresh click', () => {
        render(<DashboardMenu {...defaultProps} showMenu={true} />);
        fireEvent.click(screen.getByText('Refresh'));
        expect(mockRefreshAllCities).toHaveBeenCalled();
        expect(mockSetShowMenu).toHaveBeenCalledWith(false);
    });

    it('calls onSettingsClick on settings click', () => {
        render(<DashboardMenu {...defaultProps} showMenu={true} />);
        fireEvent.click(screen.getByText('Settings'));
        expect(mockOnSettingsClick).toHaveBeenCalled();
        expect(mockSetShowMenu).toHaveBeenCalledWith(false);
    });

    it('shows refreshing state', () => {
        render(<DashboardMenu {...defaultProps} showMenu={true} refreshing={true} />);
        expect(screen.getByText('Refreshing...')).toBeTruthy();
    });
});
