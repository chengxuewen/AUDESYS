# Ch04: Status & Ecosystem

## 4.1 Current Version & Activity

- **Latest stable**: CODESYS V3.5 SP21 (2025)
- **Version strategy**: Annual Service Pack release; component-level independent versioning since SP17
- **Update cycle**: Since SP17, core (CODESYS Essentials) is fixed; functional modules update independently
- **CODESYS go!**: April 2026 — next-gen Web-tech IDE (Beta), paid after 2028
- **R&D investment**: Growing; 2025 roadmap: OPC UA, safety, modularization, cloud platform

## 4.2 User Base

- **IDE registered users**: 300,000+ globally (CODESYS Store registrations)
- **Device manufacturers**: 500+ OEMs offering CODESYS-compatible devices
- **Device types**: 1,000+ different device models
- **Installed base**: Tens of millions of CODESYS-compatible devices in operation
- **Geographic distribution**: Europe (Germany core), China, Asia-Pacific, North America, Middle East

## 4.3 Ecosystem

### 4.3.1 Hardware Ecosystem

The most distinctive feature: **hardware manufacturer neutrality**:
- 400+ OEMs license CODESYS runtime
- 90+ automation companies deeply integrated
- Major brands: Beckhoff (TwinCAT), Wago, Schneider Electric, ABB, Bosch Rexroth, Eaton, Festo, IFM
- Standard platforms: Windows, Linux, Raspberry Pi, PLCnext

### 4.3.2 Software Ecosystem

- **CODESYS Store** — official app marketplace: libraries, plugins, templates, SoftPLC
- **OSCAT** — open-source community library (Open Source Community for Automation Technology)
- **CODESYS Forge** — developer community and sample code
- **Third-party libraries** — vendor-specific (drivers, communication, algorithms)

### 4.3.3 Training & Certification

- Official CODESYS training courses
- Developer workshops (Runtime Toolkit Workshop)
- Online docs and help system
- Community forum
- Technical blogs (e.g., Stefan Henneken's blog)

## 4.4 Recent Development Trends

### 4.4.1 Modularization (SP17+)

Major architectural refactoring:
- Core streamlined to "CODESYS Essentials"
- Language editors, fieldbus configurators, code generators extracted as independent plugins
- Each plugin has independent version number (4.x.x.x)
- Independent updates, no need to wait for annual Service Pack
- CODESYS Installer for multi-version management

### 4.4.2 CODESYS go! (Web-ification)

April 2026 Web-tech next-gen IDE:
- Backend runs on desktop, server, cloud, even PLC
- Frontend works in any browser (Windows/Linux/Mac)
- Text-based project storage (Git-friendly)
- Reuses CODESYS V3 compiler
- Compatible with CODESYS Control V3
- Limited initial features, gradual expansion

### 4.4.3 Industry 4.0 / IIoT

- OPC UA enhancement (PubSub, Alarms & Conditions, custom info models)
- MQTT support
- Cloud connectivity (CODESYS Automation Server)
- Google Cloud IoT Core integration
- Edge computing capability

### 4.4.4 Virtualization & Containerization

- Virtual PLC (vPLC) concept promotion
- Docker support (Wago PFC200)
- Cloud-native deployment
- Control software on general IT hardware

### 4.4.5 Security Enhancement

- Mandatory user management
- Encrypted communication
- Certificate management
- Signed libraries
- CodeMeter license protection

## 4.5 AUDESYS Relevance — Ecosystem Strategy

| CODESYS Ecosystem Pattern | AUDESYS Application |
|--------------------------|---------------------|
| CODESYS Store (app marketplace) | AUDESYS plugin/library marketplace |
| OSCAT (open-source community library) | AUDESYS open-source library ecosystem |
| OEM hardware neutrality | AUDESYS HAL hardware abstraction |
| CODESYS Installer (multi-version) | AUDESYS version management |
| Text-based Git-friendly projects (go!) | AUDESYS YAML + FlatBuffers config strategy (D24) |
