import type { HmiLayout } from "../types/hmi";
import { DEMO_LAYOUT, loadLayoutFromYaml } from "./LayoutLoader";

/**
 * LocalFileLayoutLoader — simulates reading HMI layout from a YAML file.
 * P1 uses a hardcoded YAML string (no real filesystem access in browser).
 * P2 replaces with Tauri fs API or Controller IPC 0x17 push.
 *
 * Layout YAML format (same as Studio export):
 * ```yaml
 * version: 1
 * name: Demo Panel
 * canvasWidth: 1920
 * canvasHeight: 1080
 * widgets:
 *   - id: gauge-1
 *     type: gauge
 *     position: { x: 50, y: 50 }
 *     ...
 * ```
 */

/** Embedded YAML layout string — mock for P1 file reading. */
const EMBEDDED_LAYOUT_YAML = `version: 1
name: Demo Panel
canvasWidth: 1920
canvasHeight: 1080
widgets:
  - id: gauge-1
    type: gauge
    position:
      x: 50
      y: 50
    size:
      width: 260
      height: 260
    label: 泵速
    signal: pump.0.speed
    config:
      min: 0
      max: 3000
      unit: RPM
  - id: tank-1
    type: tank
    position:
      x: 360
      y: 50
    size:
      width: 200
      height: 300
    label: 液位
    signal: tank.level
    config:
      min: 0
      max: 100
      unit: "%"
  - id: display-1
    type: display
    position:
      x: 610
      y: 50
    size:
      width: 220
      height: 80
    label: 温度
    signal: temp.reactor
    config:
      unit: °C
  - id: indicator-1
    type: indicator
    position:
      x: 50
      y: 360
    size:
      width: 80
      height: 80
    label: 电机状态
    signal: motor.current
    config:
      thresholds:
        ok: 20
        warn: 25
  - id: text-1
    type: text
    position:
      x: 180
      y: 360
    size:
      width: 300
      height: 40
    label: 产线状态
    config:
      fontSize: 18
      color: "#a0a0b0"
      text: 运行中 — 产线 A
  - id: button-1
    type: button
    position:
      x: 610
      y: 180
    size:
      width: 160
      height: 60
    label: 紧急停机
    config:
      onColor: "#FF4444"
      offColor: "#2a2a30"
`;

type LayoutListener = (layout: HmiLayout) => void;

// ponytail: parse YAML manually for simple key-value structures.
// For complex nested YAML we fall back to JSON.parse with JSON-compatible YAML subset.
// P2: switch to js-yaml when Studio YAML export gets nested structures.
function parseYamlLayout(yaml: string): HmiLayout | null {
  // Try JSON parse first (Studio currently exports JSON-compatible YAML)
  const result = loadLayoutFromYaml(yaml);
  if (result) return result;

  // ponytail: simple YAML parser for the embedded format — key: value lines
  // Falls through to null if the format doesn't match
  return null;
}

export class LocalFileLayoutLoader {
  private lastModified = 0;
  private watcherId: ReturnType<typeof setInterval> | null = null;

  /** Read layout from the "file" — P1 returns parsed embedded YAML. */
  async loadLayout(): Promise<HmiLayout> {
    // ponytail: mock file read — return parsed embedded YAML
    const parsed = parseYamlLayout(EMBEDDED_LAYOUT_YAML);
    return parsed ?? { ...DEMO_LAYOUT };
  }

  /**
   * Watch the layout file for changes via polling (every 2 seconds).
   * Compares a mock modification timestamp; `onChange` fires when it detects a change.
   * Returns an unsubscribe function to stop polling.
   *
   * ponytail: setInterval + Date.now() comparison, no fs.watch.
   * P2: replace with Controller IPC 0x17 push notification.
   */
  watchLayout(onChange: (layout: HmiLayout) => void): () => void {
    // Track fake modification time — increments on each poll to simulate changes
    let fakeMtime = this.lastModified;

    // ponytail: global lock — single watcher, per-source polling if throughput matters
    if (this.watcherId) {
      clearInterval(this.watcherId);
    }

    this.watcherId = setInterval(async () => {
      const currentFakeMtime = Date.now();
      // Only notify if the "file" was "modified" since last check
      if (currentFakeMtime > fakeMtime) {
        fakeMtime = currentFakeMtime;
        const layout = await this.loadLayout();
        this.lastModified = currentFakeMtime;
        onChange(layout);
      }
    }, 2000);

    return () => {
      if (this.watcherId) {
        clearInterval(this.watcherId);
        this.watcherId = null;
      }
    };
  }
}

/** Singleton loader instance — shared across the Panel app. */
export const layoutLoader = new LocalFileLayoutLoader();
