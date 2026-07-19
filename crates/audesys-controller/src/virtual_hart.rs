//! VirtualHARTDevice — emulates a HART field device for simulation.
//!
//! Maps HART commands to HAL Signal reads/writes through an InprocTransport,
//! allowing HART-based simulation without real hardware.
//!
//! # Protocol (simplified)
//! - No HART serial framing (preamble, delimiter, checksum) — command/response data only
//! - Response: `[status (2B)][data...]`
//! - Status OK: `[0x00, 0x00]`, Error: `[0x40, 0x00]`
//!
//! # Universal commands
//! - Cmd 0: Read Unique Identifier
//! - Cmd 1: Read Primary Variable (slot 0)
//! - Cmd 2: Read PV Current and Percent (slot 0 → 4-20mA mapping)
//! - Cmd 3: Read Dynamic Variables (all mapped slots)
//!
//! # ponytail: no serial framing, no streaming, no long address

use std::collections::HashMap;
use std::sync::Arc;

use audesys_hal_core::{HalTransport, HalValue, Timestamp};

// ── HART constants ──

/// HART status bytes: OK
const STATUS_OK: [u8; 2] = [0x00, 0x00];
/// HART status bytes: error
const STATUS_ERR: [u8; 2] = [0x40, 0x00];

/// Default PV range for 4-20mA mapping (ponytail: fixed; configure via map_range if needed)
const DEFAULT_PV_RANGE: f32 = 100.0;

/// A virtual HART field device that maps slots to HAL signals.
///
/// Each HART device has up to 4 dynamic variable slots (0-3). Slots are mapped
/// to signal names and read/written through the bound transport.
pub struct VirtualHARTDevice {
    device_id: u8,
    long_tag: String,
    signals: HashMap<u8, String>,
    transport: Option<Arc<dyn HalTransport>>,
}

impl VirtualHARTDevice {
    /// Create an unbound device with the given HART device ID and long tag.
    pub fn new(device_id: u8, long_tag: &str) -> Self {
        Self { device_id, long_tag: long_tag.to_string(), signals: HashMap::new(), transport: None }
    }

    /// Bind to a transport. Must be called before `handle_command` for read commands.
    pub fn bind(&mut self, transport: Arc<dyn HalTransport>) -> &mut Self {
        self.transport = Some(transport);
        self
    }

    /// Map a HART dynamic variable slot to a signal name.
    pub fn map_slot(&mut self, slot: u8, signal: &str) -> &mut Self {
        self.signals.insert(slot, signal.to_string());
        self
    }

    // ── Command dispatch ──

    /// Process a HART command. Returns response bytes: `[status(2B)][data...]`.
    pub fn handle_command(&self, cmd: u8, data: &[u8]) -> Vec<u8> {
        match cmd {
            0 => self.handle_cmd0_identifier(),
            1 => self.handle_cmd1_read_pv(),
            2 => self.handle_cmd2_read_pv_current(data),
            3 => self.handle_cmd3_read_dynamic(),
            _ => {
                let mut resp = Vec::new();
                resp.extend_from_slice(&STATUS_ERR);
                resp
            }
        }
    }

    // ── Command handlers ──

    /// Cmd 0: Read Unique Identifier.
    ///
    /// Returns: expansion(0xFE) + device_id + manufacturer(0x05DD)
    ///          + device_type(0x01) + identifier string("AUDESYS")
    fn handle_cmd0_identifier(&self) -> Vec<u8> {
        let mut resp = Vec::new();
        resp.extend_from_slice(&STATUS_OK);
        resp.push(0xFE); // expansion: 254 = "see expansion byte"
        resp.push(self.device_id);
        resp.extend_from_slice(&[0x05, 0xDD]); // manufacturer ID: 0x05DD = AUDESYS
        resp.push(0x01); // device type
        resp.extend_from_slice(b"AUDESYS"); // device identifier
        resp
    }

