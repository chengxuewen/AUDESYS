//! Manual binary encoding/decoding for HalValue.
//! 来源: docs/modules/hal/iec-type-system-design.md (D12)
//!
//! Simple fixed-width encoding for test validation only.
//! Not intended as a production serialization format — FlatBuffers is used for that.
//!
//! # Encoding format (little-endian)
//! - 1-byte type tag (0-12 = scalar/container, 13 = Array)
//! - Value bytes per type:
//!   - Bool(0):  1 byte (0 or 1)
//!   - S8(1)/U8(2): 1 byte
//!   - S16(3)/U16(4): 2 bytes
//!   - S32(5)/U32(6)/F32(9): 4 bytes
//!   - S64(7)/U64(8)/F64(10): 8 bytes
//!   - Blob(11):  4-byte length (u32 LE) + raw bytes
//!   - String(12): 4-byte length (u32 LE) + UTF-8 bytes
//!   - Array(13): 1-byte element_type tag + 4-byte data length (u32 LE) + raw data

use crate::types::{HalError, HalPinType, HalResult};
use crate::value::HalValue;

// ── Type tag constants (aligned with HalPinType discriminant order) ──

const TAG_BOOL: u8 = 0;
const TAG_S8: u8 = 1;
const TAG_U8: u8 = 2;
const TAG_S16: u8 = 3;
const TAG_U16: u8 = 4;
const TAG_S32: u8 = 5;
const TAG_U32: u8 = 6;
const TAG_S64: u8 = 7;
const TAG_U64: u8 = 8;
const TAG_F32: u8 = 9;
const TAG_F64: u8 = 10;
const TAG_BLOB: u8 = 11;
const TAG_STRING: u8 = 12;
const TAG_ARRAY: u8 = 13;

// ── Tag ↔ HalPinType mapping ──

fn pin_type_to_tag(pt: HalPinType) -> u8 {
    match pt {
        HalPinType::Bool => TAG_BOOL,
        HalPinType::S8 => TAG_S8,
        HalPinType::U8 => TAG_U8,
        HalPinType::S16 => TAG_S16,
        HalPinType::U16 => TAG_U16,
        HalPinType::S32 => TAG_S32,
        HalPinType::U32 => TAG_U32,
        HalPinType::S64 => TAG_S64,
        HalPinType::U64 => TAG_U64,
        HalPinType::F32 => TAG_F32,
        HalPinType::F64 => TAG_F64,
        HalPinType::Blob => TAG_BLOB,
        HalPinType::String => TAG_STRING,
    }
}

fn tag_to_pin_type(tag: u8) -> Option<HalPinType> {
    match tag {
        TAG_BOOL => Some(HalPinType::Bool),
        TAG_S8 => Some(HalPinType::S8),
        TAG_U8 => Some(HalPinType::U8),
        TAG_S16 => Some(HalPinType::S16),
        TAG_U16 => Some(HalPinType::U16),
        TAG_S32 => Some(HalPinType::S32),
        TAG_U32 => Some(HalPinType::U32),
        TAG_S64 => Some(HalPinType::S64),
        TAG_U64 => Some(HalPinType::U64),
        TAG_F32 => Some(HalPinType::F32),
        TAG_F64 => Some(HalPinType::F64),
        TAG_BLOB => Some(HalPinType::Blob),
        TAG_STRING => Some(HalPinType::String),
        _ => None,
    }
}

// ── Public API ──

