# Weather App

A modern, beautiful, and highly responsive weather application built with **Electron**, **React**, and **Vite**. This application features a premium glassmorphism design, real-time weather updates, and detailed forecast information.

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
- **Localization**: Support for English and Chinese (Simplified).
- **Customization**:
  - Per-city weather data source selection.
  - Startup view preferences (Dashboard vs. Last Viewed City).
  - Customizable detail view sections.

## Tech Stack

- **Core**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: React Context & Hooks
- **Data Fetching**: Axios

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

### Development

To start the application in development mode (with hot-reload for both Renderer and Main processes):

```bash
npm run dev
```

### Building

To build the application for production:

```bash
npm run build
```

The output will be in the `dist` and `dist-electron` directories.

## Project Structure

```
├── electron/        # Electron main project code
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
