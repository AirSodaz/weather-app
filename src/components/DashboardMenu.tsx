import React, { useState } from 'react';
import { FaEllipsisV, FaSync, FaCog } from 'react-icons/fa';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import RelativeTime from './RelativeTime';
import { useI18n } from '../contexts/I18nContext';

interface DashboardMenuProps {
    refreshing: boolean;
    lastRefreshTime: Date | null;
    onRefresh: () => void;
    onOpenSettings: () => void;
}

const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, scale: 0.95, transition: { duration: 0.15 } }
};

export default function DashboardMenu({
    refreshing,
    lastRefreshTime,
    onRefresh,
    onOpenSettings
}: DashboardMenuProps): JSX.Element {
    const { t } = useI18n();
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-4 glass-card rounded-full text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                aria-label="Main menu"
            >
                <FaEllipsisV className="text-xl" />
            </button>

            <AnimatePresence>
                {showMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
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
                                onClick={() => { onRefresh(); setShowMenu(false); }}
                                disabled={refreshing}
                                className="w-full px-5 py-3 text-left text-base text-white hover:bg-white/10 flex items-center gap-3 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                <FaSync className={`text-blue-300 ${refreshing ? 'animate-spin' : ''}`} />
                                {refreshing ? t.refresh.refreshing : t.refresh.button}
                            </button>
                            <button
                                onClick={() => { onOpenSettings(); setShowMenu(false); }}
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
