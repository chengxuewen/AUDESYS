//! AUDESYS FlatBuffers Bindings
//!
//! Cross-language serialization for HAL type system (D12, D19, D24).
//! Schema: schema/hal_value.fbs
//!
//! Generated code in `generated/` via `flatc --rust`.
//! Re-generate: `flatc --rust -o src/generated schema/hal_value.fbs`

mod generated {
    #[allow(unused_imports, clippy::all)]
    mod hal_value_generated;
    pub use hal_value_generated::audesys::hal::*;
}

use audesys_hal_core::types::HalPinType;
use audesys_hal_core::value::HalValue;
use flatbuffers::{FlatBufferBuilder, InvalidFlatbuffer, WIPOffset};

// ── fbs HalType ↔ HalPinType ──

fn hal_type_to_pin_type(t: generated::HalType) -> HalPinType {
    match t {
        generated::HalType::Bool => HalPinType::Bool,
        generated::HalType::S8 => HalPinType::S8,
        generated::HalType::U8 => HalPinType::U8,
        generated::HalType::S16 => HalPinType::S16,
        generated::HalType::U16 => HalPinType::U16,
        generated::HalType::S32 => HalPinType::S32,
        generated::HalType::U32 => HalPinType::U32,
        generated::HalType::S64 => HalPinType::S64,
        generated::HalType::U64 => HalPinType::U64,
        generated::HalType::F32 => HalPinType::F32,
        generated::HalType::F64 => HalPinType::F64,
        generated::HalType::Blob => HalPinType::Blob,
        generated::HalType::String => HalPinType::String,
        _ => HalPinType::Blob, // ponytail: invalid type tag, degrade safely
    }
}

fn pin_type_to_hal_type(pt: HalPinType) -> generated::HalType {
    match pt {
        HalPinType::Bool => generated::HalType::Bool,
        HalPinType::S8 => generated::HalType::S8,
        HalPinType::U8 => generated::HalType::U8,
        HalPinType::S16 => generated::HalType::S16,
        HalPinType::U16 => generated::HalType::U16,
        HalPinType::S32 => generated::HalType::S32,
        HalPinType::U32 => generated::HalType::U32,
        HalPinType::S64 => generated::HalType::S64,
        HalPinType::U64 => generated::HalType::U64,
        HalPinType::F32 => generated::HalType::F32,
        HalPinType::F64 => generated::HalType::F64,
        HalPinType::Blob => generated::HalType::Blob,
        HalPinType::String => generated::HalType::String,
    }
}

// ── Public API ──

/// Serialize a `HalValue` into FlatBuffers binary format.
///
/// Returns the raw bytes of a size-prefixed FlatBuffer containing
/// the HalSignal table with `name` set to the given signal name.
pub fn serialize_hal_value(name: &str, value: &HalValue) -> Vec<u8> {
    let mut fbb = FlatBufferBuilder::new();
    let val_offset = build_hal_value(&mut fbb, value);
    let name_offset = fbb.create_string(name);
    let signal = generated::HalSignal::create(
        &mut fbb,
        &generated::HalSignalArgs {
            name: Some(name_offset),
            value: Some(val_offset),
            timestamp_ns: 0,
        },
    );
    fbb.finish_size_prefixed(signal, None);
    fbb.finished_data().to_vec()
}

/// Deserialize a `HalValue` from FlatBuffers binary format.
///
/// `buf` must be a size-prefixed FlatBuffer produced by `serialize_hal_value`.
pub fn deserialize_hal_value(buf: &[u8]) -> Result<HalValue, InvalidFlatbuffer> {
    let signal = generated::size_prefixed_root_as_hal_signal(buf)?;
    let fbs_val = signal.value().ok_or_else(|| InvalidFlatbuffer::MissingRequiredField {
        required: "value".into(),
        error_trace: Default::default(),
    })?;
    read_hal_value(&fbs_val).ok_or_else(|| InvalidFlatbuffer::MissingRequiredField {
        required: "data".into(),
        error_trace: Default::default(),
    })
}

/// Deserialize both name and value from a FlatBuffer.
pub fn deserialize_signal(buf: &[u8]) -> Result<(String, HalValue), InvalidFlatbuffer> {
    let signal = generated::size_prefixed_root_as_hal_signal(buf)?;
    let name = signal.name().unwrap_or("").to_string();
    let fbs_val = signal.value().ok_or_else(|| InvalidFlatbuffer::MissingRequiredField {
        required: "value".into(),
        error_trace: Default::default(),
    })?;
    let value =
        read_hal_value(&fbs_val).ok_or_else(|| InvalidFlatbuffer::MissingRequiredField {
            required: "data".into(),
            error_trace: Default::default(),
        })?;
    Ok((name, value))
}

