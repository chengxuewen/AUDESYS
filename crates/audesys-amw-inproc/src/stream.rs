//! In-process StreamChannel implementation.
//! 来源: docs/modules/hal/hal-protocol-design.md S-CH, D10

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use audesys_hal_core::stream::StreamCallback;
use audesys_hal_core::{
    HalError, HalResult, HalValue, QueuePolicy, StreamConfig, StreamReader, StreamWriter,
    Subscription, Timestamp,
};

const BACKPRESSURE_MAX_RETRIES: u32 = 10;
const BACKPRESSURE_RETRY_MS: u64 = 1;

// ── Shared inner state ──

struct StreamChannelInner {
    queue: VecDeque<(HalValue, Timestamp)>,
    subscribers: Vec<StreamCallback>,
    config: StreamConfig,
}

impl StreamChannelInner {
    fn new(config: &StreamConfig) -> Self {
        Self {
            queue: VecDeque::with_capacity(config.queue_depth as usize),
            subscribers: Vec::new(),
            config: config.clone(),
        }
    }

    /// Push a value into the queue, handling overflow per policy.
    /// Returns Err on Backpressure timeout.
    fn push(&mut self, value: HalValue, ts: Timestamp) -> HalResult<()> {
        let depth = self.config.queue_depth as usize;

        if self.queue.len() >= depth {
            match self.config.queue_policy {
                QueuePolicy::DropOldest => {
                    self.queue.pop_front();
                }
                QueuePolicy::DropNewest => {
                    // ponytail: skip push — newest value discarded
                    return Ok(());
                }
                QueuePolicy::Backpressure => {
                    // ponytail: spin-wait with bounded retries
                    for _ in 0..BACKPRESSURE_MAX_RETRIES {
                        std::thread::sleep(Duration::from_millis(BACKPRESSURE_RETRY_MS));
                        if self.queue.len() < depth {
                            self.queue.push_back((value, ts));
                            return Ok(());
                        }
                    }
                    return Err(HalError::Internal("stream backpressure timeout".into()));
                }
            }
        }

        self.queue.push_back((value, ts));
        Ok(())
    }

    /// Pop the oldest value from the queue.
    fn pop(&mut self) -> Option<(HalValue, Timestamp)> {
        self.queue.pop_front()
    }

    /// Invoke all subscriber callbacks with the given value.
    fn notify_subscribers(&self, value: &HalValue, ts: Timestamp) {
        for cb in &self.subscribers {
            cb(value, ts);
        }
    }
}

// ── Writer ──

/// In-process stream writer. Multiple writers can share the same channel.
pub struct InprocStreamWriter {
    inner: Arc<Mutex<StreamChannelInner>>,
}

impl StreamWriter for InprocStreamWriter {
    fn write(&self, value: HalValue, ts: Timestamp) -> HalResult<()> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|e| HalError::Internal(format!("stream writer mutex poisoned: {}", e)))?;

        inner.push(value.clone(), ts)?;
        inner.notify_subscribers(&value, ts);

        Ok(())
    }

    fn flush(&self) -> HalResult<()> {
        // ponytail: inproc has no buffering — flush is a no-op
        Ok(())
    }
}

// ── Reader ──

/// In-process stream reader. Each reader receives an independent view.
pub struct InprocStreamReader {
    inner: Arc<Mutex<StreamChannelInner>>,
}

impl StreamReader for InprocStreamReader {
    fn read(&self) -> HalResult<Option<(HalValue, Timestamp)>> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|e| HalError::Internal(format!("stream reader mutex poisoned: {}", e)))?;

        Ok(inner.pop())
    }

    fn subscribe(&self, cb: StreamCallback) -> HalResult<Subscription> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|e| HalError::Internal(format!("stream subscribe mutex poisoned: {}", e)))?;

        inner.subscribers.push(cb);

        // ponytail: Subscription is an opaque token in hal-core.
        // Actual unsubscription happens when InprocStreamReader is dropped.
        Ok(Subscription {})
    }
}

impl Drop for InprocStreamReader {
    fn drop(&mut self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.subscribers.clear();
        }
    }
}

// ── Factory ──

/// Create a new in-process stream channel with the given configuration.
///
/// Returns independent writer and reader handles sharing a single queue.
pub fn create_stream_channel(
    config: StreamConfig,
) -> HalResult<(Box<dyn StreamWriter>, Box<dyn StreamReader>)> {
    let inner = Arc::new(Mutex::new(StreamChannelInner::new(&config)));

    let writer = InprocStreamWriter { inner: Arc::clone(&inner) };
    let reader = InprocStreamReader { inner: Arc::clone(&inner) };

    Ok((Box::new(writer), Box::new(reader)))
}
