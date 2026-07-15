# ref-intouch: Design Patterns

## 1. IDE/Runtime Separation (WindowMaker/WindowViewer)

**Problem**: HMI development and runtime execution have conflicting requirements. Development needs flexibility, debugging, and editing; runtime needs stability, performance, and deterministic behavior.

**Solution**: Architecturally separate the development environment (WindowMaker) from the runtime execution engine (WindowViewer). Shared application file format bridges the two.

**AUDESYS Application**: Studio IDE ↔ Runtime Engine separation with Hot Reload (Fast Switch equivalent).

## 2. Provider-Consumer Distributed Alarm

**Problem**: Alarms from multiple nodes (controllers, HMI stations, historians) must be presented as a unified logical view to operators, with cross-node confirmation and failover.

**Solution**: Decouple alarm generation (Provider) from alarm consumption (Consumer) via a network protocol. Each Provider generates millisecond-precision UTC timestamps. Consumers aggregate alarms from multiple Providers into a unified view.

**AUDESYS Application**: Runtime alarm pipeline with distributed alarm memory and failover sync.

## 3. Communication Abstraction Layer (Access Name)

**Problem**: Applications should not care whether a Tag value comes from PLC A via Modbus or PLC B via OPC UA. Protocol details should not pollute application logic.

**Solution**: Define a logical connection name (Access Name) that encapsulates protocol + node name + application name + topic. I/O Tags reference Access Name + Item Name only. Runtime resolves the connection transparently.

**AUDESYS Application**: amw_transport trait + Connection abstraction. Transport implementations (inproc/zenoh/UDS/OPC UA) are invisible to Signal consumers.

## 4. Template → Instance Object Model (ArchestrA)

**Problem**: Flat Tag engineering means every device requires manual recreation of all Tags, alarm configs, and graphics. No reuse, no hierarchy, no inheritance.

**Solution**: Class-based object model. Template (Class) defines attributes, scripts, graphics. Derived Template (Subclass) extends parent. Instance (Object) binds to physical I/O. Containment (Composition) creates hierarchy.

**AUDESYS Application**: HAL Device Model template hierarchy. MotorBase → ServoMotor → instance_Pump001.

## 5. Single Source of Truth (Galaxy Repository)

**Problem**: SCADA configuration scattered across files on each View Node. No central management, no version control, no concurrent engineering.

**Solution**: Centralized database (SQL Server) containing all configuration. Check-out/check-in for multi-user editing. Deploy workflow pushes changes to runtime nodes.

**AUDESYS Application**: Studio project as single source of truth (YAML/SQLite). Git-based version control instead of Galaxy's SQL Server dependency.

## 6. Event-Driven Script Triggers (7 Script Types)

**Problem**: Industrial HMI needs to respond to diverse events: startup/shutdown, window open/close, key presses, Tag value changes, condition satisfaction, operator actions, and external control events.

**Solution**: Define orthogonal script trigger types covering the entire lifecycle of an HMI session. Each type has a clear trigger condition and execution scope (application-level, window-level, Tag-level).

**AUDESYS Application**: Not directly for HAL (no scripting needed), but for Studio scripting strategy — define clear trigger types instead of a generic event system.

## 7. Progressive Complexity (Standalone → Managed)

**Problem**: A small water treatment plant needs fewer engineering controls than a multi-site petrochemical SCADA. One-size-fits-all complexity overhead punishes small projects.

**Solution**: Offer multiple application types: Standalone (simple, file-based) for small projects, Managed (Galaxy, multi-user) for large projects. Upgrade path from Standalone to Managed.

**AUDESYS Application**: "Progressive complexity" — simplified config for small projects, full object model for large ones. Avoid Galaxy's "all or nothing" approach.

## 8. Visual + Logic + Data Binding (Animation Links)

**Problem**: HMI graphics need to reflect real-time data from hundreds of Tags. Manual update code for each visual element is not scalable.

**Solution**: Declarative animation links bind Tag values to visual properties (color, position, size, visibility, rotation) without scripting. Engine evaluates bindings at runtime.

**AUDESYS Application**: Signal → UI control bidirectional binding in Studio HMI designer. Drop template → auto-generated binding.