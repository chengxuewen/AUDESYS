//! Integration tests: HealthServer /healthz endpoint.
//!
//! Verifies that the health HTTP endpoint returns valid JSON with the
//! correct status for the configured health checks.
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;

use audesys_controller::HealthServer;
use audesys_runtime_common::types::{HealthCheck, HealthCheckRegistry, HealthStatus};

// ── helpers ──

/// Always-healthy check.
struct OkCheck;
impl HealthCheck for OkCheck {
    fn name(&self) -> &str {
        "ok"
    }
    fn check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }
    fn interval_ms(&self) -> u64 {
        1000
    }
}

/// Always-degraded check.
struct DegradedCheck;
impl HealthCheck for DegradedCheck {
    fn name(&self) -> &str {
        "degraded"
    }
    fn check(&self) -> HealthStatus {
        HealthStatus::Degraded("test".into())
    }
    fn interval_ms(&self) -> u64 {
        1000
    }
}

/// Read response from the health endpoint.
/// ponytail: server doesn't read HTTP requests — it writes response immediately on accept.
/// So we just connect and read; no request needs to be sent.
fn read_health(port: u16) -> String {
    for _ in 0..20 {
        match TcpStream::connect(format!("127.0.0.1:{}", port)) {
            Ok(mut stream) => {
                // The server writes immediately — we just read
                let mut body = String::new();
                stream.read_to_string(&mut body).unwrap();
                return body;
            }
            Err(_) => thread::sleep(Duration::from_millis(100)),
        }
    }
    panic!("could not connect to health endpoint after 20 retries");
}

// ── tests ──

#[test]
fn test_health_endpoint_returns_healthy() {
    let registry = Arc::new(RwLock::new(HealthCheckRegistry::new()));
    registry.write().unwrap().register(Box::new(OkCheck));

    let server = HealthServer::new(Arc::clone(&registry));
    let port: u16 = 19876;
    let handle = server.start(port).expect("should start health server");

    // Give the server a moment to bind
    thread::sleep(Duration::from_millis(200));

    let response = read_health(port);
    assert!(response.contains("200 OK"), "should return 200 OK, got: {}", response);
    assert!(response.contains("\"healthy\""), "should report healthy, got: {}", response);
    assert!(response.contains("\"audesys-controller\""), "should include module name");

    server.stop();
    let _ = handle.join();
}

#[test]
fn test_health_endpoint_reflects_degraded() {
    let registry = Arc::new(RwLock::new(HealthCheckRegistry::new()));
    registry.write().unwrap().register(Box::new(DegradedCheck));

    let server = HealthServer::new(Arc::clone(&registry));
    let port: u16 = 19877;
    let handle = server.start(port).expect("should start health server");

    thread::sleep(Duration::from_millis(200));

    let response = read_health(port);
    assert!(response.contains("200 OK"), "should return 200 OK");
    assert!(response.contains("\"degraded\""), "should report degraded, got: {}", response);

    server.stop();
    let _ = handle.join();
}
