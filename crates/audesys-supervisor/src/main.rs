//! AUDESYS Runtime Supervisor — process orchestration and monitoring.
//!
//! Monitors child processes listed in a YAML config, auto-restarts them
//! on exit with exponential backoff, and pushes status updates to the
//! Controller via UDS IPC (best-effort, fire-and-forget).
//!
//! Graceful shutdown: SIGINT/SIGTERM → SIGKILL children → wait → exit.

use audesys_runtime_common::types::Role;
use audesys_supervisor::config::SupervisorConfig;
use audesys_supervisor::monitor::{MAX_RETRIES, ManagedProcess, ProcessState};
use std::io::{self, Read, Write};
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::process;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

// ── Wire constants (match controller ipc.rs) ──────────────────────────

const HEADER_SIZE: usize = 69;
const TOKEN_WIRE_SIZE: usize = 64;

const METHOD_AUTH_REQUEST: u8 = 0x01;
/// Push child process status to Controller.
/// 0x06 = SIGNAL_SNAPSHOT in controller, so use 0x07.
const METHOD_CHILD_STATUS: u8 = 0x07;

const STATUS_OK: u8 = 0x00;

/// Set by SIGINT/SIGTERM handler.
static SHUTDOWN: AtomicBool = AtomicBool::new(false);

// ── Wire helpers (preserved from skeleton) ────────────────────────────

fn role_to_u8(role: &Role) -> u8 {
    match role {
        Role::Operator => 0,
        Role::Engineer => 1,
        Role::Supervisor => 2,
        Role::Auditor => 3,
        Role::System => 4,
    }
}

fn build_frame(token: &[u8; TOKEN_WIRE_SIZE], method_id: u8, payload: &[u8]) -> Vec<u8> {
    let total_len = (HEADER_SIZE + payload.len()) as u32;
    let mut buf = Vec::with_capacity(total_len as usize);
    buf.extend_from_slice(&total_len.to_le_bytes());
    buf.extend_from_slice(token);
    buf.push(method_id);
    buf.extend_from_slice(payload);
    buf
}

fn read_response(stream: &mut UnixStream) -> io::Result<(u8, u8, Vec<u8>)> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf)?;
    let total_len = u32::from_le_bytes(len_buf) as usize;
    if total_len < 6 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "response too short"));
    }
    let payload_len = total_len - 6;
    let mut rest = vec![0u8; 2 + payload_len];
    stream.read_exact(&mut rest)?;
    Ok((rest[0], rest[1], rest[2..].to_vec()))
}

fn connect_and_auth(uds_path: &str) -> io::Result<([u8; TOKEN_WIRE_SIZE], UnixStream)> {
    let mut stream = UnixStream::connect(uds_path)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;

    let pid = process::id();
    let mut payload = Vec::with_capacity(5);
    payload.extend_from_slice(&pid.to_le_bytes());
    payload.push(role_to_u8(&Role::Supervisor));

    let frame = build_frame(&[0u8; TOKEN_WIRE_SIZE], METHOD_AUTH_REQUEST, &payload);
    stream.write_all(&frame)?;
    stream.flush()?;

    let (method_id, status, resp_payload) = read_response(&mut stream)?;
    if method_id != METHOD_AUTH_REQUEST || status != STATUS_OK {
        let msg = String::from_utf8_lossy(&resp_payload);
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("auth failed: {}", msg),
        ));
    }
    if resp_payload.len() < TOKEN_WIRE_SIZE {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "token too short"));
    }

    let mut token = [0u8; TOKEN_WIRE_SIZE];
    token.copy_from_slice(&resp_payload[..TOKEN_WIRE_SIZE]);
    Ok((token, stream))
}

// ── Status push ───────────────────────────────────────────────────────

/// Connect to Controller, authenticate, push status for all children,
/// then disconnect. Best-effort — errors are logged, not fatal.
fn push_status(uds_path: &str, children: &[ManagedProcess]) {
    let (token, mut stream) = match connect_and_auth(uds_path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Supervisor: status push connect/auth failed: {}", e);
            return;
        }
    };

    for child in children {
        let state_code: u8 = match child.state {
            ProcessState::Running => 0,
            ProcessState::Restarting { .. } => 1,
            ProcessState::Failed { .. } => 2,
        };

        let name_bytes = child.name.as_bytes();
        let mut payload = Vec::with_capacity(2 + name_bytes.len() + 1 + 4 + 4);
        payload.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        payload.extend_from_slice(name_bytes);
        payload.push(state_code);
        match child.exit_code {
            Some(code) => payload.extend_from_slice(&code.to_le_bytes()),
            None => payload.extend_from_slice(&0xFFFF_FFFFu32.to_le_bytes()),
        }
        payload.extend_from_slice(&child.restart_count.to_le_bytes());

        let frame = build_frame(&token, METHOD_CHILD_STATUS, &payload);
        // ponytail: fire-and-forget — don't block on controller response
        if let Err(e) = stream.write_all(&frame) {
            eprintln!("Supervisor: status push write error for {}: {}", child.name, e);
            return;
        }
    }
    let _ = stream.flush();
}

