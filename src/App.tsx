
import { I18nProvider } from './contexts/I18nContext';
import WeatherDashboard from './components/WeatherDashboard';

function App() {
    return (
        <I18nProvider>
            <div className="h-full flex flex-col weather-bg bg-default">
                <WeatherDashboard />
            </div>
        </I18nProvider>
    );
}

export default App;
