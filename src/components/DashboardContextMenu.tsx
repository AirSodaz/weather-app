import React from 'react';
import { motion, Variants } from 'framer-motion';
import { FaInfoCircle, FaCheck, FaTrash } from 'react-icons/fa';
import { useI18n } from '../contexts/I18nContext';
import { ContextMenuState } from '../hooks/useDashboardContextMenu';

const contextMenuVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } }
};

interface DashboardContextMenuProps {
    contextMenu: ContextMenuState;
    contextMenuRef: React.RefObject<HTMLDivElement>;
    confirmDelete: string | null;
    onViewDetails: () => void;
    onDeleteClick: (e: React.MouseEvent) => void;
}

function DashboardContextMenu({
    contextMenu,
    contextMenuRef,
    confirmDelete,
    onViewDetails,
    onDeleteClick
}: DashboardContextMenuProps): JSX.Element {
    const { t } = useI18n();

    if (!contextMenu.show || !contextMenu.weather) {
        return <></>;
    }

    return (
        <motion.div
            ref={contextMenuRef}
            variants={contextMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed z-[100] glass-card rounded-3xl py-2 min-w-[200px] border border-white/20"
            style={contextMenu.menuStyle}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
        >
            <button
                onClick={onViewDetails}
                className="menu-item"
            >
                <span className="menu-item-icon"><FaInfoCircle className="text-blue-400" /></span>
                {t.contextMenu?.viewDetails || 'View Details'}
            </button>
            <button
                onClick={onDeleteClick}
                className={`menu-item ${confirmDelete === contextMenu.weather?.city ? 'bg-red-500/20 text-red-200' : 'menu-item-danger'}`}
            >
                <span className="menu-item-icon">
                    {confirmDelete === contextMenu.weather?.city
                        ? <FaCheck className="text-red-400" />
                        : <FaTrash className="text-red-400" />
                    }
                </span>
                {confirmDelete === contextMenu.weather?.city ? `${t.remove}?` : t.remove}
            </button>
        </motion.div>
    );
}

export default DashboardContextMenu;
