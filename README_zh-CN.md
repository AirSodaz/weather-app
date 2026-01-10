# Weather App

一个基于 **Electron**、**React** 和 **Vite** 构建的现代、美观且响应式极佳的天气应用。该应用采用高级的玻璃拟态设计，提供实时天气更新和详细的预报信息。

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
- **本地化**: 支持英语和简体中文。
- **个性化**:
  - 每个城市可单独选择天气数据源。
  - 启动视图偏好设置（仪表盘 vs 最后查看的城市）。
  - 可自定义的详情视图板块。

## 技术栈

- **核心**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **状态管理**: React Context & Hooks
- **数据获取**: Axios

## 以此开始

### 先决条件

确保您的机器上已安装 [Node.js](https://nodejs.org/)。

### 安装

1. 克隆仓库。
2. 安装依赖：

```bash
npm install
```

### 开发

要在开发模式下启动应用程序（渲染进程和主进程均支持热重载）：

```bash
npm run dev
```

### 构建

构建生产环境应用程序：

```bash
npm run build
```

输出文件将位于 `dist` 和 `dist-electron` 目录中。

## 项目结构

```
├── electron/        # Electron 主进程代码
├── src/            
│   ├── components/  # React UI 组件
│   ├── contexts/    # Context providers (Weather, Theme, etc.)
│   ├── services/    # API 服务 (Weather API)
│   ├── utils/       # 工具函数
│   ├── locales/     # i18n 翻译文件
│   └── ...
├── dist/            # 生产构建资源
└── ...
```

## 许可证

[MIT](LICENSE)
