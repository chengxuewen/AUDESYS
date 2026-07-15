# ref-intouch: Cheatsheet

## Architecture Layers

| Layer | Component | AUDESYS Counterpart |
|-------|-----------|---------------------|
| 5. Visualization | WindowViewer / OMI / InTouch Access Anywhere | Runtime HMI Engine |
| 4. Application Server | AppEngine (Alarm/History/Script/I/O Engines) | Runtime Supervisor |
| 3. Configuration | Galaxy Repository (SQL Server) | Studio Project (YAML/Git) |
| 2. Communication | SuiteLink / DDE / OPC / MQTT / Access Name | amw_transport / amw_discovery / amw_qos |
| 1. Field Devices | PLC / RTU / DCS / Smart Instruments | HAL Device Layer |

## Tag Types (InTouch) vs Signal Types (AUDESYS)

| InTouch | AUDESYS | Notes |
|---------|---------|-------|
| Memory Tag | Memory Signal | Internal variable |
| I/O Tag | I/O Signal | External data source |
| Indirect Tag | — | Runtime redirection via .Name |
| SuperTag | Device Template | Tag group template |
| System Tag ($) | System Signal | Predefined system variables |
| — | StreamChannel | Multi-writer buffered channel (no InTouch equivalent) |
| — | RPC | Remote procedure call (no InTouch equivalent) |

## QuickScript 7 Script Types

| # | Type | Trigger | AUDESYS Equivalent |
|---|------|---------|-------------------|
| 1 | Application | On Startup / While Running / On Shutdown | Runtime lifecycle hooks |
| 2 | Window | On Show / While Showing / On Hide | View lifecycle hooks |
| 3 | Key | On Key Down / While Down / On Key Up | Input event handlers |
| 4 | Condition | On True / While True / On False / While False | HalQoS + Signal condition |
| 5 | Data Change | Tag value changes | Signal event |
| 6 | Action | Operator click | UI event handler |
| 7 | ActiveX Event | ActiveX control events | WASM plugin events |

## Communication Protocols

| Protocol | Transport | Speed | Status |
|----------|-----------|-------|--------|
| SuiteLink | TCP/IP | High | Recommended |
| DDE | Windows Messages | Low | Legacy |
| FastDDE | Windows Messages | Medium | Phasing out |
| OPC DA | COM/DCOM | Medium | Mature |
| OPC UA | TCP/HTTPS | Medium-High | Current |
| MQTT | TCP | Medium | New (2023+) |

## InTouch vs Ignition Quick Comparison

| Aspect | InTouch | Ignition |
|--------|---------|----------|
| Licensing | Tag-tier → Unlimited (2024) | Server-based, unlimited |
| Web | OMI (HTML5) | Perspective (React) |
| IDE | Desktop (WindowMaker) | Browser-based |
| Script | QuickScript + .NET | Python (Jython) |
| OS | Windows only | Cross-platform |
| MQTT | New (2023+) | Native Sparkplug B |
| Price | ~$12,000-20,000 | ~$10,000-20,000 |

## Redundancy Levels

| Level | InTouch | AUDESYS Phase |
|-------|---------|---------------|
| AppEngine | Primary/Backup (~15s failover) | Phase 2 |
| DB | SQL Server HA | Phase 2 |
| I/O | Multi DA Server | Phase 2 |
| Network | Dual NIC | Phase 2 |
| Historian | Tier-2 + local buffer | Phase 3 |

## Key Numbers

| Metric | Value |
|--------|-------|
| InTouch first release | 1989 |
| ArchestrA introduction | ~2002 |
| Wonderware → AVEVA | 2018 |
| InTouch Unlimited | 2024 |
| Install base | ~1/3 of global HMI/SCADA |
| Installation size | ~4.5 GB (requires System Platform) |
| Script types | 7 |
| System Tags | 100+ |
| Tag pricing tiers (historical) | 100/256/512/1000/3000/8000/32K/64K |