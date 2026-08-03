/**
 * FbNode — React Flow custom node for an IEC 61131-3 function block instance.
 *
 * Renders a rounded rectangle with the FB type name (e.g. TON, CTU) and
 * pin label annotations. Handles: one target handle per input pin (left),
 * one source handle per output pin (right). Handle id = pin name.
 */

import React from '@theia/core/shared/react';
import { Handle, Position, NodeProps } from '@xyflow/react';

import { FbdNodeData } from '../FbdCanvas';

/** Per-pin handle offsets: evenly spaced within the node body. */
function pinTop(index: number, total: number, height: number): number {
    return total <= 1 ? height / 2 : ((index + 1) / (total + 1)) * height;
}

const HANDLE_STYLE: React.CSSProperties = {
    width: 10,
    height: 10,
    minWidth: 0,
    minHeight: 0,
    background: '#555',
    border: '1px solid #999',
    borderRadius: '50%',
};

export const FbNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as FbdNodeData;
    const fbType = String(nodeData.fbType ?? 'FB');
    const width = Number(nodeData.width ?? 120);
    const height = Number(nodeData.height ?? 60);
    const inputPins = nodeData.inputPins ?? [];
    const outputPins = nodeData.outputPins ?? [];

    return (
        <div style={{ width, height, position: 'relative' }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {selected && (
                    <rect x={-4} y={-4} width={width + 8} height={height + 8}
                        fill="none" stroke="var(--fbd-selection-color, #4caf50)" strokeWidth={2} strokeDasharray="4 2" />
                )}
                <rect rx={4} width={width} height={height} fill="var(--fbd-fb-fill, rgba(76, 175, 80, 0.12))"
                    stroke={selected ? 'var(--fbd-selection-color, #4caf50)' : 'var(--fbd-node-stroke, #2196f3)'}
                    strokeWidth={selected ? 2 : 1.5} />
                <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central"
                    fontSize={12} fontWeight={600}
                    fill="var(--fbd-fb-label, #eee)">
                    {fbType}
                </text>
                {inputPins.map((pin, i) => (
                    <text key={`in-label-${pin.name}`} x={8} y={pinTop(i, inputPins.length, height) + 3} fontSize={8}
                        fill="var(--fbd-pin-label, #888)">
                        {pin.name}
                    </text>
                ))}
                {outputPins.map((pin, i) => (
                    <text key={`out-label-${pin.name}`} x={width - 8}
                        y={pinTop(i, outputPins.length, height) + 3} textAnchor="end" fontSize={8}
                        fill="var(--fbd-pin-label, #888)">
                        {pin.name}
                    </text>
                ))}
            </svg>
            {inputPins.map((pin, i) => (
                <Handle key={`in-${pin.name}`} type="target" position={Position.Left} id={pin.name}
                    style={{ ...HANDLE_STYLE, top: pinTop(i, inputPins.length, height) }} />
            ))}
            {outputPins.map((pin, i) => (
                <Handle key={`out-${pin.name}`} type="source" position={Position.Right} id={pin.name}
                    style={{ ...HANDLE_STYLE, top: pinTop(i, outputPins.length, height) }} />
            ))}
        </div>
    );
};
