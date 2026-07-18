import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function DebugPanel() {
    const [socketPath, setSocketPath] = useState("/tmp/audesys-controller.sock");
    const [secret, setSecret] = useState("audesys-dev-secret");
    const [connected, setConnected] = useState(false);
    const [registers, setRegisters] = useState<[string, string][]>([]);
    const [breakpoints, setBreakpoints] = useState<string>("");
    const [bpInput, setBpInput] = useState("");
    const [status, setStatus] = useState("");

    const connect = async () => {
        try {
            await invoke("connect_controller", { socketPath, secret });
            setConnected(true);
            setStatus("connected");
        } catch (e) {
            setStatus(String(e));
        }
    };

    const disconnect = async () => {
        try {
            await invoke("disconnect_controller");
            setConnected(false);
            setRegisters([]);
            setBreakpoints("");
            setStatus("disconnected");
        } catch (e) {
            setStatus(String(e));
        }
    };

    const pause = async () => {
        try {
            setStatus(await invoke("controller_pause"));
        } catch (e) {
            setStatus(String(e));
        }
    };

    const resume = async () => {
        try {
            setStatus(await invoke("controller_resume"));
        } catch (e) {
            setStatus(String(e));
        }
    };

    const step = async () => {
        try {
            setStatus(await invoke("controller_step"));
        } catch (e) {
            setStatus(String(e));
        }
    };

    const refreshRegisters = async () => {
        try {
            setRegisters(await invoke("controller_get_registers"));
        } catch (e) {
            setStatus(String(e));
        }
    };

    const refreshBreakpoints = async () => {
        try {
            setBreakpoints(await invoke("controller_get_breakpoints"));
        } catch (e) {
            setStatus(String(e));
        }
    };

    const addBreakpoint = async () => {
        try {
            await invoke("controller_add_breakpoint", { ip: parseInt(bpInput) });
            setBpInput("");
            await refreshBreakpoints();
        } catch (e) {
            setStatus(String(e));
        }
    };

    const removeBreakpoint = async (ip: string) => {
        try {
            await invoke("controller_remove_breakpoint", { ip: parseInt(ip) });
            await refreshBreakpoints();
        } catch (e) {
            setStatus(String(e));
        }
    };

    return (
        <div className="debug-panel">
            <div className="app-panel__header">Debug</div>
            {!connected ? (
                <div className="debug-panel__connect">
                    <input
                        placeholder="Socket path"
                        value={socketPath}
                        onChange={(e) => setSocketPath(e.target.value)}
                        className="debug-panel__input"
                    />
                    <input
                        placeholder="Secret"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        className="debug-panel__input"
                    />
                    <button onClick={connect} className="app-btn">
                        Connect
                    </button>
                </div>
            ) : (
                <div className="debug-panel__controls">
                    <div className="debug-panel__actions">
                        <button onClick={pause} className="app-btn">
                            ⏸
                        </button>
                        <button onClick={resume} className="app-btn">
                            ▶
                        </button>
                        <button onClick={step} className="app-btn">
                            ⏭
                        </button>
                        <button
                            onClick={disconnect}
                            className="app-btn"
                            style={{ marginLeft: "auto" }}
                        >
                            ✕
                        </button>
                    </div>
                    <button
                        onClick={refreshRegisters}
                        className="app-btn"
                        style={{ width: "100%", marginBottom: "8px" }}
                    >
                        Refresh Registers
                    </button>
                    {registers.length > 0 && (
                        <table
                            className="app-signal-table"
                            style={{ marginBottom: "8px" }}
                        >
                            <thead>
                                <tr>
                                    {registers.map(([name]) => (
                                        <th
                                            key={name}
                                            className="app-signal-table__th"
                                            style={{ textAlign: "center" }}
                                        >
                                            {name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {registers.map(([name, val]) => (
                                        <td
                                            key={name}
                                            className="app-signal-table__td app-signal-table__td--mono"
                                            style={{ textAlign: "center" }}
                                        >
                                            {val}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    )}
                    <div className="debug-panel__bp-input">
                        <input
                            placeholder="IP address"
                            value={bpInput}
                            onChange={(e) => setBpInput(e.target.value)}
                            className="debug-panel__input"
                            style={{ flex: 1 }}
                        />
                        <button onClick={addBreakpoint} className="app-btn">
                            Add BP
                        </button>
                    </div>
                    <button
                        onClick={refreshBreakpoints}
                        className="app-btn"
                        style={{ width: "100%", marginBottom: "4px" }}
                    >
                        Refresh BPs
                    </button>
                    {breakpoints &&
                        breakpoints !== "[]" &&
                        breakpoints
                            .replace(/[\[\]]/g, "")
                            .split(",")
                            .filter(Boolean)
                            .map((bp) => (
                                <div key={bp} className="debug-panel__bp-item">
                                    <span className="debug-panel__bp-addr">
                                        {bp.trim()}
                                    </span>
                                    <button
                                        onClick={() => removeBreakpoint(bp.trim())}
                                        className="debug-panel__bp-remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                    {status && (
                        <div className="debug-panel__status">{status}</div>
                    )}
                </div>
            )}
        </div>
    );
}
