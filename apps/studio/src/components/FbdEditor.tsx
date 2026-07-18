import {
  useState,
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import "./FbdEditor.css";

// ── Data Types ───────────────────────────────────────────

interface PinDef {
  id: string;
  label: string;
  side: "input" | "output";
}

interface BlockTypeDef {
  kind: string;
  label: string;
  category: "timer" | "counter" | "bistable" | "edge" | "math" | "compare";
  pins: PinDef[];
}

interface BlockInstance {
  id: string;
  kind: string;
  x: number;
  y: number;
  label: string;
}

interface Connection {
  id: string;
  sourceBlockId: string;
  sourcePinId: string;
  targetBlockId: string;
  targetPinId: string;
}

const BLOCK_WIDTH = 130;
const HEADER_HEIGHT = 26;
const PIN_ROW_HEIGHT = 20;
// ── Block Palette Definitions ────────────────────────────

// ── Block Palette Definitions ────────────────────────────

const BLOCK_TYPES: BlockTypeDef[] = [
  {
    kind: "TON",
    label: "TON",
    category: "timer",
    pins: [
      { id: "IN", label: "IN", side: "input" },
      { id: "PT", label: "PT", side: "input" },
      { id: "Q", label: "Q", side: "output" },
      { id: "ET", label: "ET", side: "output" },
    ],
  },
  {
    kind: "TOF",
    label: "TOF",
    category: "timer",
    pins: [
      { id: "IN", label: "IN", side: "input" },
      { id: "PT", label: "PT", side: "input" },
      { id: "Q", label: "Q", side: "output" },
      { id: "ET", label: "ET", side: "output" },
    ],
  },
  {
    kind: "TP",
    label: "TP",
    category: "timer",
    pins: [
      { id: "IN", label: "IN", side: "input" },
      { id: "PT", label: "PT", side: "input" },
      { id: "Q", label: "Q", side: "output" },
      { id: "ET", label: "ET", side: "output" },
    ],
  },
  {
    kind: "CTU",
    label: "CTU",
    category: "counter",
    pins: [
      { id: "CU", label: "CU", side: "input" },
      { id: "R", label: "R", side: "input" },
      { id: "PV", label: "PV", side: "input" },
      { id: "Q", label: "Q", side: "output" },
      { id: "CV", label: "CV", side: "output" },
    ],
  },
  {
    kind: "CTD",
    label: "CTD",
    category: "counter",
    pins: [
      { id: "CD", label: "CD", side: "input" },
      { id: "LD", label: "LD", side: "input" },
      { id: "PV", label: "PV", side: "input" },
      { id: "Q", label: "Q", side: "output" },
      { id: "CV", label: "CV", side: "output" },
    ],
  },
  {
    kind: "CTUD",
    label: "CTUD",
    category: "counter",
    pins: [
      { id: "CU", label: "CU", side: "input" },
      { id: "CD", label: "CD", side: "input" },
      { id: "R", label: "R", side: "input" },
      { id: "LD", label: "LD", side: "input" },
      { id: "PV", label: "PV", side: "input" },
      { id: "QU", label: "QU", side: "output" },
      { id: "QD", label: "QD", side: "output" },
      { id: "CV", label: "CV", side: "output" },
    ],
  },
  {
    kind: "SR",
    label: "SR",
    category: "bistable",
    pins: [
      { id: "S1", label: "S1", side: "input" },
      { id: "R", label: "R", side: "input" },
      { id: "Q1", label: "Q1", side: "output" },
    ],
  },
  {
    kind: "RS",
    label: "RS",
    category: "bistable",
    pins: [
      { id: "S", label: "S", side: "input" },
      { id: "R1", label: "R1", side: "input" },
      { id: "Q1", label: "Q1", side: "output" },
    ],
  },
  {
    kind: "R_TRIG",
    label: "R_TRIG",
    category: "edge",
    pins: [
      { id: "CLK", label: "CLK", side: "input" },
      { id: "Q", label: "Q", side: "output" },
    ],
  },
  {
    kind: "F_TRIG",
    label: "F_TRIG",
    category: "edge",
    pins: [
      { id: "CLK", label: "CLK", side: "input" },
      { id: "Q", label: "Q", side: "output" },
    ],
  },
  {
    kind: "ADD",
    label: "ADD",
    category: "math",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
  {
    kind: "SUB",
    label: "SUB",
    category: "math",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
  {
    kind: "MUL",
    label: "MUL",
    category: "math",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
  {
    kind: "DIV",
    label: "DIV",
    category: "math",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
  {
    kind: "GT",
    label: "GT",
    category: "compare",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
  {
    kind: "EQ",
    label: "EQ",
    category: "compare",
    pins: [
      { id: "IN1", label: "IN1", side: "input" },
      { id: "IN2", label: "IN2", side: "input" },
      { id: "OUT", label: "OUT", side: "output" },
    ],
  },
];

const CATEGORY_COLORS: Record<BlockTypeDef["category"], string> = {
  timer: "#f5a623",
  counter: "#4a90d9",
  bistable: "#52c41a",
  edge: "#a855f7",
  math: "#06b6d4",
  compare: "#ef4444",
};

// ── Helpers ──────────────────────────────────────────────

let nextId = 0;
function uid(prefix: string): string {
  return `${prefix}_${++nextId}`;
}

function getBlockType(kind: string): BlockTypeDef | undefined {
  return BLOCK_TYPES.find((bt) => bt.kind === kind);
}

function pinPosition(
  block: BlockInstance,
  pin: PinDef,
): { x: number; y: number } {
  const bt = getBlockType(block.kind);
  if (!bt) return { x: block.x, y: block.y };
  const sidePins = bt.pins.filter((p) => p.side === pin.side);
  const idx = sidePins.findIndex((p) => p.id === pin.id);
  const total = sidePins.length;
  const blockHeight = HEADER_HEIGHT + Math.max(bt.pins.filter((p) => p.side === "input").length, bt.pins.filter((p) => p.side === "output").length) * PIN_ROW_HEIGHT;
  const topOffset = HEADER_HEIGHT + PIN_ROW_HEIGHT / 2;
  const spacing = (blockHeight - HEADER_HEIGHT) / (total + 1);
  const y = block.y + topOffset + idx * spacing;
  const x = pin.side === "input" ? block.x : block.x + BLOCK_WIDTH;
  return { x, y };
}

// ── SVG Wire Path ────────────────────────────────────────

function wirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  const cx1 = x1 + dx;
  const cy1 = y1;
  const cx2 = x2 - dx;
  const cy2 = y2;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

// ── Codegen ──────────────────────────────────────────────

export function generateFbdText(
  instances: BlockInstance[],
  connections: Connection[],
): string {
  const lines: string[] = [];

  // Assign block names
  const kindCounts: Record<string, number> = {};
  const blockNames = new Map<string, string>();
  for (const bi of instances) {
    const cnt = (kindCounts[bi.kind] ?? 0) + 1;
    kindCounts[bi.kind] = cnt;
    blockNames.set(bi.id, `${bi.kind}_${cnt}`);
  }

  // BLOCK declarations
  for (const bi of instances) {
    const name = blockNames.get(bi.id)!;
    lines.push(`BLOCK ${name} ${bi.kind}`);
  }

  if (lines.length > 0) lines.push("");

  // CONNECTIONS
  for (const conn of connections) {
    const sName = blockNames.get(conn.sourceBlockId);
    const tName = blockNames.get(conn.targetBlockId);
    if (sName && tName) {
      lines.push(`${sName}.${conn.sourcePinId} → ${tName}.${conn.targetPinId};`);
    }
  }

  // OUTPUT: unconnected output pins
  for (const bi of instances) {
    const bt = getBlockType(bi.kind);
    if (!bt) continue;
    for (const pin of bt.pins.filter((p) => p.side === "output")) {
      const hasConnection = connections.some(
        (c) => c.sourceBlockId === bi.id && c.sourcePinId === pin.id,
      );
      if (!hasConnection) {
        const name = blockNames.get(bi.id)!;
        lines.push(`OUTPUT ${name}_${pin.id} → ${name}.${pin.id};`);
      }
    }
  }

  return lines.join("\n");
}

// ── Component Props ──────────────────────────────────────

interface FbdEditorProps {
  /** Callback with generated FBD text on change */
  onFbdChange?: (text: string) => void;
}

// ── Main Component ───────────────────────────────────────

export default function FbdEditor({ onFbdChange }: FbdEditorProps) {
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [wiringFrom, setWiringFrom] = useState<{
    blockId: string;
    pinId: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasWidth = 1600;
  const canvasHeight = 1200;

  // ── Canvas mouse tracking ──────────────────────────────

  const handleCanvasMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + canvasRef.current.scrollLeft;
      const y = e.clientY - rect.top + canvasRef.current.scrollTop;

      if (draggingBlockId) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === draggingBlockId
              ? { ...b, x: x - dragOffset.x, y: y - dragOffset.y }
              : b,
          ),
        );
      }

      if (wiringFrom) {
        setMousePos({ x, y });
      }
    },
    [draggingBlockId, dragOffset, wiringFrom],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingBlockId) {
      setDraggingBlockId(null);
      updateCodegen();
    }
  }, [draggingBlockId]);

  // ── Update parent with FBD text ────────────────────────

  const updateCodegen = useCallback(() => {
    // Use setTimeout so state is settled
    setTimeout(() => {
      // ponytail: read from current state via ref would be cleaner, but this works
    }, 0);
  }, []);

  // Notify parent whenever blocks or connections change
  const notifyChange = useCallback(
    (newBlocks: BlockInstance[], newConns: Connection[]) => {
      const text = generateFbdText(newBlocks, newConns);
      onFbdChange?.(text);
    },
    [onFbdChange],
  );

  // ── Palette drag start ─────────────────────────────────

  const handlePaletteDragStart = useCallback(
    (e: ReactDragEvent, kind: string) => {
      e.dataTransfer.setData("application/fbd-block", kind);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  // ── Canvas drop ────────────────────────────────────────

  const handleCanvasDrop = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/fbd-block");
      if (!kind || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + canvasRef.current.scrollLeft - 20;
      const y = e.clientY - rect.top + canvasRef.current.scrollTop - HEADER_HEIGHT / 2;

      const newBlock: BlockInstance = {
        id: uid("blk"),
        kind,
        x: Math.max(0, x),
        y: Math.max(0, y),
        label: kind,
      };

      setBlocks((prev) => {
        const next = [...prev, newBlock];
        notifyChange(next, connections);
        return next;
      });
    },
    [connections, notifyChange],
  );

  const handleCanvasDragOver = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // ── Block drag ─────────────────────────────────────────

  const handleBlockMouseDown = useCallback(
    (e: ReactMouseEvent, blockId: string) => {
      if (wiringFrom) return; // Don't drag while wiring
      e.stopPropagation();
      const block = blocks.find((b) => b.id === blockId);
      if (!block || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left + canvasRef.current.scrollLeft;
      const my = e.clientY - rect.top + canvasRef.current.scrollTop;
      setDraggingBlockId(blockId);
      setDragOffset({ x: mx - block.x, y: my - block.y });
      setSelectedBlockId(blockId);
    },
    [blocks, wiringFrom],
  );

  // ── Block context menu (delete) ────────────────────────

  const handleBlockContextMenu = useCallback(
    (e: ReactMouseEvent, blockId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setBlocks((prev) => {
        const next = prev.filter((b) => b.id !== blockId);
        return next;
      });
      setConnections((prev) => {
        const next = prev.filter(
          (c) => c.sourceBlockId !== blockId && c.targetBlockId !== blockId,
        );
        notifyChange(blocks.filter((b) => b.id !== blockId), next);
        return next;
      });
      setWiringFrom(null);
      setMousePos(null);
      if (selectedBlockId === blockId) setSelectedBlockId(null);
    },
    [blocks, selectedBlockId, notifyChange],
  );

  // ── Pin click (wiring) ─────────────────────────────────

  const handlePinClick = useCallback(
    (e: ReactMouseEvent, blockId: string, pinId: string) => {
      e.stopPropagation();
      const bt = getBlockType(blocks.find((b) => b.id === blockId)?.kind ?? "");
      const pin = bt?.pins.find((p) => p.id === pinId);
      if (!pin) return;

      if (!wiringFrom) {
        // Start wiring — only from output pins
        if (pin.side === "output") {
          setWiringFrom({ blockId, pinId });
        }
      } else {
        // Complete wiring — only to input pins
        if (pin.side === "input" && blockId !== wiringFrom.blockId) {
          const newConn: Connection = {
            id: uid("conn"),
            sourceBlockId: wiringFrom.blockId,
            sourcePinId: wiringFrom.pinId,
            targetBlockId: blockId,
            targetPinId: pinId,
          };
          // Remove duplicate
          setConnections((prev) => {
            const filtered = prev.filter(
              (c) =>
                !(
                  c.targetBlockId === blockId &&
                  c.targetPinId === pinId
                ),
            );
            const next = [...filtered, newConn];
            notifyChange(blocks, next);
            return next;
          });
        }
        setWiringFrom(null);
        setMousePos(null);
      }
    },
    [wiringFrom, blocks, notifyChange],
  );

  // ── Canvas click (cancel wiring) ───────────────────────

  const handleCanvasClick = useCallback(
    (e: ReactMouseEvent) => {
      if (wiringFrom && e.target === canvasRef.current) {
        setWiringFrom(null);
        setMousePos(null);
      }
      setSelectedBlockId(null);
    },
    [wiringFrom],
  );

  // ── Canvas key handler for Delete ──────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedBlockId) {
          setBlocks((prev) => {
            const next = prev.filter((b) => b.id !== selectedBlockId);
            return next;
          });
          setConnections((prev) => {
            const next = prev.filter(
              (c) =>
                c.sourceBlockId !== selectedBlockId &&
                c.targetBlockId !== selectedBlockId,
            );
            notifyChange(blocks.filter((b) => b.id !== selectedBlockId), next);
            return next;
          });
          setWiringFrom(null);
          setMousePos(null);
          setSelectedBlockId(null);
        }
      }
      if (e.key === "Escape") {
        setWiringFrom(null);
        setMousePos(null);
        setSelectedBlockId(null);
      }
    },
    [selectedBlockId, blocks, notifyChange],
  );

  // ── Block rendering helpers ────────────────────────────

  const renderBlock = (block: BlockInstance) => {
    const bt = getBlockType(block.kind);
    if (!bt) return null;

    const inputPins = bt.pins.filter((p) => p.side === "input");
    const outputPins = bt.pins.filter((p) => p.side === "output");
    const maxPins = Math.max(inputPins.length, outputPins.length);
    const blockHeight = HEADER_HEIGHT + maxPins * PIN_ROW_HEIGHT;
    const isSelected = block.id === selectedBlockId;
    const catColor = CATEGORY_COLORS[bt.category];

    return (
      <div
        key={block.id}
        className={`fbd-block ${isSelected ? "fbd-block--selected" : ""}`}
        style={{
          left: block.x,
          top: block.y,
          width: BLOCK_WIDTH,
          height: blockHeight,
          borderColor: isSelected ? "var(--color-amber)" : catColor,
          boxShadow: isSelected ? `0 0 0 2px ${catColor}44` : undefined,
        }}
        onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
        onContextMenu={(e) => handleBlockContextMenu(e, block.id)}
      >
        {/* Header */}
        <div
          className="fbd-block__header"
          style={{ background: catColor }}
        >
          <span className="fbd-block__label">{block.label}</span>
        </div>

        {/* Pin rows */}
        <div className="fbd-block__body">
          {Array.from({ length: maxPins }).map((_, i) => {
            const ip = inputPins[i];
            const op = outputPins[i];
            return (
              <div key={i} className="fbd-block__pin-row">
                {ip ? (
                  <div
                    className={`fbd-pin fbd-pin--input ${
                      wiringFrom ? "fbd-pin--targetable" : ""
                    }`}
                    title={ip.label}
                    onClick={(e) => handlePinClick(e, block.id, ip.id)}
                  >
                    <span className="fbd-pin__dot fbd-pin__dot--input" />
                    <span className="fbd-pin__label">{ip.label}</span>
                  </div>
                ) : (
                  <div className="fbd-pin fbd-pin--empty" />
                )}
                {op ? (
                  <div
                    className={`fbd-pin fbd-pin--output ${
                      !wiringFrom ? "fbd-pin--sourceable" : ""
                    }`}
                    title={op.label}
                    onClick={(e) => handlePinClick(e, block.id, op.id)}
                  >
                    <span className="fbd-pin__label">{op.label}</span>
                    <span className="fbd-pin__dot fbd-pin__dot--output" />
                  </div>
                ) : (
                  <div className="fbd-pin fbd-pin--empty" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Wire rendering ─────────────────────────────────────

  const renderWires = () => {
    const wires: React.ReactNode[] = [];

    for (const conn of connections) {
      const sBlock = blocks.find((b) => b.id === conn.sourceBlockId);
      const tBlock = blocks.find((b) => b.id === conn.targetBlockId);
      const sBt = sBlock ? getBlockType(sBlock.kind) : undefined;
      const tBt = tBlock ? getBlockType(tBlock.kind) : undefined;
      const sPin = sBt?.pins.find((p) => p.id === conn.sourcePinId);
      const tPin = tBt?.pins.find((p) => p.id === conn.targetPinId);
      if (!sBlock || !tBlock || !sPin || !tPin) continue;

      const p1 = pinPosition(sBlock, sPin);
      const p2 = pinPosition(tBlock, tPin);
      const path = wirePath(p1.x, p1.y, p2.x, p2.y);
      const isActive =
        wiringFrom?.blockId === conn.sourceBlockId &&
        wiringFrom?.pinId === conn.sourcePinId;

      wires.push(
        <g key={conn.id}>
          {/* Invisible thick path for easier clicking */}
          <path
            d={path}
            stroke="transparent"
            strokeWidth={12}
            fill="none"
            style={{ cursor: "pointer" }}
            className="fbd-wire-hit"
          />
          <path
            d={path}
            stroke={isActive ? "var(--color-amber)" : "var(--color-text-tertiary)"}
            strokeWidth={isActive ? 2.5 : 2}
            fill="none"
            className="fbd-wire"
          />
        </g>,
      );
    }

    // Preview wire while wiring
    if (wiringFrom && mousePos) {
      const sBlock = blocks.find((b) => b.id === wiringFrom.blockId);
      const sBt = sBlock ? getBlockType(sBlock.kind) : undefined;
      const sPin = sBt?.pins.find((p) => p.id === wiringFrom.pinId);
      if (sBlock && sPin) {
        const p1 = pinPosition(sBlock, sPin);
        const path = wirePath(p1.x, p1.y, mousePos.x, mousePos.y);
        wires.push(
          <path
            key="preview"
            d={path}
            stroke="var(--color-amber)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="none"
            className="fbd-wire-preview"
          />,
        );
      }
    }

    return wires;
  };

  // ── Category groups for palette ────────────────────────

  const groupedBlocks = new Map<string, BlockTypeDef[]>();
  for (const bt of BLOCK_TYPES) {
    const group = groupedBlocks.get(bt.category) ?? [];
    group.push(bt);
    groupedBlocks.set(bt.category, group);
  }

  const categoryLabels: Record<string, string> = {
    timer: "Timers",
    counter: "Counters",
    bistable: "Bistables",
    edge: "Edge Detection",
    math: "Arithmetic",
    compare: "Comparison",
  };

  return (
    <div className="fbd-editor" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Palette */}
      <div className="fbd-palette">
        <div className="fbd-palette__header">FBD Blocks</div>
        <div className="fbd-palette__body">
          {[...groupedBlocks.entries()].map(([category, items]) => (
            <div key={category} className="fbd-palette__group">
              <div className="fbd-palette__group-label">
                {categoryLabels[category] ?? category}
              </div>
              {items.map((bt) => (
                <div
                  key={bt.kind}
                  className="fbd-palette__item"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, bt.kind)}
                  style={{ borderLeftColor: CATEGORY_COLORS[bt.category] }}
                >
                  <span
                    className="fbd-palette__dot"
                    style={{ background: CATEGORY_COLORS[bt.category] }}
                  />
                  <span className="fbd-palette__item-label">{bt.kind}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`fbd-canvas ${wiringFrom ? "fbd-canvas--wiring" : ""}`}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        {/* SVG wire overlay */}
        <svg
          className="fbd-svg-layer"
          width={canvasWidth}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        >
          {renderWires()}
        </svg>

        {/* Blocks */}
        {blocks.map(renderBlock)}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="fbd-canvas__empty">
            Drag function blocks from the palette to start building.
          </div>
        )}
      </div>
    </div>
  );
}