// ── Builder: HalValue → FlatBuffer ──

fn build_hal_value<'a>(
    fbb: &mut FlatBufferBuilder<'a>,
    value: &HalValue,
) -> WIPOffset<generated::HalValue<'a>> {
    let (fbs_type, data_type, union_offset) = match value {
        HalValue::Bool(v) => {
            let off = generated::BoolVal::create(fbb, &generated::BoolValArgs { value: *v });
            (generated::HalType::Bool, generated::HalValueData::bool_val, off.as_union_value())
        }
        HalValue::S8(v) => {
            let off = generated::S8Val::create(fbb, &generated::S8ValArgs { value: *v });
            (generated::HalType::S8, generated::HalValueData::s8_val, off.as_union_value())
        }
        HalValue::U8(v) => {
            let off = generated::U8Val::create(fbb, &generated::U8ValArgs { value: *v });
            (generated::HalType::U8, generated::HalValueData::u8_val, off.as_union_value())
        }
        HalValue::S16(v) => {
            let off = generated::S16Val::create(fbb, &generated::S16ValArgs { value: *v });
            (generated::HalType::S16, generated::HalValueData::s16_val, off.as_union_value())
        }
        HalValue::U16(v) => {
            let off = generated::U16Val::create(fbb, &generated::U16ValArgs { value: *v });
            (generated::HalType::U16, generated::HalValueData::u16_val, off.as_union_value())
        }
        HalValue::S32(v) => {
            let off = generated::S32Val::create(fbb, &generated::S32ValArgs { value: *v });
            (generated::HalType::S32, generated::HalValueData::s32_val, off.as_union_value())
        }
        HalValue::U32(v) => {
            let off = generated::U32Val::create(fbb, &generated::U32ValArgs { value: *v });
            (generated::HalType::U32, generated::HalValueData::u32_val, off.as_union_value())
        }
        HalValue::S64(v) => {
            let off = generated::S64Val::create(fbb, &generated::S64ValArgs { value: *v });
            (generated::HalType::S64, generated::HalValueData::s64_val, off.as_union_value())
        }
        HalValue::U64(v) => {
            let off = generated::U64Val::create(fbb, &generated::U64ValArgs { value: *v });
            (generated::HalType::U64, generated::HalValueData::u64_val, off.as_union_value())
        }
        HalValue::F32(v) => {
            let off = generated::F32Val::create(fbb, &generated::F32ValArgs { value: *v });
            (generated::HalType::F32, generated::HalValueData::f32_val, off.as_union_value())
        }
        HalValue::F64(v) => {
            let off = generated::F64Val::create(fbb, &generated::F64ValArgs { value: *v });
            (generated::HalType::F64, generated::HalValueData::f64_val, off.as_union_value())
        }
        HalValue::Blob(data) => {
            let blob_off = fbb.create_vector(data);
            let off =
                generated::BlobVal::create(fbb, &generated::BlobValArgs { data: Some(blob_off) });
            (generated::HalType::Blob, generated::HalValueData::blob_val, off.as_union_value())
        }
        HalValue::String(s) => {
            let str_off = fbb.create_string(s);
            let off = generated::StringVal::create(
                fbb,
                &generated::StringValArgs { value: Some(str_off) },
            );
            (generated::HalType::String, generated::HalValueData::string_val, off.as_union_value())
        }
        HalValue::Array { element_type, data } => {
            let data_off = fbb.create_vector(data);
            let off = generated::ArrayData::create(
                fbb,
                &generated::ArrayDataArgs {
                    element_type: pin_type_to_hal_type(*element_type),
                    data: Some(data_off),
                },
            );
            // ponytail: type tag for Array is element_type, not a dedicated HalType enum variant
            let fbs_type = pin_type_to_hal_type(*element_type);
            (fbs_type, generated::HalValueData::array_val, off.as_union_value())
        }
    };

    generated::HalValue::create(
        fbb,
        &generated::HalValueArgs { type_: fbs_type, data_type, data: Some(union_offset) },
    )
}

// ── Reader: FlatBuffer → HalValue ──