    /// Cmd 1: Read Primary Variable.
    ///
    /// Reads slot 0 signal from transport and returns as IEEE 754 float.
    /// Returns error status if slot 0 is unmapped or transport not bound.
    fn handle_cmd1_read_pv(&self) -> Vec<u8> {
        match self.read_slot_f32(0) {
            Ok(value) => {
                let mut resp = Vec::new();
                resp.extend_from_slice(&STATUS_OK);
                resp.extend_from_slice(&value.to_be_bytes());
                resp
            }
            Err(_) => {
                let mut resp = Vec::new();
                resp.extend_from_slice(&STATUS_ERR);
                resp
            }
        }
    }

    /// Cmd 2: Read PV Current and Percent.
    ///
    /// Reads slot 0 signal, converts to 4-20mA range.
    /// Returns PV value + current (mA) + percent of range.
    ///
    /// ponytail: range fixed at DEFAULT_PV_RANGE; add map_range if variability needed
    fn handle_cmd2_read_pv_current(&self, _data: &[u8]) -> Vec<u8> {
        match self.read_slot_f32(0) {
            Ok(pv) => {
                let pv_clamped = pv.clamp(0.0, DEFAULT_PV_RANGE);
                let current_ma = 4.0 + (pv_clamped / DEFAULT_PV_RANGE) * 16.0;
                let percent = (pv_clamped / DEFAULT_PV_RANGE) * 100.0;

                let mut resp = Vec::new();
                resp.extend_from_slice(&STATUS_OK);
                resp.extend_from_slice(&pv.to_be_bytes());
                resp.extend_from_slice(&current_ma.to_be_bytes());
                resp.extend_from_slice(&percent.to_be_bytes());
                resp
            }
            Err(_) => {
                let mut resp = Vec::new();
                resp.extend_from_slice(&STATUS_ERR);
                resp
            }
        }
    }

    /// Cmd 3: Read Dynamic Variables.
    ///
    /// Reads all mapped slots (sorted by slot number) and returns as a float array.
    /// Format: [count(1B)][f32 × count].
    fn handle_cmd3_read_dynamic(&self) -> Vec<u8> {
        let mut slots: Vec<_> = self.signals.keys().copied().collect();
        slots.sort();

        let mut values: Vec<f32> = Vec::new();
        for slot in &slots {
            if let Ok(v) = self.read_slot_f32(*slot) {
                values.push(v);
            }
        }

        let mut resp = Vec::new();
        resp.extend_from_slice(&STATUS_OK);
        resp.push(values.len() as u8);
        for v in &values {
            resp.extend_from_slice(&v.to_be_bytes());
        }
        resp
    }

    // ── Slot helpers ──

    /// Read a mapped slot as an f32 value from the transport.
    fn read_slot_f32(&self, slot: u8) -> Result<f32, ()> {
        let name = self.signals.get(&slot).ok_or(())?;
        let transport = self.transport.as_ref().ok_or(())?;
        let (val, _) = transport
            .read_signal(name)
            .map_err(|_| ())?
            .unwrap_or((HalValue::F32(0.0), Timestamp { secs: 0, micros: 0 }));
        match val {
            HalValue::F32(v) => Ok(v),
            HalValue::F64(v) => Ok(v as f32),
            HalValue::S32(v) => Ok(v as f32),
            HalValue::U32(v) => Ok(v as f32),
            HalValue::S16(v) => Ok(v as f32),
            HalValue::U16(v) => Ok(v as f32),
            HalValue::S8(v) => Ok(v as f32),
            HalValue::U8(v) => Ok(v as f32),
            HalValue::Bool(b) => Ok(if b { 1.0 } else { 0.0 }),
            // ponytail: default unknown types to 0.0
            _ => Ok(0.0),
        }
    }
}

// ── Default ──

