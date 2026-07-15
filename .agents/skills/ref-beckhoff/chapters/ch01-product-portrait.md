# Ch01: Product Portrait

## 1.1 Basic Information

- **Full Name**: Beckhoff Automation GmbH & Co. KG / TwinCAT (The Windows Control and Automation Technology)
- **HQ**: Verl, Germany
- **Founded**: 1980
- **Founder**: Hans Beckhoff
- **Ownership**: Private family business (Beckhoff family wholly owned)
- **2024 Revenue**: EUR 11.7B (approx $12.7B), down 33% YoY (2023: EUR 17.5B)
- **Employees**: ~5,500 globally
- **TwinCAT First Release**: 1996 (TwinCAT 1.0), TwinCAT 3 in 2011

## 1.2 Positioning and Value Proposition

Beckhoff is the **inventor and primary advocate of PC-based Control**. Core value proposition:

- **Standard industrial PC replaces dedicated PLC hardware**: TwinCAT software transforms any IPC into a real-time PLC + NC + CNC controller
- **"PC Controls" philosophy**: Leverages PC hardware's rapid iteration (CPU every 18-24 months), avoiding traditional PLC upgrade bottlenecks
- **Open platform strategy**: Supports Windows, TwinCAT/BSD (FreeBSD-derived), and Beckhoff RT Linux
- **EtherCAT real-time Ethernet**: Invented by Beckhoff in 2003, now IEC 61158 international standard

## 1.3 Target User Segments

| Segment | Typical Need | Beckhoff Advantage |
|---------|-------------|-------------------|
| High-speed machine OEM | Packaging, printing, sorting | EtherCAT 50us cycle + TwinCAT MC3 multi-axis interpolation |
| Semiconductor equipment | Nanometer precision motion | High compute via PC-based Control + NC/CNC integration |
| Automotive line integrator | Multi-robot coordination + vision | TwinCAT Vision + Robotics + CNC on same platform |
| Building automation | BACnet/lighting control | TwinCAT BACnet / Building Automation modules |
| Wind energy / power monitoring | Condition monitoring + analytics | TwinCAT Analytics + Condition Monitoring |
| Research and education | Rapid prototyping | TwinCAT 3 Engineering free + MATLAB/Simulink integration |

## 1.4 Platform Level Licensing Model

Beckhoff uses **Platform Level** licensing by hardware performance (CPU cores):

| Level | Target Hardware | Typical Scenario |
|-------|----------------|-----------------|
| Level 10-20 (Economy) | Arm embedded / CX low-end | Small standalone PLC |
| Level 30-40 (Performance) | x86 IPC / CX mid-range | Mainstream PLC + NC |
| Level 50-70 (High Perf) | Multi-core x86 IPC | CNC, Vision, Analytics |
| Level 80-84 (Very High) | High-perf multi-core IPC | Multi-runtime parallel |
| Level 90-94 (Other) | 1-64 core specific config | Large-scale systems |

Key licensing characteristics:
- **TwinCAT 3 Engineering (XAE)**: Basic functions free, unlimited projects
- **TwinCAT Runtime**: 7-day renewable trial; production use by Platform Level purchase
- **100+ Function modules (TFxxxx)**: Each licensed separately by Platform Level
- **Global free technical support**: All customers eligible
- **License form**: USB dongle or software license bound to hardware ID

## 1.5 AUDESYS Relevance

Beckhoff's "Engineering free + Runtime licensed" model and "Platform Level by CPU cores" pricing are direct references for AUDESYS Studio (IDE) and Runtime licensing strategy. The open-interface-closed-core model validates AUDESYS's HAL-centric architecture approach.