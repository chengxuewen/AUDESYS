import { useState, useRef, useEffect, useCallback } from "react";
import { usePlatform } from "../platform/provider";
import "./SimulatorPanel.css";

// ── Types ──

interface SimSignal {
  name: string;
  value: string;
  type: string;
}

interface SimDevice {
  name: string;
  online: boolean;
}

interface ModbusCoil {
  addr: number;
  signal: string;
  state: boolean;
}

interface ModbusRegister {
  addr: number;
  signal: string;
  value: number;
}

interface SavedScene {
  name: string;
  cycles: number;
}

interface Fault {
  type: string;
  active: boolean;
}

type SimTab = "signals" | "devices" | "modbus" | "scene" | "faults";

const TABS: { key: SimTab; label: string }[] = [
  { key: "signals", label: "Signals" },
  { key: "devices", label: "Devices" },
  { key: "modbus", label: "Modbus" },
  { key: "scene", label: "Scene" },
  { key: "faults", label: "Faults" },
];

const FAULT_TYPES = ["timeout", "overheat", "disconnect"] as const;

// ── Tab 1: Signals ──

function SignalsTab() {
  const { invoke } = usePlatform();
  const [signals, setSignals] = useState<SimSignal[]>([]);
  const [running, setRunning] = useState(false);
  const [editCell, setEditCell] = useState<{ idx: number; field: "value" } | null>(null);
  const [editVal, setEditVal] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollSignals = useCallback(async () => {
    try {
      const sigs: SimSignal[] = await invoke("sim_get_signals");
      setSignals(sigs);
    } catch (_e) { /* controller may not respond */ }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    pollSignals();
    intervalRef.current = setInterval(pollSignals, 500);
    setRunning(true);
  }, [pollSignals]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setRunning(false);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleStart = () => { invoke("sim_start").catch(() => {}); startPolling(); };
  const handleStop = () => { invoke("sim_stop").catch(() => {}); stopPolling(); };
  const handleStep = () => { invoke("sim_step").catch(() => {}); pollSignals(); };

  const startEdit = (idx: number, val: string) => {
    setEditCell({ idx, field: "value" });
    setEditVal(val);
  };

  const commitEdit = async () => {
    if (!editCell) return;
    try {
      await invoke("sim_set_signal", { name: signals[editCell.idx].name, value: editVal });
    } catch (_e) { /* ignore */ }
    setEditCell(null);
    pollSignals();
  };

  const handleImport = () => { invoke("sim_import_signals").catch(() => {}); };

  return (
    <div className="sim-panel__tab-content">
      <div className="sim-panel__toolbar">
        <button className="sim-panel__btn" onClick={handleStart} disabled={running}>▶ Start</button>
        <button className="sim-panel__btn" onClick={handleStop} disabled={!running}>■ Stop</button>
        <button className="sim-panel__btn sim-panel__btn--secondary" onClick={handleStep}>↷ Step</button>
        <button className="sim-panel__btn sim-panel__btn--secondary" onClick={handleImport}>↓ Import</button>
      </div>
      {signals.length > 0 ? (
        <div className="sim-panel__table-wrap">
          <table className="sim-panel__table">
            <thead>
              <tr>
                <th className="sim-panel__th">Signal</th>
                <th className="sim-panel__th">Value</th>
                <th className="sim-panel__th sim-panel__th--type">Type</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={s.name} className="sim-panel__tr">
                  <td className="sim-panel__td sim-panel__td--mono">{s.name}</td>
                  <td
                    className="sim-panel__td sim-panel__td--mono sim-panel__td--editable"
                    onClick={() => startEdit(i, s.value)}
                    title="Click to edit"
                  >
                    {editCell?.idx === i && editCell.field === "value" ? (
                      <input
                        className="sim-panel__inline-input"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
                        autoFocus
                      />
                    ) : (
                      s.value
                    )}
                  </td>
                  <td className="sim-panel__td sim-panel__td--secondary">{s.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sim-panel__empty">No signals. Start simulation or import from compile.</div>
      )}
    </div>
  );
}

// ── Tab 2: Devices ──

function DevicesTab() {
  const { invoke } = usePlatform();
  const [devices, setDevices] = useState<SimDevice[]>([]);

  const refresh = useCallback(async () => {
    try {
      const devs: SimDevice[] = await invoke("sim_get_devices");
      setDevices(devs);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="sim-panel__tab-content">
      {devices.length > 0 ? (
        <div className="sim-panel__table-wrap">
          <table className="sim-panel__table">
            <thead>
              <tr>
                <th className="sim-panel__th">Device</th>
                <th className="sim-panel__th sim-panel__th--status">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.name} className="sim-panel__tr">
                  <td className="sim-panel__td sim-panel__td--mono">{d.name}</td>
                  <td className="sim-panel__td">
                    <span className={`sim-panel__status-dot${d.online ? " sim-panel__status-dot--online" : " sim-panel__status-dot--offline"}`} />
                    {d.online ? "Online" : "Offline"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sim-panel__empty">No devices</div>
      )}
    </div>
  );
}

// ── Tab 3: Modbus ──

function ModbusTab() {
  const { invoke } = usePlatform();
  const [coils, setCoils] = useState<ModbusCoil[]>([]);
  const [registers, setRegisters] = useState<ModbusRegister[]>([]);
  const [mapAddr, setMapAddr] = useState("");
  const [mapSignal, setMapSignal] = useState("");

  const refresh = useCallback(async () => {
    try {
      const c: ModbusCoil[] = await invoke("sim_get_modbus_coils");
      setCoils(c);
    } catch (_e) { /* ignore */ }
    try {
      const r: ModbusRegister[] = await invoke("sim_get_modbus_registers");
      setRegisters(r);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleCoil = async (addr: number) => {
    try { await invoke("sim_set_modbus_coil", { addr }); refresh(); } catch (_e) { /* ignore */ }
  };

  const addMapping = async () => {
    if (!mapAddr || !mapSignal) return;
    try {
      await invoke("sim_add_modbus_mapping", { addr: parseInt(mapAddr, 10), signal: mapSignal });
      setMapAddr("");
      setMapSignal("");
      refresh();
    } catch (_e) { /* ignore */ }
  };

  return (
    <div className="sim-panel__tab-content">
      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Coils</div>
        {coils.length > 0 ? (
          <div className="sim-panel__table-wrap sim-panel__table-wrap--compact">
            <table className="sim-panel__table">
              <thead>
                <tr>
                  <th className="sim-panel__th">Addr</th>
                  <th className="sim-panel__th">Signal</th>
                  <th className="sim-panel__th sim-panel__th--action">State</th>
                </tr>
              </thead>
              <tbody>
                {coils.map((c) => (
                  <tr key={c.addr} className="sim-panel__tr">
                    <td className="sim-panel__td sim-panel__td--mono">{c.addr}</td>
                    <td className="sim-panel__td sim-panel__td--mono">{c.signal}</td>
                    <td className="sim-panel__td">
                      <button
                        className={`sim-panel__toggle${c.state ? " sim-panel__toggle--on" : " sim-panel__toggle--off"}`}
                        onClick={() => toggleCoil(c.addr)}
                      >
                        {c.state ? "ON" : "OFF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sim-panel__empty">No coils</div>
        )}
      </div>

      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Registers</div>
        {registers.length > 0 ? (
          <div className="sim-panel__table-wrap sim-panel__table-wrap--compact">
            <table className="sim-panel__table">
              <thead>
                <tr>
                  <th className="sim-panel__th">Addr</th>
                  <th className="sim-panel__th">Signal</th>
                  <th className="sim-panel__th sim-panel__th--value">Value</th>
                </tr>
              </thead>
              <tbody>
                {registers.map((r) => (
                  <tr key={r.addr} className="sim-panel__tr">
                    <td className="sim-panel__td sim-panel__td--mono">{r.addr}</td>
                    <td className="sim-panel__td sim-panel__td--mono">{r.signal}</td>
                    <td className="sim-panel__td sim-panel__td--mono">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sim-panel__empty">No registers</div>
        )}
      </div>

      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Add Mapping</div>
        <div className="sim-panel__form">
          <input
            className="sim-panel__input"
            placeholder="Addr"
            value={mapAddr}
            onChange={(e) => setMapAddr(e.target.value)}
          />
          <input
            className="sim-panel__input"
            placeholder="Signal name"
            value={mapSignal}
            onChange={(e) => setMapSignal(e.target.value)}
          />
          <button className="sim-panel__btn" onClick={addMapping}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Scene ──

function SceneTab() {
  const { invoke } = usePlatform();
  const [name, setName] = useState("");
  const [cycles, setCycles] = useState("10");
  const [scenes, setScenes] = useState<SavedScene[]>([]);

  const refresh = useCallback(async () => {
    try {
      const s: SavedScene[] = await invoke("sim_get_scenes");
      setScenes(s);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const record = async () => {
    if (!name) return;
    try {
      await invoke("sim_record_scene", { name, cycles: parseInt(cycles, 10) });
      setName("");
      refresh();
    } catch (_e) { /* ignore */ }
  };

  const play = async (sceneName: string) => {
    try { await invoke("sim_play_scene", { name: sceneName }); } catch (_e) { /* ignore */ }
  };

  return (
    <div className="sim-panel__tab-content">
      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Record</div>
        <div className="sim-panel__form">
          <input
            className="sim-panel__input"
            placeholder="Scene name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="sim-panel__input sim-panel__input--narrow"
            placeholder="Cycles"
            value={cycles}
            onChange={(e) => setCycles(e.target.value)}
          />
          <button className="sim-panel__btn" onClick={record} disabled={!name}>Record</button>
        </div>
      </div>

      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Saved Scenes</div>
        {scenes.length > 0 ? (
          <div className="sim-panel__table-wrap sim-panel__table-wrap--compact">
            <table className="sim-panel__table">
              <thead>
                <tr>
                  <th className="sim-panel__th">Name</th>
                  <th className="sim-panel__th sim-panel__th--value">Cycles</th>
                  <th className="sim-panel__th sim-panel__th--action" />
                </tr>
              </thead>
              <tbody>
                {scenes.map((s) => (
                  <tr key={s.name} className="sim-panel__tr">
                    <td className="sim-panel__td sim-panel__td--mono">{s.name}</td>
                    <td className="sim-panel__td sim-panel__td--mono">{s.cycles}</td>
                    <td className="sim-panel__td">
                      <button className="sim-panel__btn sim-panel__btn--small" onClick={() => play(s.name)}>▶ Play</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sim-panel__empty">No saved scenes</div>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Faults ──

function FaultsTab() {
  const { invoke } = usePlatform();
  const [faults, setFaults] = useState<Fault[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const f: Fault[] = await invoke("sim_get_faults");
      setFaults(f);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleCheck = (type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const inject = async () => {
    if (selected.size === 0) return;
    try {
      await invoke("sim_inject_fault", { types: Array.from(selected) });
      setSelected(new Set());
      refresh();
    } catch (_e) { /* ignore */ }
  };

  return (
    <div className="sim-panel__tab-content">
      <div className="sim-panel__section">
        <div className="sim-panel__section-header">Inject Fault</div>
        <div className="sim-panel__form sim-panel__form--col">
          {FAULT_TYPES.map((type) => (
            <label key={type} className="sim-panel__check">
              <input
                type="checkbox"
                checked={selected.has(type)}
                onChange={() => toggleCheck(type)}
              />
              <span>{type}</span>
            </label>
          ))}
          <button className="sim-panel__btn sim-panel__btn--danger" onClick={inject} disabled={selected.size === 0}>
            Inject
          </button>
        </div>
      </div>

      <div className="sim-panel__section">
        <div className="sim-panel__section-header">
          Active Faults
          {faults.length > 0 && <span className="sim-panel__badge">{faults.length}</span>}
        </div>
        {faults.length > 0 ? (
          <div className="sim-panel__list">
            {faults.map((f) => (
              <div key={f.type} className="sim-panel__fault-item">
                <span className="sim-panel__fault-dot sim-panel__fault-dot--active" />
                <span className="sim-panel__fault-label">{f.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="sim-panel__empty">No active faults</div>
        )}
      </div>
    </div>
  );
}

// ── Panel ──

export default function SimulatorPanel() {
  const [tab, setTab] = useState<SimTab>("signals");

  return (
    <div className="sim-panel">
      <div className="sim-panel__header">
        <span className="sim-panel__title">Simulator</span>
        <nav className="sim-panel__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`sim-panel__tab${tab === t.key ? " sim-panel__tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="sim-panel__body">
        {tab === "signals" && <SignalsTab />}
        {tab === "devices" && <DevicesTab />}
        {tab === "modbus" && <ModbusTab />}
        {tab === "scene" && <SceneTab />}
        {tab === "faults" && <FaultsTab />}
      </div>
    </div>
  );
}
