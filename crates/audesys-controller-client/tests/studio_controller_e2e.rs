//! End-to-end integration test: Studio ↔ Controller full pipeline.
//!
//! Tests the complete chain:
//!   ST source → compile → deploy via ControllerClient → read signals
//!
//! Prerequisites: binaries must be pre-built.
//!   cargo build --bin audesys-controller
//!
//! Run with single thread to avoid socket conflicts:
//!   cargo test --test studio_controller_e2e -- --test-threads=1

use audesys_controller_client::ControllerClient;
use audesys_hal_binding_gen::compile;
use audesys_runtime_common::types::Role;
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const SOCKET_PATH: &str = "/tmp/audesys-e2e-test.sock";
const SECRET: &[u8] = b"test-secret-32-bytes-long-key!!";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(5);

// ── Helpers ──

fn controller_binary() -> String {
    if let Ok(p) = std::env::var("CARGO_BIN_EXE_audesys-controller") {
        return p;
    }
    "./target/debug/audesys-controller".into()
}

fn ensure_binary(label: &str, path: &str) -> Option<String> {
    if Path::new(path).exists() {
        Some(path.to_string())
    } else {
        eprintln!("SKIP: {} binary not found at '{}'", label, path);
        None
    }
}

fn spawn_controller(socket_path: &str) -> std::io::Result<Child> {
    Command::new(controller_binary())
        .arg("--socket-path")
        .arg(socket_path)
        .arg("--health-port")
        .arg("9010") // non-conflicting port
        .arg("--cycle-interval")
        .arg("500")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

fn wait_for_socket(socket_path: &str, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    loop {
        if UnixStream::connect(socket_path).is_ok() {
            return;
        }
        if Instant::now() >= deadline {
            panic!("timeout waiting for UDS socket '{}'", socket_path);
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn graceful_shutdown(mut child: Child, timeout: Duration) {
    use std::io::Write;
    if let Some(ref mut stdin) = child.stdin {
        let _ = stdin.write_all(b"exit\n");
        let _ = stdin.flush();
    }
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return;
            }
        }
    }
}

// ── Tests ──

/// Full pipeline: compile ST → connect → authenticate → deploy → read signal.
#[test]
fn test_deploy_and_read_signal() {
    let bin_path = controller_binary();
    if ensure_binary("audesys-controller", &bin_path).is_none() {
        return;
    }

    let _ = std::fs::remove_file(SOCKET_PATH);
    let child = spawn_controller(SOCKET_PATH).expect("should spawn controller");
    wait_for_socket(SOCKET_PATH, STARTUP_TIMEOUT);
    // Brief settle period
    thread::sleep(Duration::from_millis(200));

    // Compile a simple ST program
    let st_source = "\
PROGRAM test
  counter AT %MW0 : INT := 0;
END_PROGRAM";

    let program = compile(st_source).expect("should compile ST");
    let program_bytes = serde_json::to_vec(&program).expect("should serialize");

    // Connect, authenticate, deploy
    let mut client = ControllerClient::connect(SOCKET_PATH, SECRET)
        .expect("should connect");
    client.authenticate(Role::Engineer)
        .expect("should authenticate");

    // Deploy program
    client.load_program(&program_bytes)
        .expect("should deploy program");

    // Read the counter signal
    let val = client.read_signal("counter").expect("should read signal");
    assert!(format!("{val:?}").contains("S32"), "counter should have a value");

    // Health check
    let health = client.health_query().expect("should get health");
    assert!(!health.is_empty(), "health should return data");

    // Cleanup
    drop(client);
    let _ = std::fs::remove_file(SOCKET_PATH);
    graceful_shutdown(child, Duration::from_secs(3));
}

/// Test signal snapshot after deploy.
#[test]
fn test_signal_snapshot_after_deploy() {
    let bin_path = controller_binary();
    if ensure_binary("audesys-controller", &bin_path).is_none() {
        return;
    }

    let _ = std::fs::remove_file(SOCKET_PATH);
    let child = spawn_controller(SOCKET_PATH).expect("should spawn controller");
    wait_for_socket(SOCKET_PATH, STARTUP_TIMEOUT);
    thread::sleep(Duration::from_millis(200));

    let st_source = "PROGRAM test\n  x AT %MW0 : INT := 42;\nEND_PROGRAM";
    let program = compile(st_source).expect("should compile");
    let program_bytes = serde_json::to_vec(&program).expect("should serialize");

    let mut client = ControllerClient::connect(SOCKET_PATH, SECRET)
        .expect("should connect");
    client.authenticate(Role::Engineer)
        .expect("should authenticate");
    client.load_program(&program_bytes)
        .expect("should deploy");

    // Snapshot should include our signal
    let snapshot = client.signal_snapshot("*")
        .expect("should get snapshot");
    assert!(!snapshot.is_empty(), "snapshot should have signals");

    // ponytail: snapshot returns Vec<(String, HalValue)>
    let has_signal = snapshot.iter().any(|(name, _)| name.contains("x") || name.contains("counter"));
    assert!(has_signal, "snapshot should contain deployed signal");

    drop(client);
    let _ = std::fs::remove_file(SOCKET_PATH);
    graceful_shutdown(child, Duration::from_secs(3));
}

/// Test HAL config loading.
#[test]
fn test_load_hal_config() {
    let bin_path = controller_binary();
    if ensure_binary("audesys-controller", &bin_path).is_none() {
        return;
    }

    let _ = std::fs::remove_file(SOCKET_PATH);
    let child = spawn_controller(SOCKET_PATH).expect("should spawn controller");
    wait_for_socket(SOCKET_PATH, STARTUP_TIMEOUT);
    thread::sleep(Duration::from_millis(200));

    let mut client = ControllerClient::connect(SOCKET_PATH, SECRET)
        .expect("should connect");
    client.authenticate(Role::Engineer)
        .expect("should authenticate");

    // Load a minimal HAL config
    let yaml = b"signals:\n  test.sig1:\n    type: S32\n    direction: in\n";
    client.load_hal_config(yaml)
        .expect("should load HAL config");

    drop(client);
    let _ = std::fs::remove_file(SOCKET_PATH);
    graceful_shutdown(child, Duration::from_secs(3));
}

/// Test connection with wrong secret (should fail).
#[test]
fn test_auth_failure_wrong_secret() {
    let bin_path = controller_binary();
    if ensure_binary("audesys-controller", &bin_path).is_none() {
        return;
    }

    let _ = std::fs::remove_file(SOCKET_PATH);
    let child = spawn_controller(SOCKET_PATH).expect("should spawn controller");
    wait_for_socket(SOCKET_PATH, STARTUP_TIMEOUT);
    thread::sleep(Duration::from_millis(200));

    let wrong_secret = b"wrong-secret-----------------------";
    let mut client = ControllerClient::connect(SOCKET_PATH, wrong_secret)
        .expect("should connect (HMAC challenge)");
    let result = client.authenticate(Role::Engineer);
    assert!(result.is_err(), "auth with wrong secret should fail");

    drop(client);
    let _ = std::fs::remove_file(SOCKET_PATH);
    graceful_shutdown(child, Duration::from_secs(3));
}
