//! Safe HART serial transport client.
//!
//! Wraps RS-485 serial I/O and the [`hart_protocol`] codec in a
//! high-level API for HART command dispatch and response parsing.

use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;

use hart_protocol::consts::MIN_PREAMBLE_COUNT;
use hart_protocol::consts::commands::{
    READ_DEVICE_ID, READ_DYNAMIC_VARS, READ_LOOP_CURRENT_PERCENT, READ_PRIMARY_VARIABLE,
};
use hart_protocol::decode::{Decoder, RawFrame};
use hart_protocol::encode::encode_frame;
use hart_protocol::types::{Address, FrameType, MasterRole};

use crate::error::HartError;

// ── response type ───────────────────────────────────────────────────────

/// Parsed HART response with status bytes.
pub struct HartResponse {
    /// First response status byte (communication errors).
    pub status_byte0: u8,
    /// Second response status byte (field device status).
    pub status_byte1: u8,
    /// Command-specific response data (after the 2 status bytes).
    pub data: Vec<u8>,
}

// ── client ─────────────────────────────────────────────────────────────

/// Safe HART device client over RS-485 serial.
///
/// Manages the serial port lifecycle and provides typed command
/// methods using the [`hart_protocol`] codec.
pub struct HartClient {
    port: Mutex<Box<dyn serialport::SerialPort>>,
    address: Address,
}

// SAFETY: Mutex provides thread safety for the serial port handle.
// Serial ports on Unix are inherently Send-safe.
unsafe impl Send for HartClient {}

impl HartClient {
    /// Open a HART device on the given serial port.
    ///
    /// Configures the port for HART Bell 202 FSK: 1200 baud, 8 data bits,
    /// 1 stop bit, odd parity.  Sets a 1-second read timeout.
    pub fn new(device: &str, poll_address: u8) -> Result<Self, HartError> {
        let settings = serialport::SerialPortSettings {
            baud_rate: serialport::BaudRate::Baud1200,
            data_bits: serialport::DataBits::Eight,
            flow_control: serialport::FlowControl::None,
            parity: serialport::Parity::Odd,
            stop_bits: serialport::StopBits::One,
            timeout: Duration::from_secs(1),
        };
        let port = serialport::open_with_settings(device, &settings)
            .map_err(|e| HartError::Connection(format!("failed to open {device}: {e}")))?;

        // HART 5 uses short addressing (1 byte on wire)
        let address = Address::Short { master: MasterRole::Primary, burst: false, poll_address };

        Ok(Self { port: Mutex::new(port), address })
    }

    /// Change the polling address (command 6 after re-addressing).
    pub fn set_address(&mut self, poll_address: u8) {
        self.address = Address::Short { master: MasterRole::Primary, burst: false, poll_address };
    }

    // ── command dispatch ────────────────────────────────────────────────

    /// Send a command frame and read the response.
    fn send_command(&mut self, command: u8, data: &[u8]) -> Result<HartResponse, HartError> {
        let mut tx_buf = [0u8; 297];

        let n = encode_frame(
            FrameType::Request,
            &self.address,
            command,
            data,
            MIN_PREAMBLE_COUNT,
            &mut tx_buf,
        )
        .map_err(|e| HartError::Protocol(format!("frame encode failed: {e:?}")))?;

        // flush any stale bytes before sending
        self.drain_rx().map_err(|e| HartError::Io(format!("drain failed: {e}")))?;

        let mut port = self.port.lock().unwrap();
        port.write_all(&tx_buf[..n]).map_err(|e| HartError::Io(format!("write failed: {e}")))?;
        port.flush().map_err(|e| HartError::Io(format!("flush failed: {e}")))?;

        // read response byte-by-byte through the decoder state machine
        drop(port); // release lock before potentially blocking in read
        let mut decoder = Decoder::new();
        let mut rx = [0u8; 1];

        loop {
            let n = self
                .port
                .lock()
                .unwrap()
                .read(&mut rx)
                .map_err(|e| HartError::Io(format!("read failed: {e}")))?;
            if n == 0 {
                return Err(HartError::Timeout("no response from device".into()));
            }

            match decoder
                .feed(rx[0])
                .map_err(|e| HartError::Protocol(format!("decode error: {e:?}")))?
            {
                Some(frame) => return parse_response(frame),
                None => continue, // need more bytes
            }
        }
    }

    /// Drain any bytes waiting in the receive buffer.
    fn drain_rx(&mut self) -> Result<(), std::io::Error> {
        let mut buf = [0u8; 64];
        let mut port = self.port.lock().unwrap();
        loop {
            let n = port.read(&mut buf)?;
            if n == 0 {
                return Ok(());
            }
        }
    }

    // ── typed commands ──────────────────────────────────────────────────

    /// Read device identification (Universal Command 0).
    pub fn read_device_id(&mut self) -> Result<HartResponse, HartError> {
        self.send_command(READ_DEVICE_ID, &[])
    }

    /// Read primary variable (Universal Command 1).
    pub fn read_pv(&mut self) -> Result<HartResponse, HartError> {
        self.send_command(READ_PRIMARY_VARIABLE, &[])
    }

    /// Read loop current and percent of range (Universal Command 2).
    pub fn read_loop_current(&mut self) -> Result<HartResponse, HartError> {
        self.send_command(READ_LOOP_CURRENT_PERCENT, &[])
    }

    /// Read dynamic variables: PV, SV, TV, QV (Universal Command 3).
    pub fn read_dynamic_vars(&mut self) -> Result<HartResponse, HartError> {
        self.send_command(READ_DYNAMIC_VARS, &[])
    }
}

// ── response parsing ───────────────────────────────────────────────────

/// Extract status bytes and command data from a raw frame.
fn parse_response(frame: RawFrame) -> Result<HartResponse, HartError> {
    if frame.frame_type != FrameType::Response {
        return Err(HartError::Protocol(format!(
            "expected response frame, got {:?}",
            frame.frame_type
        )));
    }

    let data: &[u8] = frame.data.as_ref();
    if data.len() < 2 {
        return Err(HartError::Protocol("response too short for status bytes".into()));
    }

    Ok(HartResponse { status_byte0: data[0], status_byte1: data[1], data: data[2..].to_vec() })
}

// ── tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify response parsing with mock data.
    #[test]
    fn parse_hart_response() {
        let frame = hart_protocol::decode::RawFrame {
            frame_type: FrameType::Response,
            address: Address::Short { master: MasterRole::Primary, burst: false, poll_address: 0 },
            command: 1,
            data: {
                let mut v = heapless::Vec::new();
                // status bytes: 0x00 (no comm error), 0x00 (no device status)
                let _ = v.push(0x00);
                let _ = v.push(0x00);
                // Command 1 response data: unit code 57 (mA) + 4.0 as f32 BE
                let _ = v.push(0x39); // unit code 57 = mA
                let _ = v.push(0x40); // 4.0f32 = 0x40800000
                let _ = v.push(0x80);
                let _ = v.push(0x00);
                let _ = v.push(0x00);
                v
            },
        };

        let resp = parse_response(frame).unwrap();
        assert_eq!(resp.status_byte0, 0x00);
        assert_eq!(resp.status_byte1, 0x00);
        assert_eq!(resp.data.len(), 5);
    }
}
