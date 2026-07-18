//! VirtualModbusTcpDevice — emulates a Modbus TCP server for simulation.
//!
//! Maps Modbus coils/registers to HAL Signals through an InprocTransport,
//! allowing Modbus-based simulation without real hardware.
//!
//! # Protocol
//! - MBAP header: [2B tid][2B proto=0][2B len][1B unit]
//! - PDU: [1B func code][N bytes data]
//! - Read response: [MBAP][1B FC][1B byte_count][data]
//! - Write response: echo request
//!
//! # Function codes
//! - 0x01 Read Coils
//! - 0x02 Read Discrete Inputs
//! - 0x03 Read Holding Registers
//! - 0x04 Read Input Registers
//! - 0x05 Write Single Coil
//! - 0x06 Write Single Register
//! - 0x0F Write Multiple Coils (ponytail: first coil only)
//! - 0x10 Write Multiple Registers (ponytail: first register only)

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use audesys_hal_core::{HalTransport, HalValue, Timestamp};

// ── Modbus constants ──

const MBAP_HEADER_LEN: usize = 7;
const MODBUS_TCP_PORT: &str = "1502";

/// Modbus exception codes
mod exception {
    pub const ILLEGAL_FUNCTION: u8 = 0x01;
    pub const ILLEGAL_DATA_ADDRESS: u8 = 0x02;
    pub const ILLEGAL_DATA_VALUE: u8 = 0x03;
}

/// A virtual Modbus TCP device that maps coils/registers to HAL signals.
///
/// Start the TCP listener via `start()`. Each incoming connection is handled
/// by reading MBAP headers, dispatching function codes, looking up register
/// mappings, and reading/writing through the bound transport.
pub struct VirtualModbusTcpDevice {
    addr: String,
    transport: Option<Arc<dyn HalTransport>>,
    coils: HashMap<u16, String>,
    holding_regs: HashMap<u16, String>,
    input_regs: HashMap<u16, String>,
    discrete_inputs: HashMap<u16, String>,
    running: Arc<AtomicBool>,
}

impl VirtualModbusTcpDevice {
    /// Create an unbound device listening on the given address.
    /// If address does not contain ':', port 1502 is appended.
    pub fn new(addr: &str) -> Self {
        let addr = if addr.contains(':') {
            addr.to_string()
        } else {
            format!("{addr}:{MODBUS_TCP_PORT}")
        };
        Self {
            addr,
            transport: None,
            coils: HashMap::new(),
            holding_regs: HashMap::new(),
            input_regs: HashMap::new(),
            discrete_inputs: HashMap::new(),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Bind to a transport. Must be called before `start()`.
    pub fn bind(&mut self, transport: Arc<dyn HalTransport>) -> &mut Self {
        self.transport = Some(transport);
        self
    }

    /// Map a coil address to a signal name.
    pub fn map_coil(&mut self, addr: u16, signal: &str) -> &mut Self {
        self.coils.insert(addr, signal.to_string());
        self
    }

    /// Map a holding register address to a signal name.
    pub fn map_holding_register(&mut self, addr: u16, signal: &str) -> &mut Self {
        self.holding_regs.insert(addr, signal.to_string());
        self
    }

    /// Map an input register address to a signal name.
    pub fn map_input_register(&mut self, addr: u16, signal: &str) -> &mut Self {
        self.input_regs.insert(addr, signal.to_string());
        self
    }

    /// Map a discrete input address to a signal name.
    pub fn map_discrete_input(&mut self, addr: u16, signal: &str) -> &mut Self {
        self.discrete_inputs.insert(addr, signal.to_string());
        self
    }

    // ── Transport helpers ──

    fn read_coil_signal(&self, addr: u16) -> Result<bool, u8> {
        let name = self.coils.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let transport = self.transport.as_ref().expect("transport not bound");
        let (val, _) = transport
            .read_signal(name)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)?
            .unwrap_or((HalValue::Bool(false), Timestamp { secs: 0, micros: 0 }));
        match val {
            HalValue::Bool(b) => Ok(b),
            HalValue::U16(v) => Ok(v != 0),
            HalValue::U32(v) => Ok(v != 0),
            _ => Ok(false), // ponytail: treat non-bool as false
        }
    }

    fn write_coil_signal(&self, addr: u16, value: bool) -> Result<(), u8> {
        let name = self.coils.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let transport = self.transport.as_ref().expect("transport not bound");
        let ts = Timestamp { secs: 0, micros: 0 };
        transport
            .publish_signal(name, HalValue::Bool(value), ts)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)
    }

