# Ignition SCADA Cheatsheet

## Architecture (3-Tier)

```
Client (Browser/App) ↔ Gateway (Java Server) ↔ Data (PLC/DB/Sensors)
```

## Gateway Core Subsystems

| Subsystem | Technology |
|-----------|------------|
| Web Server | Jetty/Tomcat (unconfirmed) |
| Tag Engine | Real-time data engine |
| Scripting | Jython (Python 2.7 on Java) |
| Alarm Engine | ISA 18.2 Alarm Pipeline |
| History | SQL Historian / Ignition Historian |
| Reporting | JasperReports |
| Security | Roles, Security Levels, Federated Identity |
| Redundancy | Active-Standby |

## HMI Modules Comparison

| Feature | Vision | Perspective |
|---------|--------|-------------|
| Render | Java Swing | HTML5/React |
| Designer | Desktop | Browser |
| Mobile | No | Responsive |
| Components | 100+ | 200+ |
| Performance | Medium | High |
| Offline | No | Yes |
| Status | Maintenance | Primary |

## Tag Providers

| Provider | Protocol | Use Case |
|----------|----------|----------|
| OPC UA | OPC UA TCP | Any OPC UA server |
| MQTT Engine | MQTT Sparkplug | Auto-discover devices |
| Modbus | Modbus TCP/RTU | Legacy devices |
| Memory | None | Internal tags |
| Expression | None | Calculated tags |
| SQL Bridge | JDBC | Bidirectional DB |
| Siemens S7 | S7 Protocol | Siemens PLC |
| Allen-Bradley | EtherNet/IP | Rockwell PLC |

## Key API: `system` Library

```
system.tag.read("[provider]/path")       // Read tag value
system.tag.write("[provider]/path", val) // Write tag value
system.db.runQuery("SELECT * FROM ...")  // SQL query
system.alarm.acknowledge("alarm_id")     // Acknowledge alarm
system.util.sendEmail(...)               // Send email
```

## Scalability Patterns

| Pattern | Description |
|---------|-------------|
| Basic | Single Gateway |
| Scale-Out | Load balancer + multiple Gateways |
| Hub and Spoke | Central + remote edge Gateways |
| Enterprise | Multi-tier (plant → region → enterprise) |
| Cloud | Gateway on AWS/Azure/GCP |

## Licensing

| Tier | Price (estimated) | Scope |
|------|-------------------|-------|
| Platform Base | $10k-$20k | Core server |
| Solution Suite | $5k-$15k ea | Module bundle |
| Edge | $1.5k-$3k | Single-project edge |
| Maker Edition | Free | Non-commercial |
| Support | 15-20%/yr | Upgrade protection |

## Key Numbers

- **200+** Perspective components
- **100+** Vision components
- **2-8 GB** typical Gateway memory
- **3000+** certified integrators
- **200+** free video courses
- **100+** countries deployed
- **50-80%** cost savings vs traditional SCADA

## Reference Links

- Website: https://inductiveautomation.com
- Docs: https://docs.inductiveautomation.com/docs/8.3
- Forum: https://forum.inductiveautomation.com
- University: https://inductiveuniversity.com
- Exchange: https://inductiveautomation.com/exchange

## AUDESYS Reference Mapping

| AUDESYS Component | Ignition Reference |
|-------------------|-------------------|
| Studio HMI Designer | Perspective (browser-based, responsive) |
| Runtime Tag System | Tag Engine + Tag Providers |
| HAL Driver Manager | Tag Provider adapter pattern |
| HAL amw Transport | Gateway protocol abstraction |
| Alarm Pipeline | ISA 18.2 Alarm Pipeline |
| Licensing Model | Unlimited per-server |
| Ecosystem | Inductive University + Integrator Program |
| Script/Extension | WASM plugins (not Jython) |