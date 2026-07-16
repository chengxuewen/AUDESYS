//! AUDESYS Runtime Supervisor — process orchestration and monitoring.
//!
//! ponytail: skeleton only, connects to Controller via UDS and sends health query.
//! Phase 2 will add real supervision logic (process monitoring, restart, audit logging).

use audesys_runtime_common::types::Role;
use std::io::{self, Read, Write};
use std::os::unix::net::UnixStream;
use std::process;

// ── Wire constants (match controller ipc.rs) ──

/// Request frame header: 4 bytes length + 64 bytes token + 1 byte method_id = 69 bytes.
const HEADER_SIZE: usize = 69;
/// Size of the HMAC token on the wire.
const TOKEN_WIRE_SIZE: usize = 64;

const METHOD_AUTH_REQUEST: u8 = 0x01;
const METHOD_HEALTH_QUERY: u8 = 0x05;

const STATUS_OK: u8 = 0x00;

/// Encode Role to wire byte (matches controller ipc.rs `role_to_u8`).
fn role_to_u8(role: &Role) -> u8 {
    match role {
        Role::Operator => 0,
        Role::Engineer => 1,
        Role::Supervisor => 2,
        Role::Auditor => 3,
        Role::System => 4,
    }
}

/// Build a request frame: [4B total_len LE][64B token][1B method_id][payload].
fn build_frame(token: &[u8; TOKEN_WIRE_SIZE], method_id: u8, payload: &[u8]) -> Vec<u8> {
    let total_len = (HEADER_SIZE + payload.len()) as u32;
    let mut buf = Vec::with_capacity(total_len as usize);
    buf.extend_from_slice(&total_len.to_le_bytes());
    buf.extend_from_slice(token);
    buf.push(method_id);
    buf.extend_from_slice(payload);
    buf
}

/// Read a response frame from the stream.
/// Returns `(method_id, status, payload)`.
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

/// Connect to Controller, authenticate with Supervisor role, return token.
fn connect_and_auth(uds_path: &str) -> io::Result<([u8; TOKEN_WIRE_SIZE], UnixStream)> {
    let mut stream = UnixStream::connect(uds_path)?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;

    // Auth payload: [4B pid LE][1B role]
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

fn main() {
    let uds_path =
        std::env::args().nth(1).unwrap_or_else(|| "/tmp/audesys-controller.sock".to_string());

    // ponytail: SIGINT handler — print graceful message on Ctrl+C
    ctrlc_handler();

    let (token, mut stream) = match connect_and_auth(&uds_path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Supervisor: failed to connect to Controller at {}: {}", uds_path, e);
            process::exit(1);
        }
    };

    println!("Supervisor connected to Controller");

    // ── Read commands from stdin ──
    let stdin = io::stdin();
    let mut buf = String::new();
    loop {
        buf.clear();
        match stdin.read_line(&mut buf) {
            Ok(0) => break, // EOF
            Ok(_) => {
                let cmd = buf.trim();
                match cmd {
                    "health" => {
                        let frame = build_frame(&token, METHOD_HEALTH_QUERY, &[]);
                        if let Err(e) = stream.write_all(&frame).and_then(|_| stream.flush()) {
                            eprintln!("Supervisor: send error: {}", e);
                            break;
                        }
                        match read_response(&mut stream) {
                            Ok((_, status, payload)) => {
                                let body = String::from_utf8_lossy(&payload);
                                if status == STATUS_OK {
                                    println!("Controller health: OK — {}", body);
                                } else {
                                    println!("Controller health: DEGRADED — {}", body);
                                }
                            }
                            Err(e) => {
                                eprintln!("Supervisor: read error: {}", e);
                            }
                        }
                    }
                    "exit" | "quit" => break,
                    "" => {} // ignore empty lines
                    other => eprintln!("unknown command: '{}' — try: health, exit", other),
                }
            }
            Err(e) => {
                eprintln!("Supervisor: stdin error: {}", e);
                break;
            }
        }
    }

    println!("Supervisor shutting down");
}

/// ponytail: minimal SIGINT handler — set atomic flag, no channel needed for skeleton.
fn ctrlc_handler() {
    // SAFETY: single-threaded skeleton, signal handler is a leaf function.
    unsafe {
        libc::signal(libc::SIGINT, handle_sigint as *const () as libc::sighandler_t);
    }
}

extern "C" fn handle_sigint(_: libc::c_int) {
    println!("\nSupervisor received SIGINT — shutting down");
    process::exit(0);
}
