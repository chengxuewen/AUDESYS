# Ch04: Status and Ecosystem

## 4.1 Current Version and Activity

| Metric | Status |
|--------|--------|
| Latest version | TwinCAT 3.1 Build 4026 series (continuous updates) |
| Update frequency | 1-2 major versions per year, with intermediate Build updates |
| TwinCAT PLC++ | 2024: Next-gen PLC runtime with MC3 motion architecture |
| XAE Engineering | Basic functions permanently free |
| 7-day trial | Runtime 7-day renewable trial license |
| GitHub activity | 50+ open-source libraries (ADS libraries, TF examples, TcOpen community) |
| Community | Very active: user forums, Stack Overflow TcAdsTc, Reddit r/PLC |

### TwinCAT 3 Version History

| Version | Released | Key Features |
|---------|----------|-------------|
| TwinCAT 3.0 | 2011 | First VS-based version |
| TwinCAT 3.1 | 2013 | Multi-runtime, TwinCAT/BSD support |
| Build 3020 | 2015 | TwinSAFE integration, OPC UA support |
| Build 3026 | 2017 | Package Manager |
| Build 4026 | 2019 | Full TwinCAT/BSD support |
| Build 4026+ | 2020-2024 | Continuous updates, TwinCAT PLC++ (2024) |
| TwinCAT 4.0 (planned) | TBD | Architectural restructuring |

## 4.2 User Base

- **Global installations**: 1M+ TwinCAT-based control systems
- **EtherCAT nodes**: 50M+ EtherCAT slave devices worldwide (as of 2024)
- **Market share** (PC-based Automation): ~14%, ranked 3rd (behind Siemens and Rockwell)
- **Growth rate**: 9.1% CAGR 2019-2024, above industry average
- **Regional distribution**: Europe 31%, North America 34%, Asia-Pacific 35% (estimated)

Beckhoff's growth trajectory: 1980 (3 founders) -> 1990s (>EUR 100M revenue) -> 2000 (>EUR 1B) -> 2010 (>EUR 2B) -> 2020 (>EUR 3B). The 2024 decline to EUR 11.7B (33% drop) reflects the global manufacturing cyclical adjustment, but the company maintains positive cash flow and continuous R&D investment.

## 4.3 Ecosystem

### EtherCAT Device Ecosystem

EtherCAT Technology Group (ETG) is one of the largest independent industrial Ethernet user organizations:

- 7,000+ member companies (drives, I/O, sensors, encoders, valve islands)
- 5,000+ certified EtherCAT products
- Global compliance testing centers
- FSoE (FailSafe over EtherCAT) widely adopted for safety control

### Third-Party Integrations

| Third Party | Integration | Use Case |
|-------------|-------------|----------|
| MATLAB / Simulink | TE1400 interface | Model-driven development and code generation |
| LabVIEW | TF3710 interface | Test and measurement |
| OPC UA clients | TF6100 | Enterprise/ERP data exchange |
| MQTT broker | TF6701 | AWS/Azure/AliCloud IoT integration |
| Node-RED | ADS REST interface | Low-code IoT integration |
| GitHub / Git | VS integration | Version control and CI/CD |
| TcOpen (community) | Open-source library | Standardized machine function blocks |

### Ecosystem Evolution

- 1990s: EL terminal blocks pioneered industrial bus terminal blocks
- 2000s: EtherCAT standardized real-time Ethernet
- 2010s: TwinCAT 3 merges automation with IT
- 2020s: TwinCAT/BSD and MX-System usher cabinet-free mechatronics era

This strategy is "hardware provides compute, software defines function" - fundamentally different from Siemens' "hardware + software" binding strategy.

## 4.4 Latest Trends

### TwinCAT 3 to 4th Generation Evolution

- **TwinCAT PLC++** (2024): Next-gen PLC runtime with fundamentally improved engineering and runtime architecture
- **TwinCAT MC3**: Next-gen motion control architecture, companion to PLC++
- **Beckhoff RT Linux**: Third real-time OS option (alongside Windows and TwinCAT/BSD)

### TwinCAT/BSD

Dedicated real-time OS based on FreeBSD:

- Eliminates Windows licensing cost
- Native real-time kernel (no hypervisor double-tick)
- Complete TwinCAT 3 function stack
- Shorter boot time, leaner system
- Suitable for embedded control requiring high reliability

Performance comparison (isolated core mode):

| Metric | Windows + TwinCAT 3 | TwinCAT/BSD |
|--------|---------------------|-------------|
| Minimum cycle | ~250us | ~100us |
| Jitter | ~2us | ~500ns |
| Architecture | x86/x64 | x86/x64 + Arm |
| Security | Windows security model | Kernel-level security isolation |
| Long-term support | ~5 years | ~10 years (FreeBSD LTS) |

TwinCAT/BSD supports PLC, NC, CNC, Safety, Analytics, IoT. Vision and some third-party integrations still require Windows.

### TwinCAT HMI

- **Fully HTML5**: Any modern browser as HMI client
- **Responsive**: PC, tablet, phone multi-platform
- **Multi-client**: One HMI Server serves multiple clients
- **Secure**: HTTPS encrypted + user permission management
- **Server Extensions**: .NET SDK for custom extension development

### MX-System

2023 innovation: IPC, EtherCAT coupler, I/O, servo drive integrated into IP67-rated **plug-and-play system**. No control cabinet needed. Represents Beckhoff's progress toward mechatronics integration.