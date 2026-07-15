//! HalValue — unified 14-type HAL value enum.
//! 来源: docs/modules/hal/iec-type-system-design.md §2 (D12)
//!
//! Array<T> uses type-erased encoding: HalValue::Array { element_type, data }
//! where data is a FlatBuffers-compatible [u8] buffer.
//! Rationale: supports nested containers, avoids enum explosion (25 variants → 15).

use crate::types::HalPinType;

/// Unified HAL value covering 11 scalars + 3 containers (D12).
///
/// # Array<T> encoding
/// Array uses type-erased `Vec<u8>` + `element_type` tag (Option B).
/// The consumer knows the element type from the component contract.
///
/// # Variants
/// | IEC Keyword | Rust Variant | Bits |
/// |-------------|-------------|------|
/// | BOOL        | Bool(bool)  | 1    |
/// | SINT        | S8(i8)      | 8    |
/// | USINT/BYTE  | U8(u8)      | 8    |
/// | INT         | S16(i16)    | 16   |
/// | UINT/WORD   | U16(u16)    | 16   |
/// | DINT/TIME   | S32(i32)    | 32   |
/// | UDINT/DWORD/DATE/TOD | U32(u32) | 32 |
/// | LINT        | S64(i64)    | 64   |
/// | ULINT/LWORD/DT | U64(u64) | 64   |
/// | REAL        | F32(f32)    | 32   |
/// | LREAL       | F64(f64)    | 64   |
/// | —           | Blob(Vec<u8>) | var |
/// | STRING      | String(String) | var |
/// | —           | Array { element_type: HalPinType, data: Vec<u8> } | var |
#[derive(Debug, Clone, PartialEq)]
pub enum HalValue {
    Bool(bool),
    S8(i8),
    U8(u8),
    S16(i16),
    U16(u16),
    S32(i32),
    U32(u32),
    S64(i64),
    U64(u64),
    F32(f32),
    F64(f64),
    Blob(Vec<u8>),
    String(String),
    /// Type-erased array. `data` contains FlatBuffers-serialized elements.
    Array {
        element_type: HalPinType,
        data: Vec<u8>,
    },
}

impl HalValue {
    /// Return the HalPinType discriminator for this value.
    pub fn pin_type(&self) -> HalPinType {
        match self {
            HalValue::Bool(_) => HalPinType::Bool,
            HalValue::S8(_) => HalPinType::S8,
            HalValue::U8(_) => HalPinType::U8,
            HalValue::S16(_) => HalPinType::S16,
            HalValue::U16(_) => HalPinType::U16,
            HalValue::S32(_) => HalPinType::S32,
            HalValue::U32(_) => HalPinType::U32,
            HalValue::S64(_) => HalPinType::S64,
            HalValue::U64(_) => HalPinType::U64,
            HalValue::F32(_) => HalPinType::F32,
            HalValue::F64(_) => HalPinType::F64,
            HalValue::Blob(_) => HalPinType::Blob,
            HalValue::String(_) => HalPinType::String,
            HalValue::Array { element_type, .. } => *element_type,
        }
    }
}
