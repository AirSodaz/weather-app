# Weather App

A modern, beautiful, and highly responsive weather application built with **Tauri**, **React**, **Capacitor**, and **Vite**. This application features a premium glassmorphism design, real-time weather updates, and detailed forecast information. It supports Windows, macOS, Linux, and Android.

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
  - Mobile: Android (via Capacitor)
  - Web: PWA support for offline usage
- **Localization**: Support for English and Chinese (Simplified).
- **Customization**:
  - Per-city weather data source selection.
  - Startup view preferences (Dashboard vs. Last Viewed City).
  - Customizable detail view sections.
  - Custom API Host support.

## Tech Stack

- **Core**: [Tauri](https://tauri.app/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Mobile**: [Capacitor](https://capacitorjs.com/)
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

#### Android

To build for Android:

```bash
npm run android:build
```

This will build the web assets and sync them with the Android project. You can then open the project in Android Studio using `npx cap open android`.

## CI/CD

Automated builds are configured using GitHub Actions for:
- Windows
- macOS
- Ubuntu
- Android

## Project Structure

```
├── src-tauri/       # Tauri main project code (Rust)
├── android/         # Android native project code
├── src/            
│   ├── components/  # React UI components
│   ├── contexts/    # Context providers (Weather, Theme, etc.)
│   ├── services/    # API services (Weather API)
│   ├── utils/       # Utility functions
│   ├── locales/     # i18n translation files
│   └── ...
├── dist/            # Production build assets
└── ...
```

## License

[MIT](LICENSE)
