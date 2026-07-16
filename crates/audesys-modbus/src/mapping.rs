use audesys_hal_core::HalValue;

use crate::error::ModbusError;

/// Target register interpretation for converting between Modbus registers and HalValue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegisterType {
    U16,
    S16,
    U32,
    S32,
    F32,
    F64,
    Coil,
    ArrayU16,
}

/// Convert Modbus registers (host byte order) into a typed HalValue.
///
/// Registers from libmodbus are in host byte order (little-endian on macOS/x86).
/// Multi-register values are combined big-endian: reg[0] is the high word.
pub fn registers_to_halvalue(
    regs: &[u16],
    target_type: RegisterType,
) -> Result<HalValue, ModbusError> {
    match target_type {
        RegisterType::U16 => {
            if regs.is_empty() {
                return Err(ModbusError::InvalidData("empty register slice for U16".into()));
            }
            Ok(HalValue::U16(regs[0]))
        }
        RegisterType::S16 => {
            if regs.is_empty() {
                return Err(ModbusError::InvalidData("empty register slice for S16".into()));
            }
            Ok(HalValue::S16(regs[0] as i16))
        }
        RegisterType::U32 => {
            if regs.len() < 2 {
                return Err(ModbusError::InvalidData(format!(
                    "need 2 registers for U32, got {}",
                    regs.len()
                )));
            }
            let val = ((regs[0] as u32) << 16) | (regs[1] as u32);
            Ok(HalValue::U32(val))
        }
        RegisterType::S32 => {
            if regs.len() < 2 {
                return Err(ModbusError::InvalidData(format!(
                    "need 2 registers for S32, got {}",
                    regs.len()
                )));
            }
            let bits = ((regs[0] as u32) << 16) | (regs[1] as u32);
            Ok(HalValue::S32(bits as i32))
        }
        RegisterType::F32 => {
            if regs.len() < 2 {
                return Err(ModbusError::InvalidData(format!(
                    "need 2 registers for F32, got {}",
                    regs.len()
                )));
            }
            let bits = ((regs[0] as u32) << 16) | (regs[1] as u32);
            Ok(HalValue::F32(f32::from_bits(bits)))
        }
        RegisterType::F64 => {
            if regs.len() < 4 {
                return Err(ModbusError::InvalidData(format!(
                    "need 4 registers for F64, got {}",
                    regs.len()
                )));
            }
            let bits = ((regs[0] as u64) << 48)
                | ((regs[1] as u64) << 32)
                | ((regs[2] as u64) << 16)
                | (regs[3] as u64);
            Ok(HalValue::F64(f64::from_bits(bits)))
        }
        RegisterType::Coil => {
            // ponytail: treat u16 registers as u8 bytes for Coil interpretation
            let bytes: Vec<u8> = regs.iter().flat_map(|r| r.to_le_bytes()).collect();
            Ok(coils_to_halvalue(&bytes))
        }
        RegisterType::ArrayU16 => Ok(HalValue::Array {
            element_type: audesys_hal_core::HalPinType::U16,
            // ponytail: u16 → le_bytes, fixed endianness. Add explicit endianness
            // control if cross-platform determinism is needed.
            data: regs.iter().flat_map(|r| r.to_le_bytes()).collect(),
        }),
    }
}

/// Convert a HalValue to Modbus registers (host byte order).
pub fn halvalue_to_registers(value: &HalValue) -> Result<(Vec<u16>, RegisterType), ModbusError> {
    match value {
        HalValue::Bool(v) => Ok((vec![*v as u16], RegisterType::Coil)),
        HalValue::S8(v) => Ok((vec![*v as u16], RegisterType::S16)),
        HalValue::U8(v) => Ok((vec![*v as u16], RegisterType::U16)),
        HalValue::S16(v) => Ok((vec![*v as u16], RegisterType::S16)),
        HalValue::U16(v) => Ok((vec![*v], RegisterType::U16)),
        HalValue::S32(v) => {
            let bits = *v as u32;
            Ok((vec![(bits >> 16) as u16, bits as u16], RegisterType::S32))
        }
        HalValue::U32(v) => {
            let bits = *v;
            Ok((vec![(bits >> 16) as u16, bits as u16], RegisterType::U32))
        }
        HalValue::S64(v) => {
            let bits = *v as u64;
            Ok((
                vec![(bits >> 48) as u16, (bits >> 32) as u16, (bits >> 16) as u16, bits as u16],
                RegisterType::F64,
            ))
        }
        HalValue::U64(v) => {
            let bits = *v;
            Ok((
                vec![(bits >> 48) as u16, (bits >> 32) as u16, (bits >> 16) as u16, bits as u16],
                RegisterType::F64,
            ))
        }
        HalValue::F32(v) => {
            let bits = v.to_bits();
            Ok((vec![(bits >> 16) as u16, bits as u16], RegisterType::F32))
        }
        HalValue::F64(v) => {
            let bits = v.to_bits();
            Ok((
                vec![(bits >> 48) as u16, (bits >> 32) as u16, (bits >> 16) as u16, bits as u16],
                RegisterType::F64,
            ))
        }
        HalValue::Blob(v) => {
            if v.len() % 2 != 0 {
                return Err(ModbusError::InvalidData(format!(
                    "Blob length {} not a multiple of 2 (u16)",
                    v.len()
                )));
            }
            let regs: Vec<u16> = v.chunks(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            Ok((regs, RegisterType::ArrayU16))
        }
        HalValue::Array { element_type, data } => {
            if *element_type != audesys_hal_core::HalPinType::U16 {
                return Err(ModbusError::Unsupported(format!(
                    "Array element type {element_type:?} not supported for Modbus"
                )));
            }
            if data.len() % 2 != 0 {
                return Err(ModbusError::InvalidData(format!(
                    "Array data length {} not a multiple of 2",
                    data.len()
                )));
            }
            let regs: Vec<u16> = data.chunks(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            Ok((regs, RegisterType::ArrayU16))
        }
        HalValue::String(s) => {
            let bytes = s.as_bytes();
            if bytes.len() % 2 != 0 {
                return Err(ModbusError::InvalidData(format!(
                    "String length {} not a multiple of 2",
                    bytes.len()
                )));
            }
            let regs: Vec<u16> =
                bytes.chunks(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            Ok((regs, RegisterType::ArrayU16))
        }
    }
}

/// Convert a byte slice (from read_coils / read_discrete_inputs) to HalValue.
pub fn coils_to_halvalue(coils: &[u8]) -> HalValue {
    match coils.len() {
        0 => HalValue::Bool(false),
        1 => HalValue::Bool(coils[0] != 0),
        _ => HalValue::Array {
            element_type: audesys_hal_core::HalPinType::Bool,
            data: coils.to_vec(),
        },
    }
}