// ── CLI parsing ───────────────────────────────────────────────────────

fn parse_args() -> (String, String) {
    let mut config_path = "supervisor.yaml".to_string();
    let mut uds_path = "/tmp/audesys-controller.sock".to_string();
    let args: Vec<String> = std::env::args().collect();
    let mut i: usize = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--config" => {
                i = i.saturating_add(1);
                if i < args.len() {
                    config_path = args[i].clone();
                }
            }
            "--uds-path" => {
                i = i.saturating_add(1);
                if i < args.len() {
                    uds_path = args[i].clone();
                }
            }
            _ => {}
        }
        i = i.saturating_add(1);
    }
    (config_path, uds_path)
}

// ── Signal handling ───────────────────────────────────────────────────

fn setup_signals() {
    unsafe {
        libc::signal(libc::SIGINT, sig_handler as *const () as libc::sighandler_t);
        libc::signal(libc::SIGTERM, sig_handler as *const () as libc::sighandler_t);
    }
}

extern "C" fn sig_handler(_: libc::c_int) {
    SHUTDOWN.store(true, Ordering::SeqCst);
}

// ── Main ──────────────────────────────────────────────────────────────

fn main() {
    let (config_path, cli_uds_path) = parse_args();

    let config = match SupervisorConfig::load(Path::new(&config_path)) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Supervisor: failed to load config '{}': {}", config_path, e);
            process::exit(1);
        }
    };

    let uds_path = if config.uds_path.is_empty() { &cli_uds_path } else { &config.uds_path };

    setup_signals();

    // ── Spawn children ────────────────────────────────────────────
    let mut children: Vec<ManagedProcess> = config
        .children
        .iter()
        .map(|cc| {
            let mut mp = ManagedProcess::new(cc.name.clone(), cc.program.clone(), cc.args.clone());
            match mp.spawn() {
                Ok(pid) => println!("Supervisor: spawned {} (pid {})", mp.name, pid),
                Err(e) => {
                    eprintln!("Supervisor: failed to spawn {}: {}", mp.name, e);
                    mp.state = ProcessState::Failed { reason: e };
                }
            }
            mp
        })
        .collect();

    if children.is_empty() {
        eprintln!("Supervisor: no children configured, exiting");
        process::exit(0);
    }

    let check_interval = Duration::from_millis(config.check_interval_ms);
    let shutdown_timeout = Duration::from_millis(config.shutdown_timeout_ms);

    println!(
        "Supervisor: monitoring {} children, check every {}ms",
        children.len(),
        config.check_interval_ms
    );

    // ── Main monitoring loop ──────────────────────────────────────
    loop {
        if SHUTDOWN.load(Ordering::SeqCst) {
            println!("Supervisor: received shutdown signal");
            break;
        }

        let mut any_change = false;
        for child in &mut children {
            if matches!(child.state, ProcessState::Failed { .. }) {
                continue;
            }
            if let Some(change) = child.check() {
                any_change = true;
                match &change.state {
                    ProcessState::Restarting { attempt, backoff_ms } => {
                        eprintln!(
                            "Supervisor: {} exited (code {:?}), restarting (attempt {}/{}, backoff {}ms)",
                            change.name, change.exit_code, attempt, MAX_RETRIES, backoff_ms
                        );
                    }
                    ProcessState::Failed { reason } => {
                        eprintln!(
                            "Supervisor: {} FAILED: {} (exit code {:?})",
                            change.name, reason, change.exit_code
                        );
                    }
                    ProcessState::Running => {}
                }
            }
        }

        if any_change {
            push_status(uds_path, &children);
        }

        // Exit when all children have permanently failed
        let all_failed = children.iter().all(|c| matches!(c.state, ProcessState::Failed { .. }));
        if all_failed {
            eprintln!("Supervisor: all children failed, exiting");
            break;
        }

        std::thread::sleep(check_interval);
    }

    // ── Graceful shutdown ─────────────────────────────────────────
    println!("Supervisor: shutting down children...");
    for child in &mut children {
        child.kill();
    }

    let deadline = Instant::now() + shutdown_timeout;
    for child in &mut children {
        while child.child.is_some() {
            if Instant::now() >= deadline {
                child.kill();
                break;
            }
            if child.check().is_some() {
                break; // process exited
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    println!("Supervisor: shutdown complete");
}