impl Default for VirtualHARTDevice {
    fn default() -> Self {
        Self::new(0x01, "AUDESYS-VIRTUAL-HART")
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_amw_inproc::InprocTransport;

    fn dummy_ts() -> Timestamp {
        Timestamp { secs: 0, micros: 0 }
    }

    fn setup_device() -> (VirtualHARTDevice, Arc<InprocTransport>) {
        let transport = Arc::new(InprocTransport::new());
        let mut dev = VirtualHARTDevice::new(0x42, "TEST-HART-DEVICE");
        dev.bind(transport.clone() as Arc<dyn HalTransport>);
        (dev, transport)
    }

    // ── 1. Constructor ──

    #[test]
    fn test_create_device() {
        let dev = VirtualHARTDevice::new(0x42, "MY-TAG");
        assert_eq!(dev.device_id, 0x42);
        assert_eq!(dev.long_tag, "MY-TAG");
        assert!(dev.transport.is_none());
        assert!(dev.signals.is_empty());
    }

    #[test]
    fn test_default_device() {
        let dev = VirtualHARTDevice::default();
        assert_eq!(dev.device_id, 0x01);
        assert_eq!(dev.long_tag, "AUDESYS-VIRTUAL-HART");
    }

    // ── 2. Cmd 0: Read Unique Identifier ──

    #[test]
    fn test_cmd0_identifier() {
        let (dev, _transport) = setup_device();
        let resp = dev.handle_command(0, &[]);

        // status OK
        assert_eq!(resp[0], 0x00);
        assert_eq!(resp[1], 0x00);
        // expansion
        assert_eq!(resp[2], 0xFE);
        // device_id
        assert_eq!(resp[3], 0x42);
        // manufacturer 0x05DD
        assert_eq!(resp[4], 0x05);
        assert_eq!(resp[5], 0xDD);
        // device type
        assert_eq!(resp[6], 0x01);
        // identifier "AUDESYS"
        assert_eq!(&resp[7..14], b"AUDESYS");
        assert_eq!(resp.len(), 14);
    }

    // ── 3. Cmd 1: Read Primary Variable ──

    #[test]
    fn test_cmd1_read_pv() {
        let (mut dev, transport) = setup_device();
        dev.map_slot(0, "pv.value");

        transport.publish_signal("pv.value", HalValue::F32(42.5), dummy_ts()).unwrap();

        let resp = dev.handle_command(1, &[]);
        assert_eq!(resp[0], 0x00); // status OK
        assert_eq!(resp[1], 0x00);
        let pv = f32::from_be_bytes([resp[2], resp[3], resp[4], resp[5]]);
        assert!((pv - 42.5).abs() < 0.001);
        assert_eq!(resp.len(), 6);
    }

    #[test]
    fn test_cmd1_unmapped_slot_returns_error() {
        let (dev, _transport) = setup_device();
        // Slot 0 not mapped
        let resp = dev.handle_command(1, &[]);
        assert_eq!(resp[0], 0x40); // status error
        assert_eq!(resp[1], 0x00);
        assert_eq!(resp.len(), 2);
    }

    #[test]
    fn test_cmd1_no_transport_returns_error() {
        let dev = VirtualHARTDevice::new(0x01, "TAG");
        // Transport never bound
        let resp = dev.handle_command(1, &[]);
        assert_eq!(resp[0], 0x40);
        assert_eq!(resp[1], 0x00);
    }

    // ── 4. Cmd 2: PV Current and Percent ──

    #[test]
    fn test_cmd2_read_pv_current() {
        let (mut dev, transport) = setup_device();
        dev.map_slot(0, "pv.value");

        // PV = 50 (half of range 100)
        transport.publish_signal("pv.value", HalValue::F32(50.0), dummy_ts()).unwrap();

        let resp = dev.handle_command(2, &[]);
        assert_eq!(resp[0], 0x00); // status OK
        assert_eq!(resp[1], 0x00);

        // Parse PV
        let pv = f32::from_be_bytes([resp[2], resp[3], resp[4], resp[5]]);
        assert!((pv - 50.0).abs() < 0.001);

        // Parse current in mA: 4 + (50/100)*16 = 12.0
        let current = f32::from_be_bytes([resp[6], resp[7], resp[8], resp[9]]);
        assert!((current - 12.0).abs() < 0.001);

        // Parse percent: 50.0%
        let percent = f32::from_be_bytes([resp[10], resp[11], resp[12], resp[13]]);
        assert!((percent - 50.0).abs() < 0.001);

        assert_eq!(resp.len(), 14);
    }

    // ── 5. Multiple slot mapping ──

    #[test]
    fn test_map_multiple_slots() {
        let mut dev = VirtualHARTDevice::new(0x01, "TAG");
        dev.map_slot(0, "sensor.temp").map_slot(1, "sensor.pressure").map_slot(3, "sensor.flow");

        assert_eq!(dev.signals.len(), 3);
        assert_eq!(dev.signals.get(&0).unwrap(), "sensor.temp");
        assert_eq!(dev.signals.get(&1).unwrap(), "sensor.pressure");
        assert_eq!(dev.signals.get(&3).unwrap(), "sensor.flow");
    }

    // ── 6. Cmd 3: Read Dynamic Variables ──

    #[test]
    fn test_cmd3_read_all_slots() {
        let (mut dev, transport) = setup_device();
        dev.map_slot(0, "sensor.temp").map_slot(1, "sensor.pressure").map_slot(2, "sensor.flow");

        transport.publish_signal("sensor.temp", HalValue::F32(25.5), dummy_ts()).unwrap();
        transport.publish_signal("sensor.pressure", HalValue::F32(101.3), dummy_ts()).unwrap();
        transport.publish_signal("sensor.flow", HalValue::F32(3.7), dummy_ts()).unwrap();

        let resp = dev.handle_command(3, &[]);
        assert_eq!(resp[0], 0x00); // status OK
        assert_eq!(resp[1], 0x00);

        let count = resp[2];
        assert_eq!(count, 3);

        let v0 = f32::from_be_bytes([resp[3], resp[4], resp[5], resp[6]]);
        assert!((v0 - 25.5).abs() < 0.001);

        let v1 = f32::from_be_bytes([resp[7], resp[8], resp[9], resp[10]]);
        assert!((v1 - 101.3).abs() < 0.001);

        let v2 = f32::from_be_bytes([resp[11], resp[12], resp[13], resp[14]]);
        assert!((v2 - 3.7).abs() < 0.001);

        assert_eq!(resp.len(), 15); // 2 status + 1 count + 3*4 floats
    }

    #[test]
    fn test_cmd3_no_mapped_slots() {
        let (dev, _transport) = setup_device();
        let resp = dev.handle_command(3, &[]);
        assert_eq!(resp[0], 0x00); // status OK
        assert_eq!(resp[1], 0x00);
        assert_eq!(resp[2], 0); // zero dynamic variables
        assert_eq!(resp.len(), 3);
    }

    // ── 7. Error path: unmapped slot ──

    #[test]
    fn test_unmapped_slot() {
        let (dev, _transport) = setup_device();
        // No slots mapped, cmd 1 should fail
        let resp = dev.handle_command(1, &[]);
        assert_eq!(resp[0], 0x40);
        assert_eq!(resp[1], 0x00);
    }

    // ── 8. Unknown command ──

    #[test]
    fn test_unknown_command() {
        let (dev, _transport) = setup_device();
        let resp = dev.handle_command(0xFF, &[]);
        assert_eq!(resp[0], 0x40); // error status
        assert_eq!(resp[1], 0x00);
    }

    // ── 9. Value type coercion ──

    #[test]
    fn test_read_slot_coerces_types() {
        let (mut dev, transport) = setup_device();
        dev.map_slot(0, "value");

        // U16 → f32
        transport.publish_signal("value", HalValue::U16(100), dummy_ts()).unwrap();
        let resp = dev.handle_command(1, &[]);
        let v = f32::from_be_bytes([resp[2], resp[3], resp[4], resp[5]]);
        assert!((v - 100.0).abs() < 0.001);

        // Bool true → 1.0
        transport.publish_signal("value", HalValue::Bool(true), dummy_ts()).unwrap();
        let resp = dev.handle_command(1, &[]);
        let v = f32::from_be_bytes([resp[2], resp[3], resp[4], resp[5]]);
        assert!((v - 1.0).abs() < 0.001);
    }
}
