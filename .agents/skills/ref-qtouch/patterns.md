# 设计模式

## 模式 1：配置即运行

**来源**: iFIX WorkSpace

WorkSpace 既是 IDE 又是运行时环境。工程师在同一个环境中完成画面设计、标签配置、脚本编写和系统调试。

**AUDESYS 应用**: Studio IDE 采用统一开发环境，减少工具切换成本。Phase 1 支持 ST 编程 + HMI 可视化设计（D25）。

## 模式 2：统一通信抽象层

**来源**: KEPServerEX/IGS

所有设备协议统一为 OPC UA/DA 接口，新设备驱动以插件形式添加。上层应用无需关心设备细节。

**AUDESYS 应用**: HAL amw 三极 trait（HalTransport + HalDiscovery + HalQoS），传输实现可替换（D11）。

## 模式 3：异常驱动可视化

**来源**: iFIX High Performance HMI (ISA 101)

正常状态使用灰色/低饱和度配色，异常状态使用醒目颜色突出。操作员无需在正常画面上寻找异常信息。

**AUDESYS 应用**: Studio HMI 设计器的默认配色方案和模板库设计原则。

## 模式 4：数据库链管线

**来源**: iFIX Database Chains

数据处理以链式管线组织：模拟量输入链 → 量程转换 → 滤波 → 报警检测 → PID → 输出链。每步可插拔。

**AUDESYS 应用**: Runtime 数据处理管线设计，Signal/StreamChannel 的链式处理模式。

## 模式 5：标签数据库中心化

**来源**: iFIX Tag Database

所有 I/O 点集中管理于标签数据库，画面、报警、历史数据均引用标签。标签变更自动传播。

**AUDESYS 应用**: Studio IDE 的变量管理系统，HAL 类型系统与标签的映射。

## 模式 6：去中心化 SCADA 节点

**来源**: CIMPLICITY

每个 SCADA 节点独立运行，不依赖中央服务器。节点间通过配置进行数据同步和报警路由。

**AUDESYS 应用**: Runtime 分布式架构设计，独立运行单元 + 配置驱动同步。

## 模式 7：插件化图形对象（Dynamo）

**来源**: iFIX Dynamo

预置工业图形对象（500+ ISA 符号），支持动态链接。主对象更新时，所有实例自动同步。

**AUDESYS 应用**: Studio IDE 的图形组件库设计，符号标准化策略。

## 模式 8：NixOS 声明式部署

**来源**: QiTech Control（Velotic 相关技术验证）

系统配置以代码方式管理，可复现、可版本控制。原子升级支持现场回滚。

**AUDESYS 应用**: Phase 1 Docker + PREEMPT_RT，Phase 2 评估 NixOS（D29）。

## 模式 9：Electron → Tauri 迁移

**来源**: QiTech Control 技术演进

从 Electron（120MB, 150MB 内存）迁移到 Tauri（5-10MB, 50MB 内存），Rust 后端与工业控制开发语言一致。

**AUDESYS 应用**: Studio IDE 技术栈选型 Tauri + React + TypeScript（D21）。

## 模式 10：跨平台 Qt 组态

**来源**: QTouch

基于 Qt（QML/Qt Quick）构建跨平台工业组态软件，一次开发多平台适配，支持国产芯片（龙芯/飞腾等）。

**AUDESYS 应用**: 验证了 Qt 在工业 SCADA 中的可行性，为 Studio IDE 的跨平台策略提供参考。