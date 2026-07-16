//! HART adapter — HalTransport consumer with a dedicated poll loop.
//!
//! Reads HART device variables and publishes them as HAL Signals.
//! One [`HartAdapter`] per HART device.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use audesys_hal_core::{HalTransport, HalValue, Timestamp};

use crate::client::HartClient;
use crate::config::{ConnectionConfig, HartConfig, SignalDirection, VariableMappingType};
use crate::error::HartError;
use crate::mapping::{self, VariableType};

// ── timestamp helper ────────────────────────────────────────────────────

fn now_timestamp() -> Timestamp {
    let ns = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0);
    Timestamp { secs: ns / 1_000_000_000, micros: (ns / 1000 % 1_000_000) as u32 }
}

// ── adapter ─────────────────────────────────────────────────────────────

/// Bridges a HART field device to [`HalTransport`] Signals.
///
/// Spawns a dedicated poll thread that periodically reads device variables
/// and publishes them as Signals.  The adapter **consumes** an existing
/// [`HalTransport`] — it does not implement the trait itself.
pub struct HartAdapter {
    client: Arc<Mutex<HartClient>>,
    transport: Arc<dyn HalTransport>,
    mappings: Vec<crate::config::VariableMapping>,
    signal_cache: Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
    shutdown: Arc<AtomicBool>,
    poll_interval: Duration,
}

impl HartAdapter {
    /// Create and connect a HART adapter from a YAML config.
    pub fn new(config: HartConfig, transport: Arc<dyn HalTransport>) -> Result<Self, HartError> {
        let ConnectionConfig::Serial { device } = &config.connection;
        let client = HartClient::new(device, 0)?;

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
            transport,
            mappings: config.mappings,
            signal_cache: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(AtomicBool::new(false)),
            poll_interval: Duration::from_millis(config.poll_interval_ms),
        })
    }

    /// Start the poll loop in a background thread.
    pub fn start(&self) {
        let client = Arc::clone(&self.client);
        let transport = Arc::clone(&self.transport);
        let mappings = self.mappings.clone();
        let cache = Arc::clone(&self.signal_cache);
        let shutdown = Arc::clone(&self.shutdown);
        let interval = self.poll_interval;

        thread::spawn(move || {
            while !shutdown.load(Ordering::Relaxed) {
                let start = SystemTime::now();

                let mut client = client.lock().unwrap();

                for mapping in &mappings {
                    let result = match mapping.direction {
                        SignalDirection::Read => {
                            Self::poll_read(&mut client, transport.as_ref(), mapping, &cache)
                        }
                        SignalDirection::Write => {
                            Self::poll_write(&mut client, transport.as_ref(), mapping, &cache)
                        }
                    };

                    if let Err(e) = result {
                        // ponytail: log-and-skip — a single variable failure shouldn't block others.
                        eprintln!("HART poll error [{}]: {e}", mapping.signal_name);
                    }
                }

                drop(client);

                let elapsed = start.elapsed().unwrap_or(Duration::ZERO);
                if elapsed < interval {
                    thread::sleep(interval - elapsed);
                }
            }
        });
    }

    /// Signal the poll loop to stop.
    pub fn stop(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    // ── poll helpers ────────────────────────────────────────────────────

    fn poll_read(
        client: &mut HartClient,
        transport: &dyn HalTransport,
        mapping: &crate::config::VariableMapping,
        cache: &RwLock<HashMap<String, (HalValue, Timestamp)>>,
    ) -> Result<(), HartError> {
        let ts = now_timestamp();

        let value = match mapping.variable_type {
            VariableMappingType::Pv
            | VariableMappingType::Sv
            | VariableMappingType::Tv
            | VariableMappingType::Qv => {
                let resp = client.read_dynamic_vars()?;
                // data layout: PV unit(1) + PV f32(4) + SV unit(1) + SV f32(4)
                //              + TV unit(1) + TV f32(4) + QV unit(1) + QV f32(4)
                let offset = match mapping.variable_type {
                    VariableMappingType::Pv => 1,
                    VariableMappingType::Sv => 6,
                    VariableMappingType::Tv => 11,
                    VariableMappingType::Qv => 16,
                    _ => unreachable!(),
                };

                if resp.data.len() < offset + 4 {
                    return Err(HartError::InvalidData(format!(
                        "dynamic var response too short: {} bytes, need {}",
                        resp.data.len(),
                        offset + 4
                    )));
                }

                mapping::variables_to_halvalue(&resp.data[offset..], VariableType::Float)?
            }
            VariableMappingType::Status => {
                let resp = client.read_device_id()?;
                let status = u16::from_be_bytes([resp.status_byte0, resp.status_byte1]);
                HalValue::U16(status)
            }
        };

        transport
            .publish_signal(&mapping.signal_name, value.clone(), ts)
            .map_err(|e| HartError::Internal(format!("publish failed: {e:?}")))?;

        if let Ok(mut c) = cache.write() {
            c.insert(mapping.signal_name.clone(), (value, ts));
        }

        Ok(())
    }

    fn poll_write(
        _client: &mut HartClient,
        transport: &dyn HalTransport,
        mapping: &crate::config::VariableMapping,
        cache: &RwLock<HashMap<String, (HalValue, Timestamp)>>,
    ) -> Result<(), HartError> {
        let current = transport
            .read_signal(&mapping.signal_name)
            .map_err(|e| HartError::Internal(format!("read signal failed: {e:?}")))?;

        // read_signal returns Option<(HalValue, Timestamp)>
        let (current_val, _ts) = match current {
            Some(v) => v,
            None => return Ok(()),
        };

        // Skip if unchanged from last write.
        if let Ok(c) = cache.read()
            && let Some((cached_val, _)) = c.get(&mapping.signal_name)
            && *cached_val == current_val
        {
            return Ok(());
        }

        // ponytail: HART write commands (34, 35) deferred to Phase 2.
        // For Phase 1 limited set, writes are no-ops — signal values flow
        // through the read path from poll_read().
        let _wire = mapping::halvalue_to_variables(&current_val)?;

        let ts = now_timestamp();
        if let Ok(mut c) = cache.write() {
            c.insert(mapping.signal_name.clone(), (current_val, ts));
        }

        Ok(())
    }
}

impl Drop for HartAdapter {
    fn drop(&mut self) {
        self.stop();
    }
}
