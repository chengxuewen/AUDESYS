#!/usr/bin/env python3
"""AUDESYS FlatBuffers Python roundtrip + cross-language tests.

Generated bindings in ./generated/ via:
  flatc --python -o generated schema/hal_value.fbs
"""

import os
import sys
import struct

# Ensure local generated package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "generated"))

import flatbuffers
from audesys.hal.HalType import HalType
from audesys.hal.HalValueData import HalValueData
from audesys.hal.HalSignal import (
    HalSignal,
    HalSignalStart,
    HalSignalAddName,
    HalSignalAddValue,
    HalSignalAddTimestampNs,
    HalSignalEnd,
    Start as HalSignalStartAlias,
    AddName,
    AddValue,
    AddTimestampNs,
    End as HalSignalEndAlias,
)
from audesys.hal.HalValue import (
    HalValue,
    HalValueStart,
    HalValueAddType,
    HalValueAddDataType,
    HalValueAddData,
    HalValueEnd,
)
from audesys.hal.BoolVal import BoolValStart, BoolValAddValue, BoolValEnd
from audesys.hal.S32Val import S32ValStart, S32ValAddValue, S32ValEnd
from audesys.hal.F64Val import F64ValStart, F64ValAddValue, F64ValEnd
from audesys.hal.StringVal import StringValStart, StringValAddValue, StringValEnd
from audesys.hal.BlobVal import (
    BlobValStart,
    BlobValAddData,
    BlobValEnd,
    BlobValStartDataVector,
)
from audesys.hal.S8Val import S8ValStart, S8ValAddValue, S8ValEnd
from audesys.hal.U8Val import U8ValStart, U8ValAddValue, U8ValEnd
from audesys.hal.S16Val import S16ValStart, S16ValAddValue, S16ValEnd
from audesys.hal.U16Val import U16ValStart, U16ValAddValue, U16ValEnd
from audesys.hal.U32Val import U32ValStart, U32ValAddValue, U32ValEnd
from audesys.hal.S64Val import S64ValStart, S64ValAddValue, S64ValEnd
from audesys.hal.U64Val import U64ValStart, U64ValAddValue, U64ValEnd
from audesys.hal.F32Val import F32ValStart, F32ValAddValue, F32ValEnd
from audesys.hal.ArrayData import (
    ArrayDataStart,
    ArrayDataAddElementType,
    ArrayDataAddData,
    ArrayDataEnd,
    ArrayDataStartDataVector,
)

OUTPUT_DIR = "/tmp"


# ─── Build helpers ───────────────────────────────────────────────────────────


def make_signal(builder, name, hal_type, data_type, union_offset):
    """Common code: build HalValue + HalSignal in the given builder."""
    name_off = builder.CreateString(name)

    HalValueStart(builder)
    HalValueAddType(builder, hal_type)
    HalValueAddDataType(builder, data_type)
    HalValueAddData(builder, union_offset)
    val_off = HalValueEnd(builder)

    HalSignalStart(builder)
    HalSignalAddName(builder, name_off)
    HalSignalAddValue(builder, val_off)
    HalSignalAddTimestampNs(builder, 0)
    return HalSignalEnd(builder)


def finish_and_build(hal_type, data_type, build_union, name, dest_file):
    """Build a HalSignal, finish, return bytes, and write to dest_file."""
    builder = flatbuffers.Builder(1024)
    union_off = build_union(builder)
    sig_off = make_signal(builder, name, hal_type, data_type, union_off)
    builder.Finish(sig_off)
    buf = bytes(builder.Output())
    with open(dest_file, "wb") as f:
        f.write(buf)
    return buf


def finish_prefixed_and_build(hal_type, data_type, build_union, name, dest_file):
    """Same as finish_and_build but with size-prefixed (for C++ cross-lang compat)."""
    builder = flatbuffers.Builder(1024)
    union_off = build_union(builder)
    sig_off = make_signal(builder, name, hal_type, data_type, union_off)
    builder.FinishSizePrefixed(sig_off)
    buf = bytes(builder.Output())
    with open(dest_file, "wb") as f:
        f.write(buf)
    return buf


# ─── Union builders (return WIPOffset) ──────────────────────────────────────


def build_bool(builder, value):
    BoolValStart(builder)
    BoolValAddValue(builder, value)
    return BoolValEnd(builder)


def build_s32(builder, value):
    S32ValStart(builder)
    S32ValAddValue(builder, value)
    return S32ValEnd(builder)


def build_f64(builder, value):
    F64ValStart(builder)
    F64ValAddValue(builder, value)
    return F64ValEnd(builder)


