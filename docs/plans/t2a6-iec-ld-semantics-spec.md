# T2a.6 — IEC 61131-3 LD Power Flow Semantics Specification

**Status:** Draft for review  
**Date:** 2026-07-21  
**Task:** T2a.6 from `docs/plans/p1-execution-refinement.md` Phase 2a  
**Output crate:** `crates/audesys-ld-semantics/`  
**Depends:** T2a.2 (LD GLSP Server)  
**IEC 61131-3 Reference:** Edition 3.0 (2013-02), Section 4 — Ladder Diagram (LD)

---

## 1. Overview

This document defines the **power flow semantics** for IEC 61131-3 Ladder Diagram (LD) as implemented
by the `audesys-ld-semantics` crate. It covers:

- Contact element power flow: NO, NC, rising/falling edge detection
- Coil behavior: OUT, SET, RESET, negated coil
- Function block EN/ENO in LD context
- Rung evaluation order
- Power rail conventions (left rail = TRUE, right rail = implicit)
- Parallel branch (OR) power flow

The semantics are defined as **truth tables** mapping contact states and configurations to output
power flow, suitable for direct test vector generation and implementation.

---

## 2. Power Flow Model

### 2.1 Fundamental Rule

Power flows from the **left power rail** (always TRUE) through a network of contacts to **coils**
on the right. A coil is energized (TRUE) if and only if there exists a continuous path of TRUE
contacts from the left rail to the coil.

### 2.2 Contact Types

| Symbol | Name | IEC Symbol | Truth Table |
|--------|------|-----------|-------------|
| `--| |--` | Normally Open (NO) | Variable=TRUE → Power flows through |
| `--|/|--` | Normally Closed (NC) | Variable=FALSE → Power flows through |
| `--|P|--` | Positive Edge (R_TRIG) | Variable FALSE→TRUE transition → one-cycle TRUE pulse |
| `--|N|--` | Negative Edge (F_TRIG) | Variable TRUE→FALSE transition → one-cycle TRUE pulse |

### 2.3 Contact Power Flow Truth Tables

#### NO Contact (`--| |--`)

| Variable State | Power In | Power Out | Description |
|:---:|:---:|:---:|---|
| FALSE | FALSE | FALSE | Contact open, no flow |
| FALSE | TRUE  | FALSE | Contact blocks flow |
| TRUE  | FALSE | FALSE | No input power to flow |
| TRUE  | TRUE  | TRUE  | Contact closes, power flows through |

#### NC Contact (`--|/|--`)

| Variable State | Power In | Power Out | Description |
|:---:|:---:|:---:|---|
| FALSE | FALSE | FALSE | No input power |
| FALSE | TRUE  | TRUE  | Contact closed (normal), power flows |
| TRUE  | FALSE | FALSE | No input power |
| TRUE  | TRUE  | FALSE | Contact opens, blocks flow |

#### Positive Edge Contact (`--|P|--`)

| Variable (prev→curr) | Power In | Power Out | Description |
|:---:|:---:|:---:|---|
| FALSE→FALSE          | FALSE | FALSE | No edge, no flow |
| FALSE→FALSE          | TRUE  | FALSE | No edge → FALSE output |
| FALSE→TRUE           | FALSE | FALSE | No input power |
| FALSE→TRUE           | TRUE  | TRUE  | Rising edge detected → TRUE for one cycle |
| TRUE→TRUE            | TRUE  | FALSE | No edge after rising |
| TRUE→FALSE           | TRUE  | FALSE | Falling edge, not this contact |

#### Negative Edge Contact (`--|N|--`)

| Variable (prev→curr) | Power In | Power Out | Description |
|:---:|:---:|:---:|---|
| TRUE→FALSE           | TRUE  | TRUE  | Falling edge detected → TRUE for one cycle |
| TRUE→TRUE            | TRUE  | FALSE | No edge |
| FALSE→FALSE          | TRUE  | FALSE | No edge |
| FALSE→TRUE           | TRUE  | FALSE | Rising edge, not this contact |

---

## 3. Serial Contact Configurations (AND)

Power flows through a serial chain only if **all** contacts allow flow.

### 3.1 Two NO Contacts in Series

