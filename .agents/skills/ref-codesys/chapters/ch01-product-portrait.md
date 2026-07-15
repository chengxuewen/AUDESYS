# Ch01: Product Portrait

## 1.1 Basic Information

- **Full Name**: CODESYS (Controller Development System)
- **Developer**: CODESYS Group (formerly 3S-Smart Software Solutions GmbH)
- **HQ**: Kempten, Germany
- **First Released**: 1994
- **Founders**: Dieter Hess and Manfred Werner
- **Company Type**: Private (not listed, not owned by any equipment manufacturer)
- **Headcount**: ~230 globally (with China, Italy, US offices)
- **Brand Rename**: 2020-06-19 from 3S-Smart → CODESYS GmbH
- **Current Version**: CODESYS V3.5 SP21 (2025)
- **Website**: https://www.codesys.com

## 1.2 Positioning & Value Proposition

**Core positioning**: Hardware-independent IEC 61131-3 industrial control development platform.

Key value propositions:
- **Manufacturer Independence** — one IDE programs 400+ OEM PLC controllers
- **SoftPLC Concept** — PLC control functions run as software on general-purpose platforms (Windows/Linux/RTOS)
- **Full-stack coverage** — IEC 61131-3 programming, compiler, runtime, visualization, motion control, safety, fieldbus in one system
- **Open ecosystem** — IDE free, runtime per-device licensed, OEMs can brand their own version

CODESYS is not a PLC hardware manufacturer — it's a software stack vendor to OEMs. The Android analogy: Android for mobile, CODESYS for industrial control.

## 1.3 Target User Segments

| User Type | Description | Typical Use Case |
|-----------|-------------|-----------------|
| OEM Equipment Mfr | Makes PLC/PAC/motion controllers | Integrate CODESYS runtime, provide branded IDE |
| Machine Builder | Makes dedicated automation equipment | Develop control programs with Wago/Beckhoff hardware |
| System Integrator | Engineering firms | Multi-brand PLC programming, project integration, commissioning |
| End User | Plant ops engineers | Maintain existing CODESYS equipment, small apps |
| Education/Research | Universities, vocational schools | Training, PLC programming fundamentals |

## 1.4 Tiered Licensing Model

| Component | License | Price Range |
|-----------|---------|-------------|
| CODESYS Development System (IDE) | **Free** | €0 |
| CODESYS Control Win SL (PC SoftPLC) | Per-device | ~€100-500 |
| CODESYS Control for Raspberry Pi SL | Per-device | ~€50-200 |
| CODESYS Control Runtime Toolkit (OEM SDK) | OEM annual + per-device royalty | TBD |
| CODESYS SoftMotion | Add-on | ~€500-2,000/device |
| CODESYS SoftMotion CNC+Robotics | Add-on | ~€1,000-3,000/device |
| CODESYS Safety SIL2/SIL3 | Add-on | ~€1,000-3,000/device |
| CODESYS OPC UA Server | Add-on | TBD |
| CODESYS Professional Developer Edition | Developer subscription | TBD |
| CODESYS Automation Server | Cloud subscription | Pay-per-use |

**Key characteristics**:
- IDE free → lowers learning barrier and prototyping cost
- Runtime license tied to device, not developer count
- OEM licenses calculated per shipment volume
- Single License (SL) purchasable directly from CODESYS Store

## 1.5 Commercial Relationship Model

- **Upstream**: CODESYS provides runtime SDK + IDE to OEMs
- **OEMs**: Adapt runtime to hardware, brand their own version
- **Downstream**: Machine builders, integrators, end users use the IDE
- **Store**: CODESYS Store = app marketplace for libraries, plugins, SoftPLCs

## 1.6 AUDESYS Relevance

CODESYS's "IDE free, runtime licensed" model is a direct reference for AUDESYS's Studio (IDE) pricing strategy. The hardware-independent positioning validates AUDESYS's HAL-centric architecture where the runtime is decoupled from specific hardware.
