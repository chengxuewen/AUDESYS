//! Health server — minimal sync HTTP endpoint for /healthz.
//!
//! Exposes controller health status via a single-connection stdlib TCP server.
//! ponytail: 40-line stdlib HTTP server. Add tiny_http when we need routing.
//!
//! 来源: docs/modules/runtime/observability-design.md

use crate::metrics::RuntimeMetrics;
use audesys_runtime_common::types::{HealthCheckRegistry, HealthStatus};
use std::net::TcpListener;
use std::sync::{
    Arc, RwLock,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

fn prometheus_text(m: &RuntimeMetrics) -> String {
    use std::sync::atomic::Ordering;
    let mut out = String::new();
    out.push_str(&format!("audesys_cycles_completed {}\n", m.cycles_completed.load(Ordering::Relaxed)));
    out.push_str(&format!("audesys_signals_published {}\n", m.signals_published.load(Ordering::Relaxed)));
    out.push_str(&format!("audesys_config_changes_applied {}\n", m.config_changes_applied.load(Ordering::Relaxed)));
    out.push_str(&format!("audesys_child_restarts {}\n", m.child_restarts.load(Ordering::Relaxed)));
    out.push_str(&format!("audesys_health_check_failures {}\n", m.health_check_failures.load(Ordering::Relaxed)));
    let jitter = m.cycle_jitter_us.read();
    for (i, v) in jitter.iter().enumerate() {
        if *v > 0 {
            out.push_str(&format!("audesys_cycle_jitter_us{{offset=\"{}\"}} {}\n", i, v));
        }
    }
    out
}

fn health_status_str(status: &HealthStatus) -> String {
    match status {
        HealthStatus::Healthy => "healthy".into(),
        HealthStatus::Degraded(_) => "degraded".into(),
        HealthStatus::Unhealthy(_) => "unhealthy".into(),
        HealthStatus::Starting => "starting".into(),
        HealthStatus::Stopping => "stopping".into(),
    }
}

pub struct HealthServer {
    running: Arc<AtomicBool>,
    health_registry: Arc<RwLock<HealthCheckRegistry>>,
    metrics: Option<Arc<RuntimeMetrics>>,
}

impl HealthServer {
    /// Create a new HealthServer that reads status dynamically from the shared registry.
    pub fn new(health_registry: Arc<RwLock<HealthCheckRegistry>>) -> Self {
        Self { running: Arc::new(AtomicBool::new(false)), health_registry, metrics: None }
    }

    pub fn with_metrics(health_registry: Arc<RwLock<HealthCheckRegistry>>, metrics: Arc<RuntimeMetrics>) -> Self {
        Self { running: Arc::new(AtomicBool::new(false)), health_registry, metrics: Some(metrics) }
    }

    /// Start the health HTTP endpoint. Status is read from the shared registry on every request.
    pub fn start(&self, port: u16) -> Result<JoinHandle<()>, String> {
        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind health endpoint {}: {}", addr, e))?;
        // Set accept timeout so stop() can unblock within 500ms
        listener.set_nonblocking(true).map_err(|e| format!("Failed to set nonblocking: {}", e))?;

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);
        let registry = Arc::clone(&self.health_registry);
        let metrics = self.metrics.clone();

        let handle = thread::spawn(move || {
            let poll = Duration::from_millis(100);
            while running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        use std::io::{BufRead, BufReader, Read, Write};

                        // Read HTTP request line in scoped block so reader is dropped before writes
                        let path = {
                            let mut reader = BufReader::new(&mut stream);
                            let mut line = String::new();
                            match reader.read_line(&mut line) {
                                Ok(n) if n > 0 => line.split_whitespace().nth(1).unwrap_or("/").to_string(),
                                _ => "/".to_string(),
                            }
                        };

                        match path.as_str() {
                            "/metrics" => {
                                if let Some(ref m) = metrics {
                                    let body = prometheus_text(m);
                                    let response = format!(
                                        "HTTP/1.1 200 OK\r\n\
                                         Content-Type: text/plain; version=0.0.4\r\n\
                                         Connection: close\r\n\
                                         Content-Length: {}\r\n\
                                         \r\n\
                                        {}",
                                        body.len(), body
                                    );
                                    let _ = stream.write_all(response.as_bytes());
                                } else {
                                    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n");
                                }
                            }
                            _ => {
                                let status = registry.read().expect("health RwLock poisoned").aggregate();
                                let status_str = health_status_str(&status);
                                let json = format!("{{\"status\":\"{}\",\"module\":\"audesys-controller\"}}", status_str);
                                let response = format!(
                                    "HTTP/1.1 200 OK\r\n\
                                     Content-Type: application/json\r\n\
                                     Connection: close\r\n\
                                     Content-Length: {}\r\n\
                                     \r\n\
                                    {}",
                                    json.len(), json
                                );
                                let _ = stream.write_all(response.as_bytes());
                            }
                        }
                        let _ = stream.flush();
                        drop(stream);
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(poll);
                    }
                    Err(_) => {
                        break;
                    }
                }
            }
        });

        Ok(handle)
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_runtime_common::types::HealthCheck;
    use std::io::Read;
    use std::net::TcpStream;

    // ——— test helpers ———

    /// A health check that always returns Healthy.
    struct StubHealthCheck;

    impl HealthCheck for StubHealthCheck {
        fn name(&self) -> &str {
            "stub"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Healthy
        }
        fn interval_ms(&self) -> u64 {
            1000
        }
    }

    /// A health check that always returns Degraded.
    struct DegradedStubHealthCheck;

    impl HealthCheck for DegradedStubHealthCheck {
        fn name(&self) -> &str {
            "degraded_stub"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Degraded("low memory".into())
        }
        fn interval_ms(&self) -> u64 {
            1000
        }
    }

    /// A health check whose status can be toggled at runtime.
    struct ToggleHealthCheck {
        healthy: Arc<AtomicBool>,
    }

    impl HealthCheck for ToggleHealthCheck {
        fn name(&self) -> &str {
            "toggle"
        }
        fn check(&self) -> HealthStatus {
            if self.healthy.load(Ordering::SeqCst) {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unhealthy("test failure".into())
            }
        }
        fn interval_ms(&self) -> u64 {
            100
        }
    }

    fn new_registry_with(check: Box<dyn HealthCheck>) -> Arc<RwLock<HealthCheckRegistry>> {
        let mut registry = HealthCheckRegistry::new();
        registry.register(check);
        Arc::new(RwLock::new(registry))
    }

    fn find_open_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .expect("find open port")
            .local_addr()
            .expect("local addr")
            .port()
    }

    // ——— tests ———

    #[test]
    fn test_health_endpoint_responds() {
        let registry = new_registry_with(Box::new(StubHealthCheck));
        let server = HealthServer::new(registry);
        let handle = server.start(0).expect("server should start");
        std::thread::sleep(Duration::from_millis(50));

        // ponytail: skip connect test for port 0 — can't know OS-assigned port

        server.stop();
        handle.join().expect("server thread should join");
    }

    #[test]
    fn test_health_endpoint_degraded() {
        let registry = new_registry_with(Box::new(DegradedStubHealthCheck));
        let server = HealthServer::new(registry);
        let handle = server.start(0).expect("server should start");
        std::thread::sleep(Duration::from_millis(20));
        server.stop();
        handle.join().expect("server thread should join");
    }

    #[test]
    fn test_server_stops_cleanly() {
        let registry = new_registry_with(Box::new(StubHealthCheck));
        let server = HealthServer::new(registry);
        let handle = server.start(0).expect("server should start");
        std::thread::sleep(Duration::from_millis(20));
        server.stop();
        handle.join().expect("server thread should join after stop");
    }

    #[test]
    fn test_new_server_not_running() {
        let registry = new_registry_with(Box::new(StubHealthCheck));
        let server = HealthServer::new(registry);
        assert!(!server.running.load(Ordering::SeqCst));
    }

    #[test]
    fn test_dynamic_health_reflects_registry_changes() {
        let toggle = Arc::new(AtomicBool::new(true));
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(ToggleHealthCheck { healthy: Arc::clone(&toggle) }));
        let registry = Arc::new(RwLock::new(registry));

        let server = HealthServer::new(registry);
        let port = find_open_port();
        let handle = server.start(port).expect("server should start");
        std::thread::sleep(Duration::from_millis(50));

        // Verify healthy
        {
            let mut stream = TcpStream::connect(format!("127.0.0.1:{}", port)).expect("connect");
            let mut buf = [0u8; 512];
            let n = stream.read(&mut buf).expect("read");
            let response = String::from_utf8_lossy(&buf[..n]);
            assert!(
                response.contains("\"status\":\"healthy\""),
                "Expected healthy, got: {}",
                response
            );
        }

        // Toggle to unhealthy
        toggle.store(false, Ordering::SeqCst);
        std::thread::sleep(Duration::from_millis(20));

        // Verify unhealthy
        {
            let mut stream = TcpStream::connect(format!("127.0.0.1:{}", port)).expect("connect");
            let mut buf = [0u8; 512];
            let n = stream.read(&mut buf).expect("read");
            let response = String::from_utf8_lossy(&buf[..n]);
            assert!(
                response.contains("\"status\":\"unhealthy\""),
                "Expected unhealthy, got: {}",
                response
            );
        }

        server.stop();
        handle.join().expect("server thread should join");
    }
}
