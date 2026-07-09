# AUDESYS 架构决策

## D1: 项目命名规范 = AUDESYS
- **日期**: 2026-07-08
- **决定**: 全大写 `AUDESYS`，npm scope 用 `@audesys/`
- **理由**: 与 `package.json`（name="AUDESYS"）和 git remote 一致

## D2: 缺失依赖文件 = 移除引用
- **日期**: 2026-07-08
- **决定**: 从 SKILL.md 和 agent-guide.md 中删除对不存在文件的引用
- **理由**: 技能/指南应自包含，不依赖外部文件
- **影响的引用**: `docs/MODACS-Design.md` (14x)、`packages/ui/src/styles/theme.css` (4x)、`docs/MODACS-AI-Dev.md`、`~/.omo/teams/modacs-dev/config.json`

## D3: architecture.md 历史引用 = 完全去 MODACS 化
- **日期**: 2026-07-08
- **决定**: 移除所有 MODACS 历史叙述，重写为独立项目文档
- **理由**: 不应保留任何 MODACS 痕迹

## D4: .agents/rules/ 通用规则 = 仅扫描确认
- **日期**: 2026-07-08
- **决定**: 89 个规则文件已验证零 MODACS 引用，不做修改
- **理由**: 文件不含 MODACS 字样，通用开发规则与项目名无关

## D5: design-system SKILL.md = 保留并重品牌
- **日期**: 2026-07-08
- **决定**: 保留设计系统技能，重新品牌为 AUDESYS
- **理由**: AUDESYS 是工业控制平台，需要 UI 一致性

## D6: architecture.md = 骨架占位
- **日期**: 2026-07-08
- **决定**: 去 MODACS 化后内容不足 50% 的章节用 `TODO: 为 AUDESYS 重写此节` 占位
- **理由**: 保留有效技术内容，标记需重写的章节

## D7: agent-guide.md = 精简为空项目指南
- **日期**: 2026-07-08
- **决定**: 简化为匹配 AUDESYS 当前空项目状态
- **理由**: 移除 MODACS 7 阶段工作流、不存在的路径引用

## D8: D4 规则 = 无操作仅扫描
- **日期**: 2026-07-08
- **决定**: 确认性 grep 扫描，预期无修改
- **理由**: 89 个文件已确认零 MODACS 残留

## D9: @modacs/* 命名空间 = 移除引用
- **日期**: 2026-07-08
- **决定**: 移除所有 `@modacs/*` 引用，不替换为 `@audesys/*`
- **理由**: AUDESYS 尚无自己的包命名空间

## D10: HAL 通信原语 = Signal / StreamChannel / RPC 三分法
- **日期**: 2026-07-09
- **决定**: 用三种正交原语覆盖四种系统（LinuxCNC / OpenPLC / ROS2 / dora-rs）的全部通信模式，不引入第 4 种
- **理由**: Signal（单写多读最新值覆盖）与 StreamChannel（多写多读有缓冲队列）不可合并——ROS2 十年教训
- **参考**: `docs/hal-detailed-design.md` §1

## D11: amw 中间件抽象层 = HalTransport + HalDiscovery + HalQoS
- **日期**: 2026-07-09
- **决定**: 参考 ROS2 rmw 模式，定义 amw（AUDESYS Middleware）三极 trait，传输/发现/QoS 实现可替换
- **理由**: 不绑死 Zenoh/DDS/MQTT，换实现不换 API。Phase 1 用 amw_inproc，Phase 2+ 用 amw_zenoh
- **参考**: `docs/hal-detailed-design.md` §2–3

## D12: 统一类型系统 = 14 种
- **日期**: 2026-07-09
- **决定**: 11 种标量（Bool/S8/U8/S16/U16/S32/U32/S64/U64/F32/F64）+ String + Blob + Array<T>
- **理由**: 覆盖 IEC 61131-3 全部类型（TIME/DATE/TOD/DT 映射到现有数值类型），WSTRING 不引入（UTF-8 only），Blob 不进类型推导
- **参考**: `docs/hal-detailed-design.md` §4

## D13: 四系统混合线程调度
- **日期**: 2026-07-09
- **决定**: RT 线程 = LinuxCNC 显式函数列表 + ROS2 control 的 read→update→write 管线 + OpenPLC 扫描屏障 + dora-rs 事件驱动 I/O 线程
- **理由**: 三类执行需求（硬实时控制 / I/O 通信 / 流数据）不能放进同一个调度模型
- **参考**: `docs/detail/hal/thread-scheduling-design.md`

## D14: HAL 详细设计 = 独立文档策略
- **日期**: 2026-07-09
- **决定**: HAL 详细设计独立为 `docs/hal-detailed-design.md`，不在 `docs/architecture.md` 内展开
- **理由**: architecture.md 保持系统概览角色（~2300 行，6 个主章均衡），详细规范独立维护
- **参考**: `docs/hal-detailed-design.md`（3,185 行，16 章）

## D15: 文档目录结构 = detail/ 子目录
- **日期**: 2026-07-09
- **决定**: 独立设计文档放入 `docs/detail/{module}/` 子目录，合并后主文档在 `docs/` 根目录
- **理由**: 减少 docs/ 根目录文件数量，按模块组织；主合并文档作为入口
- **当前结构**: `docs/detail/hal/` 含 11 份子文档

## D16: 工业 QoS 三层执行
- **日期**: 2026-07-09
- **决定**: Deadline 在 RT 数据面（amw 内部同周期 tick 触发）、Liveliness 在控制面（Zenoh 原生）、Security Domain 在配置面（静态 keyexpr 标记）
- **理由**: 不同维度的执行时间和可靠性要求不同，不能全放进 RT 线程
- **参考**: `docs/hal-detailed-design.md` §3

## D17: Config Barrier + LockLevel
- **日期**: 2026-07-09
- **决定**: 所有配置变更排队到 RT 周期边界批量应用（Config Barrier），LockLevel 从运行时锁变更为配置权限分级
- **理由**: 多进程 Supervisor 可能随时发 RPC，不能依赖 LinuxCNC 式的开发者自觉。Run 级别拒绝所有 RPC
- **参考**: `docs/detail/hal/config-barrier-design.md`

## D18: HAL 协议设计 = 团队审核驱动
- **日期**: 2026-07-09
- **决定**: HAL 协议设计经 3 人团队（LinuxCNC 实时 / ROS2 中间件 / IEC 61131-3 软PLC）并行审核，共 27 项发现，全部逐项交互确认
- **理由**: 多视角交叉验证，避免单领域盲点
- **审核范围**: CRITICAL 7 / HIGH 8 / MEDIUM 8 / LOW 4

## 实施防护规则
- **G1**: architecture.md 内容完整性 — 删除后保留率 <50% 的章节变为 TODO 占位符
- **G2**: 删除后文本连贯性 — 无指向已删除 MODACS 上下文的孤立引用
- **G3**: @modacs/* 不自动替换 — 仅移除
- **G4**: 每次修改后运行不区分大小写的 `grep -ri modacs` 验证
- **G5**: HAL 详细文档统一入口为 `docs/hal-detailed-design.md`，子文档在 `docs/detail/hal/` 归档