```
  X1      X2     Y1
--| |----| |----( )
```

| X1 | X2 | Power at Y1 |
|:--:|:--:|:-----------:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | FALSE |
| TRUE  | TRUE  | **TRUE** |

**IL Mapping:** `LD X1` → `AND X2` → `ST Y1`

### 3.2 NO + NC in Series

```
  X1      X2     Y1
--| |----|/|----( )
```

| X1 | X2 | Power at Y1 |
|:--:|:--:|:-----------:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | **TRUE** |
| TRUE  | TRUE  | FALSE |

**IL Mapping:** `LD X1` → `ANDN X2` → `ST Y1`

### 3.3 Three Contacts in Series

```
  X1      X2      X3     Y1
--| |----|/|----| |----( )
```

| X1 | X2 | X3 | Power at Y1 |
|:--:|:--:|:--:|:-----------:|
| TRUE | FALSE | TRUE | **TRUE** |
| TRUE | FALSE | FALSE | FALSE |
| FALSE | * | * | FALSE |
| TRUE | TRUE | * | FALSE |

**Rule:** Power = X1 AND (NOT X2) AND X3

### 3.4 Series NC Chain (safety interlock pattern)

```
  E_STOP  GATE    LIMIT   MOTOR
--|/|----|/|----|/|----( )
```

| E_STOP | GATE | LIMIT | Motor |
|:------:|:----:|:-----:|:-----:|
| FALSE | FALSE | FALSE | **TRUE** |
| FALSE | FALSE | TRUE  | FALSE |
| FALSE | TRUE  | FALSE | FALSE |
| TRUE  | ANY  | ANY   | FALSE |

**Rule:** Motor = NOT E_STOP AND NOT GATE AND NOT LIMIT  
*All three NC contacts must be closed (variables FALSE) to energize motor.*

---

## 4. Parallel Contact Configurations (OR)

Power flows through a parallel branch if **any** path allows flow.

### 4.1 Two NO Contacts in Parallel (Basic OR)

```
       +-- X1 --+
  -----+         +-----( ) Y1
       +-- X2 --+
```

| X1 | X2 | Power at Y1 |
|:--:|:--:|:-----------:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | **TRUE** |
| TRUE  | FALSE | **TRUE** |
| TRUE  | TRUE  | **TRUE** |

**IL Mapping:** `LD X1` → `OR X2` → `ST Y1`

### 4.2 NO + NC in Parallel

```
       +-- X1 --+
  -----+         +-----( ) Y1
       +-- X2 --+  (NC)
```

| X1 | X2 | Power at Y1 |
|:--:|:--:|:-----------:|
| FALSE | FALSE | **TRUE** (NC closed) |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | **TRUE** |
| TRUE  | TRUE  | **TRUE** |

**IL Mapping:** `LD X1` → `ORN X2` → `ST Y1`

### 4.3 Three Parallel Branches

```
       +-- X1 --+
       +-- X2 --+
  -----+         +-----( ) Y1
       +-- X3 --+
```

| X1 | X2 | X3 | Power at Y1 |
|:--:|:--:|:--:|:-----------:|
| FALSE | FALSE | FALSE | FALSE |
| FALSE | FALSE | TRUE  | **TRUE** |
| FALSE | TRUE  | FALSE | **TRUE** |
| FALSE | TRUE  | TRUE  | **TRUE** |
| TRUE  | * | * | **TRUE** |

**IL Mapping:** `LD X1` → `OR X2` → `OR X3` → `ST Y1`

---

## 5. Mixed Serial-Parallel Configurations

### 5.1 Serial-Parallel (Series grouped with parallel)

```
       +-- X1 -- X2 --+
  -----+               +-----( ) Y1
       +-- X3 -- X4 --+
```

| X1 | X2 | X3 | X4 | Power at Y1 |
|:--:|:--:|:--:|:--:|:-----------:|
| TRUE | TRUE | * | * | **TRUE** |
| * | * | TRUE | TRUE | **TRUE** |
| TRUE | FALSE | FALSE | * | FALSE |
| FALSE | * | FALSE | * | FALSE |

**Rule:** Y1 = (X1 AND X2) OR (X3 AND X4)

### 5.2 Parallel inside Series (contact-branch-contact)

