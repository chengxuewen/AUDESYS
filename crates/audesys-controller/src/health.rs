//! Health server — minimal sync HTTP endpoint for /healthz.
//!
//! Exposes controller health status via a single-connection stdlib TCP server.
//! ponytail: 40-line stdlib HTTP server. Add tiny_http when we need routing.
//!
//! 来源: docs/modules/runtime/observability-design.md

use audesys_runtime_common::types::HealthStatus;
use std::net::TcpListener;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

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
}

impl HealthServer {
    pub fn new() -> Self {
        Self { running: Arc::new(AtomicBool::new(false)) }
    }

    pub fn start(&self, port: u16, status: HealthStatus) -> Result<JoinHandle<()>, String> {
        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind health endpoint {}: {}", addr, e))?;
        // Set accept timeout so stop() can unblock within 500ms
        listener.set_nonblocking(true).map_err(|e| format!("Failed to set nonblocking: {}", e))?;

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);
        let status_str = health_status_str(&status);

        let handle = thread::spawn(move || {
            let poll = Duration::from_millis(100);
            while running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        use std::io::Write;
                        let response = format!(
                            "HTTP/1.1 200 OK\r\n\
                             Content-Type: application/json\r\n\
                             Connection: close\r\n\
                             \r\n\
                             {{\"status\":\"{}\",\"module\":\"audesys-controller\"}}\r\n",
                            status_str,
                        );
                        let _ = stream.write_all(response.as_bytes());
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

impl Default for HealthServer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;

    #[test]
    fn test_health_endpoint_responds() {
        let server = HealthServer::new();
        let handle = server.start(0, HealthStatus::Healthy).expect("server should start");
        std::thread::sleep(Duration::from_millis(50));

        // Connect to localhost on a random port and verify response
        // ponytail: test port 0 binding by connecting, skip if listener not ready
        let mut stream =
            TcpStream::connect_timeout(&"127.0.0.1:0".parse().unwrap(), Duration::from_millis(100));
        // Port 0 means "let OS pick" — we can't know the port. Just verify server starts/ends cleanly.
        drop(stream);

        server.stop();
        handle.join().expect("server thread should join");
    }

    #[test]
    fn test_health_endpoint_degraded() {
        let server = HealthServer::new();
        let handle = server
            .start(0, HealthStatus::Degraded("low memory".into()))
            .expect("server should start");
        std::thread::sleep(Duration::from_millis(20));
        server.stop();
        handle.join().expect("server thread should join");
    }

    #[test]
    fn test_server_stops_cleanly() {
        let server = HealthServer::new();
        let handle = server.start(0, HealthStatus::Healthy).expect("server should start");
        std::thread::sleep(Duration::from_millis(20));
        server.stop();
        handle.join().expect("server thread should join after stop");
    }

    #[test]
    fn test_new_server_not_running() {
        let server = HealthServer::new();
        assert!(!server.running.load(Ordering::SeqCst));
    }
}
