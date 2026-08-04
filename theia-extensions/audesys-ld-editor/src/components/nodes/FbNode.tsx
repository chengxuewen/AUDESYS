/**
 * FbNode — React Flow custom node for an IEC 61131-3 function block.
 *
 * Renders the FB box with its type label and per-pin connection handles:
 * input pins on the left (`in:<name>`), output pins on the right
 * (`out:<name>`). Pin y positions come from the model (fb-catalog),
 * so handles land exactly on the pin rows.
 */

import React from '@theia/core/shared/react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Pin } from '../../model/nodes';
import { FB_WIDTH } from '../../model/fb-catalog';

const HANDLE_STYLE: React.CSSProperties = {
    width: 8,
    height: 8,
    minWidth: 0,
    minHeight: 0,
    background: 'transparent',
    border: 'none',
};

const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.length > 0 ? v : fallback;

interface LdFbData extends Record<string, unknown> {
    fbType?: string;
    inputPins?: Pin[];
    outputPins?: Pin[];
}

const pinY = (pin: Pin | undefined, fallback: number): number =>
    pin && typeof pin.position.y === 'number' ? pin.position.y : fallback;

export const FbNode: React.FC<NodeProps> = ({ data, selected }) => {
    const d = data as unknown as LdFbData;
    const fbType = str(d.fbType, 'FB');
    const inputPins = Array.isArray(d.inputPins) ? d.inputPins : [];
    const outputPins = Array.isArray(d.outputPins) ? d.outputPins : [];

    const width = FB_WIDTH;
    const height = Math.max(
        60,
        ...inputPins.map((p) => p.position.y),
        ...outputPins.map((p) => p.position.y),
    ) + 12;

    return (
        <div className="ld-fb" style={{ width, height }}>
            {selected && (
                <div
                    style={{
                        position: 'absolute',
                        inset: -4,
                        border: '1px dashed var(--ld-selection-color, #2196f3)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                    }}
                />
            )}
            <svg width={width} height={height} className="ld-fb__body">
                <rect
                    x={0} y={0}
                    width={width} height={height}
                    fill="var(--ld-fb-fill, #263238)"
                    stroke="var(--ld-fb-stroke, #4caf50)"
                    strokeWidth={2} rx={4}
                />
                <text
                    x={width / 2} y={height / 2 + 5}
                    textAnchor="middle" fontSize={13} fontWeight="bold"
                    fill="var(--ld-fb-text, #e0e0e0)"
                >
                    {fbType}
                </text>
            </svg>
            {inputPins.map((pin) => (
                <Handle
                    key={pin.name}
                    type="target"
                    position={Position.Left}
                    id={`in:${pin.name}`}
                    style={{ ...HANDLE_STYLE, top: pinY(pin, 0) }}
                />
            ))}
            {outputPins.map((pin) => (
                <Handle
                    key={pin.name}
                    type="source"
                    position={Position.Right}
                    id={`out:${pin.name}`}
                    style={{ ...HANDLE_STYLE, top: pinY(pin, 0) }}
                />
            ))}
            {inputPins.slice(1).map((pin) => (
                <div
                    key={pin.name}
                    className="ld-fb__pin-label ld-fb__pin-label--in"
                    style={{ top: pinY(pin, 0) - 6 }}
                >
                    {pin.name}
                </div>
            ))}
            {outputPins.slice(1).map((pin) => (
                <div
                    key={pin.name}
                    className="ld-fb__pin-label ld-fb__pin-label--out"
                    style={{ top: pinY(pin, 0) - 6 }}
                >
                    {pin.name}
                </div>
            ))}
        </div>
    );
};
