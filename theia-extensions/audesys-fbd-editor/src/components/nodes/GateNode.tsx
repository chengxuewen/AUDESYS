/**
 * GateNode — React Flow custom node for an IEC 61131-3 FBD logic gate.
 *
 * SVG shapes ported from the former GLSP FbdGateView (fbd-gmodel-views.ts):
 * AND = D-shape, OR = curved shield, XOR = shield + extra curve,
 * NOT = triangle + bubble, MUX = trapezoid.
 *
 * Handles: one target handle per input pin (left), one source handle
 * per output pin (right). Handle id = pin name (port-to-port edges).
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

/** IEC 61131-3 gate shapes (JSX port of the former GLSP renderGateShape). */
function GateShape({ gateType, width, height }: { gateType: string; width: number; height: number }): React.ReactNode {
    const stroke = 'var(--fbd-node-stroke, #2196f3)';
    const fill = 'var(--fbd-gate-fill, rgba(33, 150, 243, 0.15))';
    const hw = width / 2;
    const hh = height / 2;
    switch (gateType) {
        case 'AND':
            return <path d={`M0,0 L${width * 0.6},0 A${width * 0.4},${hh} 0 0,1 ${width * 0.6},${height} L0,${height} Z`} fill={fill} stroke={stroke} strokeWidth={2} />;
        case 'OR':
            return <path d={`M0,0 Q${hw},0 ${width},${hh} Q${hw},${height} 0,${height} Q${width * 0.3},${hh} 0,0 Z`} fill={fill} stroke={stroke} strokeWidth={2} />;
        case 'XOR':
            return (
                <React.Fragment>
                    <path d={`M0,0 Q${hw},0 ${width},${hh} Q${hw},${height} 0,${height} Q${width * 0.3},${hh} 0,0 Z`} fill={fill} stroke={stroke} strokeWidth={2} />
                    <path d={`M-6,0 Q${width * 0.3 - 6},${hh} -6,${height}`} fill="none" stroke={stroke} strokeWidth={2} />
                </React.Fragment>
            );
        case 'NOT':
            return (
                <React.Fragment>
                    <path d={`M0,0 L${width * 0.7},${hh} L0,${height} Z`} fill={fill} stroke={stroke} strokeWidth={2} />
                    <circle cx={width * 0.7 + 8} cy={hh} r={8} fill="none" stroke={stroke} strokeWidth={2} />
                </React.Fragment>
            );
        case 'MUX':
            return <path d={`M${width * 0.2},0 L${width * 0.8},0 L${width},${height} L0,${height} Z`} fill={fill} stroke={stroke} strokeWidth={2} />;
        default:
            return <rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={2} rx={4} />;
    }
}

export const GateNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as FbdNodeData;
    const gateType = String(nodeData.gateType ?? 'AND');
    const width = Number(nodeData.width ?? 60);
    const height = Number(nodeData.height ?? 60);
    const inputPins = nodeData.inputPins ?? [];
    const outputPins = nodeData.outputPins ?? [];

    return (
        <div style={{ width, height }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {selected && (
                    <rect x={-4} y={-4} width={width + 8} height={height + 8}
                        fill="none" stroke="var(--fbd-selection-color, #4caf50)" strokeWidth={2} strokeDasharray="4 2" />
                )}
                <GateShape gateType={gateType} width={width} height={height} />
                <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={9}
                    fill="var(--fbd-node-label, #888)">
                    {gateType}
                </text>
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
