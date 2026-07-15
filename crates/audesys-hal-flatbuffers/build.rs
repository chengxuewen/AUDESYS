//! Build script: regenerate FlatBuffers Rust bindings when schema changes.
//! D39: flatc auto-generation from .fbs schema.

fn main() {
    println!("cargo:rerun-if-changed=schema/hal_value.fbs");

    let status = std::process::Command::new("flatc")
        .args(["--rust", "-o", "src/generated", "schema/hal_value.fbs"])
        .status()
        .expect("flatc not found. Install with: brew install flatbuffers");

    if !status.success() {
        panic!("flatc compilation failed");
    }
}
