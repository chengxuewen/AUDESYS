//! Test helpers for hal-core integration tests.
//!
//! # Decision references
//! - D33: direct TDD, AAA pattern

use audesys_hal_core::HalValue;

/// Stub tracing initializer — no-op in Phase 0.
///
/// 来源: docs/modules/runtime/observability-design.md
// ponytail: impl when observability crate exists
pub fn init_tracing() {}

pub fn val_i32(v: i32) -> HalValue {
    HalValue::S32(v)
}

pub fn val_f64(v: f64) -> HalValue {
    HalValue::F64(v)
}

pub fn val_bool(v: bool) -> HalValue {
    HalValue::Bool(v)
}

// ponytail: minimal helpers — expand as test surface grows
