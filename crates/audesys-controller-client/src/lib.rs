//! AUDESYS Controller IPC client — synchronous UDS client for the Controller wire protocol.
//!
//! # Wire Protocol (matches `crates/audesys-controller/src/ipc.rs`)
//! - Request: `[4B total_len LE][64B token][1B method_id][N bytes payload]`
//! - Response: `[4B total_len LE][1B method_id][1B status][N bytes payload]`
//! - STATUS_OK = 0, STATUS_ERROR = 1
//!
//! # Usage
//! ```ignore
//! let mut client = ControllerClient::connect("/tmp/audeys-controller.sock", secret)?;
//! client.authenticate(Role::Engineer)?;
//! let val = client.read_signal("counter.value")?;
//! ```

use audesys_hal_core::types::HalPinType;
use audesys_hal_core::value::HalValue;
use audesys_runtime_common::types::Role;
use std::io::{self, Read, Write};
use std::os::unix::net::UnixStream;
use std::sync::atomic::{AtomicBool, Ordering};

// ── Wire constants (mirrors ipc.rs) ──

const TOKEN_WIRE_SIZE: usize = 64;
const HEADER_SIZE: usize = 4 + TOKEN_WIRE_SIZE + 1; // 69

const METHOD_AUTH_REQUEST: u8 = 0x01;
const METHOD_CONFIG_COMMAND: u8 = 0x02;
const METHOD_READ_SIGNAL: u8 = 0x03;
const METHOD_WRITE_SIGNAL: u8 = 0x04;
const METHOD_HEALTH_QUERY: u8 = 0x05;
const METHOD_SIGNAL_SNAPSHOT: u8 = 0x06;
const METHOD_LOAD_PROGRAM: u8 = 0x07;
const METHOD_LOAD_HAL_CONFIG: u8 = 0x08;
const METHOD_PAUSE: u8 = 0x09;
const METHOD_RESUME: u8 = 0x0A;
const METHOD_STEP_CYCLE: u8 = 0x0B;
const METHOD_SET_BREAKPOINT: u8 = 0x0C;
const METHOD_CLEAR_BREAKPOINT: u8 = 0x0D;
const METHOD_LIST_BREAKPOINTS: u8 = 0x0E;
const METHOD_READ_REGISTERS: u8 = 0x0F;
const METHOD_DEBUG_STATE: u8 = 0x10;
const METHOD_PREPARE_SWAP: u8 = 0x11;
const METHOD_COMMIT_SWAP: u8 = 0x12;
const METHOD_ROLLBACK_SWAP: u8 = 0x13;

const STATUS_OK: u8 = 0x00;
#[allow(dead_code)]
const STATUS_ERROR: u8 = 0x01;

// ── Role encode (mirrors ipc.rs) ──

fn role_to_u8(role: &Role) -> u8 {
    match role {
        Role::Operator => 0,
        Role::Engineer => 1,
        Role::Supervisor => 2,
        Role::Auditor => 3,
        Role::System => 4,
    }
}

// ponytail: HalValue binary encode/decode duplicated from ipc.rs.
// Move to a shared crate (audesys-hal-wire or FlatBuffers) when
// there are 3+ consumers of this code.

// ── Pin type discriminants (mirrors ipc.rs) ──

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

// ── HalValue binary encode/decode (mirrors ipc.rs) ──

