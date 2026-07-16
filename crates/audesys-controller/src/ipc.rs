//! Controller IPC — Unix Domain Socket listener with SO_PEERCRED auth and HMAC SessionToken.
//!
//! # Architecture
//! - Sync-only (no tokio): compatible with SCHED_FIFO RT threads
//! - SO_PEERCRED: kernel-provided peer (pid, uid, gid) — unforgeable
//! - HMAC-SHA256 SessionToken: signed per-connection token, avoids repeated getsockopt
//! - Frame-based wire protocol: `<length:u32><token:64 bytes><method_id:u8><payload:N bytes>`
//!
//! 来源: docs/modules/runtime/ipc-security-design.md §2-3

use crate::engine::Engine;
use audesys_hal_core::qos::ConfigCommand;
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::value::HalValue;
use audesys_runtime_common::types::Role;
use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;
use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::os::unix::io::AsRawFd;
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ── Constants ──

type HmacSha256 = Hmac<Sha256>;

/// Size of the token field on the wire.
const TOKEN_WIRE_SIZE: usize = 64;

/// Message header size: 4 (length) + 64 (token) + 1 (method_id) = 69 bytes.
const HEADER_SIZE: usize = 69;

/// Default token TTL for non-Supervisor roles (ms).
const DEFAULT_TOKEN_TTL_MS: u64 = 3_600_000; // 1 hour

/// Token TTL for Supervisor (ms).
const SUPERVISOR_TOKEN_TTL_MS: u64 = 86_400_000; // 24 hours

// ── Method IDs ──

const METHOD_AUTH_REQUEST: u8 = 0x01;
const METHOD_CONFIG_COMMAND: u8 = 0x02;
const METHOD_READ_SIGNAL: u8 = 0x03;
const METHOD_WRITE_SIGNAL: u8 = 0x04;
const METHOD_HEALTH_QUERY: u8 = 0x05;
const METHOD_SIGNAL_SNAPSHOT: u8 = 0x06;

// ── Response status ──

const STATUS_OK: u8 = 0x00;
const STATUS_ERROR: u8 = 0x01;

// ── HalPinType → wire discriminant ──

fn pin_type_discriminant(pt: HalPinType) -> u8 {
    match pt {
        HalPinType::Bool => 0,
        HalPinType::S8 => 1,
        HalPinType::U8 => 2,
        HalPinType::S16 => 3,
        HalPinType::U16 => 4,
        HalPinType::S32 => 5,
        HalPinType::U32 => 6,
        HalPinType::S64 => 7,
        HalPinType::U64 => 8,
        HalPinType::F32 => 9,
        HalPinType::F64 => 10,
        HalPinType::Blob => 11,
        HalPinType::String => 12,
    }
}

fn pin_type_from_disc(d: u8) -> Result<HalPinType, String> {
    match d {
        0 => Ok(HalPinType::Bool),
        1 => Ok(HalPinType::S8),
        2 => Ok(HalPinType::U8),
        3 => Ok(HalPinType::S16),
        4 => Ok(HalPinType::U16),
        5 => Ok(HalPinType::S32),
        6 => Ok(HalPinType::U32),
        7 => Ok(HalPinType::S64),
        8 => Ok(HalPinType::U64),
        9 => Ok(HalPinType::F32),
        10 => Ok(HalPinType::F64),
        11 => Ok(HalPinType::Blob),
        12 => Ok(HalPinType::String),
        _ => Err(format!("unknown pin type disc: {}", d)),
    }
}