```
  X1    +-- X2 --+    X4    Y1
--| |---+         +---| |---( )
        +-- X3 --+
```

| X1 | X2 | X3 | X4 | Power at Y1 |
|:--:|:--:|:--:|:--:|:-----------:|
| TRUE | FALSE | FALSE | TRUE | FALSE |
| TRUE | TRUE  | FALSE | TRUE | **TRUE** |
| TRUE | FALSE | TRUE  | TRUE | **TRUE** |
| TRUE | TRUE  | TRUE  | TRUE | **TRUE** |
| FALSE | * | * | * | FALSE |

**Rule:** Y1 = X1 AND (X2 OR X3) AND X4

### 5.3 Complex Multi-Level (the "H" pattern)

```
  X1    +-- X2 -- X3 --+    X5    Y1
--| |---+               +---| |---( )
        +-- X4 --------+
```

| X1 | X2 | X3 | X4 | X5 | Power at Y1 |
|:--:|:--:|:--:|:--:|:--:|:-----------:|
| TRUE | TRUE | TRUE | * | TRUE | **TRUE** |
| TRUE | * | * | TRUE | TRUE | **TRUE** |
| TRUE | TRUE | FALSE | FALSE | TRUE | FALSE |
| TRUE | FALSE | * | FALSE | TRUE | FALSE |
| FALSE | * | * | * | * | FALSE |

**Rule:** Y1 = X1 AND ( (X2 AND X3) OR X4 ) AND X5

### 5.4 Start-Stop Latch Pattern (Seal-in circuit)

```
  START    STOP    MOTOR
--+--| |--+-|/|----( )
  |        |
  +--| |---+   (MOTOR aux contact)
  MOTOR
```

**Truth table (power flow at MOTOR coil):**

| Cycle | START | STOP | MOTOR (prev) | MOTOR (next) | Description |
|:---:|:---:|:---:|:---:|:---:|---|
| 0 | FALSE | FALSE | FALSE | FALSE | Initial state |
| 1 | TRUE  | FALSE | FALSE | **TRUE** | Start pressed → latch on |
| 2 | FALSE | FALSE | TRUE  | **TRUE** | Start released, seal-in holds |
| 3 | FALSE | TRUE  | TRUE  | FALSE | Stop pressed → latch off |
| 4 | TRUE  | TRUE  | FALSE | FALSE | Stop overrides start |

**IL Mapping:**
```
LD START
OR MOTOR     // seal-in: MOTOR contact in parallel with START
ANDN STOP    // STOP NC contact in series
ST MOTOR
```

---

## 6. Coil Behavior

### 6.1 Coil Types

| Coil | IEC Symbol | Behavior |
|------|-----------|----------|
| OUT | `-( )-` | Variable = power flow state (updated each scan) |
| SET | `-(S)-` | If power flow=TRUE, variable latched to TRUE (retained until RESET) |
| RESET | `-(R)-` | If power flow=TRUE, variable latched to FALSE |
| NEGATED OUT | `-(/)-` | Variable = NOT(power flow) |

### 6.2 Coil Power Flow Truth Table

| Coil Type | Power In | Variable Previous | Variable Next | IL |
|-----------|:--------:|:-----------------:|:-------------:|---|
| OUT `-( )-` | FALSE | * | FALSE | `ST var` (FALSE) |
| OUT `-( )-` | TRUE  | * | TRUE  | `ST var` (TRUE) |
| SET `-(S)-` | FALSE | * | * (retained) | `S var` (exec only if TRUE) |
| SET `-(S)-` | TRUE  | * | TRUE  | `S var` |
| RESET `-(R)-` | FALSE | * | * (retained) | `R var` (exec only if TRUE) |
| RESET `-(R)-` | TRUE  | * | FALSE | `R var` |
| NEGATED `-(/)-` | FALSE | * | TRUE  | `STN var` |
| NEGATED `-(/)-` | TRUE  | * | FALSE | `STN var` |

### 6.3 Multiple Coils on Same Rung

```
  X1                    Y1    Y2
--| |------------------( )---( )
```

| X1 | Y1 | Y2 |
|:--:|:--:|:--:|
| FALSE | FALSE | FALSE |
| TRUE  | TRUE  | TRUE  |

