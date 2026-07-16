//! ModbusAdapter — HalTransport consumer that bridges Modbus registers ↔ HAL Signals.
//! 来源: docs/modules/hal/hal-protocol-design.md §D23

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use audesys_hal_core::{HalTransport, HalValue, Timestamp};

use crate::client::ModbusClient;
use crate::config::{
    ConnectionConfig, ModbusConfig, RegisterMapping, RegisterMappingType, SignalDirection,
};
use crate::error::ModbusError;
use crate::mapping::{
    RegisterType, coils_to_halvalue, halvalue_to_registers, registers_to_halvalue,
};

fn now_ns() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0)
}

fn now_timestamp() -> Timestamp {
    let ns = now_ns();
    Timestamp { secs: ns / 1_000_000_000, micros: (ns / 1000 % 1_000_000) as u32 }
}

/// Bridges Modbus registers to HAL Signals through an injected HalTransport.
///
/// The adapter runs a synchronous poll loop in a dedicated std::thread —
/// libmodbus is blocking, not async. Read mappings pull Modbus registers
/// and publish them as HAL Signals. Write mappings read HAL Signals and
/// push changed values back to Modbus devices.
pub struct ModbusAdapter {
    client: Arc<Mutex<ModbusClient>>,
    transport: Arc<dyn HalTransport>,
    mappings: Vec<RegisterMapping>,
    signal_cache: Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
    shutdown: Arc<AtomicBool>,
    poll_interval: Duration,
}

impl ModbusAdapter {
    /// Create a new adapter, connecting to the Modbus device and binding to a transport.
    pub fn new(
        config: ModbusConfig,
        transport: Arc<dyn HalTransport>,
    ) -> Result<Self, ModbusError> {
        let client = match &config.connection {
            ConnectionConfig::Tcp { host, port } => {
                let c = ModbusClient::new_tcp(&host, *port)?;
                c.connect()?;
                c
            }
            ConnectionConfig::Rtu {
                device,
                baud,
                parity,
                data_bits,
                stop_bits,
                slave_id,
            } => {
                let c = ModbusClient::new_rtu(&device, *baud, *parity, *data_bits, *stop_bits)?;
                c.set_slave(*slave_id)?;
                c.connect()?;
                c
            }
        };

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
            transport,
            mappings: config.mappings.clone(),
            signal_cache: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(AtomicBool::new(false)),
            poll_interval: Duration::from_millis(config.poll_interval_ms),
        })
    }

    /// Start the poll loop in a dedicated thread. Returns a JoinHandle.
    pub fn start(&self) -> JoinHandle<()> {
        let client = Arc::clone(&self.client);
        let transport = Arc::clone(&self.transport);
        let mappings = self.mappings.clone();
        let cache = Arc::clone(&self.signal_cache);
        let shutdown = Arc::clone(&self.shutdown);
        let interval = self.poll_interval;

        thread::spawn(move || {
            while !shutdown.load(Ordering::Relaxed) {
                let ts = now_timestamp();

                for mapping in &mappings {
                    match mapping.direction {
                        SignalDirection::Read => {
                            if let Err(e) =
                                Self::poll_read(&client, &transport, mapping, &cache, ts)
                            {
                                eprintln!(
                                    "ModbusAdapter: read error on {}: {e}",
                                    mapping.signal_name
                                );
                            }
                        }
                        SignalDirection::Write => {
                            if let Err(e) =
                                Self::poll_write(&client, &transport, mapping, &cache, ts)
                            {
                                eprintln!(
                                    "ModbusAdapter: write error on {}: {e}",
                                    mapping.signal_name
                                );
                            }
                        }
                    }
                }

                thread::sleep(interval);
            }
        })
    }

    /// Signal the poll loop to stop. Does not join — use the JoinHandle for that.
    pub fn stop(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    // ── private poll helpers ──

    fn poll_read(
        client: &Arc<Mutex<ModbusClient>>,
        transport: &Arc<dyn HalTransport>,
        mapping: &RegisterMapping,
        cache: &Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
        ts: Timestamp,
    ) -> Result<(), ModbusError> {
        let c = client.lock().map_err(|e| ModbusError::Io(e.to_string()))?;

        let value = match mapping.register_type {
            RegisterMappingType::Coil => {
                let bits = c.read_coils(mapping.address, mapping.count)?;
                let coils: Vec<u8> = bits.into_iter().map(u8::from).collect();
                coils_to_halvalue(&coils)
            }
            RegisterMappingType::DiscreteInput => {
                let bits = c.read_discrete_inputs(mapping.address, mapping.count)?;
                let coils: Vec<u8> = bits.into_iter().map(u8::from).collect();
                coils_to_halvalue(&coils)
            }
            RegisterMappingType::HoldingRegister => {
                let regs = c.read_holding_registers(mapping.address, mapping.count)?;
                // ponytail: default to U16 — add per-mapping data_type to config if needed
                registers_to_halvalue(&regs, RegisterType::U16)?
            }
            RegisterMappingType::InputRegister => {
                let regs = c.read_input_registers(mapping.address, mapping.count)?;
                registers_to_halvalue(&regs, RegisterType::U16)?
            }
        };

        // drop client lock before calling transport
        drop(c);

        transport
            .publish_signal(&mapping.signal_name, value.clone(), ts)
            .map_err(|e| ModbusError::Io(format!("publish failed: {e}")))?;

        if let Ok(mut cache_map) = cache.write() {
            cache_map.insert(mapping.signal_name.clone(), (value, ts));
        }

        Ok(())
    }

    fn poll_write(
        client: &Arc<Mutex<ModbusClient>>,
        transport: &Arc<dyn HalTransport>,
        mapping: &RegisterMapping,
        cache: &Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
        _ts: Timestamp,
    ) -> Result<(), ModbusError> {
        let current = transport
            .read_signal(&mapping.signal_name)
            .map_err(|e| ModbusError::Io(format!("read_signal failed: {e}")))?;

        let (value, signal_ts) = match current {
            Some(v) => v,
            None => return Ok(()),
        };

        // skip if unchanged
        {
            let cache_map = cache.read().map_err(|e| ModbusError::Io(e.to_string()))?;
            if cache_map
                .get(&mapping.signal_name)
                .is_some_and(|(cached_val, _)| *cached_val == value)
            {
                return Ok(());
            }
        }

        let c = client.lock().map_err(|e| ModbusError::Io(e.to_string()))?;
        let (registers, _inferred_type) = halvalue_to_registers(&value)?;

        match registers.len() {
            1 => c.write_single_register(mapping.address, registers[0])?,
            _ => c.write_multiple_registers(mapping.address, &registers)?,
        }

        // update cache
        if let Ok(mut cache_map) = cache.write() {
            cache_map.insert(mapping.signal_name.clone(), (value, signal_ts));
        }

        Ok(())
    }
}

impl Drop for ModbusAdapter {
    fn drop(&mut self) {
        self.stop();
    }
}
