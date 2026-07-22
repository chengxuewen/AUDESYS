# AUDESYS Studio Theia 开发环境搭建

> 更新日期：2026-07-22
> 目标读者：AUDESYS Studio 开发者

## 前提条件

| 依赖 | 版本要求 | 安装方式 |
|------|---------|---------|
| Node.js | ≥ 22 | `nvm install 22` |
| Rust | stable | `rustup default stable` |
| npm | ≥ 9 | 随 Node.js 安装 |
| Git | ≥ 2.40 | macOS 内置 `git` |

## 快速开始

```bash
# 1. 克隆仓库
git clone <repo-url> && cd AUDESYS

# 2. 安装依赖
cd apps/studio-theia
npm install

# 3. 构建 napi-rs 原生模块
cd ../../crates/audesys-theia-bridge
npm install
npm run build          # 编译 .node 二进制

# 4. 构建 Theia 应用
cd ../../apps/studio-theia
npm run build

# 5. 启动 Studio
npm start
```

启动后 Studio 窗口自动打开。首次启动约 30 秒（Electron 冷启动 + Theia 初始化）。

## napi-rs 桥接构建详解

`crates/audesys-theia-bridge/` 是 Rust → Node.js 绑定层，编译为 `.node` 原生二进制。

```bash
cd crates/audesys-theia-bridge

# 安装 npm 依赖（napi-rs CLI）
npm install

# 编译 Rust → .node（macOS x64）
npm run build
# 输出：index.darwin-x64.node（~980KB）

# 如果在 Apple Silicon Mac 上开发
npm run build -- --target aarch64-apple-darwin

# 交叉编译 Linux/Mac/Win 三平台（CI 用）
npm run build -- --target x86_64-unknown-linux-gnu
npm run build -- --target x86_64-pc-windows-msvc

# 运行 napi-rs 测试
npm test
```

构建产物：
- `index.darwin-x64.node` — macOS x64 原生二进制
- `index.js` — JS 入口（自动选择平台对应的 .node 文件）
- `index.d.ts` — TypeScript 类型声明

## 启动模式

```bash
# 开发模式（带调试日志）
npm run start:debug

# 浏览器模式（不使用 Electron）
npm run build && theia start --plugins=local-dir:../../theia-plugins

# 生产构建（优化压缩）
npm run build:prod

# 打包为可分发的安装包
npm run build:prod && npm run package
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Theia Studio |
| `npm run build` | 构建开发版本 |
| `npm run build:prod` | 构建生产版本 |
| `npm run clean` | 清理构建产物 |
| `npm run rebuild` | 重新构建 Electron 原生依赖 |
| `npm test` | 运行 Smoke 测试 |
| `npm run bundle` | rebuild + build |

## 添加新语言编辑器扩展

以添加一个新的 Monaco 语言编辑器为例：

```bash
# 1. 创建扩展目录
mkdir -p theia-extensions/audesys-mylang-editor/src/browser

# 2. 创建 package.json
cat > theia-extensions/audesys-mylang-editor/package.json << 'EOF'
{
  "name": "audesys-mylang-editor",
  "version": "0.1.0",
  "description": "AUDESYS MyLang Editor",
  "theiaExtensions": [{
    "frontend": "lib/browser/mylang-frontend-module"
  }],
  "dependencies": {
    "@theia/monaco": "1.73.0",
    "@theia/core": "1.73.0"
  }
}
EOF

# 3. 注册 Monaco 语言
# 创建 src/browser/mylang-language.ts
#    - 定义 Monarch tokenizer（语法高亮规则）
#    - 定义 language configuration（括号、注释、缩进）
#
# 创建 src/browser/mylang-frontend-module.ts
#    - inversify ContainerModule
#    - 注册 LanguageContribution

# 4. 在 apps/studio-theia/package.json 中添加依赖
# "audesys-mylang-editor": "file:../../theia-extensions/audesys-mylang-editor"

# 5. 重新构建
cd apps/studio-theia && npm install && npm run build
```

完整参考：`theia-extensions/audesys-st-editor/src/browser/`

## 运行测试

```bash
# Smoke 测试（快速验证启动）
cd apps/studio-theia
npm run test:smoke

# Rust 侧回归测试（当前 737+ 测试需全通过）
cd ../../
cargo test --workspace

# 完整 E2E 测试
cd apps/studio-theia
npx playwright test
```

## 故障排查

### `require('@audesys/theia-bridge')` 报错

```
Error: Cannot find module '@audesys/theia-bridge'
```
→ 运行 `cd crates/audesys-theia-bridge && npm install && npm run build`

### napi-rs 编译失败（缺少 Rust target）

```bash
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### Theia 启动白屏

```bash
npm run clean && npm run build && npm start
```

### Electron 版本不匹配

```bash
npm run rebuild    # 重新构建原生模块
```

## CI/CD

当前 CI 配置（`.github/workflows/qa-fast.yml`）：
- macOS + Linux 矩阵
- Smoke 测试（2 分钟超时）
- `cargo test --workspace`（Rust 回归）
- `cargo clippy` + `cargo fmt --check`

napi-rs 三平台构建在 CI 中通过 GitHub Actions matrix 实现。