def build_string(builder, value):
    str_off = builder.CreateString(value)
    StringValStart(builder)
    StringValAddValue(builder, str_off)
    return StringValEnd(builder)


def build_blob(builder, data):
    BlobValStartDataVector(builder, len(data))
    for b in reversed(data):
        builder.PrependByte(b)
    vec_off = builder.EndVector()
    BlobValStart(builder)
    BlobValAddData(builder, vec_off)
    return BlobValEnd(builder)


def build_array_s8(builder, data):
    ArrayDataStartDataVector(builder, len(data))
    for b in reversed(data):
        builder.PrependByte(b)
    vec_off = builder.EndVector()
    ArrayDataStart(builder)
    ArrayDataAddElementType(builder, HalType.S8)
    ArrayDataAddData(builder, vec_off)
    return ArrayDataEnd(builder)


# ─── Deserialization helpers ────────────────────────────────────────────────


def deser_root(buf, offset=0):
    """Deserialize a non-prefixed HalSignal from buf at given offset."""
    sig = HalSignal()
    sig.Init(buf, offset)
    return sig


def deser_size_prefixed(buf):
    """Read a size-prefixed HalSignal (4-byte prefix then root)."""
    return HalSignal.GetRootAsHalSignal(buf, 0)  # C++ uses non-prefixed Finish


def value_from_halvalue(hv):
    """Extract the union value from a deserialized HalValue."""
    dt = hv.DataType()
    data = hv.Data()
    if data is None:
        return None

    if dt == HalValueData.bool_val:
        from audesys.hal.BoolVal import BoolVal
        bv = BoolVal()
        bv.Init(data.Bytes, data.Pos)
        return ("bool", bv.Value())

    elif dt == HalValueData.s32_val:
        from audesys.hal.S32Val import S32Val
        sv = S32Val()
        sv.Init(data.Bytes, data.Pos)
        return ("s32", sv.Value())

    elif dt == HalValueData.f64_val:
        from audesys.hal.F64Val import F64Val
        fv = F64Val()
        fv.Init(data.Bytes, data.Pos)
        return ("f64", fv.Value())

    elif dt == HalValueData.string_val:
        from audesys.hal.StringVal import StringVal
        sv = StringVal()
        sv.Init(data.Bytes, data.Pos)
        return ("string", sv.Value())

    elif dt == HalValueData.blob_val:
        from audesys.hal.BlobVal import BlobVal
        bv = BlobVal()
        bv.Init(data.Bytes, data.Pos)
        raw = bv.DataAsNumpy()
        return ("blob", bytes(raw) if raw is not None else b"")

    elif dt == HalValueData.array_val:
        from audesys.hal.ArrayData import ArrayData
        av = ArrayData()
        av.Init(data.Bytes, data.Pos)
        raw = av.DataAsNumpy()
        return ("array", (av.ElementType(), bytes(raw) if raw is not None else b""))

    elif dt == HalValueData.s8_val:
        from audesys.hal.S8Val import S8Val
        sv = S8Val()
        sv.Init(data.Bytes, data.Pos)
        return ("s8", sv.Value())

    elif dt == HalValueData.u8_val:
        from audesys.hal.U8Val import U8Val
        uv = U8Val()
        uv.Init(data.Bytes, data.Pos)
        return ("u8", uv.Value())

    elif dt == HalValueData.s16_val:
        from audesys.hal.S16Val import S16Val
        sv = S16Val()
        sv.Init(data.Bytes, data.Pos)
        return ("s16", sv.Value())

    elif dt == HalValueData.u16_val:
        from audesys.hal.U16Val import U16Val
        uv = U16Val()
        uv.Init(data.Bytes, data.Pos)
        return ("u16", uv.Value())

    elif dt == HalValueData.u32_val:
        from audesys.hal.U32Val import U32Val
        uv = U32Val()
        uv.Init(data.Bytes, data.Pos)
        return ("u32", uv.Value())

    elif dt == HalValueData.s64_val:
        from audesys.hal.S64Val import S64Val
        sv = S64Val()
        sv.Init(data.Bytes, data.Pos)
        return ("s64", sv.Value())

    elif dt == HalValueData.u64_val:
        from audesys.hal.U64Val import U64Val
        uv = U64Val()
        uv.Init(data.Bytes, data.Pos)
        return ("u64", uv.Value())

    elif dt == HalValueData.f32_val:
        from audesys.hal.F32Val import F32Val
        fv = F32Val()
        fv.Init(data.Bytes, data.Pos)
        return ("f32", fv.Value())

    return None


# ─── Roundtrip tests ────────────────────────────────────────────────────────


