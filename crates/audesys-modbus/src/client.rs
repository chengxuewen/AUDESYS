use std::ffi::CString;
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};

use audesys_modbus_sys::{
    self as ffi, MODBUS_MAX_READ_REGISTERS, MODBUS_MAX_WRITE_REGISTERS, modbus_t,
};

use crate::error::{ModbusError, last_modbus_error};

pub struct ModbusClient {
    ctx: NonNull<modbus_t>,
    connected: AtomicBool,
}

// SAFETY: libmodbus is thread-safe when each context is used by one thread at a time.
// ModbusClient is !Sync (contains AtomicBool), so it's already single-thread-owned.
unsafe impl Send for ModbusClient {}

impl Drop for ModbusClient {
    fn drop(&mut self) {
        if self.connected.load(Ordering::Relaxed) {
            // SAFETY: ctx is non-null and was obtained from modbus_new_tcp.
            unsafe { ffi::modbus_close(self.ctx.as_ptr()) };
        }
        // SAFETY: ctx is non-null, obtained from modbus_new_tcp, and has not been freed.
        unsafe { ffi::modbus_free(self.ctx.as_ptr()) };
    }
}

impl ModbusClient {
    pub fn new_tcp(host: &str, port: u16) -> Result<Self, ModbusError> {
        let c_host = CString::new(host).map_err(|e| ModbusError::Connection(e.to_string()))?;
        // SAFETY: c_host is a valid CString. port fits in c_int (u16 ≤ i32::MAX).
        let raw = unsafe { ffi::modbus_new_tcp(c_host.as_ptr(), port as std::os::raw::c_int) };
        // Drop c_host after the FFI call — modbus_new_tcp copies the string internally.
        drop(c_host);

        let ctx = NonNull::new(raw)
            .ok_or_else(|| ModbusError::Connection("failed to create TCP context".into()))?;

        Ok(Self { ctx, connected: AtomicBool::new(false) })
    }

    pub fn connect(&self) -> Result<(), ModbusError> {
        // SAFETY: ctx is non-null and valid.
        let ret = unsafe { ffi::modbus_connect(self.ctx.as_ptr()) };
        if ret != 0 {
            return Err(ModbusError::Connection(last_modbus_error()));
        }

        // Set response timeout: 1 second.
        // SAFETY: ctx is non-null and connected.
        unsafe {
            ffi::modbus_set_response_timeout(self.ctx.as_ptr(), 1, 0);
        }

        self.connected.store(true, Ordering::Release);
        Ok(())
    }

    pub fn disconnect(&self) {
        if self.connected.swap(false, Ordering::AcqRel) {
            // SAFETY: ctx is non-null, was connected, and has not been closed.
            unsafe { ffi::modbus_close(self.ctx.as_ptr()) };
        }
    }

    pub fn new_rtu(
        device: &str,
        baud: u32,
        parity: char,
        data_bits: u8,
        stop_bits: u8,
    ) -> Result<Self, ModbusError> {
        let c_device = CString::new(device).map_err(|e| ModbusError::Connection(e.to_string()))?;
        // SAFETY: c_device is a valid CString. Parameters fit in c_int/c_char.
        let raw = unsafe {
            ffi::modbus_new_rtu(
                c_device.as_ptr(),
                baud as std::os::raw::c_int,
                parity as std::os::raw::c_char,
                data_bits as std::os::raw::c_int,
                stop_bits as std::os::raw::c_int,
            )
        };
        // Drop c_device after the FFI call — modbus_new_rtu copies the string internally.
        drop(c_device);

        let ctx = NonNull::new(raw)
            .ok_or_else(|| ModbusError::Connection("failed to create RTU context".into()))?;

        Ok(Self { ctx, connected: AtomicBool::new(false) })
    }

    pub fn set_slave(&self, id: u8) -> Result<(), ModbusError> {
        // SAFETY: ctx is non-null.
        let ret = unsafe { ffi::modbus_set_slave(self.ctx.as_ptr(), id as std::os::raw::c_int) };
        if ret != 0 {
            return Err(ModbusError::Protocol(last_modbus_error()));
        }
        Ok(())
    }

    fn check_connected(&self) -> Result<(), ModbusError> {
        if !self.connected.load(Ordering::Acquire) {
            return Err(ModbusError::NotConnected);
        }
        Ok(())
    }

