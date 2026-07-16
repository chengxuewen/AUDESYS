//! HART variable type discriminators.
//!
//! Provides HART-specific type information used by the adapter to
//! decode command response data into [`HalValue`].

use audesys_hal_core::HalPinType;

// ── variable type ──────────────────────────────────────────────────────

/// HART variable classification mapped to [`HalPinType`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VariableType {
    /// IEEE 754 single-precision float (4 bytes).
    Float,
    /// 8-bit unsigned integer.
    U8,
    /// 16-bit unsigned integer (big-endian on wire).
    U16,
    /// 24-bit unsigned integer (big-endian on wire).
    U24,
    /// Device status byte pair.
    Status,
}

impl VariableType {
    /// Returns the HAL pin type this variable maps to.
    pub fn to_pin_type(self) -> HalPinType {
        match self {
            VariableType::Float => HalPinType::F32,
            VariableType::U8 => HalPinType::U8,
            VariableType::U16 => HalPinType::U16,
            VariableType::U24 => HalPinType::U32, // 24-bit stored in u32
            VariableType::Status => HalPinType::U16,
        }
    }
}

// ── conversion helpers ─────────────────────────────────────────────────

/// Decode a HART IEEE 754 big-endian float from 4 bytes.
fn decode_f32_be(bytes: &[u8]) -> f32 {
    let arr: [u8; 4] = bytes[..4].try_into().unwrap_or([0; 4]);
    f32::from_bits(u32::from_be_bytes(arr))
}

/// Encode a float to HART IEEE 754 big-endian bytes.
fn encode_f32_be(val: f32) -> [u8; 4] {
    val.to_bits().to_be_bytes()
}

/// Decode big-endian u16 from 2 bytes.
fn decode_u16_be(bytes: &[u8]) -> u16 {
    let arr: [u8; 2] = bytes[..2].try_into().unwrap_or([0; 2]);
    u16::from_be_bytes(arr)
}

/// Read big-endian u24 from 3 bytes into a u32.
fn decode_u24_be(bytes: &[u8]) -> u32 {
    (u32::from(bytes[0]) << 16) | (u32::from(bytes[1]) << 8) | u32::from(bytes[2])
}

/// Convert a HART variable byte slice to [`HalValue`].
///
/// The `var_type` selects the decoding format.
pub fn variables_to_halvalue(
    data: &[u8],
    var_type: VariableType,
) -> Result<audesys_hal_core::HalValue, super::error::HartError> {
    match var_type {
        VariableType::Float => {
            if data.len() < 4 {
                return Err(super::error::HartError::InvalidData("float requires 4 bytes".into()));
            }
            Ok(audesys_hal_core::HalValue::F32(decode_f32_be(data)))
        }
        VariableType::U8 => {
            if data.is_empty() {
                return Err(super::error::HartError::InvalidData("u8 requires 1 byte".into()));
            }
            Ok(audesys_hal_core::HalValue::U8(data[0]))
        }
        VariableType::U16 => {
            if data.len() < 2 {
                return Err(super::error::HartError::InvalidData("u16 requires 2 bytes".into()));
            }
            Ok(audesys_hal_core::HalValue::U16(decode_u16_be(data)))
        }
        VariableType::U24 => {
            if data.len() < 3 {
                return Err(super::error::HartError::InvalidData("u24 requires 3 bytes".into()));
            }
            Ok(audesys_hal_core::HalValue::U32(decode_u24_be(data)))
        }
        VariableType::Status => {
            if data.len() < 2 {
                return Err(super::error::HartError::InvalidData("status requires 2 bytes".into()));
            }
            Ok(audesys_hal_core::HalValue::U16(decode_u16_be(data)))
        }
    }
}

/// Convert a [`HalValue`] to HART wire-format bytes.
///
/// Returns the bytes and the [`VariableType`] they represent.
pub fn halvalue_to_variables(
    value: &audesys_hal_core::HalValue,
) -> Result<(Vec<u8>, VariableType), super::error::HartError> {
    match value {
        audesys_hal_core::HalValue::F32(v) => Ok((encode_f32_be(*v).to_vec(), VariableType::Float)),
        audesys_hal_core::HalValue::U8(v) => Ok((vec![*v], VariableType::U8)),
        audesys_hal_core::HalValue::U16(v) => Ok((v.to_be_bytes().to_vec(), VariableType::U16)),
        audesys_hal_core::HalValue::U32(v) => {
            let raw = v.to_be_bytes();
            Ok((raw[1..].to_vec(), VariableType::U24))
        }
        other => Err(super::error::HartError::Unsupported(format!(
            "HalValue variant {other:?} has no HART wire equivalent"
        ))),
    }
}

// ── tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::HalValue;

    #[test]
    fn roundtrip_f32() {
        let v = HalValue::F32(42.5);
        let (data, vt) = halvalue_to_variables(&v).unwrap();
        assert_eq!(vt, VariableType::Float);
        let back = variables_to_halvalue(&data, vt).unwrap();
        assert_eq!(back, v);
    }

    #[test]
    fn roundtrip_u16() {
        let v = HalValue::U16(0xAABB);
        let (data, vt) = halvalue_to_variables(&v).unwrap();
        assert_eq!(vt, VariableType::U16);
        let back = variables_to_halvalue(&data, vt).unwrap();
        assert_eq!(back, v);
    }

    #[test]
    fn roundtrip_u24() {
        let v = HalValue::U32(0x123456);
        let (data, vt) = halvalue_to_variables(&v).unwrap();
        assert_eq!(vt, VariableType::U24);
        assert_eq!(data.len(), 3);
        let back = variables_to_halvalue(&data, vt).unwrap();
        assert_eq!(back, HalValue::U32(0x123456));
    }

    #[test]
    fn decode_f32_ieee754() {
        // 42.5 in IEEE 754 big-endian: 0x422A0000
        let data = [0x42, 0x2A, 0x00, 0x00];
        let val = variables_to_halvalue(&data, VariableType::Float).unwrap();
        assert_eq!(val, HalValue::F32(42.5));
    }

    #[test]
    fn unsupported_variant() {
        let v = HalValue::Bool(true);
        let err = halvalue_to_variables(&v).unwrap_err();
        assert!(matches!(err, crate::error::HartError::Unsupported(_)));
    }
}