fn read_hal_value(fbs: &generated::HalValue<'_>) -> Option<HalValue> {
    match fbs.data_type() {
        generated::HalValueData::bool_val => {
            let v = fbs.data_as_bool_val()?;
            Some(HalValue::Bool(v.value()))
        }
        generated::HalValueData::s8_val => {
            let v = fbs.data_as_s_8_val()?;
            Some(HalValue::S8(v.value()))
        }
        generated::HalValueData::u8_val => {
            let v = fbs.data_as_u_8_val()?;
            Some(HalValue::U8(v.value()))
        }
        generated::HalValueData::s16_val => {
            let v = fbs.data_as_s_16_val()?;
            Some(HalValue::S16(v.value()))
        }
        generated::HalValueData::u16_val => {
            let v = fbs.data_as_u_16_val()?;
            Some(HalValue::U16(v.value()))
        }
        generated::HalValueData::s32_val => {
            let v = fbs.data_as_s_32_val()?;
            Some(HalValue::S32(v.value()))
        }
        generated::HalValueData::u32_val => {
            let v = fbs.data_as_u_32_val()?;
            Some(HalValue::U32(v.value()))
        }
        generated::HalValueData::s64_val => {
            let v = fbs.data_as_s_64_val()?;
            Some(HalValue::S64(v.value()))
        }
        generated::HalValueData::u64_val => {
            let v = fbs.data_as_u_64_val()?;
            Some(HalValue::U64(v.value()))
        }
        generated::HalValueData::f32_val => {
            let v = fbs.data_as_f_32_val()?;
            Some(HalValue::F32(v.value()))
        }
        generated::HalValueData::f64_val => {
            let v = fbs.data_as_f_64_val()?;
            Some(HalValue::F64(v.value()))
        }
        generated::HalValueData::blob_val => {
            let v = fbs.data_as_blob_val()?;
            let data = v.data().map(|d| d.bytes().to_vec()).unwrap_or_default();
            Some(HalValue::Blob(data))
        }
        generated::HalValueData::string_val => {
            let v = fbs.data_as_string_val()?;
            let s = v.value().unwrap_or("").to_string();
            Some(HalValue::String(s))
        }
        generated::HalValueData::array_val => {
            let v = fbs.data_as_array_val()?;
            let element_type = hal_type_to_pin_type(v.element_type());
            let data = v.data().map(|d| d.bytes().to_vec()).unwrap_or_default();
            Some(HalValue::Array { element_type, data })
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_bool() {
        let v = HalValue::Bool(true);
        let buf = serialize_hal_value("test.bool", &v);
        let v2 = deserialize_hal_value(&buf).unwrap();
        assert_eq!(v, v2);
    }

    #[test]
    fn roundtrip_all_scalars() {
        let cases: Vec<HalValue> = vec![
            HalValue::S8(-42),
            HalValue::U8(200),
            HalValue::S16(-10000),
            HalValue::U16(60000),
            HalValue::S32(-1_000_000),
            HalValue::U32(4_000_000_000),
            HalValue::S64(-1_000_000_000_000),
            HalValue::U64(18_000_000_000_000),
            HalValue::F32(3.14),
            HalValue::F64(std::f64::consts::PI),
        ];
        for v in &cases {
            let buf = serialize_hal_value("test", v);
            let v2 = deserialize_hal_value(&buf).unwrap();
            assert_eq!(*v, v2, "roundtrip failed for {:?}", v);
        }
    }

    #[test]
    fn roundtrip_string() {
        let v = HalValue::String("hello 你好 🦀".into());
        let buf = serialize_hal_value("test.str", &v);
        let v2 = deserialize_hal_value(&buf).unwrap();
        assert_eq!(v, v2);
    }

    #[test]
    fn roundtrip_blob() {
        let v = HalValue::Blob(vec![0, 1, 2, 255, 128]);
        let buf = serialize_hal_value("test.blob", &v);
        let v2 = deserialize_hal_value(&buf).unwrap();
        assert_eq!(v, v2);
    }

    #[test]
    fn roundtrip_array() {
        let v = HalValue::Array {
            element_type: HalPinType::S32,
            data: vec![0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
        };
        let buf = serialize_hal_value("test.array", &v);
        let v2 = deserialize_hal_value(&buf).unwrap();
        assert_eq!(v, v2);
    }

    #[test]
    fn roundtrip_signal_name() {
        let v = HalValue::F64(2.718);
        let buf = serialize_hal_value("sensor.temp", &v);
        let (name, v2) = deserialize_signal(&buf).unwrap();
        assert_eq!(name, "sensor.temp");
        assert_eq!(v, v2);
    }
}
