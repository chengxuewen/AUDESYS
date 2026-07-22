import { useState, useEffect, useRef } from "react";
import { usePlatform } from "../platform/provider";

export default function SignalWatchPanel() {
    const { invoke } = usePlatform();
    const [signals, setSignals] = useState<[string, string][]>([]);
    const [polling, setPolling] = useState(false);
    const [count, setCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startPolling = () => {
        if (polling) return;
        setPolling(true);
        const id = setInterval(async () => {
            try {
                const sigs: [string, string][] = await invoke("controller_signal_snapshot", { pattern: "*" });
                setSignals(sigs);
                setCount((c) => c + 1);
            } catch (_e) {
                // silently ignore — controller may not respond every tick
            }
        }, 500);
        intervalRef.current = id;
    };

    const stopPolling = () => {
        setPolling(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopPolling();
    }, []);

    return (
        <div className="debug-panel">
            <div className="app-panel__header">
                Signal Monitor
                <span style={{ fontSize: "11px", fontWeight: "normal", marginLeft: "8px" }}>
                    {polling ? `● Live (${count})` : "○ Idle"}
                </span>
            </div>
            <div style={{ padding: "4px 8px", display: "flex", gap: "4px" }}>
                {!polling ? (
                    <button onClick={startPolling} className="app-btn" style={{ fontSize: "12px", padding: "4px 8px" }}>
                        Start
                    </button>
                ) : (
                    <button onClick={stopPolling} className="app-btn" style={{ fontSize: "12px", padding: "4px 8px" }}>
                        Stop
                    </button>
                )}
            </div>
            {signals.length > 0 && (
                <div style={{ maxHeight: "200px", overflow: "auto", padding: "0 8px 8px" }}>
                    <table className="app-signal-table" style={{ width: "100%" }}>
                        <thead>
                            <tr>
                                <th className="app-signal-table__th" style={{ textAlign: "left" }}>Name</th>
                                <th className="app-signal-table__th" style={{ textAlign: "right", width: "80px" }}>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signals.map(([name, val]) => (
                                <tr key={name}>
                                    <td className="app-signal-table__td" style={{ fontSize: "12px", padding: "2px 4px" }}>{name}</td>
                                    <td className="app-signal-table__td app-signal-table__td--mono" style={{ fontSize: "12px", padding: "2px 4px", textAlign: "right" }}>{val}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {polling && signals.length === 0 && (
                <div style={{ padding: "8px", fontSize: "12px", color: "#888" }}>No signals yet — start the controller and deploy a program.</div>
            )}
        </div>
    );
}
