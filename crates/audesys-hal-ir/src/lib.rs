//! AUDESYS HAL IR — register VM for executing compiled IEC 61131-3 programs.
//!
//! # Architecture (from D22, hal-ir-design.md)
//! - **Register VM**: 16 general-purpose registers (r0–r15), no stack, no heap
//! - **Instruction set**: 20 opcodes covering data movement, arithmetic, comparison,
//!   bitwise logic, and control flow
//! - **Scan cycle**: Load → Compute → Write → Halt (Phase 1: sequential execution)
//!
//! # Phase 1 scope (hal-ir-design.md §6)
//! - Simple ST programs: arithmetic, comparison, if/else, while loops
//! - Scalar types: Bool, S8–S64, U8–U64, F32, F64
//! - Signal Read/Write via Load/Store (transport deferred to Phase 2)
//!
//! # Phase 2+ (not yet implemented)
//! - Function calls, timers, structs/arrays, multi-task scheduling
//! - FlatBuffers serialization of HalProgram
//! - HalTransport integration for signal I/O

pub mod instruction;
pub mod program;
pub mod types;
pub mod vm;

mod executor;
pub use executor::{Executor, ExecutorResult};

/// Re-export for convenience.
pub use audesys_hal_core as hal_core;
