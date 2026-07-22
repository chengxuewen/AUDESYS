# AUDESYS Studio 迁移指南：Tauri → Eclipse Theia

> 更新日期：2026-07-22
> 目标读者：原 Tauri Studio 用户

## 概述

AUDESYS Studio 从 Tauri+React 自建架构迁移到 Eclipse Theia 框架（D71）。迁移后的 Studio 提供更好的 IDE 体验，同时保持与现有 Rust Runtime 和 Controller 的完全兼容。

## 变化一览

| 项目 | Tauri Studio | Theia Studio |
|------|-------------|-------------|
| **框架** | Tauri (Rust 后端 + WebView) | Electron + Eclipse Theia |
| **代码编辑器** | CodeMirror 6 | Monaco Editor (VS Code 同款) |
| **LD/FBD 编辑器** | @xyflow/react 流程图 | Eclipse GLSP 图形编辑器 |
| **HMI 设计器** | react-rnd SVG 画布 | ReactWidget 包装（功能不变） |
| **Rust 桥接** | Tauri invoke (34 命令) | napi-rs (~25 函数) |
| **面板系统** | 自建 Tool+Slot 布局 | Theia Dock Panel 系统 |
| **插件生态** | 无 | VS Code 扩展兼容（Open VSX） |

## 与用户相关的变更

### 零迁移成本

所有项目文件格式不变，可直接在 Theia Studio 中打开：

- **IEC 61131-3 源码**（.st/.il/.ld/.fbd）— 文件直接复用
- **G-code 源码** — Monaco Editor 原生支持
- **HMI 布局**（hmi/layout.yaml）— 格式不变
- **编译产物** — Rust cargo target 路径不变

### 新增功能

- **GLSP 图形编辑器**：LD（梯形图）和 FBD（功能块图）使用专业图形编辑器，支持拖拽连线、自动布局、属性面板
- **Monaco Editor**：ST/IL/G-code 使用 VS Code 同款编辑器，享受智能提示、诊断、快速修复
- **Theia 工作台**：Dock Panel、命令面板（Ctrl+Shift+P）、快捷键自定义、多标签页
- **VS Code 扩展**：可通过 Open VSX 安装主题、LSP 语言服务器等扩展

### 破坏性变更

- **Tauri 命令被移除**：原有的 34 个 Tauri 命令不再可用。Theia Backend 通过 napi-rs 提供等效功能
- **调试断点格式不兼容**：Tauri 的 `debug/bookmarks.json` 需转换为 `.theia/debug.json`
- **项目配置**：Tauri 的 `project.yaml` 需替换为 Theia Workspace 配置（`.theia/workspace.json`）
- **快捷键变化**：部分快捷键已适配 Theia 默认键位

## 如何迁移现有项目

### 1. 安装 Theia Studio

```bash
# macOS
open AUDESYS\ Studio.dmg

# 或从源码构建
cd apps/studio-theia
npm install
npm run build
npm start
```

### 2. 打开已有项目

```
File → Open Folder → 选择原 Tauri Studio 的项目根目录
```

Theia 自动识别项目结构，IEC 61131-3 源文件直接可用。

### 3. 迁移项目配置

```bash
npx audesys migrate --from-tauri /path/to/old-project
```

自动执行：
- `project.yaml` → `.theia/workspace.json`
- `debug/bookmarks.json` → `.theia/debug.json`

### 4. 验证编译

在 Monaco 编辑器中打开 .st 文件，Ctrl+S 保存触发编译。错误信息显示在 Problems 面板中。

## 6 语言编辑器对应关系

| 语言 | Tauri 实现 | Theia 实现 | 迁移影响 |
|------|-----------|-----------|---------|
| ST (结构化文本) | CodeMirror 6 | Monaco Editor | 重新打开即可 |
| IL (指令表) | CodeMirror 6 | Monaco Editor | 重新打开即可 |
| LD (梯形图) | @xyflow/react | GLSP 图形编辑器 | 编辑器升级，.ld 文件兼容 |
| FBD (功能块图) | @xyflow/react | GLSP 图形编辑器 | 编辑器升级，.fbd 文件兼容 |
| SFC (顺序功能图) | CodeMirror 6 | Monaco Editor | 重新打开即可 |
| G-code | CodeMirror 6 | Monaco Editor | 重新打开即可 |

## 获取帮助

- 本文档：`docs/guides/migration-tauri-to-theia.md`
- 架构详情：`docs/modules/studio/theia-architecture.md`
- 开发环境搭建：`docs/guides/dev-setup-theia.md`
- 问题反馈：GitHub Issues
