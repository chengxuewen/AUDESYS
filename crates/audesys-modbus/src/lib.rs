//! Modbus RTU/TCP protocol adapter for AUDESYS HAL.

pub mod adapter;
pub mod client;
pub mod config;
pub mod error;
pub mod mapping;

pub use adapter::ModbusAdapter;
pub use client::ModbusClient;
pub use config::{
    ConnectionConfig, ModbusConfig, RegisterMapping, RegisterMappingType, SignalDirection,
};
pub use error::ModbusError;
pub use mapping::{RegisterType, coils_to_halvalue, halvalue_to_registers, registers_to_halvalue};
