import { useState, useCallback, useRef } from 'react';
import { I18nProvider } from './contexts/I18nContext';
import TitleBar from './components/TitleBar';
import WeatherDashboard from './components/WeatherDashboard';

/**
 * The root component of the application.
 * Manages the global background state and transitions based on weather conditions.
 * Wraps the application in the I18nProvider.
 *
 * @returns {JSX.Element} The main application component.
 */
function App(): JSX.Element {
    const [bgClass, setBgClass] = useState('bg-default');
    const [transition, setTransition] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    /**
     * Handles background class changes triggered by weather updates.
     * Triggers a transition effect when the background changes.
     *
     * @param {string} newBg - The new background CSS class.
     */
    const handleBgChange = useCallback((newBg: string) => {
        setBgClass(prev => {
            if (prev !== newBg) {
                setTransition(true);
                // Reset transition state after animation duration.
                setTimeout(() => setTransition(false), 800);
                return newBg;
            }
            return prev;
        });
    }, []);

    return (
        <I18nProvider>
            <div
                ref={containerRef}
                className={`h-full flex flex-col relative overflow-hidden ${bgClass} ${transition ? 'bg-transition' : ''}`}
            >
                <div className="z-[100] relative">
                    <TitleBar />
                </div>
                <WeatherDashboard onBgChange={handleBgChange} bgContainerRef={containerRef} />
            </div>
        </I18nProvider>
    );
}

export default App;
