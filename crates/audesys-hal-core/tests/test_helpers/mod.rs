//! Test helpers for hal-core integration tests.
//!
//! # Decision references
//! - D33: direct TDD, AAA pattern

use audesys_hal_core::mock_transport::StubValue;

/// Stub tracing initializer — no-op in Phase 0.
///
/// 来源: docs/modules/runtime/observability-design.md
// ponytail: impl when observability crate exists
pub fn init_tracing() {}

/// Build a `StubValue::S32` for quick test setup.
/// 来源: docs/modules/hal/iec-type-system-design.md
pub fn val_i32(v: i32) -> StubValue {
    StubValue::S32(v)
}

/// Build a `StubValue::F64` for quick test setup.
/// 来源: docs/modules/hal/iec-type-system-design.md
pub fn val_f64(v: f64) -> StubValue {
    StubValue::F64(v)
}

/// Build a `StubValue::Bool` for quick test setup.
/// 来源: docs/modules/hal/iec-type-system-design.md
pub fn val_bool(v: bool) -> StubValue {
    StubValue::Bool(v)
}

// ponytail: minimal helpers — expand as test surface grows
