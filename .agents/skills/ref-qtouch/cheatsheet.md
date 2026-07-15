# 速查表

## 产品关系

```
Proficy HMI/SCADA
├── iFIX            → 高性能 HMI + SCADA，单站点
├── CIMPLICITY      → 企业级分布式 SCADA，多站点
├── Historian       → 时序数据归档
├── Operations Hub  → Web 低代码仪表板
├── Webspace        → HTML5 移动客户端
└── KEPServerEX     → OPC 统一通信层

QTouch
└── 跨平台组态 SCADA → 国产化替代，Qt 技术栈
```

## iFIX 架构栈

```
WorkSpace (IDE)
    ↓
SAC (Scan, Alarm, Control)
    ├── Database Chains (AI/AO/DI/DO)
    ├── Alarm Management
    └── Data Acquisition
    ↓
KEPServerEX/IGS (OPC UA/DA, 200+ 驱动)
    ↓
Proficy Historian (时序归档)
```

## AUDESYS 决策映射

| AUDESYS 决策 | QTouch/iFIX 参考 |
|-------------|-----------------|
| D21: Tauri + React + TS | QiTech Electron→Tauri 迁移验证 |
| D22: RuSTy → HAL IR | QTouch IEC 61131-3 + C 混合 |
| D24: YAML + FlatBuffers | iFIX 标签数据库 + Configuration Hub |
| D25: ST Only + HMI | iFIX WorkSpace 配置即运行 |
| D26: WASM + Python (Phase 2) | iFIX VBA 教训（避免锁定） |
| D27: 层级化安全域 | iFIX 角色安全 |
| D29: Docker → NixOS | QiTech NixOS 生产验证 |
| D11: amw 三极 trait | KEPServerEX 统一通信层 |

## 关键数字

| 指标 | 数值 |
|------|------|
| iFIX 产品年龄 | 40+ 年 (1983-) |
| 全球客户 | 20,000+ 组织 |
| 支持的设备驱动 | 200+ |
| Dynamo 预置对象 | 500+ |
| 报警队列大小 | 10,000 (2023 版本) |
| iFIX 2023 安装时间 | 15 分钟（之前 1-3 小时） |
| 数据库同步压缩 | 65,000 标签 90s → 3s |
| Velotic 独立时间 | 2026 年 3 月 |

## 警示清单

### 需避免的 iFIX 缺陷
- [ ] VBA 脚本锁定（性能、安全） → AUDESYS 选 WASM + Python
- [ ] 配置工具分散（多个独立工具） → AUDESYS 统一 IDE
- [ ] COM/ActiveX 技术债 → AUDESYS 现代技术栈
- [ ] 向后兼容限制现代化 → AUDESYS schema 版本管理
- [ ] 品牌多次变更引发用户担忧 → 保持品牌一致性

### 所有权变迁时间线
```
Intellution (1981)
    ↓ Emerson 收购 (1995)
Emerson (1995-2001)
    ↓ GE 获得 (2001)
GE Fanuc / GE Digital (2001-2024)
    ↓ GE 分拆
GE Vernova (2024-2026.03)
    ↓ TPG 收购
Velotic (2026.03-)
```

## 关键竞争产品

| 产品 | 开发商 | 主要市场 |
|------|--------|---------|
| Wonderware InTouch | Aveva (Schneider) | 全球分布 |
| WinCC / WinCC OA | Siemens | 欧洲/全球 |
| FactoryTalk | Rockwell | 北美 |
| Movicon.NExT | Emerson | 欧洲 |
| QTouch | 武汉舜通智能 | 中国 |
| Ignition | Inductive Automation | 全球 |