Both coils receive the same power flow — Y1 and Y2 are identical.

---

## 7. EN/ENO Behavior

### 7.1 Function Block EN/ENO Pins

Per IEC 61131-3 §4.2.4, function blocks and functions in LD have:

- **EN (Enable In):** Boolean input on the left side of the block. Controls whether the block executes.
- **ENO (Enable Out):** Boolean output on the right side. Indicates successful execution.

### 7.2 EN/ENO Truth Table

| EN (Power In) | Block Executes? | ENO | Description |
|:---:|:---:|:---:|---|
| FALSE | No | FALSE | Block skipped, outputs retain previous values |
| TRUE  | Yes, no error | TRUE  | Normal execution, outputs updated |
| TRUE  | Yes, error occurs | FALSE | Block executed but error (e.g., division by zero, out of range) |

### 7.3 EN/ENO Chain (Cascaded Blocks)

```
  X1                          X2                    Y1
--| |----[TON  - EN/ENO]----| |----[CTU  - EN/ENO]--( )
         [  T#1s  Q    ]          [   5   CV   ]
```

| X1 | TON Error? | EN/ENO₁ | X2 | CTU Error? | EN/ENO₂ | Y1 |
|:--:|:---:|:---:|:--:|:---:|:---:|:--:|
| FALSE | N/A | FALSE | * | N/A | FALSE | FALSE |
| TRUE  | No | TRUE | FALSE | N/A | FALSE | FALSE |
| TRUE  | No | TRUE | TRUE | No | TRUE | **TRUE** |
| TRUE  | Yes | FALSE | * | N/A | FALSE | FALSE |
| TRUE  | No | TRUE | TRUE | Yes | FALSE | FALSE |

**Rule:** If any block's ENO goes FALSE, power flow stops at that block. Downstream
blocks do not execute (EN=FALSE).

### 7.4 Standard Library Block EN/ENO Behavior

| Block Type | ENO=LOW Conditions |
|------------|-------------------|
| TON/TOF | PT ≤ T#0s (invalid time) |
| CTU/CTD | CV overflow, PV ≤ 0 |
| ADD/SUB/MUL/DIV | Division by zero (DIV), integer overflow |
| MOVE | Always ENO=EN (never fails) |
| EQ/GT/LT/GE/LE/NE | Always ENO=EN (never fails) |
| SEL/MUX | Always ENO=EN (never fails) |
| Custom FB | Determined by implementation; ENO set programmatically |

---

## 8. Rung Evaluation Order

### 8.1 Scan Cycle Semantics

```
SCAN CYCLE:
  1. Read inputs  — snapshot all physical/digital inputs
  2. Evaluate rungs — top-to-bottom, each rung left-to-right
  3. Write outputs — apply coil states to physical/digital outputs

ALL contacts in a rung use the SAME input snapshot values.
A coil written in rung N is NOT visible as a contact in rung N (but IS visible in rung N+1).
```

### 8.2 Rung Evaluation Pseudo-Code

```rust
/// Evaluate all rungs (networks) in a POU for one scan cycle.
///
/// IEC 61131-3 §4.1.2: rungs are evaluated in order 1..N, top-to-bottom.
/// Within each rung, power flow propagates left-to-right.
///
/// # Arguments
/// * `rungs` - ordered list of rung ASTs (top to bottom)
/// * `vars` - mutable variable store (reads use snapshot, writes accumulate)
///
/// # Returns
/// * `RungResults` - per-rung output assignments (applied atomically at cycle end)
pub fn evaluate_cycle(rungs: &[Rung], vars: &VarStore) -> RungResults {
    let input_snapshot = vars.snapshot_inputs();  // IEC §4.1.2: read once per cycle
    let mut results = RungResults::new();
    let mut edge_state = EdgeState::new();        // track prev-cycle values for edge detection

    for (rung_idx, rung) in rungs.iter().enumerate() {
        // Step 1: Evaluate power flow from left rail through contact network
        let power_flow = evaluate_power_flow(
            &rung.contact_network,
            &input_snapshot,   // use snapshot, not live values
            &mut edge_state,
            rung_idx,
        );

        // Step 2: Apply power flow to all coils/FBs in this rung
        for element in &rung.output_elements {
            match element {
                OutputElement::Coil { var, kind } => {
                    let result = match kind {
                        CoilKind::Out => power_flow,
                        CoilKind::Set if power_flow => true,   // latch on
                        CoilKind::Set => vars.get_bool(var),    // retain
                        CoilKind::Reset if power_flow => false, // latch off
                        CoilKind::Reset => vars.get_bool(var),  // retain
                        CoilKind::Negated => !power_flow,
                    };
                    results.set_coil(var, result);
                }
                OutputElement::FunctionBlock { block, en_power } => {
                    let en = en_power.unwrap_or(power_flow);
                    let (outputs, eno) = if en {
                        block.execute(&input_snapshot)
                    } else {
                        (block.retain_outputs(), false)
                    };
                    results.merge_fb_outputs(&outputs);
                    results.set_eno(block.id(), eno);
                }
            }
        }
    }

    // Step 3: Update vars with all accumulated results (IEC §4.1.2)
    vars.apply_results(&results);
    edge_state.advance_cycle(&input_snapshot);

    results
}
```

