//! CNC motion planner — trapezoidal velocity profile generator.
//!
//! Generates `HalProgram` instructions for multi-axis linear motion
//! with acceleration/cruise/deceleration phases. Used by the G-code
//! compiler and potentially by other IEC 61131-3 motion function blocks.

mod profile;

pub use profile::{generate_trapezoidal_program, TrapezoidalProfile};