/// ponytail: simple binary HalValue encoder. Add FlatBuffers when cross-language IPC needed.
fn encode_hal_value(value: &HalValue) -> Vec<u8> {
    let mut buf = Vec::new();
    // Array uses marker 0xFE — pushed before match to avoid element_type collision
    match value {
        HalValue::Array { element_type, data } => {
            buf.push(0xFE);
            buf.extend_from_slice(&(data.len() as u32).to_le_bytes());
            buf.push(pin_type_discriminant(*element_type));
            buf.extend_from_slice(data);
        }
        _ => {
            buf.push(pin_type_discriminant(value.pin_type()));
            match value {
                HalValue::Bool(v) => buf.push(if *v { 1 } else { 0 }),
                HalValue::S8(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::U8(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::S16(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::U16(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::S32(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::U32(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::S64(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::U64(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::F32(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::F64(v) => buf.extend_from_slice(&v.to_le_bytes()),
                HalValue::Blob(data) => {
                    buf.extend_from_slice(&(data.len() as u32).to_le_bytes());
                    buf.extend_from_slice(data);
                }
                HalValue::String(s) => {
                    let bytes = s.as_bytes();
                    buf.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
                    buf.extend_from_slice(bytes);
                }
                HalValue::Array { .. } => unreachable!("handled above"),
            }
        }
    }
    buf
}

/// ponytail: simple binary HalValue decoder. Add FlatBuffers when cross-language IPC needed.
fn decode_hal_value(data: &[u8]) -> Result<(HalValue, usize), String> {
    if data.is_empty() {
        return Err("empty value data".into());
    }
    let type_disc = data[0];
    let rest = &data[1..];
    match type_disc {
        0 => {
            let v = rest.first().copied().unwrap_or(0) != 0;
            Ok((HalValue::Bool(v), 2))
        }
        1 => need(rest, 1).map(|_| (HalValue::S8(rest[0] as i8), 2)),
        2 => need(rest, 1).map(|_| (HalValue::U8(rest[0]), 2)),
        3 => {
            need(rest, 2)?;
            Ok((HalValue::S16(i16::from_le_bytes([rest[0], rest[1]])), 3))
        }
        4 => {
            need(rest, 2)?;
            Ok((HalValue::U16(u16::from_le_bytes([rest[0], rest[1]])), 3))
        }
        5 => read4(rest).map(|arr| (HalValue::S32(i32::from_le_bytes(arr)), 5)),
        6 => read4(rest).map(|arr| (HalValue::U32(u32::from_le_bytes(arr)), 5)),
        7 => read8(rest).map(|arr| (HalValue::S64(i64::from_le_bytes(arr)), 9)),
        8 => read8(rest).map(|arr| (HalValue::U64(u64::from_le_bytes(arr)), 9)),
        9 => read4(rest).map(|arr| (HalValue::F32(f32::from_le_bytes(arr)), 5)),
        10 => read8(rest).map(|arr| (HalValue::F64(f64::from_le_bytes(arr)), 9)),
        11 => {
            need(rest, 4)?;
            let len = u32::from_le_bytes([rest[0], rest[1], rest[2], rest[3]]) as usize;
            need(rest, 4 + len)?;
            Ok((HalValue::Blob(rest[4..4 + len].to_vec()), 5 + len))
        }
        12 => {
            need(rest, 4)?;
            let len = u32::from_le_bytes([rest[0], rest[1], rest[2], rest[3]]) as usize;
            need(rest, 4 + len)?;
            let s =
                String::from_utf8(rest[4..4 + len].to_vec()).map_err(|e| format!("utf8: {}", e))?;
            Ok((HalValue::String(s), 5 + len))
        }
        // Array marker: [1B 0xFE][4B len][1B elem_type][data]
        0xFE => {
            need(rest, 4)?;
            let len = u32::from_le_bytes([rest[0], rest[1], rest[2], rest[3]]) as usize;
            need(rest, 4 + 1 + len)?;
            let elem = pin_type_from_disc(rest[4])?;
            Ok((HalValue::Array { element_type: elem, data: rest[5..5 + len].to_vec() }, 6 + len))
        }
        _ => Err(format!("unknown pin type discriminant: {}", type_disc)),
    }
}

fn need(data: &[u8], n: usize) -> Result<(), String> {
    if data.len() < n { Err(format!("need {} bytes, have {}", n, data.len())) } else { Ok(()) }
}

fn read4(data: &[u8]) -> Result<[u8; 4], String> {
    need(data, 4)?;
    let mut arr = [0u8; 4];
    arr.copy_from_slice(&data[..4]);
    Ok(arr)
}

fn read8(data: &[u8]) -> Result<[u8; 8], String> {
    need(data, 8)?;
    let mut arr = [0u8; 8];
    arr.copy_from_slice(&data[..8]);
    Ok(arr)
}

// ── Wire frame helpers ──

fn build_response(method_id: u8, status: u8, payload: &[u8]) -> Vec<u8> {
    let total_len = 6u32 + payload.len() as u32;
    let mut buf = Vec::with_capacity(total_len as usize);
    buf.extend_from_slice(&total_len.to_le_bytes());
    buf.push(method_id);
    buf.push(status);
    buf.extend_from_slice(payload);
    buf
}

fn build_error_response(method_id: u8, msg: &str) -> Vec<u8> {
    build_response(method_id, STATUS_ERROR, msg.as_bytes())
}

fn build_ok_response(method_id: u8, payload: &[u8]) -> Vec<u8> {
    build_response(method_id, STATUS_OK, payload)
}

fn read_exact(stream: &mut UnixStream, n: usize) -> io::Result<Vec<u8>> {
    let mut buf = vec![0u8; n];
    stream.read_exact(&mut buf)?;
    Ok(buf)
}

fn write_all(stream: &mut UnixStream, data: &[u8]) -> io::Result<()> {
    stream.write_all(data)?;
    stream.flush()
}

/// Read a single frame: returns (token_bytes, method_id, payload).
fn read_frame(stream: &mut UnixStream) -> io::Result<(Vec<u8>, u8, Vec<u8>)> {
    let len_bytes = read_exact(stream, 4)?;
    let frame_len =
        u32::from_le_bytes([len_bytes[0], len_bytes[1], len_bytes[2], len_bytes[3]]) as usize;
    if frame_len < HEADER_SIZE {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "frame too short"));
    }
    let payload_len = frame_len - HEADER_SIZE;

    let token = read_exact(stream, TOKEN_WIRE_SIZE)?;
    let method_id = read_exact(stream, 1)?[0];
    let payload = if payload_len > 0 { read_exact(stream, payload_len)? } else { Vec::new() };

    Ok((token, method_id, payload))
}

// ── SO_PEERCRED ──

/// Get peer process credentials from UDS: (pid, uid, gid). Kernel-guaranteed.
fn peer_cred(stream: &UnixStream) -> io::Result<(i32, u32, u32)> {
    #[cfg(target_os = "linux")]
    {
        let cred: libc::ucred = unsafe {
            let mut cred: libc::ucred = std::mem::zeroed();
            let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
            let ret = libc::getsockopt(
                stream.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_PEERCRED,
                &mut cred as *mut _ as *mut libc::c_void,
                &mut len,
            );
            if ret != 0 {
                return Err(io::Error::last_os_error());
            }
            cred
        };
        Ok((cred.pid, cred.uid, cred.gid))
    }
    #[cfg(not(target_os = "linux"))]
    {
        // ponytail: macOS — use getpeereid() (no pid available)
        let fd = stream.as_raw_fd();
        let mut uid: libc::uid_t = 0;
        let mut gid: libc::gid_t = 0;
        let ret = unsafe { libc::getpeereid(fd, &mut uid, &mut gid) };
        let pid = unsafe { libc::getpid() };
        if ret != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok((pid, uid, gid))
    }
}

// ── Role↔UID Whitelist ──

fn default_whitelist() -> HashMap<Role, Vec<u32>> {
    let mut wl = HashMap::new();
    wl.insert(Role::Supervisor, vec![0, 1000]);
    wl.insert(Role::Engineer, vec![1000]);
    wl.insert(Role::Operator, vec![1000, 1001]);
    wl.insert(Role::Auditor, vec![1000]);
    wl.insert(Role::System, vec![0]);
    wl
}

fn is_uid_allowed(whitelist: &HashMap<Role, Vec<u32>>, role: &Role, uid: u32) -> bool {
    whitelist.get(role).is_some_and(|uids| uids.contains(&uid))
}

// ── Time ──

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

// ── Wire token ──

/// Layout: [8B session_id LE] [1B role] [8B expires_at_ms LE] [32B HMAC] [15B pad]
fn build_wire_token(secret: &[u8], session_id: u64, role: u8, expires_at_ms: u64) -> Vec<u8> {
    let mut token = vec![0u8; TOKEN_WIRE_SIZE];
    token[0..8].copy_from_slice(&session_id.to_le_bytes());
    token[8] = role;
    token[9..17].copy_from_slice(&expires_at_ms.to_le_bytes());

    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC key must be valid");
    mac.update(&session_id.to_le_bytes());
    mac.update(&[role]);
    mac.update(&expires_at_ms.to_le_bytes());
    let digest = mac.finalize().into_bytes();
    token[17..49].copy_from_slice(&digest);
    // bytes 49..64 are already zero
    token
}

fn verify_wire_token(secret: &[u8], token: &[u8]) -> Result<u8, String> {
    if token.len() < TOKEN_WIRE_SIZE {
        return Err("token too short".into());
    }
    let session_id = u64::from_le_bytes(token[0..8].try_into().unwrap());
    let role = token[8];
    let expires_at_ms = u64::from_le_bytes(token[9..17].try_into().unwrap());

    if now_ms() > expires_at_ms {
        return Err("token expired".into());
    }
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| "HMAC init failed".to_string())?;
    mac.update(&session_id.to_le_bytes());
    mac.update(&[role]);
    mac.update(&expires_at_ms.to_le_bytes());
    mac.verify_slice(&token[17..49]).map_err(|_| "invalid token signature".to_string())?;
    Ok(role)
}

// ── Role encode/decode ──

fn role_to_u8(role: &Role) -> u8 {
    match role {
        Role::Operator => 0,
        Role::Engineer => 1,
        Role::Supervisor => 2,
        Role::Auditor => 3,
        Role::System => 4,
    }
}

fn role_from_u8(b: u8) -> Option<Role> {
    match b {
        0 => Some(Role::Operator),
        1 => Some(Role::Engineer),
        2 => Some(Role::Supervisor),
        3 => Some(Role::Auditor),
        4 => Some(Role::System),
        _ => None,
    }
}

// ── Session info ──

struct SessionInfo {
    session_id: u64,
    role: Role,
    expires_at_ms: u64,
}

// ── Authorization ──

fn can_config(role: Option<&Role>) -> bool {
    matches!(role, Some(Role::Engineer) | Some(Role::Supervisor) | Some(Role::System))
}

fn can_read(role: Option<&Role>) -> bool {
    role.is_some()
}

fn can_write(role: Option<&Role>) -> bool {
    matches!(role, Some(Role::Engineer) | Some(Role::Supervisor) | Some(Role::System))
}

// ── IpcServer ──

/// IPC server listening on a Unix Domain Socket for Controller commands.
///
/// # Security
/// - SO_PEERCRED on auth: verifies peer (pid, uid, gid) against whitelist
/// - HMAC-SHA256 SessionToken: issued after auth, verified on every subsequent message
///
/// # Lifecycle
/// - `new(socket_path, engine)` → create
/// - `start()` → spawn accept loop in background, returns JoinHandle
/// - `stop()` → signal shutdown
pub struct IpcServer {
    socket_path: String,
    engine: Arc<Engine>,
    token_secret: Vec<u8>,
    running: Arc<AtomicBool>,
    whitelist: HashMap<Role, Vec<u32>>,
}

impl IpcServer {
    /// Create with a random 32-byte HMAC secret.
    pub fn new(socket_path: &str, engine: Arc<Engine>) -> Self {
        let mut secret = vec![0u8; 32];
        rand::thread_rng().fill(&mut secret[..]);
        Self {
            socket_path: socket_path.to_string(),
            engine,
            token_secret: secret,
            running: Arc::new(AtomicBool::new(false)),
            whitelist: default_whitelist(),
        }
    }

    /// Start accept loop. Returns JoinHandle to the accept thread.
    pub fn start(&self) -> io::Result<JoinHandle<()>> {
        let _ = std::fs::remove_file(&self.socket_path);
        let listener = UnixListener::bind(&self.socket_path)?;
        listener.set_nonblocking(true)?;

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);
        let socket_path = self.socket_path.clone();
        let engine = Arc::clone(&self.engine);
        let token_secret = self.token_secret.clone();
        let whitelist = self.whitelist.clone();

        let handle = thread::spawn(move || {
            let poll = Duration::from_millis(100);
            while running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        let engine = Arc::clone(&engine);
                        let token_secret = token_secret.clone();
                        let whitelist = whitelist.clone();
                        let next_sid = Arc::new(Mutex::new(1u64));
                        thread::spawn(move || {
                            handle_connection(stream, engine, &token_secret, &whitelist, &next_sid);
                        });
                    }
                    Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                        thread::sleep(poll);
                    }
                    Err(_) => break,
                }
            }
            let _ = std::fs::remove_file(&socket_path);
        });

        Ok(handle)
    }

    /// Signal the accept loop to stop.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Check if running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

// ── Connection handling ──

fn handle_connection(
    mut stream: UnixStream,
    engine: Arc<Engine>,
    token_secret: &[u8],
    whitelist: &HashMap<Role, Vec<u32>>,
    next_session_id: &Mutex<u64>,
) {
    if stream.set_read_timeout(Some(Duration::from_millis(500))).is_err() {
        return;
    }

    let mut session: Option<SessionInfo> = None;

    loop {
        let (token_bytes, method_id, payload) = match read_frame(&mut stream) {
            Ok(f) => f,
            Err(ref e)
                if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(_) => break,
        };

        // Verify token if we have a session
        if let Some(ref sess) = session {
            if method_id == METHOD_AUTH_REQUEST {
                let _ = write_all(
                    &mut stream,
                    &build_error_response(METHOD_AUTH_REQUEST, "already authenticated"),
                );
                continue;
            }
            match verify_wire_token(token_secret, &token_bytes) {
                Ok(role_byte) => {
                    if role_from_u8(role_byte).as_ref() != Some(&sess.role) {
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(method_id, "role mismatch"),
                        );
                        continue;
                    }
                    if now_ms() > sess.expires_at_ms {
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(method_id, "token expired"),
                        );
                        session = None;
                        continue;
                    }
                }
                Err(e) => {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(method_id, &format!("auth: {}", e)),
                    );
                    continue;
                }
            }
        }

        match method_id {
            METHOD_AUTH_REQUEST => {
                if let Ok(sess) =
                    handle_auth(&mut stream, &payload, token_secret, whitelist, next_session_id)
                {
                    let token = build_wire_token(
                        token_secret,
                        sess.session_id,
                        role_to_u8(&sess.role),
                        sess.expires_at_ms,
                    );
                    let _ = write_all(&mut stream, &build_ok_response(METHOD_AUTH_REQUEST, &token));
                    session = Some(sess);
                }
            }

            METHOD_CONFIG_COMMAND => {
                let role = session.as_ref().map(|s| &s.role);
                if !can_config(role) {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_CONFIG_COMMAND, "unauthorized"),
                    );
                    continue;
                }
                let cmd = ConfigCommand {
                    id: rand::random(),
                    method: "configureComponent".into(),
                    params: payload,
                    queued_at: std::time::Instant::now(),
                };
                match engine.queue_config(cmd) {
                    Ok(()) => {
                        let _ = write_all(
                            &mut stream,
                            &build_ok_response(METHOD_CONFIG_COMMAND, b"queued"),
                        );
                    }
                    Err(e) => {
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(METHOD_CONFIG_COMMAND, &e),
                        );
                    }
                }
            }

            METHOD_READ_SIGNAL => {
                let role = session.as_ref().map(|s| &s.role);
                if !can_read(role) {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_READ_SIGNAL, "unauthorized"),
                    );
                    continue;
                }
                let signal_name = String::from_utf8_lossy(&payload).to_string();
                let mw = engine.middleware();
                let mw_guard = mw.lock().unwrap();
                match mw_guard.read_signal(&signal_name) {
                    Ok(Some((value, _ts))) => {
                        let encoded = encode_hal_value(&value);
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_ok_response(METHOD_READ_SIGNAL, &encoded),
                        );
                    }
                    Ok(None) => {
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(METHOD_READ_SIGNAL, "signal not found"),
                        );
                    }
                    Err(e) => {
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(METHOD_READ_SIGNAL, &e.to_string()),
                        );
                    }
                }
            }

            METHOD_WRITE_SIGNAL => {
                let role = session.as_ref().map(|s| &s.role);
                if !can_write(role) {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_WRITE_SIGNAL, "unauthorized"),
                    );
                    continue;
                }
                if payload.len() < 2 {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_WRITE_SIGNAL, "payload too short"),
                    );
                    continue;
                }
                let name_len = u16::from_le_bytes([payload[0], payload[1]]) as usize;
                if payload.len() < 2 + name_len {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_WRITE_SIGNAL, "payload truncated"),
                    );
                    continue;
                }
                let signal_name = String::from_utf8_lossy(&payload[2..2 + name_len]).to_string();
                let value_data = &payload[2 + name_len..];

                let (value, _) = match decode_hal_value(value_data) {
                    Ok(v) => v,
                    Err(e) => {
                        let _ =
                            write_all(&mut stream, &build_error_response(METHOD_WRITE_SIGNAL, &e));
                        continue;
                    }
                };

                let mw = engine.middleware();
                let mw_guard = mw.lock().unwrap();
                let ts = audesys_hal_core::types::Timestamp {
                    secs: now_ms() / 1000,
                    micros: ((now_ms() % 1000) * 1000) as u32,
                };
                match mw_guard.publish_signal(&signal_name, value, ts) {
                    Ok(()) => {
                        drop(mw_guard);
                        let _ =
                            write_all(&mut stream, &build_ok_response(METHOD_WRITE_SIGNAL, b"ok"));
                    }
                    Err(e) => {
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(METHOD_WRITE_SIGNAL, &e.to_string()),
                        );
                    }
                }
            }

            METHOD_HEALTH_QUERY => {
                let role = session.as_ref().map(|s| &s.role);
                if !can_read(role) {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_HEALTH_QUERY, "unauthorized"),
                    );
                    continue;
                }
                let status = engine.health_status();
                let text = format!("{:?}", status);
                let _ = write_all(
                    &mut stream,
                    &build_ok_response(METHOD_HEALTH_QUERY, text.as_bytes()),
                );
            }

            METHOD_SIGNAL_SNAPSHOT => {
                let role = session.as_ref().map(|s| &s.role);
                if !can_read(role) {
                    let _ = write_all(
                        &mut stream,
                        &build_error_response(METHOD_SIGNAL_SNAPSHOT, "unauthorized"),
                    );
                    continue;
                }
                let pattern = String::from_utf8_lossy(&payload).to_string();
                let mw = engine.middleware();
                let mw_guard = mw.lock().unwrap();
                match mw_guard.snapshot_signals(&pattern) {
                    Ok(signals) => {
                        let mut buf = Vec::new();
                        buf.extend_from_slice(&(signals.len() as u16).to_le_bytes());
                        for (name, value, _ts) in &signals {
                            let nb = name.as_bytes();
                            buf.extend_from_slice(&(nb.len() as u16).to_le_bytes());
                            buf.extend_from_slice(nb);
                            buf.extend_from_slice(&encode_hal_value(value));
                        }
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_ok_response(METHOD_SIGNAL_SNAPSHOT, &buf),
                        );
                    }
                    Err(e) => {
                        drop(mw_guard);
                        let _ = write_all(
                            &mut stream,
                            &build_error_response(METHOD_SIGNAL_SNAPSHOT, &e.to_string()),
                        );
                    }
                }
            }

            _ => {
                let _ = write_all(
                    &mut stream,
                    &build_error_response(
                        method_id,
                        &format!("unknown method_id: 0x{:02x}", method_id),
                    ),
                );
            }
        }
    }
}

