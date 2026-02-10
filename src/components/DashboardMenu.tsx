import { useRef, useState, useEffect } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { FaSync, FaCog, FaEllipsisV } from 'react-icons/fa';
import RelativeTime from './RelativeTime';
import { useI18n } from '../contexts/I18nContext';

interface DashboardMenuProps {
    onRefresh: () => void;
    onSettings: () => void;
    lastRefreshTime: Date | null;
    isRefreshing: boolean;
}

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};

export function DashboardMenu({
    onRefresh,
    onSettings,
    lastRefreshTime,
    isRefreshing
}: DashboardMenuProps): JSX.Element {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
             if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                 setIsOpen(false);
             }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="p-4 glass-card rounded-full text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                aria-label="Main menu"
            >
                <FaEllipsisV className="text-xl" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Overlay to catch clicks if needed, though click-outside handles it */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                        <motion.div
                            key="dashboard-menu"
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="absolute right-0 top-full mt-3 w-56 glass-card rounded-2xl py-2 shadow-2xl flex flex-col z-50 border border-white/10 backdrop-blur-xl"
                        >
                            {lastRefreshTime && (
                                <div className="px-5 py-3 text-sm font-medium text-white/40 border-b border-white/10 uppercase tracking-wider">
                                    {t.refresh.lastUpdate}: <RelativeTime date={lastRefreshTime} />
                                </div>
                            )}
                            <button
                                onClick={() => { onRefresh(); setIsOpen(false); }}
                                disabled={isRefreshing}
                                className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                <FaSync className={`text-blue-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? t.refresh.refreshing : t.refresh.button}
                            </button>
                            <button
                                onClick={() => { onSettings(); setIsOpen(false); }}
                                className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                <FaCog className="text-slate-300" />
                                {t.settings.title}
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
