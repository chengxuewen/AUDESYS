# AUDESYS 项目坑点

## 已遭遇的坑
暂无（项目无源代码，尚未开始开发）

## 项目初始化相关

### 全局 MODACS→AUDESYS 替换的危险
- **问题**: 不能简单地全局替换 `MODACS` → `AUDESYS`
- **原因**: 
  - `@modacs/*` npm scope 不应自动变为 `@audesys/*`（AUDESYS 还没有自己的包）
  - 历史上下文引用需审慎处理（architecture.md 中某些是合法性引用）
  - 文件路径引用（`docs/MODACS-Design.md`）应移除而非重命名
- **方案**: 精确的手术式编辑，配合每次修改后 `grep -ri modacs` 验证

### 缺失依赖文件的处理
- **问题**: 被引用的文件不存在于 AUDESYS 中（MODACS-Design.md、MODACS-AI-Dev.md、theme.css）
- **原因**: .agents/ 和 .opencode/ 直接从 MODACS 复制，保留了指向 MODACS 文件的引用
- **方案**: 移除引用使技能自包含，而非创建占位文件

### architecture.md 章节连贯性
- **问题**: 删除 MODACS 引用后，某些章节内容不足 50%，上下文支离破碎
- **原因**: 2289 行文档中 18+ 处 MODACS 引用，删除后 40-60% 内容为不连贯骨架
- **方案**: D6 骨架占位策略 — 内容不足 50% 的章节用 `TODO: 为 AUDESYS 重写此节` 替换

### Git 仓库状态
- **问题**: 仓库已初始化但零提交（首次提交前）
- **影响**: 所有文件显示为 `??`（未跟踪），无 git 历史可参考
- **方案**: 首次提交包含所有基础文件

### .gitignore 排除 .sisyphus/
- **注意**: `.sisyphus/` 在 .gitignore 中，计划文件和证据不会提交到仓库
- **影响**: 提交时需排除 `.sisyphus/` 路径
