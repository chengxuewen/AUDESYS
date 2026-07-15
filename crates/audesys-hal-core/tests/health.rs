//! AUDESYS health check — compile-link verification.
//!
//! Phase 0: proves the Cargo workspace compiles and links correctly.
//! Phase 1: replaced by actual hal-core integration tests.
//!
//! # Decision references
//! - D32: CI-first
//! - D35: Cargo workspace structure
use audesys_hal_core::HalCoreLinked;

#[test]
fn workspace_compiles_and_links() {
    let _token = HalCoreLinked;
}