### 8.3 Left-to-Right Power Flow Evaluation

```rust
/// Evaluate power flow through a contact network.
///
/// Power originates at the left power rail (value = TRUE).
/// Propagates through the network graph left-to-right using a
/// depth-first traversal that short-circuits on FALSE.
fn evaluate_power_flow(
    network: &ContactNetwork,
    snapshot: &InputSnapshot,
    edge_state: &mut EdgeState,
    rung_idx: usize,
) -> bool {
    // A contact network is a directed graph:
    // - Nodes: connection points
    // - Edges: contacts with associated variables
    //
    // Power flow is computed via topological traversal from the
    // left rail node to the output node.

    let left_rail = network.left_rail_node();
    let output_node = network.output_node();

    // DFS/BFS with memoization — each node has one power value per scan
    let mut node_power: HashMap<NodeId, bool> = HashMap::new();
    node_power.insert(left_rail, true); // left rail always TRUE

    // Topological order ensures left-to-right propagation
    for node in network.topological_order() {
        if let Some(power) = node_power.get(&node).copied() {
            for edge in network.outgoing_edges(node) {
                let contact_power = match &edge.contact {
                    Contact::No(var) => power && snapshot.get_bool(var),
                    Contact::Nc(var) => power && !snapshot.get_bool(var),
                    Contact::PosEdge(var) => {
                        power && edge_state.is_rising(var, snapshot)
                    }
                    Contact::NegEdge(var) => {
                        power && edge_state.is_falling(var, snapshot)
                    }
                };
                // OR-semantics: if multiple incoming edges to a node,
                // the node is TRUE if ANY incoming path is TRUE
                let existing = node_power.get(&edge.target).copied().unwrap_or(false);
                node_power.insert(edge.target, existing || contact_power);
            }
        }
    }

    node_power.get(&output_node).copied().unwrap_or(false)
}
```

### 8.4 Rung-to-Rung Data Flow (Within Same Scan)

```
Rung 1:  X1      Y1
        --| |----( )

Rung 2:  Y1      Y2    ← Y1 from Rung 1 is visible HERE
        --| |----( )

Rung 3:  X2      Y1    ← Y1 can be overwritten!
        --|/|----( )     Last write wins.
```

**Rule:** A rung N+1 sees the output of rung N within the same scan cycle.
If rung N+1 writes the same variable, the last rung's value is the final output.

---

## 9. Test Vectors

Each test vector includes: ASCII rung art, input states, expected output, and IL mapping.

### TV-1: Single NO Contact → OUT
```
Rung:  X1      Y1
      --| |----( )
```
| X1 | Y1 |
|:--:|:--:|
| FALSE | FALSE |
| TRUE  | TRUE  |
> IL: `LD X1` → `ST Y1`

### TV-2: Single NC Contact → OUT
```
Rung:  X1      Y1
      --|/|----( )
```
| X1 | Y1 |
|:--:|:--:|
| FALSE | TRUE  |
| TRUE  | FALSE |
> IL: `LDN X1` → `ST Y1`

