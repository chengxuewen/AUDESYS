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
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
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
    /// Serialize this value to bytes (for array storage).
    fn to_bytes(&self) -> Vec<u8> {
        match self {
            HalValue::Bool(b) => vec![*b as u8],
            HalValue::S8(n) => n.to_le_bytes().to_vec(),
            HalValue::U8(n) => n.to_le_bytes().to_vec(),
            HalValue::S16(n) => n.to_le_bytes().to_vec(),
            HalValue::U16(n) => n.to_le_bytes().to_vec(),
            HalValue::S32(n) => n.to_le_bytes().to_vec(),
            HalValue::U32(n) => n.to_le_bytes().to_vec(),
            HalValue::S64(n) => n.to_le_bytes().to_vec(),
            HalValue::U64(n) => n.to_le_bytes().to_vec(),
            HalValue::F32(n) => n.to_le_bytes().to_vec(),
            HalValue::F64(n) => n.to_le_bytes().to_vec(),
            HalValue::Blob(b) => {
                let mut v = (b.len() as u32).to_le_bytes().to_vec();
                v.extend_from_slice(b);
                v
            }
            HalValue::String(s) => s.as_bytes().to_vec(),
            HalValue::Array { element_type: _, data } => data.clone(),
        }
    }

    /// Extract element at index from Array. Returns S32(0) for non-Array/out-of-bounds.
    // ponytail: panic-free, no bounds error in Phase 1
    pub fn index(&self, idx: usize) -> HalValue {
        match self {
            HalValue::Array { element_type, data } => {
                let elem_size = HalValue::byte_size(element_type);
                let offset = idx * elem_size as usize;
                if offset + elem_size as usize > data.len() {
                    return Self::zero(element_type);
                }
                Self::from_bytes(element_type, &data[offset..offset + elem_size as usize])
            }
            _ => HalValue::zero(&self.pin_type()),
        }
    }

    /// Return a new Array with element at index replaced. Returns self for non-Array/out-of-bounds.
    pub fn set_index(mut self, idx: usize, value: HalValue) -> HalValue {
        match &self {
            HalValue::Array { element_type, data } => {
                let elem_size = HalValue::byte_size(element_type);
                let offset = idx * elem_size as usize;
                if offset + elem_size as usize > data.len() {
                    return self;
                }
                // ponytail: own the Array and mutate the data in-place
                if let HalValue::Array { data, .. } = &mut self {
                    let bytes = value.to_bytes();
                    data[offset..offset + elem_size as usize]
                        .copy_from_slice(&bytes[..elem_size as usize]);
                }
                self
            }
            _ => self,
        }
    }

    /// Size of this type in bytes (for array offset calculation).
    fn byte_size(element_type: &HalPinType) -> u32 {
        use HalPinType::*;
        match element_type {
            Bool | S8 | U8 => 1,
            S16 | U16 => 2,
            S32 | U32 | F32 => 4,
            S64 | U64 | F64 => 8,
            Blob | String => 8, // pointer width (ponytail: flat buffer ref not stored in array)
        }
    }

    fn zero(element_type: &HalPinType) -> HalValue {
        use HalPinType::*;
        match element_type {
            Bool => HalValue::Bool(false),
            S8 => HalValue::S8(0),
            U8 => HalValue::U8(0),
            S16 => HalValue::S16(0),
            U16 => HalValue::U16(0),
            S32 => HalValue::S32(0),
            U32 => HalValue::U32(0),
            S64 => HalValue::S64(0),
            U64 => HalValue::U64(0),
            F32 => HalValue::F32(0.0),
            F64 => HalValue::F64(0.0),
            Blob => HalValue::Blob(vec![]),
            String => HalValue::String(std::string::String::new()),
        }
    }

    fn from_bytes(element_type: &HalPinType, bytes: &[u8]) -> HalValue {
        use HalPinType::*;
        match element_type {
            Bool => HalValue::Bool(bytes[0] != 0),
            S8 => HalValue::S8(bytes[0] as i8),
            U8 => HalValue::U8(bytes[0]),
            S16 => HalValue::S16(i16::from_le_bytes([bytes[0], bytes[1]])),
            U16 => HalValue::U16(u16::from_le_bytes([bytes[0], bytes[1]])),
            S32 => HalValue::S32(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
            U32 => HalValue::U32(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
            S64 => HalValue::S64(i64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ])),
            U64 => HalValue::U64(u64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ])),
            F32 => HalValue::F32(f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
            F64 => HalValue::F64(f64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ])),
            Blob | String => HalValue::S32(0), // ponytail: not stored in arrays
        }
    }
}

// ── Arithmetic trait implementations for IR VM ──
// ponytail: macro-generated binops for all 11 scalar types.
// Type mismatches and containers (Blob/String/Array) return S32(0).
// Full type checking is the compiler's responsibility (hal-ir-design.md §2.5).