/// Encode a `HalValue` into a byte buffer using the manual binary format.
///
/// # Panics
/// Does not panic. All HalValue variants are supported.
pub fn encode_halvalue(v: &HalValue) -> Vec<u8> {
    let mut buf = Vec::new();
    match v {
        HalValue::Bool(b) => {
            buf.push(TAG_BOOL);
            buf.push(if *b { 1 } else { 0 });
        }
        HalValue::S8(n) => {
            buf.push(TAG_S8);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::U8(n) => {
            buf.push(TAG_U8);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::S16(n) => {
            buf.push(TAG_S16);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::U16(n) => {
            buf.push(TAG_U16);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::S32(n) => {
            buf.push(TAG_S32);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::U32(n) => {
            buf.push(TAG_U32);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::S64(n) => {
            buf.push(TAG_S64);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::U64(n) => {
            buf.push(TAG_U64);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::F32(n) => {
            buf.push(TAG_F32);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::F64(n) => {
            buf.push(TAG_F64);
            buf.extend_from_slice(&n.to_le_bytes());
        }
        HalValue::Blob(data) => {
            buf.push(TAG_BLOB);
            let len = data.len() as u32;
            buf.extend_from_slice(&len.to_le_bytes());
            buf.extend_from_slice(data);
        }
        HalValue::String(s) => {
            buf.push(TAG_STRING);
            let bytes = s.as_bytes();
            let len = bytes.len() as u32;
            buf.extend_from_slice(&len.to_le_bytes());
            buf.extend_from_slice(bytes);
        }
        HalValue::Array { element_type, data } => {
            buf.push(TAG_ARRAY);
            buf.push(pin_type_to_tag(*element_type));
            let data_len = data.len() as u32;
            buf.extend_from_slice(&data_len.to_le_bytes());
            buf.extend_from_slice(data);
        }
    }
    buf
}

/// Decode a byte buffer back into a `HalValue`.
///
/// # Errors
/// - `UnknownHalType` — type tag is not 0-13
/// - `InvalidBlobLength` — Blob declared length does not match remaining bytes
/// - `InvalidUtf8` — String contains invalid UTF-8
/// - `TypeMismatch` — Array element_type tag is not a valid scalar type (0-12)
pub fn decode_halvalue(buf: &[u8]) -> HalResult<HalValue> {
    if buf.is_empty() {
        return Err(HalError::Internal("empty buffer".into()));
    }

    let tag = buf[0];
    let payload = &buf[1..];

    match tag {
        TAG_BOOL => {
            if payload.is_empty() {
                return Err(HalError::Internal("bool: missing value byte".into()));
            }
            Ok(HalValue::Bool(payload[0] != 0))
        }
        TAG_S8 => {
            if payload.is_empty() {
                return Err(HalError::Internal("S8: insufficient bytes".into()));
            }
            Ok(HalValue::S8(i8::from_le_bytes([payload[0]])))
        }
        TAG_U8 => {
            if payload.is_empty() {
                return Err(HalError::Internal("U8: insufficient bytes".into()));
            }
            Ok(HalValue::U8(payload[0]))
        }
        TAG_S16 => {
            if payload.len() < 2 {
                return Err(HalError::Internal("S16: insufficient bytes".into()));
            }
            Ok(HalValue::S16(i16::from_le_bytes([payload[0], payload[1]])))
        }
        TAG_U16 => {
            if payload.len() < 2 {
                return Err(HalError::Internal("U16: insufficient bytes".into()));
            }
            Ok(HalValue::U16(u16::from_le_bytes([payload[0], payload[1]])))
        }
        TAG_S32 => {
            if payload.len() < 4 {
                return Err(HalError::Internal("S32: insufficient bytes".into()));
            }
            Ok(HalValue::S32(i32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]])))
        }
        TAG_U32 => {
            if payload.len() < 4 {
                return Err(HalError::Internal("U32: insufficient bytes".into()));
            }
            Ok(HalValue::U32(u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]])))
        }
        TAG_S64 => {
            if payload.len() < 8 {
                return Err(HalError::Internal("S64: insufficient bytes".into()));
            }
            Ok(HalValue::S64(i64::from_le_bytes([
                payload[0], payload[1], payload[2], payload[3], payload[4], payload[5], payload[6],
                payload[7],
            ])))
        }
        TAG_U64 => {
            if payload.len() < 8 {
                return Err(HalError::Internal("U64: insufficient bytes".into()));
            }
            Ok(HalValue::U64(u64::from_le_bytes([
                payload[0], payload[1], payload[2], payload[3], payload[4], payload[5], payload[6],
                payload[7],
            ])))
        }
        TAG_F32 => {
            if payload.len() < 4 {
                return Err(HalError::Internal("F32: insufficient bytes".into()));
            }
            Ok(HalValue::F32(f32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]])))
        }
        TAG_F64 => {
            if payload.len() < 8 {
                return Err(HalError::Internal("F64: insufficient bytes".into()));
            }
            Ok(HalValue::F64(f64::from_le_bytes([
                payload[0], payload[1], payload[2], payload[3], payload[4], payload[5], payload[6],
                payload[7],
            ])))
        }
        TAG_BLOB => {
            if payload.len() < 4 {
                return Err(HalError::Internal("Blob: missing length prefix".into()));
            }
            let declared =
                u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
            let actual = payload.len() - 4;
            if declared != actual {
                return Err(HalError::InvalidBlobLength {
                    declared: declared as u32,
                    actual: actual as u32,
                });
            }
            Ok(HalValue::Blob(payload[4..].to_vec()))
        }
        TAG_STRING => {
            if payload.len() < 4 {
                return Err(HalError::Internal("String: missing length prefix".into()));
            }
            let len = u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
            let actual = payload.len() - 4;
            if len != actual {
                return Err(HalError::Internal("String: length mismatch".into()));
            }
            let s = String::from_utf8(payload[4..].to_vec()).map_err(|_| HalError::InvalidUtf8)?;
            Ok(HalValue::String(s))
        }
        TAG_ARRAY => {
            if payload.len() < 6 {
                return Err(HalError::Internal("Array: insufficient header".into()));
            }
            let elem_tag = payload[0];
            let data_len =
                u32::from_le_bytes([payload[1], payload[2], payload[3], payload[4]]) as usize;
            if payload.len() < 5 + data_len {
                return Err(HalError::Internal("Array: data truncated".into()));
            }
            let element_type = tag_to_pin_type(elem_tag).ok_or(HalError::TypeMismatch {
                // ponytail: best-effort error — actual is synthetic
                expected: HalPinType::S32,
                actual: HalPinType::S32,
            })?;
            let data = payload[5..5 + data_len].to_vec();
            Ok(HalValue::Array { element_type, data })
        }
        other => Err(HalError::UnknownHalType { type_id: other }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Roundtrip helpers ──

    fn roundtrip(v: &HalValue) {
        let encoded = encode_halvalue(v);
        let decoded = decode_halvalue(&encoded).expect("decode failed");
        assert_eq!(v, &decoded, "roundtrip mismatch for {:?}", v);
    }

    fn roundtrip_f32(v: f32) {
        let hv = HalValue::F32(v);
        let encoded = encode_halvalue(&hv);
        let decoded = decode_halvalue(&encoded).expect("decode failed");
        if let HalValue::F32(d) = decoded {
            assert_eq!(v.to_bits(), d.to_bits(), "f32 roundtrip failed: {} vs {}", v, d);
        } else {
            panic!("expected F32, got {:?}", decoded);
        }
    }

    fn roundtrip_f64(v: f64) {
        let hv = HalValue::F64(v);
        let encoded = encode_halvalue(&hv);
        let decoded = decode_halvalue(&encoded).expect("decode failed");
        if let HalValue::F64(d) = decoded {
            assert_eq!(v.to_bits(), d.to_bits(), "f64 roundtrip failed: {} vs {}", v, d);
        } else {
            panic!("expected F64, got {:?}", decoded);
        }
    }

    #[test]
    fn roundtrip_all_scalars() {
        roundtrip(&HalValue::Bool(false));
        roundtrip(&HalValue::Bool(true));
        roundtrip(&HalValue::S8(0));
        roundtrip(&HalValue::S8(-128));
        roundtrip(&HalValue::S8(127));
        roundtrip(&HalValue::U8(0));
        roundtrip(&HalValue::U8(255));
        roundtrip(&HalValue::S16(-32768));
        roundtrip(&HalValue::S16(32767));
        roundtrip(&HalValue::U16(0));
        roundtrip(&HalValue::U16(65535));
        roundtrip(&HalValue::S32(-2147483648));
        roundtrip(&HalValue::S32(2147483647));
        roundtrip(&HalValue::U32(0));
        roundtrip(&HalValue::U32(4294967295));
        roundtrip(&HalValue::S64(-9223372036854775808));
        roundtrip(&HalValue::S64(9223372036854775807));
        roundtrip(&HalValue::U64(0));
        roundtrip(&HalValue::U64(18446744073709551615));

        roundtrip_f32(0.0);
        roundtrip_f32(-1.0);
        roundtrip_f32(std::f32::consts::PI);
        roundtrip_f32(f32::MIN);
        roundtrip_f32(f32::MAX);
        roundtrip_f32(f32::NAN);

        roundtrip_f64(0.0);
        roundtrip_f64(-1.0);
        roundtrip_f64(std::f64::consts::PI);
        roundtrip_f64(f64::MIN);
        roundtrip_f64(f64::MAX);
        roundtrip_f64(f64::NAN);
    }

    #[test]
    fn roundtrip_blob() {
        roundtrip(&HalValue::Blob(vec![]));
        roundtrip(&HalValue::Blob(vec![0, 1, 2]));
        roundtrip(&HalValue::Blob(vec![255; 256]));
    }

    #[test]
    fn roundtrip_string() {
        roundtrip(&HalValue::String("".into()));
        roundtrip(&HalValue::String("hello".into()));
        roundtrip(&HalValue::String("中文".into()));
        roundtrip(&HalValue::String("Hello 世界 🌍".into()));
    }

    #[test]
    fn roundtrip_array() {
        let v = HalValue::Array { element_type: HalPinType::S32, data: vec![0, 0, 0, 0] };
        roundtrip(&v);
    }

    #[test]
    fn decode_unknown_type_id() {
        let buf = [0xFF];
        let result = decode_halvalue(&buf);
        assert!(
            matches!(result, Err(HalError::UnknownHalType { type_id: 0xFF })),
            "expected UnknownHalType, got {:?}",
            result
        );
    }

    #[test]
    fn decode_blob_length_mismatch() {
        let v = HalValue::Blob(vec![1, 2, 3, 4]);
        let mut encoded = encode_halvalue(&v);
        // Corrupt the length field (bytes 1-4 after tag, set to 999)
        let fake_len: u32 = 999;
        encoded[1..5].copy_from_slice(&fake_len.to_le_bytes());
        let result = decode_halvalue(&encoded);
        assert!(
            matches!(result, Err(HalError::InvalidBlobLength { .. })),
            "expected InvalidBlobLength, got {:?}",
            result
        );
    }

    #[test]
    fn decode_blob_empty() {
        let v = HalValue::Blob(vec![]);
        roundtrip(&v);
    }

    #[test]
    fn decode_blob_max() {
        // ponytail: large blob — 65535 zero bytes, one alloc
        let data = vec![0u8; 65535];
        let v = HalValue::Blob(data);
        roundtrip(&v);
    }
}
