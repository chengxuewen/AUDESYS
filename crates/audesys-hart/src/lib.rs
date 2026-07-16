//! HART protocol adapter for AUDESYS HAL.
//!
//! Bridges HART field device variables (PV, SV, TV, QV) to [`HalTransport`] Signals.
//! Uses the native Rust [`hart_protocol`] crate for command encoding/decoding.
//!
//! ## Architecture
//! - [`HartClient`] — safe HART serial transport (UART/RS-485)
//! - [`HartAdapter`] — [`HalTransport`] consumer with dedicated poll loop
//! - [`HartConfig`] — YAML-configurable device setup and variable mappings

pub mod adapter;
pub mod client;
pub mod config;
pub mod error;
pub mod mapping;

pub use adapter::HartAdapter;
pub use client::HartClient;
pub use config::{
    ConnectionConfig, HartConfig, SignalDirection, VariableMapping, VariableMappingType,
};
pub use error::HartError;
pub use mapping::{VariableType, halvalue_to_variables, variables_to_halvalue};
