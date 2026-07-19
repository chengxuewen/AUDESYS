//! Runtime performance benchmarks — signal throughput, RPC latency, registry ops.
//!
//! Run: `cargo bench -p audesys-controller`

use criterion::{BenchmarkId, Criterion, Throughput, black_box, criterion_group, criterion_main};

use audesys_amw_inproc::InprocTransport;
use audesys_controller::{SignalDef, SignalRegistry, WriteStrategy};
use audesys_hal_core::{HalPinType, HalTransport, HalValue, Timestamp};

// ── Signal throughput ──

fn bench_signal_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("signal_throughput");

    for n in [1u32, 10, 100, 1000] {
        let t = InprocTransport::new();

        group.throughput(Throughput::Elements(n as u64));
        group.bench_with_input(BenchmarkId::new("publish", n), &n, |b, &n| {
            b.iter(|| {
                for i in 0..n {
                    t.publish_signal(
                        &format!("b.s{i}"),
                        HalValue::F64(i as f64),
                        Timestamp { secs: 0, micros: 0 },
                    )
                    .unwrap();
                }
            });
        });

        // Pre-populate
        for i in 0..n {
            t.publish_signal(
                &format!("b.s{i}"),
                HalValue::F64(i as f64),
                Timestamp { secs: 0, micros: 0 },
            )
            .unwrap();
        }

        group.bench_with_input(BenchmarkId::new("read", n), &n, |b, &n| {
            b.iter(|| {
                for i in 0..n {
                    black_box(t.read_signal(&format!("b.s{i}")).unwrap());
                }
            });
        });
    }
    group.finish();
}

// ── RPC latency ──

fn bench_rpc_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("rpc");
    let t = InprocTransport::new();
    t.register_rpc_handler("ping", Box::new(|_| Ok(b"pong".to_vec()))).unwrap();

    group.bench_function("round_trip", |b| {
        b.iter(|| {
            black_box(t.rpc_call("ping", b"{}", 1000).unwrap());
        });
    });
    group.finish();
}

// ── Signal registry ──

fn bench_signal_registry(c: &mut Criterion) {
    let mut group = c.benchmark_group("signal_registry");

    for n in [10u32, 100, 1000] {
        group.throughput(Throughput::Elements(n as u64));
        group.bench_with_input(BenchmarkId::new("register", n), &n, |b, &n| {
            b.iter(|| {
                let reg = SignalRegistry::new();
                for i in 0..n {
                    reg.register(SignalDef::new(
                        &format!("s{i}"),
                        HalPinType::F64,
                        HalValue::F64(0.0),
                        WriteStrategy::Own,
                    ))
                    .unwrap();
                }
                black_box(reg);
            });
        });

        let reg = SignalRegistry::new();
        for i in 0..n {
            reg.register(SignalDef::new(
                &format!("s{i}"),
                HalPinType::F64,
                HalValue::F64(0.0),
                WriteStrategy::Own,
            ))
            .unwrap();
        }

        group.bench_with_input(BenchmarkId::new("lookup", n), &n, |b, _| {
            b.iter(|| {
                black_box(reg.get("s500").is_some());
            });
        });

        group.bench_with_input(BenchmarkId::new("snapshot", n), &n, |b, _| {
            b.iter(|| {
                black_box(reg.list_snapshots());
            });
        });
    }
    group.finish();
}

// ── Transport snapshot ──

fn bench_transport_snapshot(c: &mut Criterion) {
    let mut group = c.benchmark_group("transport");

    let t = InprocTransport::new();
    for i in 0..1000u32 {
        t.publish_signal(
            &format!("ts.s{i}"),
            HalValue::F64(i as f64),
            Timestamp { secs: 0, micros: 0 },
        )
        .unwrap();
    }

    group.bench_function("snapshot_1000", |b| {
        b.iter(|| {
            black_box(t.snapshot_signals("ts.*").unwrap());
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_signal_throughput,
    bench_rpc_latency,
    bench_signal_registry,
    bench_transport_snapshot,
);
criterion_main!(benches);