### TV-3: Two NO in Series (AND)
```
Rung:  X1    X2    Y1
      --| |--| |--( )
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | FALSE |
| TRUE  | TRUE  | TRUE  |
> IL: `LD X1` → `AND X2` → `ST Y1`

### TV-4: NO + NC in Series
```
Rung:  X1    X2    Y1
      --| |--|/|--( )
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | TRUE  |
| TRUE  | TRUE  | FALSE |
> IL: `LD X1` → `ANDN X2` → `ST Y1`

### TV-5: NC + NO in Series
```
Rung:  X1    X2    Y1
      --|/|--| |--( )
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | TRUE  |
| TRUE  | FALSE | FALSE |
| TRUE  | TRUE  | FALSE |
> IL: `LDN X1` → `AND X2` → `ST Y1`

### TV-6: NC + NC in Series
```
Rung:  X1    X2    Y1
      --|/|--|/|--( )
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | TRUE  |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | FALSE |
| TRUE  | TRUE  | FALSE |
> IL: `LDN X1` → `ANDN X2` → `ST Y1`

### TV-7: NO in Parallel (OR)
```
Rung:    +-- X1 --+
        -+         +-( ) Y1
         +-- X2 --+
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | FALSE |
| FALSE | TRUE  | TRUE  |
| TRUE  | FALSE | TRUE  |
| TRUE  | TRUE  | TRUE  |
> IL: `LD X1` → `OR X2` → `ST Y1`

### TV-8: NO Parallel with NC
```
Rung:    +-- X1 --+
        -+         +-( ) Y1
         +--|/| X2+
```
| X1 | X2 | Y1 |
|:--:|:--:|:--:|
| FALSE | FALSE | TRUE  |
| FALSE | TRUE  | FALSE |
| TRUE  | FALSE | TRUE  |
| TRUE  | TRUE  | TRUE  |
> IL: `LD X1` → `ORN X2` → `ST Y1`

### TV-9: Start-Stop Seal-in (SET/RESET equivalent)
```
Rung:  START  STOP   MOTOR
      --+--| |--+-|/|--( )
        |       |
        +-| |---+ (MOTOR aux)
         MOTOR
```
| Cycle | START | STOP | MOTOR (prev) | MOTOR (next) |
|:-----:|:-----:|:----:|:------------:|:------------:|
| 0 | FALSE | FALSE | FALSE | FALSE |
| 1 | TRUE  | FALSE | FALSE | TRUE  |
| 2 | FALSE | FALSE | TRUE  | TRUE  |
| 3 | FALSE | TRUE  | TRUE  | FALSE |
| 4 | TRUE  | TRUE  | FALSE | FALSE |
> IL: `LD START` → `OR MOTOR` → `ANDN STOP` → `ST MOTOR`

### TV-10: Serial-Parallel (branch inside series)
```
Rung:  X1  +-- X2 --+  X4    Y1
      --| |-+         +-| |--( )
            +-- X3 --+
```
| X1 | X2 | X3 | X4 | Y1 |
|:--:|:--:|:--:|:--:|:--:|
| FALSE | * | * | * | FALSE |
| TRUE | FALSE | FALSE | TRUE | FALSE |
| TRUE | TRUE  | FALSE | TRUE | TRUE  |
| TRUE | FALSE | TRUE  | TRUE | TRUE  |
| TRUE | TRUE  | TRUE  | TRUE | TRUE  |
| TRUE | TRUE  | TRUE  | FALSE | FALSE |

### TV-11: Three NC in Series (Safety Interlock)
```
Rung:  E_OK   DOOR   TEMP   MOTOR
      --|/|---|/|---|/|---( )
```
| E_OK | DOOR | TEMP | MOTOR |
|:----:|:----:|:----:|:-----:|
| FALSE | FALSE | FALSE | TRUE  |
| FALSE | FALSE | TRUE  | FALSE |
| FALSE | TRUE  | FALSE | FALSE |
| TRUE  | FALSE | FALSE | FALSE |
| FALSE | TRUE  | TRUE  | FALSE |
| TRUE  | TRUE  | FALSE | FALSE |
| TRUE  | FALSE | TRUE  | FALSE |
| TRUE  | TRUE  | TRUE  | FALSE |
> IL: `LDN E_OK` → `ANDN DOOR` → `ANDN TEMP` → `ST MOTOR`

### TV-12: SET Coil Latching
```
Rung:  X1      Y1        X2      Y1
      --| |----(S)      --| |----(R)
