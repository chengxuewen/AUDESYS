//! AUDESYS Studio — Tauri backend commands.
//!
//! Provides two commands:
//! - `compile_st`: IEC 61131-3 ST → HAL IR compilation
//! - `run_program`: Execute compiled program on register VM

use audesys_hal_binding_gen::compile;
use audesys_hal_ir::{program::HalProgram, Executor};
use serde::Serialize;

/// Signal state returned to the frontend after execution.
#[derive(Serialize)]
struct SignalState {
    name: String,
    value: serde_json::Value,
    pin_type: String,
}

/// Compile an IEC 61131-3 Structured Text source into a HAL IR program (JSON).
#[tauri::command]
fn compile_st(source: String) -> Result<String, String> {
    let program = compile(&source).map_err(|e| e.to_string())?;
    serde_json::to_string(&program).map_err(|e| e.to_string())
}

/// Run a compiled HalProgram on the register VM and return signal states.
///
/// `cycle_ms` is reserved for Phase 2 (multi-cycle execution); currently ignored.
#[tauri::command]
fn run_program(program_json: String, _cycle_ms: u64) -> Result<String, String> {
    let program: HalProgram =
        serde_json::from_str(&program_json).map_err(|e| format!("deserialize: {e}"))?;

    // Clone signal bindings before Executor takes ownership of the program.
    let signal_bindings = program.signals.clone();
    let mut executor = Executor::new(program);
    executor.run_to_halt();

    // ponytail: cycle_ms ignored in Phase 1, single run-to-halt
    let signals: Vec<SignalState> = signal_bindings
        .iter()
        .map(|s| {
            let value = executor
                .vm()
                .read_signal(&s.hal_signal_name)
                .map(|v| serde_json::to_value(v).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null);
            SignalState {
                name: s.hal_signal_name.clone(),
                value,
                pin_type: format!("{:?}", s.hal_pin_type),
            }
        })
        .collect();

    serde_json::to_string(&signals).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![compile_st, run_program])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
