// AUDESYS FlatBuffers roundtrip test — C++ side
// Builds HalSignal with each HalValue variant, serializes, deserializes, verifies.

#include <cassert>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>
#include <memory>

#include "generated/hal_value_generated.h"

using namespace audesys::hal;

// ── helpers ──

static void write_bin(const std::string& path, const uint8_t* data, size_t len) {
    std::ofstream f(path, std::ios::binary);
    f.write(reinterpret_cast<const char*>(data), static_cast<std::streamsize>(len));
}

static void print_hex(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; ++i)
        printf("%02x", data[i]);
    printf("\n");
}

// ── build a HalSignal with a scalar value ──

template <typename ValOffset>
static flatbuffers::Offset<HalSignal> build_signal(
    flatbuffers::FlatBufferBuilder& fbb,
    const char* name,
    HalType hal_type,
    HalValueData union_type,
    ValOffset data_offset,
    uint64_t ts_ns = 1)
{
    auto name_off = fbb.CreateString(name);
    auto value_off = CreateHalValue(fbb, hal_type, union_type, data_offset.Union());
    return CreateHalSignal(fbb, name_off, value_off, ts_ns);
}

// ── test one signal end-to-end ──

template <typename F>
static void test_one(const char* label, const char* filepath, F build_fn) {
    printf("[%s] ", label);

    // build
    flatbuffers::FlatBufferBuilder fbb(128);
    auto sig_off = build_fn(fbb);
    fbb.Finish(sig_off);

    const uint8_t* buf = fbb.GetBufferPointer();
    size_t len = fbb.GetSize();

    // hex
    print_hex(buf, len);

    // write to file
    write_bin(filepath, buf, len);

    // verify
    auto* sig = GetHalSignal(buf);
    assert(sig != nullptr);
    printf("  ok\n");
}

// ────────────────────────────────────────────────────────────