```
| Cycle | X1 | X2 | Y1 |
|:-----:|:--:|:--:|:--:|
| 0 | FALSE | FALSE | FALSE |
| 1 | TRUE  | FALSE | TRUE  |
| 2 | FALSE | FALSE | TRUE  (latched) |
| 3 | FALSE | TRUE  | FALSE |
| 4 | FALSE | FALSE | FALSE |
> IL: `LD X1` → `S Y1` ... `LD X2` → `R Y1`

### TV-13: Multiple Coils on One Rung
```
Rung:  X1      Y1    Y2    Y3
      --| |----( )--( )--( )
```
| X1 | Y1 | Y2 | Y3 |
|:--:|:--:|:--:|:--:|
| FALSE | FALSE | FALSE | FALSE |
| TRUE  | TRUE  | TRUE  | TRUE  |
> IL: `LD X1` → `ST Y1` → `ST Y2` → `ST Y3`

### TV-14: EN/ENO Chain with TON → CTU
```
Rung:  X1    [TON]    X2    [CTU]    Y1
      --| |--|EN ENO|--| |--|EN ENO|-( )
             |T#1s Q|         | 5  CV|
```
| X1 | TON Error | ENO₁ | X2 | CTU Error | ENO₂ | Y1 |
|:--:|:---:|:---:|:--:|:---:|:---:|:--:|
| FALSE | N/A | FALSE | * | N/A | FALSE | FALSE |
| TRUE  | No  | TRUE  | FALSE | N/A | FALSE | FALSE |
| TRUE  | No  | TRUE  | TRUE  | No  | TRUE  | TRUE  |
| TRUE  | Yes | FALSE | TRUE  | N/A | FALSE | FALSE |
| TRUE  | No  | TRUE  | TRUE  | Yes | FALSE | FALSE |

### TV-15: Rung-to-Rung Propagation (same scan)
```
Rung 1:  X1      Y1
        --| |----( )

Rung 2:  Y1      Y2
        --|/|----( )
```
| X1 | R1 Y1 | R2 Y2 |
|:--:|:------:|:-----:|
| FALSE | FALSE | TRUE  |
| TRUE  | TRUE  | FALSE |

*Y1 from Rung 1 is visible as NC contact in Rung 2. Rung 2 evaluates after Rung 1.*

### TV-16: Rising Edge Detection
```
Rung:  X1      Y1
      --|P|----( )
```
| Cycle | X1 (prev→curr) | Y1 |
|:-----:|:---:|:--:|
| 0 | FALSE→FALSE | FALSE |
| 1 | FALSE→TRUE  | TRUE  |
| 2 | TRUE→TRUE   | FALSE |
| 3 | TRUE→FALSE  | FALSE |
| 4 | FALSE→TRUE  | TRUE  |

### TV-17: Negated Coil
```
Rung:  X1      Y1
      --| |----(/)
```
| X1 | Y1 |
|:--:|:--:|
| FALSE | TRUE  |
| TRUE  | FALSE |

### TV-18: Parallel Branches with Different Depths
```
Rung:    +-- X1 -- X2 --+
        -+               +-( ) Y1
         +-- X3 ---------+
