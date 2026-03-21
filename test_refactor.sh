# Check where the top-right menu is defined in WeatherDashboard.tsx
awk '/Top Right Menu Button/,/<\/AnimatePresence>/' src/components/WeatherDashboard.tsx
