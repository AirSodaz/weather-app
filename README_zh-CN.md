# Weather App

一个基于 **Tauri 2.0**、**React** 和 **Vite** 构建的现代、美观且响应式极佳的天气应用。该应用采用高级的玻璃拟态设计，提供实时天气更新和详细的预报信息。支持 Windows、macOS、Linux 和 Android。

[English](README.md) | [简体中文](README_zh-CN.md)

## 功能特点

- **实时天气数据**: 准确的当前状况和预报。
- **多城市支持**: 搜索并保存多个城市到您的仪表盘。
- **详细预报**: 
  - 小时预报 (24小时)
  - 每日预报 (7天)
  - 详细指标 (紫外线指数、湿度、风速、能见度等)
- **交互式界面**:
  - 由 `framer-motion` 驱动的流畅动画
  - 玻璃拟态美学
  - 动态布局
- **跨平台支持**:
  - 桌面: Windows, macOS, Linux (via Tauri)
  - 移动: Android (via Tauri 2.0)
  - Web: 支持生成 PWA 以离线使用
- **本地化**: 支持英语和简体中文。
- **个性化**:
  - 每个城市可单独选择天气数据源。
  - 启动视图偏好设置（仪表盘 vs 最后查看的城市）。
  - 可自定义的详情视图板块。
  - 支持自定义 API Host。

## 技术栈

- **核心**: [Tauri 2.0](https://v2.tauri.app/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **状态管理**: React Context & Hooks
- **数据获取**: Axios

## 以此开始

### 先决条件

确保您的机器上已安装 [Node.js](https://nodejs.org/)。
对于 Android 开发，您还需要安装 [Android Studio](https://developer.android.com/studio)。
对于 Tauri 开发，请确保您已安装操作系统的[先决条件](https://tauri.app/zh-cn/v1/guides/getting-started/prerequisites)。

### 安装

1. 克隆仓库。
2. 安装依赖：

```bash
npm install
```

### 开发

要在开发模式下启动应用程序：

```bash
npm run tauri dev
```

### 构建

#### 桌面端 (Tauri)

构建生产环境应用程序（Windows, macOS, Linux）：

```bash
npm run tauri build
```

输出文件将位于 `src-tauri/target/release/bundle` 目录中。

#### Android (Tauri 2.0)

开发 Android 应用：

```bash
npm run tauri android dev
```

构建 Android 应用：

```bash
npm run tauri android build
```

## CI/CD

使用 GitHub Actions 配置了以下平台的自动构建：
- Windows
- macOS
- Ubuntu
- Android

## 项目结构

```
├── src-tauri/       # Tauri 主进程代码 (Rust)
├── src/            
│   ├── components/  # React UI 组件
│   ├── contexts/    # Context providers (Weather, Theme, etc.)
│   ├── hooks/       # 自定义 React Hooks
│   ├── services/    # API 服务 (Weather API)
│   ├── utils/       # 工具函数
│   ├── locales/     # i18n 翻译文件
│   └── ...
├── dist/            # 生产构建资源
└── ...
```

## 许可证

[MIT](LICENSE)
