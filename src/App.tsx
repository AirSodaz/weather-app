import { useState, useCallback, useRef } from 'react';
import { useIsMaximized } from './hooks/useIsMaximized';
import { I18nProvider } from './contexts/I18nContext';
import TitleBar from './components/TitleBar';
import WeatherDashboard from './components/WeatherDashboard';

function App() {
    const [bgClass, setBgClass] = useState('bg-default');
    const [transition, setTransition] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isMaximized = useIsMaximized();

    const handleBgChange = useCallback((newBg: string) => {
        setBgClass(prev => {
            if (prev !== newBg) {
                setTransition(true);
                // Reset transition state after animation duration
                setTimeout(() => setTransition(false), 800);
                return newBg;
            }
            return prev;
        });
    }, []);

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

    return (
        <I18nProvider>
            <div
                ref={containerRef}
                className={`h-full flex flex-col relative overflow-hidden ${bgClass} ${transition ? 'bg-transition' : ''} ${isTauri && !isMaximized ? 'rounded-xl' : ''}`}
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
