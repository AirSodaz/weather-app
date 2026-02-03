import { useEffect, RefObject } from 'react';

/**
 * Hook to trap focus within a container and handle Escape key to close.
 *
 * @param ref - Ref to the container element
 * @param isActive - Whether the trap should be active
 * @param onClose - Callback for Escape key
 */
export function useFocusTrap(
    ref: RefObject<HTMLElement>,
    isActive: boolean,
    onClose?: () => void
) {
    useEffect(() => {
        if (!isActive || !ref.current) return;

        const element = ref.current;
        const focusableElements = element.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus first element on mount to ensure focus is within the modal
        // using requestAnimationFrame to ensure DOM is ready and prevent conflict with opening animation
        requestAnimationFrame(() => {
            firstElement.focus();
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }

            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        element.addEventListener('keydown', handleKeyDown);
        return () => element.removeEventListener('keydown', handleKeyDown);
    }, [isActive, onClose, ref]);
}
