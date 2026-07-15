# Ch05: Market Positioning

## 5.1 Industry Segments

| Industry | Application | Market Share Estimate |
|----------|------------|---------------------|
| Machine building (OEM) | Packaging, textile, printing, woodworking | Core market ~30% |
| Mobile machinery | Agricultural, construction, material handling | Strong (IFM, etc.) |
| Building automation | HVAC, lighting, energy mgmt | Important market |
| Process industry | Chemical, pharma, food & beverage | Medium-low |
| Automotive manufacturing | Production lines, assembly | Low (TIA Portal dominant) |
| Infrastructure | Water treatment, power | Medium-low |
| Education | Training, teaching, labs | Strong (free IDE) |

## 5.2 Competitive Analysis

### 5.2.1 vs Siemens TIA Portal

| Dimension | CODESYS | TIA Portal |
|-----------|---------|-----------|
| Developer | CODESYS Group (independent) | Siemens (hardware vendor) |
| IDE price | Free | €700-15,000+ |
| Hardware support | 400+ brands | Siemens only |
| Market share | ~15% (400+ brands combined) | ~35-40% (Siemens only) |
| Programming languages | All 5 + CFC | All 5 |
| Simulation | Built-in SoftPLC | PLCSIM (separate license) |
| Motion control | SoftMotion (add-on) | SIMOTION (integrated) |
| Safety | SIL2/SIL3 certified | Safety Integrated |
| Version control | Git-friendly XML | Limited (TIA Openness API) |
| Learning curve | Moderate | Steep |
| Primary market | OEM/machine building | Factory automation/process control |
| Global job demand | ~2,500 (US) | ~10,000 (US) |

**Relationship**: Direct competitors in different segments. TIA Portal dominates large factory automation and process control. CODESYS dominates OEM machine building and mobile machinery.

### 5.2.2 vs Beckhoff TwinCAT

| Dimension | CODESYS | TwinCAT |
|-----------|---------|---------|
| Relationship | Upstream platform | Derived from CODESYS + self-developed extensions |
| IDE | CODESYS Development System | TwinCAT XAE (Visual Studio Shell) |
| Runtime | CODESYS Control | TwinCAT Runtime (self-developed RT kernel) |
| Hardware | 400+ brands | Beckhoff hardware only |
| Motion control | SoftMotion (add-on) | Built-in NC/CNC |
| Min cycle | 50μs (hardware-dependent) | <50μs (Beckhoff hardware optimized) |
| Fieldbus | Multiple | EtherCAT native |
| HMI | Built-in visualization | No native HMI (third-party required) |

**Relationship**: TwinCAT originated from CODESYS V2. TwinCAT 3 uses Visual Studio Shell but maintains IEC 61131 compatibility. Both compete and share technical lineage. TwinCAT leads in high-end motion control; CODESYS wins on hardware flexibility.

### 5.2.3 vs Rockwell Studio 5000

| Dimension | CODESYS | Studio 5000 |
|-----------|---------|------------|
| Developer | CODESYS Group | Rockwell Automation |
| Hardware | 400+ brands | Rockwell/Allen-Bradley only |
| IDE price | Free | ~$2,000+ |
| Primary market | Europe/Asia | North America |
| Programming languages | Full IEC 61131 | Ladder/ST/FBD/SFC |
| Integrated HMI | Yes | Requires FactoryTalk View |

### 5.2.4 vs Schneider EcoStruxure Machine Expert

**Relationship**: EcoStruxure Machine Expert is itself a branded version of CODESYS V3. "Upstream" and "branded version" relationship, not competition.

## 5.3 Competitive/Complementary Relationships

- **Upward (SCADA/HMI)**: CODESYS provides built-in visualization, typically complements SCADA systems (WinCC, Ignition, iFIX)
- **Downward (fieldbus)**: Supports mainstream fieldbuses, important member of EtherCAT Technology Group
- **Horizontal (cloud/IT)**: OPC UA, MQTT integration with IT systems; Automation Server provides cloud capability

## 5.4 AUDESYS Relevance — Market Positioning

| CODESYS Market Insight | AUDESYS Application |
|------------------------|---------------------|
| Free IDE + licensed runtime lowers barrier | AUDESYS Studio pricing strategy |
| Hardware neutrality wins OEM adoption | AUDESYS HAL hardware abstraction validates the strategy |
| OEM machine building is the sweet spot | AUDESYS target segment alignment |
| Education market (free IDE) builds future users | AUDESYS developer adoption strategy |
| Compete on hardware flexibility, not brand lock-in | AUDESYS vs single-vendor industrial IDEs |