```
| X1 | X2 | X3 | Y1 |
|:--:|:--:|:--:|:--:|
| FALSE | * | FALSE | FALSE |
| TRUE | TRUE | * | TRUE  |
| FALSE | * | TRUE  | TRUE  |
| TRUE | FALSE | FALSE | FALSE |

**Rule:** Y1 = (X1 AND X2) OR X3

---

## 10. IEC 61131-3 Section References

| Topic | IEC 61131-3:2013 Section | Description |
|-------|--------------------------|-------------|
| LD Language Overview | §4.1 | Ladder Diagram introduction, power rail concept |
| Rung Evaluation | §4.1.2 | Left-to-right power flow, top-to-bottom execution |
| Contacts | §4.2.1 | NO, NC, edge detection contacts |
| Coils | §4.2.2 | Output, SET, RESET, negated coils |
| Power Flow Rules | §4.2.3 | Serial (AND), parallel (OR), mixed combinational logic |
| Function Block in LD | §4.2.4 | EN/ENO pins, block invocation in rung context |
| Evaluation Order | §4.3.1 | Within-rung and rung-to-rung evaluation rules |
| Scan Cycle | §2.4.2 (Common Elements) | Read inputs → execute → write outputs |
| Data Types | §2.3 | BOOL, integer, time types referenced in LD |
| Edge Detection | §2.5.2.3.1 (R_TRIG), §2.5.2.3.2 (F_TRIG) | Standard edge detection function blocks |

### Additional References

| Source | Topic |
|--------|-------|
| PLCopen TC6 | XML exchange format for LD (IEC 61131-10) |
| CODESYS LD Editor | Reference implementation; all languages compile to ST internal representation |
| IEC 61131-3:2013 §Table 30 | Standard LD graphical symbols |
| IEC 61131-3:2013 §Table 31 | Standard LD semantics summary |

---

## 11. Implementation Notes

### 11.1 Current LD Compiler (audesys-ld-compiler)

The current LD compiler supports **serial-only rungs** (no parallel branches) with these elements:

```
NETWORK
  NO X1       // normally open contact
  NC X2       // normally closed contact
  OUT Y1      // output coil
  SET Y2      // set coil
  RESET Y2    // reset coil
```

Mapping to IL:
- First NO → `LD var`, first NC → `LDN var`
- Subsequent NO → `AND var`, subsequent NC → `ANDN var`
- OUT → `ST var`, SET → `S var`, RESET → `R var`

### 11.2 T2a.6 Scope: audesys-ld-semantics Crate

The new `audesys-ld-semantics` crate extends the current flat-serial model to support:

1. **Parallel branches:** `OR`/`ORN` IL instructions via branch detection in the contact network graph
2. **EN/ENO propagation:** power flow tracking through function block chains
3. **Edge contacts:** `--|P|--` / `--|N|--` with per-variable edge state tracking
4. **Negated coils:** `-(/)-` with boolean inversion
5. **Power flow validation:** detect dead-end branches, verify all paths reach a coil

### 11.3 ContactNetwork Data Model

```rust
/// Directed acyclic graph representing a rung's contact network.
pub struct ContactNetwork {
    nodes: Vec<ContactNode>,
    edges: Vec<ContactEdge>,
    left_rail: NodeId,
    output_node: NodeId,
}

pub struct ContactNode {
    id: NodeId,
}

pub struct ContactEdge {
    source: NodeId,
    target: NodeId,
    contact: Contact,
}

pub enum Contact {
    No(String),         // --| |--
    Nc(String),         // --|/|--
    PosEdge(String),    // --|P|--
    NegEdge(String),    // --|N|--
}

pub enum OutputElement {
    Coil { var: String, kind: CoilKind },
    FunctionBlock { /* ... */ },
}
```

---

## 12. Validation Checklist

- [ ] All 18 test vectors produce correct IL output
- [ ] Serial AND logic: `LD/AND/ANDN` sequence is correct
- [ ] Parallel OR logic: `LD/OR/ORN` for each parallel branch
- [ ] Mixed serial-parallel: OR blocks correctly parenthesized in IL
- [ ] EN/ENO chain: downstream blocks skip when ENO=FALSE
- [ ] Edge contacts: one-cycle TRUE pulse on detected edge
- [ ] SET/RESET coils: latching behavior (retained when power flow FALSE)
- [ ] Negated coil: output = NOT power flow
- [ ] Rung-to-rung propagation: rung N output visible in rung N+1
- [ ] Scan cycle snapshot: all contacts use same-cycle input values
- [ ] Dead-end branches: detected and reported as warning
- [ ] HalProgram output: is_well_formed() returns true
- [ ] Integration: LD → IL → HalProgram pipeline unchanged for existing serial tests

---

<!--
ponytail: this spec covers the IEC 61131-3 minimum for LD power flow semantics.
Not covered: CFC-style free-form FB placement, IEC 61499 event-driven LD,
structured jumps (JMP/LBL), RETURN in LD context. Add when needed.
-->
