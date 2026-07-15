# Ch07: Reference Value for AUDESYS

## 7.1 Multi-Runtime Modular Architecture

Beckhoff TwinCAT's multi-runtime architecture has direct reference value for AUDESYS Runtime modularization:

| Design Feature | TwinCAT Implementation | AUDESYS Reference Point |
|---------------|------------------------|--------------------------|
| Runtime types | PLC / NC / CNC / Safety / Vision / Analytics runtimes | AUDESYS Runtime modular separation (PLC / NC / CNC / Safety) |
| Unified scheduling | All runtimes mount to same Task scheduler | AUDESYS mixed thread scheduling (D13) practical validation |
| Data channel | Shared process image / unified Task input-output update | AUDESYS HAL Signal primitive periodic refresh mechanism |
| Safety integration | TwinSAFE as independent runtime communicating via FSoE | AUDESYS Safety module isolation design approach |
| Module registration | TcCOM module "log on" mechanism to Task | AUDESYS runtime module registration/discovery mechanism |

**Key lesson**: TwinCAT demonstrates multi-runtime integration **without sacrificing determinism**. All runtimes share the same Task scheduler, with fixed execution order and process image synchronization to avoid race conditions.

## 7.2 Real-Time Scheduling Model Reference

TwinCAT's **double-tick + rate-monotonic scheduling** model provides engineering practice reference for AUDESYS RT thread design:

- **Conditional latency claims**: TwinCAT explicitly states that latency requires conditions (core isolation, hardware performance, message size) - exactly the issue AUDESYS audit identified and fixed (see pitfalls.md "unverifiable latency claims")
- **Core isolation**: TwinCAT's isolated core concept shows how to guarantee real-time quality without hypervisor RTOS
- **Automatic Task cycle/priority management**: AUDESYS can reference TwinCAT's RMS strategy for assigning fixed priorities to different runtimes
- **PLC Runtime input/output update difference**: TwinCAT 2 compatibility causes PLC Runtime behavior different from standard TcCOM modules - warns AUDESYS to watch for such architectural inconsistency in backward compatibility

## 7.3 Visual Studio IDE Shell Strategy

TwinCAT's decision to embed Visual Studio rather than build a custom IDE has direct implications for AUDESYS Studio:

| TwinCAT XAE Design | AUDESYS Studio Reference |
|--------------------|--------------------------|
| Not a self-built IDE, embedded mature Shell | Consider VS Code / Theia / other existing IDE Shell |
| Leverage existing editor, debugger, version control | Focus engineering on PLC editor (IEC 61131-3) and visual configurator |
| C++ modules use native VS project system | Support multi-language mixed projects |
| Project format compatible with VS project | Define clear project format (JSON / YAML / database) |
| TcCOM modules configured in System Manager visual UI | AUDESYS hardware configurator reference System Manager UX |
| Git integration for team collaboration | Native Git workflow support |

**Core lesson**: TwinCAT proves that **not building a custom IDE is a valid engineering decision** - focus resources on automation-specific editors and runtime debugging, let mature tools provide basic IDE functions.

## 7.4 10 Specific Reference Points

1. **Platform Level licensing**: AUDESYS can reference Beckhoff's Platform Level model for Runtime licensing (by CPU core count or feature set)

2. **Package Manager**: TwinCAT Build 4026's Package Manager is the reference model for AUDESYS Studio extension ecosystem

3. **TwinCAT PLC++**: 2024 next-gen runtime architecture shows how to innovate runtime engine while maintaining API compatibility

4. **TwinCAT/BSD**: Demonstrates migration path from Windows dependency to dedicated RTOS. AUDESYS could consider similar approach for future phases

5. **TFxxxx module classification**: Clear functional taxonomy (Base -> Measurement -> Motion -> Connectivity -> Vision -> Industry). AUDESYS can reference this for own function module system

6. **ADS protocol openness**: Full public specification enables any third party to implement ADS clients. AUDESYS HAL communication primitives should also consider open protocol specification

7. **TwinCAT 3 debugging capabilities**: From hardware (oscilloscope) to software (PLC code debug) complete debugging chain including breakpoints, watch window, call stack, value monitoring. AUDESYS Studio debugger should reference this model

8. **Project management**: Based on VS project system (.sln/.vcxproj), supports multi-project solutions. AUDESYS Studio should reference this for project management design

9. **EtherCAT master-slave architecture**: One master, multiple slaves - similar to AUDESYS distributed Runtime architecture. AUDESYS can reference EtherCAT master-slave communication for distributed runtime design

10. **Version control integration**: VS native Git integration for team project version management. AUDESYS Studio should provide similar version control support

## 7.5 EtherCAT Performance Dependency Conditions

EtherCAT's 50us cycle and <1us jitter are industry consensus, but real-world application depends on: slave count, EtherCAT backbone bandwidth, core isolation, and other factors. AUDESYS should reference this in real-time communication design - explicitly annotate dependency conditions (hardware platform, core count, message size, topology) in performance claims. This is exactly the "unverifiable latency claims" issue AUDESYS audit identified and fixed.

## 7.6 Licensing Model Reference

1. **Hardware performance-based tiering** (Platform Level): License price tied to CPU cores, not feature count. Users upgrade hardware without additional software cost, incentivizing investment in more powerful hardware
2. **Engineering free + Runtime paid**: Lower learning barrier, ensure commercial sustainability
3. **Function module independent licensing**: 100+ TFxxxx modules licensed independently, users pay per need
4. **Trial licensing**: 7-day renewable trial reduces evaluation cost

## 7.7 Overall Lessons for AUDESYS

1. **Modular architecture is core competitiveness**: TwinCAT's multi-runtime demonstrates how to integrate multiple control paradigms on one platform while maintaining determinism and scalability. AUDESYS Runtime modularization should use this as benchmark.

2. **Open interfaces drive ecosystem prosperity**: ADS and TcCOM open interfaces enable third-party integration and ecosystem growth. AUDESYS HAL primitives and amw abstraction layer should adopt open interface strategy.

3. **Not building a custom IDE is an effective engineering decision**: TwinCAT embeds Visual Studio instead of building its own IDE, focusing on automation-specific functionality. AUDESYS Studio should reference this strategy, using VS Code or Theia as mature IDE Shell.