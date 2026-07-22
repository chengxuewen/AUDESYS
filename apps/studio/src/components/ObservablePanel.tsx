import { useState, useEffect, useRef } from "react";
import { usePlatform } from "../platform/provider";

function parsePrometheus(text: string): Record<string, string> {
    const metrics: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
            metrics[parts[0]] = parts[1];
        }
    }
    return metrics;
}

export default function ObservablePanel() {
    const { invoke } = usePlatform();
    const [metrics, setMetrics] = useState<Record<string, string>>({});
    const [port, setPort] = useState("9000");
    const [polling, setPolling] = useState(false);
    const [error, setError] = useState("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchMetrics = async () => {
        try {
            const raw: string = await invoke("fetch_controller_metrics", { healthPort: port });
            setMetrics(parsePrometheus(raw));
            setError("");
        } catch (e) {
            setError(String(e));
        }
    };

    const startPolling = () => {
        if (polling) return;
        setPolling(true);
        fetchMetrics();
        intervalRef.current = setInterval(fetchMetrics, 2000);
    };

    const stopPolling = () => {
        setPolling(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };

    useEffect(() => () => stopPolling(), []);

    const jitterData = metrics["audesys_cycle_jitter_us"]
        ?.match(/\[([^\]]*)\]/)?.[1]
        ?.split(",")
        .filter(Boolean)
        .map(Number) ?? [];

    const entries = Object.entries(metrics).filter(([k]) => !k.startsWith("audesys_cycle_jitter_us"));

    return (
        <div className="debug-panel">
            <div className="app-panel__header">
                Observability
                {polling && <span style={{ fontSize: "11px", fontWeight: "normal", marginLeft: "8px" }}>● Live</span>}
            </div>
            <div style={{ padding: "4px 8px", display: "flex", gap: "4px" }}>
                <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    style={{ width: "60px", fontSize: "12px", padding: "2px 4px" }}
                    placeholder="port"
                />
                {!polling ? (
                    <button onClick={startPolling} className="app-btn" style={{ fontSize: "12px", padding: "4px 8px" }}>Start</button>
                ) : (
                    <button onClick={stopPolling} className="app-btn" style={{ fontSize: "12px", padding: "4px 8px" }}>Stop</button>
                )}
            </div>
            {error && <div style={{ padding: "4px 8px", fontSize: "11px", color: "#f66" }}>{error}</div>}
            {entries.length > 0 && (
                <table className="app-signal-table" style={{ width: "100%", marginBottom: "8px" }}>
                    <tbody>
                        {entries.map(([key, val]) => (
                            <tr key={key}>
                                <td className="app-signal-table__td" style={{ fontSize: "11px", padding: "1px 4px" }}>{key.replace("audesys_", "")}</td>
                                <td className="app-signal-table__td app-signal-table__td--mono" style={{ fontSize: "11px", padding: "1px 4px", textAlign: "right" }}>{val}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {jitterData.length > 0 && (
                <div style={{ padding: "0 8px 8px" }}>
                    <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>Jitter (μs)</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "1px", height: "40px" }}>
                        {jitterData.map((val, i) => {
                            const max = Math.max(...jitterData, 1);
                            const h = Math.max(2, (val / max) * 38);
                            return <div key={i} style={{ flex: 1, background: "#4a9", height: `${h}px` }} title={`${val}μs`} />;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