macro_rules! hal_binop {
    ($trait:ident, $method:ident, $op:tt) => {
        impl std::ops::$trait for HalValue {
            type Output = HalValue;
            fn $method(self, rhs: HalValue) -> HalValue {
                match (self, rhs) {
                    (HalValue::S8(a), HalValue::S8(b)) => HalValue::S8(a $op b),
                    (HalValue::U8(a), HalValue::U8(b)) => HalValue::U8(a $op b),
                    (HalValue::S16(a), HalValue::S16(b)) => HalValue::S16(a $op b),
                    (HalValue::U16(a), HalValue::U16(b)) => HalValue::U16(a $op b),
                    (HalValue::S32(a), HalValue::S32(b)) => HalValue::S32(a $op b),
                    (HalValue::U32(a), HalValue::U32(b)) => HalValue::U32(a $op b),
                    (HalValue::S64(a), HalValue::S64(b)) => HalValue::S64(a $op b),
                    (HalValue::U64(a), HalValue::U64(b)) => HalValue::U64(a $op b),
                    (HalValue::F32(a), HalValue::F32(b)) => HalValue::F32(a $op b),
                    (HalValue::F64(a), HalValue::F64(b)) => HalValue::F64(a $op b),
                    // ponytail: type mismatch → S32(0), full error model in Phase 2
                    _ => HalValue::S32(0),
                }
            }
        }
    };
}

hal_binop!(Add, add, +);
hal_binop!(Sub, sub, -);
hal_binop!(Mul, mul, *);
hal_binop!(Div, div, /);

macro_rules! hal_bitop {
    ($trait:ident, $method:ident, $op:tt) => {
        impl std::ops::$trait for HalValue {
            type Output = HalValue;
            fn $method(self, rhs: HalValue) -> HalValue {
                match (self, rhs) {
                    (HalValue::Bool(a), HalValue::Bool(b)) => HalValue::Bool(a $op b),
                    (HalValue::S8(a), HalValue::S8(b)) => HalValue::S8(a $op b),
                    (HalValue::U8(a), HalValue::U8(b)) => HalValue::U8(a $op b),
                    (HalValue::S16(a), HalValue::S16(b)) => HalValue::S16(a $op b),
                    (HalValue::U16(a), HalValue::U16(b)) => HalValue::U16(a $op b),
                    (HalValue::S32(a), HalValue::S32(b)) => HalValue::S32(a $op b),
                    (HalValue::U32(a), HalValue::U32(b)) => HalValue::U32(a $op b),
                    (HalValue::S64(a), HalValue::S64(b)) => HalValue::S64(a $op b),
                    (HalValue::U64(a), HalValue::U64(b)) => HalValue::U64(a $op b),
                    _ => HalValue::S32(0),
                }
            }
        }
    };
}

hal_bitop!(BitAnd, bitand, &);
hal_bitop!(BitOr, bitor, |);
hal_bitop!(BitXor, bitxor, ^);

// ponytail: MOD semantics differ from IEC 61131-3 for negative operands
// (IEC truncates toward -∞, Rust % truncates toward 0). Fix in Phase 2.
hal_binop!(Rem, rem, %);

impl std::ops::Neg for HalValue {
    type Output = HalValue;
    fn neg(self) -> HalValue {
        match self {
            HalValue::S8(v) => HalValue::S8(-v),
            HalValue::S16(v) => HalValue::S16(-v),
            HalValue::S32(v) => HalValue::S32(-v),
            HalValue::S64(v) => HalValue::S64(-v),
            HalValue::F32(v) => HalValue::F32(-v),
            HalValue::F64(v) => HalValue::F64(-v),
            _ => HalValue::S32(0),
        }
    }
}

impl std::ops::Not for HalValue {
    type Output = HalValue;
    fn not(self) -> HalValue {
        match self {
            HalValue::Bool(v) => HalValue::Bool(!v),
            HalValue::S8(v) => HalValue::S8(!v),
            HalValue::U8(v) => HalValue::U8(!v),
            HalValue::S16(v) => HalValue::S16(!v),
            HalValue::U16(v) => HalValue::U16(!v),
            HalValue::S32(v) => HalValue::S32(!v),
            HalValue::U32(v) => HalValue::U32(!v),
            HalValue::S64(v) => HalValue::S64(!v),
            HalValue::U64(v) => HalValue::U64(!v),
            _ => HalValue::S32(0),
        }
    }
}

impl std::cmp::PartialOrd for HalValue {
    fn partial_cmp(&self, other: &HalValue) -> Option<std::cmp::Ordering> {
        match (self, other) {
            (HalValue::S8(a), HalValue::S8(b)) => a.partial_cmp(b),
            (HalValue::U8(a), HalValue::U8(b)) => a.partial_cmp(b),
            (HalValue::S16(a), HalValue::S16(b)) => a.partial_cmp(b),
            (HalValue::U16(a), HalValue::U16(b)) => a.partial_cmp(b),
            (HalValue::S32(a), HalValue::S32(b)) => a.partial_cmp(b),
            (HalValue::U32(a), HalValue::U32(b)) => a.partial_cmp(b),
            (HalValue::S64(a), HalValue::S64(b)) => a.partial_cmp(b),
            (HalValue::U64(a), HalValue::U64(b)) => a.partial_cmp(b),
            (HalValue::F32(a), HalValue::F32(b)) => a.partial_cmp(b),
            (HalValue::F64(a), HalValue::F64(b)) => a.partial_cmp(b),
            _ => None,
        }
    }
}