int main() {
    // 1. Bool(true)
    test_one("Bool", "/tmp/fb_signal_bool.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        auto bool_off = CreateBoolVal(fbb, true);
        return build_signal(fbb, "test.bool", HalType::Bool,
                            HalValueData::bool_val, bool_off);
    });

    // verify roundtrip
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        auto bool_off = CreateBoolVal(fbb, true);
        auto sig_off = build_signal(fbb, "test.bool", HalType::Bool,
                                    HalValueData::bool_val, bool_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::bool_val);
        assert(sig->value()->data_as_bool_val()->value() == true);
        assert(strcmp(sig->name()->c_str(), "test.bool") == 0);
    }

    // 2. S32(42)
    test_one("S32", "/tmp/fb_signal_s32.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        auto s32_off = CreateS32Val(fbb, 42);
        return build_signal(fbb, "test.s32", HalType::S32,
                            HalValueData::s32_val, s32_off);
    });
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        auto s32_off = CreateS32Val(fbb, 42);
        auto sig_off = build_signal(fbb, "test.s32", HalType::S32,
                                    HalValueData::s32_val, s32_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::s32_val);
        assert(sig->value()->data_as_s32_val()->value() == 42);
    }

    // 3. F64(3.14)
    test_one("F64", "/tmp/fb_signal_f64.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        auto f64_off = CreateF64Val(fbb, 3.14);
        return build_signal(fbb, "test.f64", HalType::F64,
                            HalValueData::f64_val, f64_off);
    });
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        auto f64_off = CreateF64Val(fbb, 3.14);
        auto sig_off = build_signal(fbb, "test.f64", HalType::F64,
                                    HalValueData::f64_val, f64_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::f64_val);
        assert(sig->value()->data_as_f64_val()->value() == 3.14);
    }

    // 4. String("hello")
    test_one("String", "/tmp/fb_signal_string.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        auto str_off = fbb.CreateString("hello");
        auto sv_off = CreateStringVal(fbb, str_off);
        return build_signal(fbb, "test.string", HalType::String,
                            HalValueData::string_val, sv_off);
    });
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        auto str_off = fbb.CreateString("hello");
        auto sv_off = CreateStringVal(fbb, str_off);
        auto sig_off = build_signal(fbb, "test.string", HalType::String,
                                    HalValueData::string_val, sv_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::string_val);
        assert(strcmp(sig->value()->data_as_string_val()->value()->c_str(), "hello") == 0);
    }

    // 5. Blob({0xde, 0xad, 0xbe, 0xef})
    test_one("Blob", "/tmp/fb_signal_blob.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        uint8_t raw[] = {0xde, 0xad, 0xbe, 0xef};
        auto blob_vec = fbb.CreateVector(raw, 4);
        auto blob_off = CreateBlobVal(fbb, blob_vec);
        return build_signal(fbb, "test.blob", HalType::Blob,
                            HalValueData::blob_val, blob_off);
    });
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        uint8_t raw[] = {0xde, 0xad, 0xbe, 0xef};
        auto blob_vec = fbb.CreateVector(raw, 4);
        auto blob_off = CreateBlobVal(fbb, blob_vec);
        auto sig_off = build_signal(fbb, "test.blob", HalType::Blob,
                                    HalValueData::blob_val, blob_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::blob_val);
        auto* bv = sig->value()->data_as_blob_val();
        assert(bv->data()->size() == 4);
        assert(bv->data()->Get(0) == 0xde);
        assert(bv->data()->Get(1) == 0xad);
        assert(bv->data()->Get(2) == 0xbe);
        assert(bv->data()->Get(3) == 0xef);
    }

    // 6. Array<S8> — element_type=S8(1), data=[1,2,3]
    test_one("Array", "/tmp/fb_signal_array.bin", [](flatbuffers::FlatBufferBuilder& fbb) {
        uint8_t raw[] = {1, 2, 3};
        auto data_vec = fbb.CreateVector(raw, 3);
        auto arr_off = CreateArrayData(fbb, HalType::S8, data_vec);
        return build_signal(fbb, "test.array", HalType::S8,
                            HalValueData::array_val, arr_off);
    });
    {
        flatbuffers::FlatBufferBuilder fbb(128);
        uint8_t raw[] = {1, 2, 3};
        auto data_vec = fbb.CreateVector(raw, 3);
        auto arr_off = CreateArrayData(fbb, HalType::S8, data_vec);
        auto sig_off = build_signal(fbb, "test.array", HalType::S8,
                                    HalValueData::array_val, arr_off);
        fbb.Finish(sig_off);
        auto* sig = GetHalSignal(fbb.GetBufferPointer());
        assert(sig->value()->data_type() == HalValueData::array_val);
        auto* ad = sig->value()->data_as_array_val();
        assert(ad->element_type() == HalType::S8);
        assert(ad->data()->size() == 3);
        assert(ad->data()->Get(0) == 1);
        assert(ad->data()->Get(1) == 2);
        assert(ad->data()->Get(2) == 3);
    }

    printf("\nAll 6 roundtrip tests passed.\n");

    // ── Cross-language: read Python output ──
    printf("\n=== Cross-language Python read tests ===\n");

    auto read_py = [](const char* path, auto check) {
        std::ifstream f(path, std::ios::binary | std::ios::ate);
        if (!f) { printf("  SKIP: %s not found\n", path); return; }
        size_t len = f.tellg(); f.seekg(0);
        std::vector<uint8_t> buf(len);
        f.read(reinterpret_cast<char*>(buf.data()), len);
        auto* sig = GetHalSignal(buf.data());
        check(sig);
    };

    read_py("/tmp/py_fb_signal_s32.bin", [](auto* sig) {
        assert(sig->value()->data_type() == HalValueData::s32_val);
        assert(sig->value()->data_as_s32_val()->value() == 42);
        printf("  PASS: cross-lang s32 (C++ reads Python)\n");
    });
    read_py("/tmp/py_fb_signal_f64.bin", [](auto* sig) {
        assert(sig->value()->data_type() == HalValueData::f64_val);
        assert(sig->value()->data_as_f64_val()->value() == 3.14);
        printf("  PASS: cross-lang f64 (C++ reads Python)\n");
    });
    read_py("/tmp/py_fb_signal_bool.bin", [](auto* sig) {
        assert(sig->value()->data_type() == HalValueData::bool_val);
        assert(sig->value()->data_as_bool_val()->value() == true);
        printf("  PASS: cross-lang bool (C++ reads Python)\n");
    });
    read_py("/tmp/py_fb_signal_string.bin", [](auto* sig) {
        assert(sig->value()->data_type() == HalValueData::string_val);
        assert(strcmp(sig->value()->data_as_string_val()->value()->c_str(), "hello") == 0);
        printf("  PASS: cross-lang string (C++ reads Python)\n");
    });
    read_py("/tmp/py_fb_signal_blob.bin", [](auto* sig) {
        assert(sig->value()->data_type() == HalValueData::blob_val);
        auto* bv = sig->value()->data_as_blob_val();
        assert(bv->data()->size() == 4);
        assert(bv->data()->Get(0) == 0xde && bv->data()->Get(1) == 0xad);
        assert(bv->data()->Get(2) == 0xbe && bv->data()->Get(3) == 0xef);
        printf("  PASS: cross-lang blob (C++ reads Python)\n");
    });

    printf("\nAll cross-language tests complete.\n");
    return 0;
}