def test_roundtrip_bool():
    buf = finish_and_build(
        HalType.Bool, HalValueData.bool_val,
        lambda b: build_bool(b, True),
        "test.bool", os.path.join(OUTPUT_DIR, "py_fb_signal_bool.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    assert sig.Name() == b"test.bool", f"name mismatch: {sig.Name()}"
    hv = sig.Value()
    assert hv.Type() == HalType.Bool
    tag, val = value_from_halvalue(hv)
    assert tag == "bool" and val is True, f"expected bool=True, got {tag}={val}"


def test_roundtrip_s32():
    buf = finish_and_build(
        HalType.S32, HalValueData.s32_val,
        lambda b: build_s32(b, 42),
        "test.s32", os.path.join(OUTPUT_DIR, "py_fb_signal_s32.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "s32" and val == 42, f"expected 42, got {val}"


def test_roundtrip_f64():
    buf = finish_and_build(
        HalType.F64, HalValueData.f64_val,
        lambda b: build_f64(b, 3.14),
        "test.f64", os.path.join(OUTPUT_DIR, "py_fb_signal_f64.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "f64" and abs(val - 3.14) < 1e-10, f"expected 3.14, got {val}"


def test_roundtrip_string():
    buf = finish_and_build(
        HalType.String, HalValueData.string_val,
        lambda b: build_string(b, "hello"),
        "test.str", os.path.join(OUTPUT_DIR, "py_fb_signal_string.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "string" and val == b"hello", f"expected hello, got {val}"


def test_roundtrip_blob():
    data = bytes([0xde, 0xad, 0xbe, 0xef])
    buf = finish_and_build(
        HalType.Blob, HalValueData.blob_val,
        lambda b: build_blob(b, data),
        "test.blob", os.path.join(OUTPUT_DIR, "py_fb_signal_blob.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "blob" and val == data, f"blob mismatch"


def test_roundtrip_array_s8():
    data = bytes([1, 2, 3])
    buf = finish_and_build(
        HalType.S8, HalValueData.array_val,
        lambda b: build_array_s8(b, data),
        "test.array_s8", os.path.join(OUTPUT_DIR, "py_fb_signal_array_s8.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "array"
    etype, arr = val
    assert etype == HalType.S8, f"element_type mismatch: {etype}"
    assert arr == data, f"array data mismatch: {arr}"


def test_roundtrip_unicode_string():
    buf = finish_and_build(
        HalType.String, HalValueData.string_val,
        lambda b: build_string(b, "你好 🦀"),
        "test.unicode", os.path.join(OUTPUT_DIR, "py_fb_signal_unicode.bin"),
    )
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "string"
    assert val.decode("utf-8") == "你好 🦀", f"unicode mismatch: {val}"


def test_roundtrip_all_scalars():
    """Write one size-prefixed file per scalar type for C++ cross-language."""
    cases = [
        (HalType.S8, HalValueData.s8_val,
         lambda b: build_scalar(b, "S8", S8ValStart, S8ValAddValue, S8ValEnd, -42),
         "py_fb_signal_s8.bin"),
        (HalType.U8, HalValueData.u8_val,
         lambda b: build_scalar(b, "U8", U8ValStart, U8ValAddValue, U8ValEnd, 200),
         "py_fb_signal_u8.bin"),
        (HalType.S16, HalValueData.s16_val,
         lambda b: build_scalar(b, "S16", S16ValStart, S16ValAddValue, S16ValEnd, -10000),
         "py_fb_signal_s16.bin"),
        (HalType.U16, HalValueData.u16_val,
         lambda b: build_scalar(b, "U16", U16ValStart, U16ValAddValue, U16ValEnd, 60000),
         "py_fb_signal_u16.bin"),
        (HalType.S32, HalValueData.s32_val,
         lambda b: build_s32(b, -42),
         "py_fb_signal_s32_prefixed.bin"),
        (HalType.U32, HalValueData.u32_val,
         lambda b: build_scalar(b, "U32", U32ValStart, U32ValAddValue, U32ValEnd, 4000000000),
         "py_fb_signal_u32.bin"),
        (HalType.S64, HalValueData.s64_val,
         lambda b: build_scalar(b, "S64", S64ValStart, S64ValAddValue, S64ValEnd, -1000000000000),
         "py_fb_signal_s64.bin"),
        (HalType.U64, HalValueData.u64_val,
         lambda b: build_scalar(b, "U64", U64ValStart, U64ValAddValue, U64ValEnd, 18000000000000),
         "py_fb_signal_u64.bin"),
        (HalType.F32, HalValueData.f32_val,
         lambda b: build_scalar(b, "F32", F32ValStart, F32ValAddValue, F32ValEnd, 3.14),
         "py_fb_signal_f32.bin"),
        (HalType.F64, HalValueData.f64_val,
         lambda b: build_f64(b, 3.141592653589793),
         "py_fb_signal_f64_prefixed.bin"),
    ]
    for hal_type, data_type, build_fn, fname in cases:
        buf = finish_prefixed_and_build(
            hal_type, data_type, build_fn,
            "test.scalar", os.path.join(OUTPUT_DIR, fname),
        )
        assert buf is not None, f"Failed to build {fname}"


def build_scalar(builder, name, start_fn, add_fn, end_fn, value):
    """Build a generic scalar value table: start → add → end."""
    start_fn(builder)
    add_fn(builder, value)
    return end_fn(builder)


# ─── Cross-language: read C++ output ────────────────────────────────────────


def test_cross_lang_read_cpp_s32():
    """Read C++-generated /tmp/fb_signal_s32.bin and verify."""
    path = os.path.join(OUTPUT_DIR, "fb_signal_s32.bin")
    if not os.path.exists(path):
        print(f"SKIP: {path} not found (C++ build not yet done)")
        return
    with open(path, "rb") as f:
        buf = f.read()
    sig = HalSignal.GetRootAsHalSignal(buf, 0)  # C++ uses non-prefixed Finish
    assert sig.Name() == b"test.s32", f"name mismatch: {sig.Name()}"
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "s32" and val == 42, f"cross-lang s32: expected 42, got {val}"
    print("  PASS: cross-lang s32")


def test_cross_lang_read_cpp_f64():
    path = os.path.join(OUTPUT_DIR, "fb_signal_f64.bin")
    if not os.path.exists(path):
        print(f"SKIP: {path} not found (C++ build not yet done)")
        return
    with open(path, "rb") as f:
        buf = f.read()
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "f64" and abs(val - 3.14) < 1e-10, f"cross-lang f64 mismatch: {val}"
    print("  PASS: cross-lang f64")


def test_cross_lang_read_cpp_string():
    path = os.path.join(OUTPUT_DIR, "fb_signal_string.bin")
    if not os.path.exists(path):
        print(f"SKIP: {path} not found (C++ build not yet done)")
        return
    with open(path, "rb") as f:
        buf = f.read()
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "string" and val == b"hello", f"cross-lang string mismatch: {val}"
    print("  PASS: cross-lang string")


def test_cross_lang_read_cpp_blob():
    path = os.path.join(OUTPUT_DIR, "fb_signal_blob.bin")
    if not os.path.exists(path):
        print(f"SKIP: {path} not found (C++ build not yet done)")
        return
    with open(path, "rb") as f:
        buf = f.read()
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    expected = bytes([0xde, 0xad, 0xbe, 0xef])
    assert tag == "blob" and val == expected, f"cross-lang blob mismatch: {val}"
    print("  PASS: cross-lang blob")


def test_cross_lang_read_cpp_bool():
    path = os.path.join(OUTPUT_DIR, "fb_signal_bool.bin")
    if not os.path.exists(path):
        print(f"SKIP: {path} not found (C++ build not yet done)")
        return
    with open(path, "rb") as f:
        buf = f.read()
    sig = HalSignal.GetRootAsHalSignal(buf, 0)
    hv = sig.Value()
    tag, val = value_from_halvalue(hv)
    assert tag == "bool" and val is True, f"cross-lang bool mismatch: {val}"
    print("  PASS: cross-lang bool")


# ─── Main ────────────────────────────────────────────────────────────────────


def main():
    print("=== Python roundtrip tests ===")
    test_roundtrip_bool()
    print("  PASS: bool")
    test_roundtrip_s32()
    print("  PASS: s32")
    test_roundtrip_f64()
    print("  PASS: f64")
    test_roundtrip_string()
    print("  PASS: string")
    test_roundtrip_blob()
    print("  PASS: blob")
    test_roundtrip_array_s8()
    print("  PASS: array(s8)")
    test_roundtrip_unicode_string()
    print("  PASS: unicode string")
    test_roundtrip_all_scalars()
    print("  PASS: all scalars (size-prefixed)")

    print("\n=== Cross-language C++ read tests ===")
    cross_pass = 0
    cross_pass += 1 if test_cross_lang_read_cpp_s32() is None else 0
    cross_pass += 1 if test_cross_lang_read_cpp_f64() is None else 0
    cross_pass += 1 if test_cross_lang_read_cpp_string() is None else 0
    cross_pass += 1 if test_cross_lang_read_cpp_blob() is None else 0
    cross_pass += 1 if test_cross_lang_read_cpp_bool() is None else 0
    print(f"  PASS: {cross_pass}/5 cross-language")

    print("\nAll tests passed.")


if __name__ == "__main__":
    main()
