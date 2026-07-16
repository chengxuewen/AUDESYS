#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(clippy::missing_safety_doc)]

use std::os::raw::{c_char, c_int};

// ── opaque type ──────────────────────────────────────────────────────────

/// Opaque handle to a libmodbus context.
///
/// SAFETY: every public function that takes `*mut modbus_t` is `unsafe`
/// because the pointer must be non-null AND obtained from the matching
/// `modbus_new_*` constructor (Tcp / Rtu).
pub enum modbus_t {}

// ── memory mapping struct ────────────────────────────────────────────────

/// Server-side register/coil mapping.
///
/// Owned by libmodbus — use `modbus_mapping_free` to deallocate.
#[repr(C)]
pub struct modbus_mapping_t {
    pub nb_bits: c_int,
    pub start_bits: c_int,
    pub nb_input_bits: c_int,
    pub start_input_bits: c_int,
    pub nb_input_registers: c_int,
    pub start_input_registers: c_int,
    pub nb_registers: c_int,
    pub start_registers: c_int,
    pub tab_bits: *mut u8,
    pub tab_input_bits: *mut u8,
    pub tab_input_registers: *mut u16,
    pub tab_registers: *mut u16,
}

// ── protocol constants ───────────────────────────────────────────────────

/// Max coils / discrete-inputs that can be read in one request.
pub const MODBUS_MAX_READ_BITS: c_int = 2000;
/// Max holding / input registers that can be read in one request.
pub const MODBUS_MAX_READ_REGISTERS: c_int = 125;
/// Max coils that can be written in one request.
pub const MODBUS_MAX_WRITE_BITS: c_int = 1968;
/// Max holding registers that can be written in one request.
pub const MODBUS_MAX_WRITE_REGISTERS: c_int = 123;

pub const MODBUS_READ_COIL_STATUS: u8 = 0x01;
pub const MODBUS_READ_INPUT_STATUS: u8 = 0x02;
pub const MODBUS_READ_HOLDING_REGISTERS: u8 = 0x03;
pub const MODBUS_READ_INPUT_REGISTERS: u8 = 0x04;
pub const MODBUS_WRITE_SINGLE_COIL: u8 = 0x05;
pub const MODBUS_WRITE_SINGLE_REGISTER: u8 = 0x06;
pub const MODBUS_WRITE_MULTIPLE_COILS: u8 = 0x0F;
pub const MODBUS_WRITE_MULTIPLE_REGISTERS: u8 = 0x10;

// ── TCP constants ─────────────────────────────────────────────────────────

pub const MODBUS_TCP_DEFAULT_PORT: c_int = 502;
pub const MODBUS_TCP_SLAVE: u8 = 0xFF;
pub const MODBUS_TCP_MAX_ADU_LENGTH: c_int = 260;

// ── error recovery bitmask ───────────────────────────────────────────────

pub const MODBUS_ERROR_RECOVERY_LINK: c_int = 1;
pub const MODBUS_ERROR_RECOVERY_PROTOCOL: c_int = 2;

// ── FFI declarations ─────────────────────────────────────────────────────

#[link(name = "modbus")]
unsafe extern "C" {
    // ── context lifetime ──────────────────────────────────────────────

    pub fn modbus_new_tcp(ip: *const c_char, port: c_int) -> *mut modbus_t;

    pub fn modbus_new_rtu(
        device: *const c_char,
        baud: c_int,
        parity: c_char,
        data_bit: c_int,
        stop_bit: c_int,
    ) -> *mut modbus_t;

    pub fn modbus_connect(ctx: *mut modbus_t) -> c_int;
    pub fn modbus_close(ctx: *mut modbus_t);
    pub fn modbus_free(ctx: *mut modbus_t);
    pub fn modbus_flush(ctx: *mut modbus_t) -> c_int;

    // ── configuration ─────────────────────────────────────────────────

    pub fn modbus_set_slave(ctx: *mut modbus_t, slave: c_int) -> c_int;

    pub fn modbus_set_response_timeout(ctx: *mut modbus_t, sec: u32, usec: u32) -> c_int;

    pub fn modbus_set_byte_timeout(ctx: *mut modbus_t, sec: u32, usec: u32) -> c_int;

    pub fn modbus_set_error_recovery(ctx: *mut modbus_t, error_recovery: c_int) -> c_int;

    pub fn modbus_set_debug(ctx: *mut modbus_t, flag: c_int) -> c_int;

    // ── read ──────────────────────────────────────────────────────────

    pub fn modbus_read_bits(ctx: *mut modbus_t, addr: c_int, nb: c_int, dest: *mut u8) -> c_int;

    pub fn modbus_read_input_bits(
        ctx: *mut modbus_t,
        addr: c_int,
        nb: c_int,
        dest: *mut u8,
    ) -> c_int;

    pub fn modbus_read_registers(
        ctx: *mut modbus_t,
        addr: c_int,
        nb: c_int,
        dest: *mut u16,
    ) -> c_int;

    pub fn modbus_read_input_registers(
        ctx: *mut modbus_t,
        addr: c_int,
        nb: c_int,
        dest: *mut u16,
    ) -> c_int;

    // ── write ─────────────────────────────────────────────────────────

    pub fn modbus_write_bit(ctx: *mut modbus_t, addr: c_int, status: c_int) -> c_int;

    pub fn modbus_write_register(ctx: *mut modbus_t, addr: c_int, value: c_int) -> c_int;

    pub fn modbus_write_bits(ctx: *mut modbus_t, addr: c_int, nb: c_int, data: *const u8) -> c_int;

    pub fn modbus_write_registers(
        ctx: *mut modbus_t,
        addr: c_int,
        nb: c_int,
        data: *const u16,
    ) -> c_int;

    // ── server-side ───────────────────────────────────────────────────

    pub fn modbus_mapping_new(
        nb_bits: c_int,
        nb_input_bits: c_int,
        nb_registers: c_int,
        nb_input_registers: c_int,
    ) -> *mut modbus_mapping_t;

    pub fn modbus_mapping_free(mb_mapping: *mut modbus_mapping_t);

    pub fn modbus_tcp_listen(ctx: *mut modbus_t, nb_connection: c_int) -> c_int;

    pub fn modbus_tcp_accept(ctx: *mut modbus_t, s: *mut c_int) -> c_int;

    pub fn modbus_receive(ctx: *mut modbus_t, req: *mut u8) -> c_int;

    pub fn modbus_reply(
        ctx: *mut modbus_t,
        req: *const u8,
        req_length: c_int,
        mb_mapping: *mut modbus_mapping_t,
    ) -> c_int;

    pub fn modbus_reply_exception(
        ctx: *mut modbus_t,
        req: *const u8,
        exception_code: c_int,
    ) -> c_int;

    // ── socket access ─────────────────────────────────────────────────

    pub fn modbus_get_socket(ctx: *mut modbus_t) -> c_int;
    pub fn modbus_set_socket(ctx: *mut modbus_t, s: c_int) -> c_int;

    // ── diagnostics ───────────────────────────────────────────────────

    pub fn modbus_strerror(errnum: c_int) -> *const c_char;
}