    pub fn read_holding_registers(&self, addr: u16, count: u16) -> Result<Vec<u16>, ModbusError> {
        self.check_connected()?;
        if count == 0 || count > MODBUS_MAX_READ_REGISTERS as u16 {
            return Err(ModbusError::InvalidData(format!(
                "count {count} not in 1..={MAX}",
                MAX = MODBUS_MAX_READ_REGISTERS
            )));
        }

        let mut buf = vec![0u16; count as usize];
        // SAFETY: ctx is non-null, connected, buf is valid for count u16 elements.
        let ret = unsafe {
            ffi::modbus_read_registers(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                count as std::os::raw::c_int,
                buf.as_mut_ptr(),
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        // SAFETY: ret ≥ 0, truncate to actual count read.
        buf.truncate(ret as usize);
        Ok(buf)
    }

    pub fn read_input_registers(&self, addr: u16, count: u16) -> Result<Vec<u16>, ModbusError> {
        self.check_connected()?;
        if count == 0 || count > MODBUS_MAX_READ_REGISTERS as u16 {
            return Err(ModbusError::InvalidData(format!(
                "count {count} not in 1..={MAX}",
                MAX = MODBUS_MAX_READ_REGISTERS
            )));
        }

        let mut buf = vec![0u16; count as usize];
        // SAFETY: ctx is non-null, connected, buf is valid for count u16 elements.
        let ret = unsafe {
            ffi::modbus_read_input_registers(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                count as std::os::raw::c_int,
                buf.as_mut_ptr(),
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        buf.truncate(ret as usize);
        Ok(buf)
    }

    pub fn read_coils(&self, addr: u16, count: u16) -> Result<Vec<bool>, ModbusError> {
        self.check_connected()?;
        if count == 0 {
            return Err(ModbusError::InvalidData("count must be > 0".into()));
        }

        let mut buf = vec![0u8; count as usize];
        // SAFETY: ctx is non-null, connected, buf is valid for count u8 elements.
        let ret = unsafe {
            ffi::modbus_read_bits(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                count as std::os::raw::c_int,
                buf.as_mut_ptr(),
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        buf.truncate(ret as usize);
        Ok(buf.into_iter().map(|b| b != 0).collect())
    }

    pub fn read_discrete_inputs(&self, addr: u16, count: u16) -> Result<Vec<bool>, ModbusError> {
        self.check_connected()?;
        if count == 0 {
            return Err(ModbusError::InvalidData("count must be > 0".into()));
        }

        let mut buf = vec![0u8; count as usize];
        // SAFETY: ctx is non-null, connected, buf is valid for count u8 elements.
        let ret = unsafe {
            ffi::modbus_read_input_bits(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                count as std::os::raw::c_int,
                buf.as_mut_ptr(),
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        buf.truncate(ret as usize);
        Ok(buf.into_iter().map(|b| b != 0).collect())
    }

    pub fn write_single_coil(&self, addr: u16, value: bool) -> Result<(), ModbusError> {
        self.check_connected()?;
        // SAFETY: ctx is non-null, connected.
        let ret = unsafe {
            ffi::modbus_write_bit(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                value as std::os::raw::c_int,
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        Ok(())
    }

    pub fn write_single_register(&self, addr: u16, value: u16) -> Result<(), ModbusError> {
        self.check_connected()?;
        // SAFETY: ctx is non-null, connected.
        let ret = unsafe {
            ffi::modbus_write_register(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                value as std::os::raw::c_int,
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        Ok(())
    }

    pub fn write_multiple_registers(&self, addr: u16, values: &[u16]) -> Result<(), ModbusError> {
        self.check_connected()?;
        let nb = values.len();
        if nb == 0 || nb > MODBUS_MAX_WRITE_REGISTERS as usize {
            return Err(ModbusError::InvalidData(format!(
                "count {nb} not in 1..={MAX}",
                MAX = MODBUS_MAX_WRITE_REGISTERS
            )));
        }
        // SAFETY: ctx is non-null, connected, values is valid for nb u16 elements.
        let ret = unsafe {
            ffi::modbus_write_registers(
                self.ctx.as_ptr(),
                addr as std::os::raw::c_int,
                nb as std::os::raw::c_int,
                values.as_ptr(),
            )
        };
        if ret < 0 {
            return Err(ModbusError::Io(last_modbus_error()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_rtu_invalid_device() {
        let client = ModbusClient::new_rtu("/nonexistent/device", 9600, 'N', 8, 1).unwrap();
        assert!(client.connect().is_err());
    }
}
