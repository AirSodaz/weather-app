# Weather App

![Build Status](https://img.shields.io/github/actions/workflow/status/AirSodaz/weather-app/build.yml?style=flat-square)
![Version](https://img.shields.io/github/package-json/v/AirSodaz/weather-app?style=flat-square)
![License](https://img.shields.io/github/license/AirSodaz/weather-app?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-blue?style=flat-square)

A modern, beautiful, and highly responsive weather application built with **Tauri 2.0**, **React**, and **Vite**. This application features a premium glassmorphism design, real-time weather updates, and detailed forecast information. It supports Windows, macOS, Linux, and Android.

![App Screenshot](https://via.placeholder.com/800x450.png?text=App+Screenshot+Placeholder)

[English](README.md) | [简体中文](README_zh-CN.md)

## Features

- **Real-time Weather Data**: Accurate current conditions and forecasts.
- **Multi-City Support**: Search and save multiple cities to your dashboard.
- **Detailed Forecasts**: 
  - Hourly forecasts (24h)
  - Daily forecasts (7-day)
  - Detailed metrics (UV Index, Humidity, Wind, Visibility, etc.)
- **Interactive UI**:
  - Smooth animations powered by `framer-motion`
  - Glassmorphism aesthetic
  - Dynamic layouts
- **Cross-Platform Support**:
  - Desktop: Windows, macOS, Linux (via Tauri)
  - Mobile: Android (via Tauri 2.0)
  - Web: PWA support for offline usage
- **Localization**: Support for English and Chinese (Simplified).
- **Customization**:
  - Per-city weather data source selection.
  - Startup view preferences (Dashboard vs. Last Viewed City).
  - Customizable detail view sections.
  - Custom API Host support.

## Configuration

To use the weather features, you need to configure an API key for your preferred weather provider.

1.  Open the application settings.
2.  Select your weather source:
    *   **OpenWeatherMap**: Requires an API key from [openweathermap.org](https://openweathermap.org/).
    *   **WeatherAPI**: Requires an API key from [weatherapi.com](https://www.weatherapi.com/).
    *   **QWeather**: Requires an API key from [qweather.com](https://www.qweather.com/).
    *   **Custom**: Allows you to connect to a compatible custom API endpoint.
3.  Enter your API key and save.

## Tech Stack

- **Core**: [Tauri 2.0](https://v2.tauri.app/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: React Context & Hooks
- **Data Fetching**: Axios

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
For Android development, you also need [Android Studio](https://developer.android.com/studio).
For Tauri development, ensure you have the [prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) installed for your OS.

### Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

### Development

To start the application in development mode:

```bash
npm run tauri dev
```

### Building

#### Desktop (Tauri)

To build the application for production (Windows, macOS, Linux):

```bash
npm run tauri build
```

The output will be in the `src-tauri/target/release/bundle` directory.

#### Android (Tauri 2.0)

To develop for Android:

```bash
npm run tauri android dev
```

To build for Android:

```bash
npm run tauri android build
```

## CI/CD

Automated builds are configured using GitHub Actions for:
- Windows
- macOS
- Ubuntu
- Android

## Project Structure

```
├── src-tauri/       # Tauri main project code (Rust)
├── src/            
│   ├── components/  # React UI components
│   ├── contexts/    # Context providers (Weather, Theme, etc.)
│   ├── hooks/       # Custom React hooks
│   ├── services/    # API services (Weather API)
│   ├── utils/       # Utility functions
│   ├── locales/     # i18n translation files
│   └── ...
├── dist/            # Production build assets
└── ...
```

## License

[MIT](LICENSE)
