//! Modbus TCP integration tests — TcpListener backend + libmodbus protocol.

use std::ffi::c_int;
use std::io;
use std::net::TcpListener;
use std::os::unix::io::IntoRawFd;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use audesys_modbus::ModbusClient;
use audesys_modbus_sys as ffi;

struct TestServer {
    port: u16,
    mapping: *mut ffi::modbus_mapping_t,
    shutdown: Arc<AtomicBool>,
}
unsafe impl Send for TestServer {}

impl Drop for TestServer {
    fn drop(&mut self) {
        unsafe { ffi::modbus_mapping_free(self.mapping) };
    }
}

impl TestServer {
    fn new(port: u16, nb_coils: u16, nb_registers: u16) -> Self {
        let mapping =
            unsafe { ffi::modbus_mapping_new(nb_coils as c_int, 0, nb_registers as c_int, 0) };
        assert!(!mapping.is_null());
        Self { port, mapping, shutdown: Arc::new(AtomicBool::new(false)) }
    }

    fn set_register(&self, addr: u16, value: u16) {
        unsafe {
            let m = &*self.mapping;
            assert!((addr as usize) < m.nb_registers as usize);
            *m.tab_registers.add(addr as usize) = value;
        }
    }

    fn set_coil(&self, addr: u16, value: bool) {
        unsafe {
            let m = &*self.mapping;
            assert!((addr as usize) < m.nb_bits as usize);
            *m.tab_bits.add(addr as usize) = value as u8;
        }
    }

    fn run(&self) -> (u16, JoinHandle<()>) {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", self.port)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let actual_port = listener.local_addr().unwrap().port();
        let mapping_addr = self.mapping as usize;
        let shutdown = Arc::clone(&self.shutdown);

        let handle = thread::spawn(move || {
            let mapping = mapping_addr as *mut ffi::modbus_mapping_t;
            loop {
                if shutdown.load(Ordering::Relaxed) {
                    break;
                }
                let stream = match listener.accept() {
                    Ok((s, _)) => s,
                    Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(50));
                        continue;
                    }
                    Err(_) => continue,
                };

                let host = std::ffi::CString::new("127.0.0.1").unwrap();
                let ctx = unsafe { ffi::modbus_new_tcp(host.as_ptr(), 0) };
                drop(host);
                if ctx.is_null() {
                    continue;
                }

                let client_fd = stream.into_raw_fd();
                unsafe {
                    ffi::modbus_set_socket(ctx, client_fd);
                    ffi::modbus_set_response_timeout(ctx, 1, 0);
                }

                let mut query = [0u8; ffi::MODBUS_TCP_MAX_ADU_LENGTH as usize];
                loop {
                    let rc = unsafe { ffi::modbus_receive(ctx, query.as_mut_ptr()) };
                    if rc <= 0 {
                        break;
                    }
                    unsafe {
                        ffi::modbus_reply(ctx, query.as_ptr(), rc, mapping);
                    }
                }

                unsafe {
                    ffi::modbus_close(ctx);
                    ffi::modbus_free(ctx);
                }
            }
        });

        (actual_port, handle)
    }

    fn shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }
}

fn setup(nb_coils: u16, nb_registers: u16) -> (TestServer, JoinHandle<()>, ModbusClient) {
    let server = TestServer::new(0, nb_coils, nb_registers);
    let (port, handle) = server.run();
    thread::sleep(Duration::from_millis(100));
    let client = ModbusClient::new_tcp("127.0.0.1", port).unwrap();
    client.connect().unwrap();
    (server, handle, client)
}

#[test]
fn test_read_holding_registers() {
    let (server, handle, client) = setup(0, 10);
    server.set_register(0, 0xABCD);
    server.set_register(1, 0x1234);
    let values = client.read_holding_registers(0, 2).unwrap();
    assert_eq!(values, vec![0xABCD, 0x1234]);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_write_single_register() {
    let (server, handle, client) = setup(0, 10);
    client.write_single_register(0, 42).unwrap();
    let values = client.read_holding_registers(0, 1).unwrap();
    assert_eq!(values, vec![42]);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_write_multiple_registers() {
    let (server, handle, client) = setup(0, 20);
    client.write_multiple_registers(2, &[100, 200, 300, 400]).unwrap();
    let values = client.read_holding_registers(2, 4).unwrap();
    assert_eq!(values, vec![100, 200, 300, 400]);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_read_write_coils() {
    let (server, handle, client) = setup(16, 0);
    server.set_coil(3, true);
    let bits = client.read_coils(3, 3).unwrap();
    assert_eq!(bits, vec![true, false, false]);
    client.write_single_coil(5, true).unwrap();
    let bits = client.read_coils(5, 1).unwrap();
    assert_eq!(bits, vec![true]);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_halvalue_roundtrip_u16() {
    let (server, handle, client) = setup(0, 10);
    server.set_register(0, 0xFF00);
    let values = client.read_holding_registers(0, 1).unwrap();
    assert_eq!(values[0], 0xFF00);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_halvalue_roundtrip_f32() {
    let (server, handle, client) = setup(0, 4);
    let original: f32 = std::f32::consts::PI;
    let bits = original.to_bits();
    server.set_register(0, (bits >> 16) as u16);
    server.set_register(1, bits as u16);
    let regs = client.read_holding_registers(0, 2).unwrap();
    let decoded_bits = ((regs[0] as u32) << 16) | (regs[1] as u32);
    let decoded = f32::from_bits(decoded_bits);
    assert!((decoded - original).abs() < f32::EPSILON);
    client.disconnect();
    server.shutdown();
    handle.join().unwrap();
}

#[test]
fn test_multiple_clients() {
    let server = TestServer::new(0, 0, 10);
    let (port, handle) = server.run();
    thread::sleep(Duration::from_millis(100));

    let c1 = ModbusClient::new_tcp("127.0.0.1", port).unwrap();
    c1.connect().unwrap();
    c1.write_single_register(0, 100).unwrap();
    assert_eq!(c1.read_holding_registers(0, 1).unwrap(), vec![100]);
    c1.disconnect();

    thread::sleep(Duration::from_millis(100));

    let c2 = ModbusClient::new_tcp("127.0.0.1", port).unwrap();
    c2.connect().unwrap();
    assert_eq!(c2.read_holding_registers(0, 1).unwrap(), vec![100]);
    c2.write_single_register(1, 200).unwrap();
    assert_eq!(c2.read_holding_registers(1, 1).unwrap(), vec![200]);
    c2.disconnect();

    server.shutdown();
    handle.join().unwrap();
}
