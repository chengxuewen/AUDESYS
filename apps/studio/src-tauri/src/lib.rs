//! AUDESYS Studio — Tauri backend commands.
//!
//! Provides five commands:
//! - `compile_st`: IEC 61131-3 ST → HAL IR compilation
//! - `run_program`: Execute compiled program on register VM
//! - `deploy_program`: Deploy ST program to running Controller
//! - `load_hal_config`: Load HAL config to running Controller
//! - `read_controller_signal`: Read signal from running Controller

use audesys_controller_client::ControllerClient;
use audesys_hal_binding_gen::compile;
use audesys_hal_ir::{program::HalProgram, Executor};
use audesys_runtime_common::types::Role;
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

/// Deploy a compiled ST program to a running Controller via IPC.
#[tauri::command]
fn deploy_program(socket_path: String, secret: String, program_bytes: Vec<u8>) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Engineer)
        .map_err(|e| format!("auth: {e}"))?;
    client.load_program(&program_bytes)
        .map_err(|e| format!("deploy: {e}"))
}

/// Load a HAL config (YAML) to a running Controller via IPC.
#[tauri::command]
fn load_hal_config(socket_path: String, secret: String, yaml_bytes: Vec<u8>) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Engineer)
        .map_err(|e| format!("auth: {e}"))?;
    client.load_hal_config(&yaml_bytes)
        .map_err(|e| format!("config: {e}"))
}

/// Read a signal value from a running Controller via IPC.
#[tauri::command]
fn read_controller_signal(socket_path: String, secret: String, signal_name: String) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Operator)
        .map_err(|e| format!("auth: {e}"))?;
    let value = client.read_signal(&signal_name)
        .map_err(|e| format!("read: {e}"))?;
    serde_json::to_string(&value).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            compile_st,
            run_program,
            deploy_program,
            load_hal_config,
            read_controller_signal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