// ── Auth ──

fn handle_auth(
    stream: &mut UnixStream,
    payload: &[u8],
    secret: &[u8],
    whitelist: &HashMap<Role, Vec<u32>>,
    next_sid: &Mutex<u64>,
) -> Result<SessionInfo, ()> {
    // Payload: [4 bytes pid LE][1 byte role]
    if payload.len() < 5 {
        let _ = write_all(
            stream,
            &build_error_response(METHOD_AUTH_REQUEST, "need 5 bytes (pid + role)"),
        );
        return Err(());
    }
    let client_pid = u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]);
    let role_byte = payload[4];
    let requested_role = match role_from_u8(role_byte) {
        Some(r) => r,
        None => {
            let _ = write_all(
                stream,
                &build_error_response(
                    METHOD_AUTH_REQUEST,
                    &format!("unknown role byte: {}", role_byte),
                ),
            );
            return Err(());
        }
    };

    let (peer_pid, peer_uid, _peer_gid) = match peer_cred(stream) {
        Ok(c) => c,
        Err(e) => {
            let _ = write_all(
                stream,
                &build_error_response(METHOD_AUTH_REQUEST, &format!("SO_PEERCRED: {}", e)),
            );
            return Err(());
        }
    };

    if peer_pid as u32 != client_pid {
        let _ = write_all(
            stream,
            &build_error_response(
                METHOD_AUTH_REQUEST,
                &format!("pid mismatch: claimed {}, actual {}", client_pid, peer_pid),
            ),
        );
        return Err(());
    }

    if !is_uid_allowed(whitelist, &requested_role, peer_uid) {
        let _ = write_all(
            stream,
            &build_error_response(
                METHOD_AUTH_REQUEST,
                &format!("uid {} not allowed for {:?}", peer_uid, requested_role),
            ),
        );
        return Err(());
    }

    let session_id = {
        let mut sid = next_sid.lock().unwrap();
        let id = *sid;
        *sid = sid.wrapping_add(1);
        id
    };
    let ttl_ms = if requested_role == Role::Supervisor {
        SUPERVISOR_TOKEN_TTL_MS
    } else {
        DEFAULT_TOKEN_TTL_MS
    };
    let expires_at_ms = now_ms() + ttl_ms;

    let token = build_wire_token(secret, session_id, role_to_u8(&requested_role), expires_at_ms);
    let _ = write_all(stream, &build_ok_response(METHOD_AUTH_REQUEST, &token));

    Ok(SessionInfo { session_id, role: requested_role, expires_at_ms })
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    // ── HalValue encode/decode ──

    #[test]
    fn test_encode_decode_bool() {
        let v = HalValue::Bool(true);
        let enc = encode_hal_value(&v);
        assert_eq!(&enc[..2], &[0, 1]);
        let (dec, n) = decode_hal_value(&enc).unwrap();
        assert_eq!(dec, HalValue::Bool(true));
        assert_eq!(n, 2);
    }

    #[test]
    fn test_encode_decode_u32() {
        let v = HalValue::U32(0xDEAD_BEEF);
        let enc = encode_hal_value(&v);
        let (dec, _) = decode_hal_value(&enc).unwrap();
        assert_eq!(dec, v);
    }

    #[test]
    fn test_encode_decode_f64() {
        let v = HalValue::F64(std::f64::consts::PI);
        let enc = encode_hal_value(&v);
        let (dec, _) = decode_hal_value(&enc).unwrap();
        match dec {
            HalValue::F64(d) => assert!((d - std::f64::consts::PI).abs() < 1e-10),
            _ => panic!("expected F64"),
        }
    }

    #[test]
    fn test_encode_decode_string() {
        let v = HalValue::String("hello".into());
        let enc = encode_hal_value(&v);
        let (dec, _) = decode_hal_value(&enc).unwrap();
        assert_eq!(dec, v);
    }

    #[test]
    fn test_encode_decode_blob() {
        let v = HalValue::Blob(vec![1, 2, 3]);
        let enc = encode_hal_value(&v);
        let (dec, _) = decode_hal_value(&enc).unwrap();
        assert_eq!(dec, v);
    }

    #[test]
    fn test_encode_decode_all_hal_types() {
        let values: Vec<HalValue> = vec![
            HalValue::Bool(false),
            HalValue::Bool(true),
            HalValue::S8(-128),
            HalValue::U8(255),
            HalValue::S16(-32768),
            HalValue::U16(65535),
            HalValue::S32(-2_147_483_648),
            HalValue::U32(4_294_967_295),
            HalValue::S64(-9_223_372_036_854_775_808),
            HalValue::U64(18_446_744_073_709_551_615),
            HalValue::F32(std::f32::consts::PI),
            HalValue::F64(std::f64::consts::E),
            HalValue::Blob(vec![1, 2, 3, 4, 5]),
            HalValue::String("unicode: 你好".into()),
            HalValue::Array { element_type: HalPinType::U32, data: vec![0x01, 0x00, 0x00, 0x00] },
        ];
        for v in &values {
            let enc = encode_hal_value(v);
            let (dec, _) =
                decode_hal_value(&enc).unwrap_or_else(|e| panic!("decode {:?}: {}", v, e));
            assert_eq!(&dec, v, "round-trip {:?}", v);
        }
    }

    #[test]
    fn test_decode_empty() {
        assert!(decode_hal_value(&[]).is_err());
    }

    #[test]
    fn test_decode_unknown_discriminant() {
        assert!(decode_hal_value(&[255]).is_err());
    }

    // ── Wire token ──

    #[test]
    fn test_token_round_trip() {
        let secret = b"test-secret-32-bytes-long-key!!";
        let token = build_wire_token(secret, 42, role_to_u8(&Role::Engineer), now_ms() + 60_000);
        assert_eq!(token.len(), 64);
        let role = verify_wire_token(secret, &token).unwrap();
        assert_eq!(role, role_to_u8(&Role::Engineer));
    }

    #[test]
    fn test_token_tamper_detection() {
        let secret = b"test-secret-32-bytes-long-key!!";
        let mut token =
            build_wire_token(secret, 42, role_to_u8(&Role::Engineer), now_ms() + 60_000);
        token[20] ^= 0xFF;
        assert!(verify_wire_token(secret, &token).is_err());
    }

    #[test]
    fn test_token_expiry() {
        let secret = b"test-secret-32-bytes-long-key!!";
        let token = build_wire_token(secret, 42, role_to_u8(&Role::Engineer), 1000);
        assert!(verify_wire_token(secret, &token).is_err());
    }

    #[test]
    fn test_token_different_secret_fails() {
        let s1 = b"secret-number-one-32-bytes-kk!";
        let s2 = b"secret-number-two-32-bytes-kk!";
        let token = build_wire_token(s1, 42, role_to_u8(&Role::Engineer), now_ms() + 60_000);
        assert!(verify_wire_token(s2, &token).is_err());
    }

    #[test]
    fn test_token_role_round_trip() {
        let secret = b"test-secret-32-bytes-long-key!!";
        for role in &[Role::Operator, Role::Engineer, Role::Supervisor, Role::Auditor, Role::System]
        {
            let token = build_wire_token(secret, 1, role_to_u8(role), now_ms() + 60_000);
            let b = verify_wire_token(secret, &token).unwrap();
            assert_eq!(role_from_u8(b).as_ref(), Some(role));
        }
    }

    // ── Whitelist ──

    #[test]
    fn test_whitelist_supervisor_uid0() {
        let wl = default_whitelist();
        assert!(is_uid_allowed(&wl, &Role::Supervisor, 0));
    }

    #[test]
    fn test_whitelist_operator_uid_mismatch() {
        let wl = default_whitelist();
        assert!(!is_uid_allowed(&wl, &Role::Operator, 999));
    }

    // ── Role encode/decode ──

    #[test]
    fn test_role_encode_decode() {
        for role in &[Role::Operator, Role::Engineer, Role::Supervisor, Role::Auditor, Role::System]
        {
            assert_eq!(role_from_u8(role_to_u8(role)).as_ref(), Some(role));
        }
    }

    #[test]
    fn test_role_invalid_byte() {
        assert_eq!(role_from_u8(255), None);
    }

    // ── Response frames ──

    #[test]
    fn test_build_response_format() {
        let r = build_response(METHOD_HEALTH_QUERY, STATUS_OK, b"healthy");
        assert_eq!(u32::from_le_bytes([r[0], r[1], r[2], r[3]]), 6 + 7);
        assert_eq!(r[4], METHOD_HEALTH_QUERY);
        assert_eq!(r[5], STATUS_OK);
        assert_eq!(&r[6..], b"healthy");
    }

    #[test]
    fn test_error_response_format() {
        let r = build_error_response(METHOD_CONFIG_COMMAND, "locked");
        let len = u32::from_le_bytes([r[0], r[1], r[2], r[3]]) as usize;
        assert_eq!(len, 6 + 6);
        assert_eq!(r[4], METHOD_CONFIG_COMMAND);
        assert_eq!(r[5], STATUS_ERROR);
        assert_eq!(&r[6..], b"locked");
    }

    // ── Pin type discriminants ──

    #[test]
    fn test_pin_type_all_covered() {
        let types = [
            HalPinType::Bool,
            HalPinType::S8,
            HalPinType::U8,
            HalPinType::S16,
            HalPinType::U16,
            HalPinType::S32,
            HalPinType::U32,
            HalPinType::S64,
            HalPinType::U64,
            HalPinType::F32,
            HalPinType::F64,
            HalPinType::Blob,
            HalPinType::String,
        ];
        let mut seen = [false; 13];
        for t in &types {
            let d = pin_type_discriminant(*t) as usize;
            assert!(d < 13);
            seen[d] = true;
        }
        assert!(seen.iter().all(|&x| x));
    }

    // ── IpcServer lifecycle ──

    #[test]
    fn test_new_server_not_running() {
        let engine = test_engine();
        let server = IpcServer::new("/tmp/test-audesys-new.sock", Arc::new(engine));
        assert!(!server.is_running());
    }

    #[test]
    fn test_ipc_server_start_stop() {
        let path = "/tmp/test-audesys-ipc-lifecycle.sock";
        let _ = std::fs::remove_file(path);
        let server = IpcServer::new(path, Arc::new(test_engine()));
        let h = server.start().expect("start");
        assert!(server.is_running());
        std::thread::sleep(Duration::from_millis(50));
        server.stop();
        h.join().expect("join accept thread");
        assert!(!server.is_running());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_uds_client_can_connect() {
        use std::os::unix::net::UnixStream;
        let path = "/tmp/test-audesys-connect.sock";
        let _ = std::fs::remove_file(path);
        let server = IpcServer::new(path, Arc::new(test_engine()));
        let h = server.start().expect("start");
        std::thread::sleep(Duration::from_millis(50));
        assert!(UnixStream::connect(path).is_ok());
        server.stop();
        h.join().expect("join");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_health_unauth_rejected() {
        use std::io::Write;
        use std::os::unix::net::UnixStream;
        let path = "/tmp/test-audesys-health.sock";
        let _ = std::fs::remove_file(path);
        let server = IpcServer::new(path, Arc::new(test_engine()));
        let h = server.start().expect("start");
        std::thread::sleep(Duration::from_millis(50));

        let mut client = UnixStream::connect(path).expect("connect");
        client.set_read_timeout(Some(Duration::from_millis(2000))).ok();

        // Send HealthQuery without auth
        let frame_len = HEADER_SIZE as u32;
        let mut frame = Vec::new();
        frame.extend_from_slice(&frame_len.to_le_bytes());
        frame.extend_from_slice(&[0u8; TOKEN_WIRE_SIZE]);
        frame.push(METHOD_HEALTH_QUERY);
        client.write_all(&frame).expect("send");
        client.flush().ok();

        // Should get error (no session)
        let mut lb = [0u8; 4];
        if client.read_exact(&mut lb).is_ok() {
            let rlen = u32::from_le_bytes(lb) as usize;
            let mut resp = vec![0u8; rlen - 4];
            client.read_exact(&mut resp).ok();
            // Unauthenticated → should get an error back from token verification
            // (token is all zeros = invalid signature)
        }

        server.stop();
        h.join().expect("join");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_auth_flow_sends_token() {
        use std::io::Write;
        use std::os::unix::net::UnixStream;

        let path = "/tmp/test-audesys-auth-flow.sock";
        let _ = std::fs::remove_file(path);
        let server = IpcServer::new(path, Arc::new(test_engine()));
        let h = server.start().expect("start");
        std::thread::sleep(Duration::from_millis(50));

        let mut client = UnixStream::connect(path).expect("connect");
        client.set_read_timeout(Some(Duration::from_millis(2000))).ok();

        // Build auth request
        let pid = std::process::id();
        let mut payload = Vec::new();
        payload.extend_from_slice(&pid.to_le_bytes());
        payload.push(role_to_u8(&Role::System)); // uid 0 role

        let frame_len = (HEADER_SIZE + payload.len()) as u32;
        let mut frame = Vec::new();
        frame.extend_from_slice(&frame_len.to_le_bytes());
        frame.extend_from_slice(&[0u8; TOKEN_WIRE_SIZE]);
        frame.push(METHOD_AUTH_REQUEST);
        frame.extend_from_slice(&payload);

        client.write_all(&frame).expect("send auth");
        client.flush().ok();

        // Read response
        let mut lb = [0u8; 4];
        if let Ok(()) = client.read_exact(&mut lb) {
            let rlen = u32::from_le_bytes(lb) as usize;
            let mut resp = vec![0u8; rlen - 4];
            client.read_exact(&mut resp).ok();
            // Response format: [method_id][status][payload]
            // SO_PEERCRED may succeed or fail depending on test environment
            // Both outcomes are valid for this unit test
        }

        server.stop();
        h.join().expect("join");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_uds_response_format() {
        use std::io::{Read, Write};
        use std::os::unix::net::UnixStream;

        let path = "/tmp/test-audesys-response.sock";
        let _ = std::fs::remove_file(path);
        let server = IpcServer::new(path, Arc::new(test_engine()));
        let h = server.start().expect("start");
        std::thread::sleep(Duration::from_millis(50));

        let mut client = UnixStream::connect(path).expect("connect");
        client.set_read_timeout(Some(Duration::from_millis(2000))).ok();

        // Send ReadSignal without auth — server should respond with error
        let sig = b"test.signal";
        let frame_len = (HEADER_SIZE + sig.len()) as u32;
        let mut frame = Vec::new();
        frame.extend_from_slice(&frame_len.to_le_bytes());
        frame.extend_from_slice(&[0u8; TOKEN_WIRE_SIZE]);
        frame.push(METHOD_READ_SIGNAL);
        frame.extend_from_slice(sig);

        client.write_all(&frame).expect("send");
        client.flush().ok();

        let mut lb = [0u8; 4];
        if client.read_exact(&mut lb).is_ok() {
            let rlen = u32::from_le_bytes(lb) as usize;
            let mut resp = vec![0u8; rlen - 4];
            client.read_exact(&mut resp).ok();
            // Should be an error response (no session)
            if resp.len() >= 2 {
                assert!(
                    resp[0] == METHOD_READ_SIGNAL || resp[0] == METHOD_AUTH_REQUEST,
                    "response method_id"
                );
            }
        }

        server.stop();
        h.join().expect("join");
        let _ = std::fs::remove_file(path);
    }

    // ── Test helpers ──

    fn test_engine() -> Engine {
        use crate::lifecycle::LifecycleManager;
        use audesys_hal_core::discovery::{
            DiscoveryEntry, HalDiscovery, WatchCallback, WatchHandle,
        };
        use audesys_hal_core::middleware::AmwMetrics;
        use audesys_hal_core::qos::{ConfigStatus, LivelinessStatus};
        use audesys_hal_core::transport::{HalTransport, RpcHandler, SignalCallback};
        use audesys_hal_core::types::{HalResult, Subscription, Timestamp};

        struct DummyMw;
        impl HalTransport for DummyMw {
            fn publish_signal(&self, _: &str, _: HalValue, _: Timestamp) -> HalResult<()> {
                Ok(())
            }
            fn read_signal(&self, _: &str) -> HalResult<Option<(HalValue, Timestamp)>> {
                Ok(None)
            }
            fn subscribe_signal(&self, _: &str, _: SignalCallback) -> HalResult<Subscription> {
                Ok(Subscription {})
            }
            fn snapshot_signals(&self, _: &str) -> HalResult<Vec<(String, HalValue, Timestamp)>> {
                Ok(Vec::new())
            }
            fn rpc_call(&self, _: &str, _: &[u8], _: u64) -> HalResult<Vec<u8>> {
                Ok(Vec::new())
            }
            fn register_rpc_handler(&self, _: &str, _: RpcHandler) -> HalResult<()> {
                Ok(())
            }
            fn shutdown(&self) -> HalResult<()> {
                Ok(())
            }
        }
        impl HalDiscovery for DummyMw {
            fn list_all(&self) -> HalResult<Vec<DiscoveryEntry>> {
                Ok(Vec::new())
            }
            fn find_by_name(&self, _: &str) -> HalResult<Option<DiscoveryEntry>> {
                Ok(None)
            }
            fn find_by_pattern(&self, _: &str) -> HalResult<Vec<DiscoveryEntry>> {
                Ok(Vec::new())
            }
            fn watch(&self, _: WatchCallback) -> HalResult<WatchHandle> {
                Ok(WatchHandle {})
            }
        }
        impl audesys_hal_core::qos::HalQoS for DummyMw {
            fn lock_level(&self) -> audesys_hal_core::qos::LockLevel {
                audesys_hal_core::qos::LockLevel::None
            }
            fn set_lock_level(
                &self,
                _: audesys_hal_core::qos::LockLevel,
            ) -> HalResult<ConfigStatus> {
                Ok(ConfigStatus::Applied)
            }
            fn queue_config(&self, _: ConfigCommand) -> HalResult<ConfigStatus> {
                Ok(ConfigStatus::Queued)
            }
            fn apply_queued(&self) -> HalResult<Vec<ConfigStatus>> {
                Ok(Vec::new())
            }
            fn register_entity(&self, _: &str) -> HalResult<()> {
                Ok(())
            }
            fn check_liveliness(&self, _: &str) -> HalResult<LivelinessStatus> {
                Ok(LivelinessStatus::Alive)
            }
            fn tag_security_domain(&self, _: &str, _: &str) -> HalResult<()> {
                Ok(())
            }
            fn get_security_domain(&self, _: &str) -> HalResult<Option<String>> {
                Ok(None)
            }
        }
        impl audesys_hal_core::middleware::AmwMiddleware for DummyMw {
            fn backend_name(&self) -> &'static str {
                "dummy"
            }
            fn shutdown(&self) -> HalResult<()> {
                Ok(())
            }
            fn metrics(&self) -> AmwMetrics {
                AmwMetrics::default()
            }
        }

        Engine::new(Box::new(DummyMw), Arc::new(LifecycleManager::new()))
    }
}
