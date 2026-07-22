"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTheiaHmiSignal = useTheiaHmiSignal;
const react_1 = require("react");
/**
 * Theia-specific HMI signal hook.
 * Uses napi-rs bridge to read controller signals.
 * Falls back to SimulationHarness for Preview mode in development.
 *
 * ponytail: 500ms polling with setInterval, same as studio version.
 */
function useTheiaHmiSignal(signalName) {
    const [value, setValue] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const intervalRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        setValue(null);
        setError(null);
        if (!signalName)
            return;
        const tick = async () => {
            try {
                // ponytail: try napi-rs bridge first, fallback to SimulationHarness
                const result = await readSignalNative(signalName);
                setValue(String(result ?? null));
                setError(null);
            }
            catch (e) {
                setValue(null);
                setError(String(e));
            }
        };
        tick();
        const id = setInterval(tick, 500);
        intervalRef.current = id;
        return () => {
            clearInterval(id);
            intervalRef.current = null;
        };
    }, [signalName]);
    const clearError = () => setError(null);
    return { value, error, clearError };
}
/**
 * Stub: reads a signal via napi-rs bridge or SimulationHarness.
 * Replace with actual napi-rs binding when theia-bridge crate is ready.
 */
async function readSignalNative(signalName) {
    // ponytail: try window.__audesysSim first (SimulationHarness stub for dev)
    const sim = window.__audesysSim;
    if (sim?.readSignal) {
        return await sim.readSignal(signalName);
    }
    // ponytail: placeholder — real napi-rs bridge when implemented
    return null;
}
//# sourceMappingURL=useTheiaHmiSignal.js.map