/// ponytail: simple binary HalValue encoder. Add FlatBuffers when cross-language IPC needed.
fn encode_hal_value(value: &HalValue) -> Vec<u8> {
    let mut buf = Vec::new();
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

// ── ControllerClient ──

/// Synchronous IPC client for the AUDESYS Controller's Unix Domain Socket protocol.
///
/// # Lifecycle
/// 1. [`ControllerClient::connect`] — opens UDS connection
/// 2. [`ControllerClient::authenticate`] — sends auth request, caches session token
/// 3. Call RPC methods as needed
///
/// The session token is automatically included in every request frame after
/// successful authentication. Re-authentication is not required unless the
/// connection is dropped and re-established.
pub struct ControllerClient {
    stream: UnixStream,
    #[allow(dead_code)]
    hmac_secret: Vec<u8>,
    session_token: Option<Vec<u8>>,
    has_token: AtomicBool,
}

impl ControllerClient {
    /// Open a UDS connection to the Controller at `socket_path`.
    ///
    /// `hmac_secret` is the shared secret used by the server for token signing.
    /// This must match the server's randomly-generated secret. In production,
    /// the secret is exchanged out-of-band (file, env var, or Supervisor mediation).
    pub fn connect(socket_path: &str, hmac_secret: &[u8]) -> io::Result<Self> {
        let stream = UnixStream::connect(socket_path)?;
        stream.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;
        Ok(Self {
            stream,
            hmac_secret: hmac_secret.to_vec(),
            session_token: None,
            has_token: AtomicBool::new(false),
        })
    }

    /// Authenticate with the Controller, requesting the given role.
    ///
    /// Sends an `AUTH_REQUEST` frame with zeroed token + `[4B pid LE][1B role]` payload.
    /// On success, the server returns a 64-byte session token which is cached for
    /// all subsequent requests on this connection.
    pub fn authenticate(&mut self, role: Role) -> Result<(), String> {
        let pid = std::process::id();
        let mut payload = Vec::with_capacity(5);
        payload.extend_from_slice(&pid.to_le_bytes());
        payload.push(role_to_u8(&role));

        // Auth uses zeroed token field
        let frame = build_request(&[0u8; TOKEN_WIRE_SIZE], METHOD_AUTH_REQUEST, &payload);
        write_all(&mut self.stream, &frame).map_err(|e| format!("auth send: {}", e))?;

        let (method_id, status, resp_payload) =
            read_response(&mut self.stream).map_err(|e| format!("auth recv: {}", e))?;

        if method_id != METHOD_AUTH_REQUEST || status != STATUS_OK {
            let msg = String::from_utf8_lossy(&resp_payload);
            return Err(format!("auth rejected: {}", msg));
        }

        if resp_payload.len() < TOKEN_WIRE_SIZE {
            return Err(format!("auth token too short: {} bytes", resp_payload.len()));
        }

        self.session_token = Some(resp_payload[..TOKEN_WIRE_SIZE].to_vec());
        self.has_token.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// Check whether a session token has been cached.
    pub fn is_authenticated(&self) -> bool {
        self.has_token.load(Ordering::SeqCst)
    }

    // ── RPC methods ──

    /// Load an IEC 61131-3 program (raw ST bytecode / IR).
    ///
    /// Sends the raw program bytes to the Controller. Returns the server response text.
    pub fn load_program(&mut self, bytes: &[u8]) -> Result<String, String> {
        let resp = self.send_request(METHOD_LOAD_PROGRAM, bytes)?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Load a HAL configuration (YAML bytes).
    ///
    /// Sends the YAML configuration bytes to the Controller. Returns the server response text.
    pub fn load_hal_config(&mut self, yaml: &[u8]) -> Result<String, String> {
        let resp = self.send_request(METHOD_LOAD_HAL_CONFIG, yaml)?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Read a signal value by name.
    ///
    /// Sends the signal name as raw bytes. The server responds with the encoded HalValue.
    pub fn read_signal(&mut self, name: &str) -> Result<HalValue, String> {
        let resp = self.send_request(METHOD_READ_SIGNAL, name.as_bytes())?;
        let (value, _) = decode_hal_value(&resp)?;
        Ok(value)
    }

    /// Write a value to a named signal.
    ///
    /// Encodes `[2B name_len LE][name bytes][encoded HalValue]` as the payload.
    pub fn write_signal(&mut self, name: &str, value: &HalValue) -> Result<(), String> {
        let name_bytes = name.as_bytes();
        let value_bytes = encode_hal_value(value);
        let mut payload = Vec::with_capacity(2 + name_bytes.len() + value_bytes.len());
        payload.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        payload.extend_from_slice(name_bytes);
        payload.extend_from_slice(&value_bytes);
        self.send_request(METHOD_WRITE_SIGNAL, &payload)?;
        Ok(())
    }

    /// Query the Controller's health status.
    ///
    /// Returns the health status text from the server (e.g. `"Healthy"`).
    pub fn health_query(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_HEALTH_QUERY, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Take a snapshot of signals matching a wildcard pattern.
    ///
    /// The response is decoded as: `[2B count LE]` followed by repeated
    /// `[2B name_len LE][name bytes][encoded HalValue]` entries.
    pub fn signal_snapshot(&mut self, pattern: &str) -> Result<Vec<(String, HalValue)>, String> {
        let resp = self.send_request(METHOD_SIGNAL_SNAPSHOT, pattern.as_bytes())?;
        decode_snapshot_response(&resp)
    }

    /// Send an arbitrary configuration command (raw bytes).
    ///
    /// Returns the server response text.
    pub fn config_command(&mut self, cmd_bytes: &[u8]) -> Result<String, String> {
        let resp = self.send_request(METHOD_CONFIG_COMMAND, cmd_bytes)?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    // ── Debug control ──

    /// Pause the engine (stops cycle execution).
    pub fn pause(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_PAUSE, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Resume the engine from paused state.
    pub fn resume(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_RESUME, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Single-step one cycle from paused state.
    pub fn step_cycle(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_STEP_CYCLE, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Set a breakpoint at the given instruction pointer.
    pub fn set_breakpoint(&mut self, ip: u32) -> Result<String, String> {
        let resp = self.send_request(METHOD_SET_BREAKPOINT, &ip.to_be_bytes())?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Clear a breakpoint at the given instruction pointer.
    pub fn clear_breakpoint(&mut self, ip: u32) -> Result<String, String> {
        let resp = self.send_request(METHOD_CLEAR_BREAKPOINT, &ip.to_be_bytes())?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// List all active breakpoints. Returns comma-separated IP addresses.
    pub fn list_breakpoints(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_LIST_BREAKPOINTS, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Read a VM register value. Returns e.g. "r0=42".
    pub fn read_register(&mut self, reg_idx: u8) -> Result<String, String> {
        let resp = self.send_request(METHOD_READ_REGISTERS, &[reg_idx])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Get full debug state as JSON.
    pub fn debug_state(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_DEBUG_STATE, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    // ── Hot-swap ──

    /// Prepare a hot-swap program for deployment at cycle boundary.
    pub fn prepare_swap(&mut self, program_bytes: &[u8]) -> Result<String, String> {
        let resp = self.send_request(METHOD_PREPARE_SWAP, program_bytes)?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Commit the prepared swap. Applied at the next cycle boundary.
    pub fn commit_swap(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_COMMIT_SWAP, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    /// Rollback: discard the pending swap.
    pub fn rollback_swap(&mut self) -> Result<String, String> {
        let resp = self.send_request(METHOD_ROLLBACK_SWAP, &[])?;
        String::from_utf8(resp).map_err(|e| format!("utf8: {}", e))
    }

    // ── Internal helpers ──

    /// Build a wire request frame, send it, read the response, and check status.
    fn send_request(&mut self, method_id: u8, payload: &[u8]) -> Result<Vec<u8>, String> {
        let token = self.session_token.as_deref().unwrap_or(&[0u8; TOKEN_WIRE_SIZE]);
        let frame = build_request(token, method_id, payload);
        write_all(&mut self.stream, &frame).map_err(|e| format!("send {}: {}", method_id, e))?;
        let (_, _, payload) = read_response(&mut self.stream)?;
        Ok(payload)
    }
}

// ── Wire frame constructors ──

fn build_request(token: &[u8], method_id: u8, payload: &[u8]) -> Vec<u8> {
    let total_len = HEADER_SIZE as u32 + payload.len() as u32;
    let mut buf = Vec::with_capacity(total_len as usize);
    buf.extend_from_slice(&total_len.to_le_bytes());
    if token.len() >= TOKEN_WIRE_SIZE {
        buf.extend_from_slice(&token[..TOKEN_WIRE_SIZE]);
    } else {
        let mut padded = [0u8; TOKEN_WIRE_SIZE];
        padded[..token.len()].copy_from_slice(token);
        buf.extend_from_slice(&padded);
    }
    buf.push(method_id);
    buf.extend_from_slice(payload);
    buf
}

fn write_all(stream: &mut UnixStream, data: &[u8]) -> io::Result<()> {
    stream.write_all(data)?;
    stream.flush()
}

fn read_exact(stream: &mut UnixStream, n: usize) -> io::Result<Vec<u8>> {
    let mut buf = vec![0u8; n];
    stream.read_exact(&mut buf)?;
    Ok(buf)
}

/// Read a response frame: returns (method_id, status, payload).
fn read_response(stream: &mut UnixStream) -> Result<(u8, u8, Vec<u8>), String> {
    let len_bytes = read_exact(stream, 4).map_err(|e| format!("read length: {}", e))?;
    let frame_len =
        u32::from_le_bytes([len_bytes[0], len_bytes[1], len_bytes[2], len_bytes[3]]) as usize;

    // Response header: 4 (length) + 1 (method_id) + 1 (status) = 6 bytes
    if frame_len < 6 {
        return Err(format!("response frame too short: {}", frame_len));
    }
    let payload_len = frame_len - 6;

    let method_id = read_exact(stream, 1).map_err(|e| format!("read method_id: {}", e))?[0];
    let status = read_exact(stream, 1).map_err(|e| format!("read status: {}", e))?[0];
    let payload = if payload_len > 0 {
        read_exact(stream, payload_len).map_err(|e| format!("read payload: {}", e))?
    } else {
        Vec::new()
    };

    if status != STATUS_OK {
        let msg = String::from_utf8_lossy(&payload);
        return Err(format!("server error (method={:#04x}): {}", method_id, msg));
    }

    Ok((method_id, status, payload))
}

/// Decode a snapshot response: `[2B count LE]` repeated `[2B name_len LE][name][encoded HalValue]`.
fn decode_snapshot_response(data: &[u8]) -> Result<Vec<(String, HalValue)>, String> {
    if data.len() < 2 {
        return Err("snapshot response too short".into());
    }
    let count = u16::from_le_bytes([data[0], data[1]]) as usize;
    let mut results = Vec::with_capacity(count);
    let mut offset = 2usize;

    for _ in 0..count {
        if offset + 2 > data.len() {
            return Err("snapshot: truncated name_len".into());
        }
        let name_len = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
        offset += 2;
        if offset + name_len > data.len() {
            return Err("snapshot: truncated name".into());
        }
        let name = String::from_utf8_lossy(&data[offset..offset + name_len]).to_string();
        offset += name_len;
        let (value, consumed) = decode_hal_value(&data[offset..])?;
        offset += consumed;
        results.push((name, value));
    }

    Ok(results)
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

    // ── Auth request frame ──

    #[test]
    fn test_build_auth_request() {
        // Auth uses zeroed token
        let pid = 12345u32;
        let mut payload = Vec::with_capacity(5);
        payload.extend_from_slice(&pid.to_le_bytes());
        payload.push(role_to_u8(&Role::Engineer)); // 1

        let frame = build_request(&[0u8; TOKEN_WIRE_SIZE], METHOD_AUTH_REQUEST, &payload);

        // Verify total_len (4 bytes LE)
        let total_len = u32::from_le_bytes([frame[0], frame[1], frame[2], frame[3]]) as usize;
        assert_eq!(total_len, HEADER_SIZE + payload.len());

        // Token field: 64 zero bytes
        assert_eq!(&frame[4..68], &[0u8; TOKEN_WIRE_SIZE]);

        // Method ID
        assert_eq!(frame[68], METHOD_AUTH_REQUEST);

        // Payload: pid (LE) + role
        let payload_pid = u32::from_le_bytes([frame[69], frame[70], frame[71], frame[72]]);
        assert_eq!(payload_pid, pid);
        assert_eq!(frame[73], 1); // Engineer = 1
    }

    // ── Snapshot decode ──

    #[test]
    fn test_decode_snapshot_single() {
        let mut buf = Vec::new();
        // count = 1
        buf.extend_from_slice(&1u16.to_le_bytes());
        // name = "test.sig" (8 bytes)
        let name = b"test.sig";
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);
        // value = U32(42)
        let val = encode_hal_value(&HalValue::U32(42));
        buf.extend_from_slice(&val);

        let result = decode_snapshot_response(&buf).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, "test.sig");
        assert_eq!(result[0].1, HalValue::U32(42));
    }

    #[test]
    fn test_decode_snapshot_empty() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&0u16.to_le_bytes());
        let result = decode_snapshot_response(&buf).unwrap();
        assert!(result.is_empty());
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
}