    fn read_register_signal(&self, map: &HashMap<u16, String>, addr: u16) -> Result<u16, u8> {
        let name = map.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let transport = self.transport.as_ref().expect("transport not bound");
        let (val, _) = transport
            .read_signal(name)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)?
            .unwrap_or((HalValue::U16(0), Timestamp { secs: 0, micros: 0 }));
        match val {
            HalValue::U16(v) => Ok(v),
            HalValue::U32(v) => Ok(v as u16),
            HalValue::S32(v) => Ok(v as u16),
            HalValue::F32(v) => Ok(v as u16),
            HalValue::Bool(b) => Ok(if b { 1 } else { 0 }),
            _ => Ok(0), // ponytail: default register read to 0
        }
    }

    fn write_register_signal(&self, map: &HashMap<u16, String>, addr: u16, value: u16) -> Result<(), u8> {
        let name = map.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let transport = self.transport.as_ref().expect("transport not bound");
        let ts = Timestamp { secs: 0, micros: 0 };
        transport
            .publish_signal(name, HalValue::U16(value), ts)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)
    }

    // ── Frame helpers ──

    /// Build an exception response frame.
    fn exception_response(mbap: &[u8], func_code: u8, exc_code: u8) -> Vec<u8> {
        let mut resp = Vec::with_capacity(MBAP_HEADER_LEN + 2);
        resp.extend_from_slice(&mbap[..2]); // transaction ID
        resp.extend_from_slice(&[0, 0]); // protocol ID
        resp.extend_from_slice(&[0, 3]); // length = 3 (unit + fc + exc)
        resp.push(mbap[6]); // unit ID
        resp.push(func_code | 0x80); // error function code
        resp.push(exc_code);
        resp
    }

    /// Build a read response with byte_count and data.
    fn read_response(mbap: &[u8], func_code: u8, data: &[u8]) -> Vec<u8> {
        let pdu_len = 2 + data.len(); // func_code + byte_count + data
        let total_len = pdu_len + 1; // + unit ID
        let mut resp = Vec::with_capacity(MBAP_HEADER_LEN + pdu_len);
        resp.extend_from_slice(&mbap[..2]); // transaction ID
        resp.extend_from_slice(&[0, 0]); // protocol ID
        let len_hi = ((total_len >> 8) & 0xFF) as u8;
        let len_lo = (total_len & 0xFF) as u8;
        resp.extend_from_slice(&[len_hi, len_lo]);
        resp.push(mbap[6]); // unit ID
        resp.push(func_code);
        resp.push(data.len() as u8); // byte count
        resp.extend_from_slice(data);
        resp
    }

    /// Echo the request as the response (for write commands).
    fn echo_response(mbap: &[u8], func_code: u8, data: &[u8]) -> Vec<u8> {
        let pdu_len = 1 + data.len(); // func_code + data
        let total_len = pdu_len + 1; // + unit ID
        let mut resp = Vec::with_capacity(MBAP_HEADER_LEN + pdu_len);
        resp.extend_from_slice(&mbap[..2]); // transaction ID
        resp.extend_from_slice(&[0, 0]); // protocol ID
        let len_hi = ((total_len >> 8) & 0xFF) as u8;
        let len_lo = (total_len & 0xFF) as u8;
        resp.extend_from_slice(&[len_hi, len_lo]);
        resp.push(mbap[6]); // unit ID
        resp.push(func_code);
        resp.extend_from_slice(data);
        resp
    }

    // ── Request dispatch ──

    fn handle_request(&self, mbap: &[u8], pdu: &[u8]) -> Vec<u8> {
        if pdu.is_empty() {
            return Self::exception_response(mbap, 0, exception::ILLEGAL_FUNCTION);
        }

        let func_code = pdu[0];
        let data = &pdu[1..];

        match func_code {
            0x01 => self.handle_read_coils(mbap, data),
            0x02 => self.handle_read_discrete_inputs(mbap, data),
            0x03 => self.handle_read_holding_registers(mbap, data),
            0x04 => self.handle_read_input_registers(mbap, data),
            0x05 => self.handle_write_single_coil(mbap, data),
            0x06 => self.handle_write_single_register(mbap, data),
            0x0F => self.handle_write_multiple_coils(mbap, data),
            0x10 => self.handle_write_multiple_registers(mbap, data),
            _ => Self::exception_response(mbap, func_code, exception::ILLEGAL_FUNCTION),
        }
    }

    fn handle_read_coils(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return Self::exception_response(mbap, 0x01, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 2000 {
            return Self::exception_response(mbap, 0x01, exception::ILLEGAL_DATA_VALUE);
        }

        let byte_count = ((count + 7) / 8) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            match self.read_coil_signal(addr) {
                Ok(true) => {
                    let byte_idx = (i / 8) as usize;
                    let bit_idx = i % 8;
                    result[byte_idx] |= 1 << bit_idx;
                }
                Ok(false) => {}
                Err(exc) => return Self::exception_response(mbap, 0x01, exc),
            }
        }

        Self::read_response(mbap, 0x01, &result)
    }

    fn handle_read_discrete_inputs(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return Self::exception_response(mbap, 0x02, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 2000 {
            return Self::exception_response(mbap, 0x02, exception::ILLEGAL_DATA_VALUE);
        }

        let byte_count = ((count + 7) / 8) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            let name = match self.discrete_inputs.get(&addr) {
                Some(n) => n,
                None => continue, // unmapped → false
            };
            let transport = match &self.transport {
                Some(t) => t,
                None => continue,
            };
            if let Ok(Some((HalValue::Bool(true), _))) = transport.read_signal(name) {
                let byte_idx = (i / 8) as usize;
                let bit_idx = i % 8;
                result[byte_idx] |= 1 << bit_idx;
            }
        }

        Self::read_response(mbap, 0x02, &result)
    }

    fn handle_read_holding_registers(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        self.handle_read_registers(mbap, 0x03, data, &self.holding_regs)
    }

    fn handle_read_input_registers(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        self.handle_read_registers(mbap, 0x04, data, &self.input_regs)
    }

    fn handle_read_registers(
        &self,
        mbap: &[u8],
        func_code: u8,
        data: &[u8],
        map: &HashMap<u16, String>,
    ) -> Vec<u8> {
        if data.len() < 4 {
            return Self::exception_response(mbap, func_code, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 125 {
            return Self::exception_response(mbap, func_code, exception::ILLEGAL_DATA_VALUE);
        }

        let byte_count = (count * 2) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            match self.read_register_signal(map, addr) {
                Ok(val) => {
                    let idx = (i * 2) as usize;
                    result[idx] = (val >> 8) as u8;
                    result[idx + 1] = (val & 0xFF) as u8;
                }
                Err(exc) => return Self::exception_response(mbap, func_code, exc),
            }
        }

        Self::read_response(mbap, func_code, &result)
    }

    fn handle_write_single_coil(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return Self::exception_response(mbap, 0x05, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = match u16::from_be_bytes([data[2], data[3]]) {
            0xFF00 => true,
            0x0000 => false,
            _ => return Self::exception_response(mbap, 0x05, exception::ILLEGAL_DATA_VALUE),
        };

        match self.write_coil_signal(addr, value) {
            Ok(()) => Self::echo_response(mbap, 0x05, data),
            Err(exc) => Self::exception_response(mbap, 0x05, exc),
        }
    }

    fn handle_write_single_register(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return Self::exception_response(mbap, 0x06, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = u16::from_be_bytes([data[2], data[3]]);

        match self.write_register_signal(&self.holding_regs, addr, value) {
            Ok(()) => Self::echo_response(mbap, 0x06, data),
            Err(exc) => Self::exception_response(mbap, 0x06, exc),
        }
    }

    fn handle_write_multiple_coils(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 5 {
            return Self::exception_response(mbap, 0x0F, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        // ponytail: only first coil; skip count[2:4] and byte_count[5]
        if data.len() < 6 {
            return Self::exception_response(mbap, 0x0F, exception::ILLEGAL_DATA_VALUE);
        }
        let value = data[5] & 0x01; // first coil value from first byte

        match self.write_coil_signal(addr, value != 0) {
            Ok(()) => {
                // echo back addr + count (original request data[..4])
                Self::echo_response(mbap, 0x0F, &data[..4])
            }
            Err(exc) => Self::exception_response(mbap, 0x0F, exc),
        }
    }

    fn handle_write_multiple_registers(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 7 {
            return Self::exception_response(mbap, 0x10, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        // ponytail: only first register; skip count[2:4], byte_count[5], data[5:6]
        let value = u16::from_be_bytes([data[5], data[6]]);

        match self.write_register_signal(&self.holding_regs, addr, value) {
            Ok(()) => Self::echo_response(mbap, 0x10, &data[..4]),
            Err(exc) => Self::exception_response(mbap, 0x10, exc),
        }
    }

    // ── Connection handler ──

    fn handle_client(&self, mut stream: TcpStream) {
        stream
            .set_read_timeout(Some(std::time::Duration::from_millis(100)))
            .ok();

        let mut mbap_buf = vec![0u8; MBAP_HEADER_LEN];

        loop {
            if self.running.load(Ordering::Relaxed) == false {
                break;
            }

            // Read MBAP header
            match read_exact(&mut stream, &mut mbap_buf) {
                Ok(()) => {}
                Err(_) => break, // timeout or disconnect
            }

            // Parse length from MBAP header bytes [4:6]
            let pdu_len = u16::from_be_bytes([mbap_buf[4], mbap_buf[5]]) as usize;
            if pdu_len < 2 {
                // length must include unit ID + at least 1 func code byte
                let _ = stream.write_all(&[0; 0]);
                break;
            }
            let pdu_size = pdu_len - 1; // subtract unit ID from length field

            let mut pdu_buf = vec![0u8; pdu_size];
            match read_exact(&mut stream, &mut pdu_buf) {
                Ok(()) => {}
                Err(_) => break,
            }

            let response = self.handle_request(&mbap_buf, &pdu_buf);

            // Best-effort write — client may have disconnected
            let _ = stream.write_all(&response);
        }
    }

    // ── Lifecycle ──

    /// Start the TCP listener thread. Returns a JoinHandle.
    ///
    /// # Panics
    /// Panics if `bind()` was not called first.
    pub fn start(&self) -> JoinHandle<()> {
        assert!(
            self.transport.is_some(),
            "VirtualModbusTcpDevice: must call bind() before start()"
        );

        self.running.store(true, Ordering::Relaxed);

        let addr = self.addr.clone();
        let running = Arc::clone(&self.running);
        // ponytail: clone what we need for the thread — coils, regs, transport
        // All fields are owned, so we recreate a handle-like struct
        let coils = self.coils.clone();
        let holding_regs = self.holding_regs.clone();
        let input_regs = self.input_regs.clone();
        let discrete_inputs = self.discrete_inputs.clone();
        let transport = Arc::clone(self.transport.as_ref().unwrap());

        thread::spawn(move || {
            let listener = match TcpListener::bind(&addr) {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("VirtualModbusTcpDevice: bind failed: {e}");
                    return;
                }
            };
            listener
                .set_nonblocking(false)
                .expect("set_nonblocking failed");

            // Wrap in a local self-like struct for handle_client
            let device = ThreadDevice {
                transport,
                coils,
                holding_regs,
                input_regs,
                discrete_inputs,
            };

            for stream in listener.incoming() {
                if !running.load(Ordering::Relaxed) {
                    break;
                }
                match stream {
                    Ok(s) => {
                        device.handle_client(s, &running);
                    }
                    Err(_) => break,
                }
            }
        })
    }

    /// Signal the listener thread to stop. Does not join.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

impl Default for VirtualModbusTcpDevice {
    fn default() -> Self {
        Self::new("127.0.0.1:1502")
    }
}

impl Drop for VirtualModbusTcpDevice {
    fn drop(&mut self) {
        self.stop();
    }
}

// ── Thread-local device handle (avoids Arc<Self> complexity) ──

struct ThreadDevice {
    transport: Arc<dyn HalTransport>,
    coils: HashMap<u16, String>,
    holding_regs: HashMap<u16, String>,
    input_regs: HashMap<u16, String>,
    discrete_inputs: HashMap<u16, String>,
}

impl ThreadDevice {
    fn handle_client(&self, mut stream: TcpStream, running: &AtomicBool) {
        stream
            .set_read_timeout(Some(std::time::Duration::from_millis(100)))
            .ok();

        let mut mbap_buf = vec![0u8; MBAP_HEADER_LEN];

        loop {
            if !running.load(Ordering::Relaxed) {
                break;
            }

            match read_exact(&mut stream, &mut mbap_buf) {
                Ok(()) => {}
                Err(_) => break,
            }

            let pdu_len = u16::from_be_bytes([mbap_buf[4], mbap_buf[5]]) as usize;
            if pdu_len < 2 {
                break;
            }
            let pdu_size = pdu_len - 1;

            let mut pdu_buf = vec![0u8; pdu_size];
            match read_exact(&mut stream, &mut pdu_buf) {
                Ok(()) => {}
                Err(_) => break,
            }

            let response = self.handle_request(&mbap_buf, &pdu_buf);
            let _ = stream.write_all(&response);
        }
    }

    fn handle_request(&self, mbap: &[u8], pdu: &[u8]) -> Vec<u8> {
        if pdu.is_empty() {
            return exception_response(mbap, 0, exception::ILLEGAL_FUNCTION);
        }
        let fc = pdu[0];
        let data = &pdu[1..];

        match fc {
            0x01 => self.handle_read_coils(mbap, data),
            0x02 => self.handle_read_discrete_inputs(mbap, data),
            0x03 => self.handle_read_registers(mbap, 0x03, data, &self.holding_regs),
            0x04 => self.handle_read_registers(mbap, 0x04, data, &self.input_regs),
            0x05 => self.handle_write_single_coil(mbap, data),
            0x06 => self.handle_write_single_register(mbap, data),
            0x0F => self.handle_write_multiple_coils(mbap, data),
            0x10 => self.handle_write_multiple_registers(mbap, data),
            _ => exception_response(mbap, fc, exception::ILLEGAL_FUNCTION),
        }
    }

    fn read_coil_signal(&self, addr: u16) -> Result<bool, u8> {
        let name = self.coils.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let (val, _) = self
            .transport
            .read_signal(name)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)?
            .unwrap_or((HalValue::Bool(false), Timestamp { secs: 0, micros: 0 }));
        match val {
            HalValue::Bool(b) => Ok(b),
            HalValue::U16(v) => Ok(v != 0),
            HalValue::U32(v) => Ok(v != 0),
            _ => Ok(false),
        }
    }

    fn write_coil_signal(&self, addr: u16, value: bool) -> Result<(), u8> {
        let name = self.coils.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let ts = Timestamp { secs: 0, micros: 0 };
        self.transport
            .publish_signal(name, HalValue::Bool(value), ts)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)
    }

    fn read_register_signal(&self, map: &HashMap<u16, String>, addr: u16) -> Result<u16, u8> {
        let name = map.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let (val, _) = self
            .transport
            .read_signal(name)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)?
            .unwrap_or((HalValue::U16(0), Timestamp { secs: 0, micros: 0 }));
        match val {
            HalValue::U16(v) => Ok(v),
            HalValue::U32(v) => Ok(v as u16),
            HalValue::S32(v) => Ok(v as u16),
            HalValue::F32(v) => Ok(v as u16),
            HalValue::Bool(b) => Ok(if b { 1 } else { 0 }),
            _ => Ok(0),
        }
    }

    fn write_register_signal(&self, map: &HashMap<u16, String>, addr: u16, value: u16) -> Result<(), u8> {
        let name = map.get(&addr).ok_or(exception::ILLEGAL_DATA_ADDRESS)?;
        let ts = Timestamp { secs: 0, micros: 0 };
        self.transport
            .publish_signal(name, HalValue::U16(value), ts)
            .map_err(|_| exception::ILLEGAL_DATA_ADDRESS)
    }

    // ── Read handlers ──

    fn handle_read_coils(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return exception_response(mbap, 0x01, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 2000 {
            return exception_response(mbap, 0x01, exception::ILLEGAL_DATA_VALUE);
        }
        let byte_count = ((count + 7) / 8) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            match self.read_coil_signal(addr) {
                Ok(true) => {
                    let bi = (i / 8) as usize;
                    result[bi] |= 1 << (i % 8);
                }
                Ok(false) => {}
                Err(exc) => return exception_response(mbap, 0x01, exc),
            }
        }
        read_response(mbap, 0x01, &result)
    }

    fn handle_read_discrete_inputs(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return exception_response(mbap, 0x02, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 2000 {
            return exception_response(mbap, 0x02, exception::ILLEGAL_DATA_VALUE);
        }
        let byte_count = ((count + 7) / 8) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            let name = match self.discrete_inputs.get(&addr) {
                Some(n) => n,
                None => continue,
            };
            if let Ok(Some((HalValue::Bool(true), _))) = self.transport.read_signal(name) {
                let bi = (i / 8) as usize;
                result[bi] |= 1 << (i % 8);
            }
        }
        read_response(mbap, 0x02, &result)
    }

    fn handle_read_registers(
        &self,
        mbap: &[u8],
        fc: u8,
        data: &[u8],
        map: &HashMap<u16, String>,
    ) -> Vec<u8> {
        if data.len() < 4 {
            return exception_response(mbap, fc, exception::ILLEGAL_DATA_VALUE);
        }
        let start = u16::from_be_bytes([data[0], data[1]]);
        let count = u16::from_be_bytes([data[2], data[3]]);
        if count == 0 || count > 125 {
            return exception_response(mbap, fc, exception::ILLEGAL_DATA_VALUE);
        }
        let byte_count = (count * 2) as usize;
        let mut result = vec![0u8; byte_count];
        for i in 0..count {
            let addr = start + i;
            match self.read_register_signal(map, addr) {
                Ok(val) => {
                    let idx = (i * 2) as usize;
                    result[idx] = (val >> 8) as u8;
                    result[idx + 1] = (val & 0xFF) as u8;
                }
                Err(exc) => return exception_response(mbap, fc, exc),
            }
        }
        read_response(mbap, fc, &result)
    }

    // ── Write handlers ──

    fn handle_write_single_coil(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return exception_response(mbap, 0x05, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = match u16::from_be_bytes([data[2], data[3]]) {
            0xFF00 => true,
            0x0000 => false,
            _ => return exception_response(mbap, 0x05, exception::ILLEGAL_DATA_VALUE),
        };
        match self.write_coil_signal(addr, value) {
            Ok(()) => echo_response(mbap, 0x05, data),
            Err(exc) => exception_response(mbap, 0x05, exc),
        }
    }

    fn handle_write_single_register(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 4 {
            return exception_response(mbap, 0x06, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = u16::from_be_bytes([data[2], data[3]]);
        match self.write_register_signal(&self.holding_regs, addr, value) {
            Ok(()) => echo_response(mbap, 0x06, data),
            Err(exc) => exception_response(mbap, 0x06, exc),
        }
    }

    fn handle_write_multiple_coils(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 6 {
            return exception_response(mbap, 0x0F, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = data[5] & 0x01;
        match self.write_coil_signal(addr, value != 0) {
            Ok(()) => echo_response(mbap, 0x0F, &data[..4]),
            Err(exc) => exception_response(mbap, 0x0F, exc),
        }
    }

    fn handle_write_multiple_registers(&self, mbap: &[u8], data: &[u8]) -> Vec<u8> {
        if data.len() < 8 {
            return exception_response(mbap, 0x10, exception::ILLEGAL_DATA_VALUE);
        }
        let addr = u16::from_be_bytes([data[0], data[1]]);
        let value = u16::from_be_bytes([data[5], data[6]]);
        match self.write_register_signal(&self.holding_regs, addr, value) {
            Ok(()) => echo_response(mbap, 0x10, &data[..4]),
            Err(exc) => exception_response(mbap, 0x10, exc),
        }
    }
}

// ── Static helpers (no self) ──

fn read_exact(stream: &mut TcpStream, buf: &mut [u8]) -> Result<(), std::io::Error> {
    let mut offset = 0;
    while offset < buf.len() {
        match stream.read(&mut buf[offset..]) {
            Ok(0) => return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "eof")),
            Ok(n) => offset += n,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                return Err(std::io::Error::new(std::io::ErrorKind::WouldBlock, "timeout"));
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                return Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout"));
            }
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

fn exception_response(mbap: &[u8], fc: u8, exc: u8) -> Vec<u8> {
    let mut resp = Vec::with_capacity(9);
    resp.extend_from_slice(&mbap[..2]);
    resp.extend_from_slice(&[0, 0, 0, 3]);
    resp.push(mbap[6]);
    resp.push(fc | 0x80);
    resp.push(exc);
    resp
}

fn read_response(mbap: &[u8], fc: u8, data: &[u8]) -> Vec<u8> {
    let pdu_len = 2 + data.len();
    let total_len = pdu_len + 1;
    let mut resp = Vec::with_capacity(7 + pdu_len);
    resp.extend_from_slice(&mbap[..2]);
    resp.extend_from_slice(&[0, 0]);
    resp.push((total_len >> 8) as u8);
    resp.push((total_len & 0xFF) as u8);
    resp.push(mbap[6]);
    resp.push(fc);
    resp.push(data.len() as u8);
    resp.extend_from_slice(data);
    resp
}

fn echo_response(mbap: &[u8], fc: u8, data: &[u8]) -> Vec<u8> {
    let pdu_len = 1 + data.len();
    let total_len = pdu_len + 1;
    let mut resp = Vec::with_capacity(7 + pdu_len);
    resp.extend_from_slice(&mbap[..2]);
    resp.extend_from_slice(&[0, 0]);
    resp.push((total_len >> 8) as u8);
    resp.push((total_len & 0xFF) as u8);
    resp.push(mbap[6]);
    resp.push(fc);
    resp.extend_from_slice(data);
    resp
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_amw_inproc::InprocTransport;
    use std::net::TcpStream;
    use std::time::Duration;

    fn dummy_ts() -> Timestamp {
        Timestamp { secs: 0, micros: 0 }
    }

    // ── 1. Constructor ──

    #[test]
    fn test_create_device() {
        let dev = VirtualModbusTcpDevice::new("127.0.0.1:9999");
        assert_eq!(dev.addr, "127.0.0.1:9999");
        assert!(dev.transport.is_none());
        assert!(dev.coils.is_empty());
        assert!(dev.holding_regs.is_empty());
    }

    #[test]
    fn test_default_port_appended() {
        let dev = VirtualModbusTcpDevice::new("127.0.0.1");
        assert_eq!(dev.addr, "127.0.0.1:1502");
    }

    // ── 2. Mapping ──

    #[test]
    fn test_map_coil_and_register() {
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:9999");
        dev.map_coil(0, "coil.0")
            .map_coil(5, "coil.5")
            .map_holding_register(100, "reg.100")
            .map_input_register(200, "input.200")
            .map_discrete_input(50, "discrete.50");

        assert_eq!(dev.coils.get(&0).unwrap(), "coil.0");
        assert_eq!(dev.coils.get(&5).unwrap(), "coil.5");
        assert_eq!(dev.holding_regs.get(&100).unwrap(), "reg.100");
        assert_eq!(dev.input_regs.get(&200).unwrap(), "input.200");
        assert_eq!(dev.discrete_inputs.get(&50).unwrap(), "discrete.50");
        assert_eq!(dev.coils.len(), 2);
        assert_eq!(dev.holding_regs.len(), 1);
    }

    // ── 3. Transport binding ──

    #[test]
    fn test_bind_transport() {
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:9999");
        let transport = Arc::new(InprocTransport::new());
        dev.bind(transport);
        assert!(dev.transport.is_some());
    }

    // ── 4. Frame parsing / static helpers ──

    #[test]
    fn test_modbus_read_coil_request_frame() {
        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01];
        let pdu = [0x01, 0x00, 0x00, 0x00, 0x01]; // read coil 0, count=1

        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        let transport = Arc::new(InprocTransport::new());
        transport
            .publish_signal("coil.0", HalValue::Bool(true), dummy_ts())
            .unwrap();
        dev.bind(transport);
        dev.map_coil(0, "coil.0");

        let resp = dev.handle_request(&mbap, &pdu);
        // MBAP: tid=0x0001, proto=0, len=4 = unit+fc+bc+data -> 0x00 0x04
        // PDU: fc=0x01, bc=1, data=0x01
        assert_eq!(resp.len(), 10);
        assert_eq!(resp[0..2], [0x00, 0x01]); // transaction ID
        assert_eq!(resp[2..4], [0x00, 0x00]); // protocol
        assert_eq!(resp[4..6], [0x00, 0x04]); // length = 4
        assert_eq!(resp[6], 0x01); // unit ID
        assert_eq!(resp[7], 0x01); // func code
        assert_eq!(resp[8], 0x01); // byte count
        assert_eq!(resp[9], 0x01); // coil data (coil 0 = ON)
    }

    // ── 5. Write-then-read roundtrip ──

    #[test]
    fn test_modbus_write_register_roundtrip() {
        let mbap: [u8; 7] = [0x00, 0x02, 0x00, 0x00, 0x00, 0x06, 0x01];
        let write_pdu = [0x06, 0x00, 0x64, 0x00, 0x2A]; // write register 100 = 42
        let read_pdu = [0x03, 0x00, 0x64, 0x00, 0x01]; // read holding reg 100, count=1

        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        let transport = Arc::new(InprocTransport::new());
        dev.bind(transport);
        dev.map_holding_register(100, "reg.100");

        // Write
        let w_resp = dev.handle_request(&mbap, &write_pdu);
        assert_eq!(w_resp[7], 0x06); // echoed func code

        // Read
        let r_resp = dev.handle_request(&mbap, &read_pdu);
        // PDU: fc=0x03, bc=2, data=[0x00, 0x2A]
        assert_eq!(r_resp[7], 0x03);
        assert_eq!(r_resp[8], 2); // 2 bytes
        assert_eq!(r_resp[9], 0x00);
        assert_eq!(r_resp[10], 0x2A); // 42
    }

    // ── 6. Full simulation loop ──

    #[test]
    fn test_full_simulation_loop() {
        let transport = Arc::new(InprocTransport::new());
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        dev.bind(Arc::clone(&transport) as Arc<dyn HalTransport>);
        dev.map_coil(0, "motor.run")
            .map_holding_register(100, "motor.speed");

        // Set initial signal values via transport
        transport
            .publish_signal("motor.run", HalValue::Bool(true), dummy_ts())
            .unwrap();
        transport
            .publish_signal("motor.speed", HalValue::U16(1200), dummy_ts())
            .unwrap();

        // Read coil 0
        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01];
        let coil_resp = dev.handle_request(&mbap, &[0x01, 0x00, 0x00, 0x00, 0x01]);
        assert_eq!(coil_resp[9], 0x01); // coil ON

        // Read holding register 100
        let reg_resp = dev.handle_request(&mbap, &[0x03, 0x00, 0x64, 0x00, 0x01]);
        assert_eq!(reg_resp[9], 0x04); // hi byte
        assert_eq!(reg_resp[10], 0xB0); // lo byte = 0x04B0 = 1200
    }

    // ── 7. Unmapped register → exception ──

    #[test]
    fn test_unmapped_register_returns_exception() {
        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01];
        let read_pdu = [0x03, 0x00, 0xFF, 0x00, 0x01]; // holding reg 255 (unmapped)

        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        let transport = Arc::new(InprocTransport::new());
        dev.bind(transport);

        let resp = dev.handle_request(&mbap, &read_pdu);
        // Should be exception: FC=0x83, exc=0x02 (illegal data address)
        assert_eq!(resp[7], 0x83); // error function code (0x03 | 0x80)
        assert_eq!(resp[8], exception::ILLEGAL_DATA_ADDRESS);
    }

    // ── 8. Unknown function code → exception ──

    #[test]
    fn test_unknown_function_code() {
        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x01];
        let pdu = [0x99, 0x00, 0x00]; // unknown FC

        let dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        let resp = dev.handle_request(&mbap, &pdu);
        assert_eq!(resp[7], 0x99 | 0x80);
        assert_eq!(resp[8], exception::ILLEGAL_FUNCTION);
    }

    // ── 9. Multiple coils ──

    #[test]
    fn test_multiple_coils() {
        let transport = Arc::new(InprocTransport::new());
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        dev.bind(Arc::clone(&transport) as Arc<dyn HalTransport>);
        dev.map_coil(0, "coil.0")
            .map_coil(1, "coil.1")
            .map_coil(7, "coil.7")
            .map_coil(8, "coil.8");

        transport.publish_signal("coil.0", HalValue::Bool(true), dummy_ts()).unwrap();
        transport.publish_signal("coil.1", HalValue::Bool(false), dummy_ts()).unwrap();
        transport.publish_signal("coil.7", HalValue::Bool(true), dummy_ts()).unwrap();
        transport.publish_signal("coil.8", HalValue::Bool(true), dummy_ts()).unwrap();

        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01];
        // Read coils 0-1 (2 coils)
        let resp = dev.handle_request(&mbap, &[0x01, 0x00, 0x00, 0x00, 0x02]);
        assert_eq!(resp[7], 0x01); // func code OK
        assert_eq!(resp[8], 1); // 1 byte (2 coils → ceil(2/8) = 1)
        // Byte 0: coil 0=ON, coil 1=OFF → bit0=1, bit1=0 → 0x01
        assert_eq!(resp[9], 0x01);

        // Read coils 7-8 (2 coils). Modbus packs LSB-first:
        // coil 7(start+0)→bit0, coil 8(start+1)→bit1, both ON → 0b11 = 3
        let resp2 = dev.handle_request(&mbap, &[0x01, 0x00, 0x07, 0x00, 0x02]);
        assert_eq!(resp2[9], 3); // both coils ON
    }

    // ── 10. Write single coil via Modbus frame ──

    #[test]
    fn test_write_single_coil_via_frame() {
        let transport = Arc::new(InprocTransport::new());
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        dev.bind(Arc::clone(&transport) as Arc<dyn HalTransport>);
        dev.map_coil(10, "coil.10");

        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01];
        // Write coil 10 = ON (0xFF00)
        let resp = dev.handle_request(&mbap, &[0x05, 0x00, 0x0A, 0xFF, 0x00]);
        assert_eq!(resp[7], 0x05); // echo FC

        // Verify via transport
        let (val, _) = transport.read_signal("coil.10").unwrap().unwrap();
        assert_eq!(val, HalValue::Bool(true));
    }

    // ── 11. Write multiple register (first only) ──

    #[test]
    fn test_write_multiple_register_first_only() {
        let transport = Arc::new(InprocTransport::new());
        let mut dev = VirtualModbusTcpDevice::new("127.0.0.1:19999");
        dev.bind(Arc::clone(&transport) as Arc<dyn HalTransport>);
        dev.map_holding_register(200, "reg.200");

        let mbap: [u8; 7] = [0x00, 0x01, 0x00, 0x00, 0x00, 0x0B, 0x01];
        // Write multiple regs: addr=200, count=2, byte_count=4, data=0x1234, 0x5678
        let resp = dev.handle_request(
            &mbap,
            &[0x10, 0x00, 0xC8, 0x00, 0x02, 0x04, 0x12, 0x34, 0x56, 0x78],
        );
        assert_eq!(resp[7], 0x10); // echo FC

        // ponytail: only first register written
        let (val, _) = transport.read_signal("reg.200").unwrap().unwrap();
        assert_eq!(val, HalValue::U16(0x1234));
    }
}
