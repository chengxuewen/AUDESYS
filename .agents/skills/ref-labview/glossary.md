# LabVIEW Glossary

## A
- **Actor Framework (AF)**: NI's official message-driven concurrency framework. Each Actor is an independent VI with its own message queue and state. Steep learning curve.
- **Application Builder**: Tool that compiles LabVIEW VIs into standalone executable (.exe) files. Included in Professional edition.

## B
- **Block Diagram**: LabVIEW's graphical source code editor. Contains function nodes, wires, structures, and terminals.
- **Broken Wire**: Compile-time error state where data type mismatch along a wire prevents execution.

## C
- **Case Structure**: Conditional execution structure (like switch/case). Each sub-diagram is a "case" selected by an input value.
- **Channel Wire**: LabVIEW 2016 feature. Two types: Stream Channel (buffered, queue-like) and Tag Channel (latest-value, signal-like).
- **CLAD/CLD/CLA**: Certified LabVIEW Associate Developer / Developer / Architect. Three-tier certification program.
- **CompactRIO (cRIO)**: NI's embedded controller with FPGA + RT processor. Industrial control and monitoring.
- **Connector Pane**: Defines VI input/output interface. Used when VI acts as a SubVI (like function signature).
- **Controls**: Front panel elements that provide input data (knobs, buttons, numeric boxes, etc.).

## D
- **DAQmx**: NI's unified data acquisition driver API. Provides consistent interface across all NI DAQ hardware.
- **Dataflow Programming**: Execution model where node execution is triggered by data availability on all inputs, not by sequential instruction order.
- **DFIR (DataFlow Intermediate Representation)**: LabVIEW's internal compiler representation between diagram parsing and code generation.
- **DQMH (Delacor QMH)**: NI-recommended QMH framework. Based on LVOOP and Actor patterns. Each module has independent message-handling loop + event broadcasting.

## E
- **Error Cluster**: LabVIEW's error handling mechanism. A cluster containing status (boolean), code (I32), and source (string). Propagated via wires between nodes.
- **Event Structure**: GUI event handling structure. Responds to user interactions (mouse clicks, key presses, value changes) with event-driven code.
- **Express VI**: Configurable VI with a configuration dialog. Generates optimized code based on user settings. Designed for rapid prototyping.

## F
- **Feedback Node**: Simplified Shift Register as a single node on a wire. Used for single-line feedback loops (IIR filters, iterative algorithms).
- **For Loop**: Structure that executes its sub-diagram N times, automatically iterating based on array element count or fixed count.
- **Front Panel**: LabVIEW's user interface editor. Contains Controls (inputs) and Indicators (outputs).

## G
- **G Language**: LabVIEW's graphical programming language. Syntax elements are icons, wires, and structures instead of keywords and punctuation.
- **G Web Development**: Web-based LabVIEW development. WebVIs run in browser via WebAssembly + JavaScript.

## H
- **Highlight Execution**: Debug mode showing data tokens flowing through wires as animation. Each node highlights as it executes. Slow but intuitive.
- **Host VI**: LabVIEW VI running on the development PC (typically Windows). Provides UI and host-side processing.

## I
- **Indicators**: Front panel elements that display output data (graphs, numeric displays, LEDs, etc.).
- **Invoke Node**: Programmatic method call on a reference (control, VI, application). Equivalent to calling a method in text languages.

## L
- **LVOOP (LabVIEW Object-Oriented Programming)**: Object-oriented extension to G language. Classes, single inheritance, dynamic dispatch, interfaces. Introduced in LabVIEW 8.6.

## M
- **MAX (Measurement & Automation Explorer)**: NI's hardware configuration and management tool. Device discovery, self-test, software management.
- **Merge Errors**: VI that combines multiple error clusters. Returns the first error found (or no-error if all clear).

## N
- **Nigel AI**: NI's AI assistant for LabVIEW. Code completion, code generation, and sequence generation. Based on OpenAI + Azure. Introduced 2025 Q1.
- **Notifier**: Asynchronous communication mechanism. Notifies all waiting receivers when a value changes. Similar to Signal subscription pattern.
- **NXG (Next Generation)**: LabVIEW's 2017-2021 rewrite attempt. Failed due to toolkit incompatibility, incomplete features, and community resistance.

## P
- **Probe Tool**: Debugging tool that attaches to a wire to display live data values during execution.
- **Producer-Consumer**: Pattern with two parallel loops communicating via queue. Producer handles data acquisition, consumer handles processing/display.
- **Property Node**: Programmatic access to a reference's properties (control appearance, VI state, etc.). Equivalent to getter/setter in text languages.

## Q
- **QMH (Queued Message Handler)**: Message-based architecture pattern. Each message loop receives commands via queue, executes corresponding action handler. Most versatile LabVIEW pattern.

## R
- **RT Target VI**: LabVIEW VI deployed to a real-time controller (PXI, CompactRIO). Handles deterministic control logic.
- **RT FIFO**: Real-time data transfer mechanism between loops. Non-blocking, deterministic.

## S
- **SCTL (Single-Cycle Timed Loop)**: FPGA loop structure. Entire loop body executes in one FPGA clock cycle (25ns/12.5ns).
- **Shift Register**: Loop boundary node that passes data between iterations. Left = previous iteration value. Right = current iteration value.
- **Shared Variable**: Network-published variable for data sharing across nodes. Similar to Signal + HalDiscovery.
- **State Machine**: Pattern with While Loop + Case Structure + Shift Register. Each case executes its state and returns next state.
- **Stream Channel**: Type of Channel Wire (2016+). Buffered data transfer, multiple writers, multiple readers. Like Kafka topic partition.
- **Structure**: Framework element controlling execution flow (While Loop, For Loop, Case Structure, Event Structure, etc.).
- **SubVI**: VI used as a subroutine within another VI. Like a function call in text languages.

## T
- **Tag Channel**: Type of Channel Wire (2016+). Latest-value, overwrite semantics. Like Signal.
- **Task (DAQmx)**: Complete acquisition/output configuration. Virtual channels + timing + trigger config encapsulated as atomic unit.
- **Terminal**: Front panel control/indicator representation on the block diagram. Controls (input) = bordered. Indicators (output) = borderless.
- **TestStand**: NI's test execution management software. Test sequence orchestration, multi-language step execution, result management.
- **Timed Loop**: Deterministic cycle loop for RT targets. Microsecond-level precision. Supports priority, core affinity, watchdog.

## V
- **VI (Virtual Instrument)**: LabVIEW's fundamental program unit. Three components: Front Panel, Block Diagram, Connector Pane.
- **VIM (Malleable VI)**: Compile-time polymorphic VI (like C++ templates or Rust generics). Type resolved at edit time, not runtime.
- **VIPM (VI Package Manager)**: Third-party package manager for LabVIEW toolkits and libraries (like npm/PyPI).
- **Virtual Channel**: Software representation of a physical channel with custom name, scaling, and engineering unit mapping.
- **VISA (Virtual Instrument Software Architecture)**: Unified instrument control API. Same interface for GPIB, Serial, USB, Ethernet.

## W
- **Watchdog Timer**: Hardware/software mechanism that monitors loop execution. Detects overrun, triggers fail-safe action.
- **While Loop**: Structure that executes its sub-diagram until a stop condition is met.
- **Wire**: Colored line connecting node terminals. Color = data type. Thickness = data dimension. Defines both data flow and execution order.