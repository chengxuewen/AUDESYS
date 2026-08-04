/**
 * CoilNode — React Flow custom node for an IEC 61131-3 LD coil.
 *
 * SVG ported from the former GLSP LdCoilView (ld-gmodel-views.ts):
 * 36×36 circle (rx = 18). Negated draws a diagonal slash, Set an "S",
 * Reset an "R". Normal is a plain circle.
 *
 * Handles: target on the left, source on the right, anchored at the
 * symbol's vertical centre (y = 18).
 *
 * Double-clicking the variable label opens an inline rename input
 * (committed via `d.onRename`). Hovering shows the element comment
 * (if any) in the tooltip. When selected, a NodeToolbar switcher
 * replaces the coil type Normal ↔ Negated ↔ Set ↔ Reset via
 * `d.onChangeType`, preserving the variable name.
 */
import React from '@theia/core/shared/react';
import { Handle, Position, NodeProps, NodeToolbar } from '@xyflow/react';
import { CONTACT_SIZE } from '../../model/grid';
import { CoilType } from '../../model/nodes';

const HALF = CONTACT_SIZE / 2;

/** Invisible but functional edge anchor. */
const HANDLE_STYLE: React.CSSProperties = {
    width: 8,
    height: 8,
    minWidth: 0,
    minHeight: 0,
    background: 'transparent',
    border: 'none',
    top: HALF,
};

const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.length > 0 ? v : fallback;

interface LdCoilData extends Record<string, unknown> {
    variableName?: string;
    coilType?: string;
    comment?: string;
    onRename?: (id: string, name: string) => void;
    onChangeType?: (id: string, type: string) => void;
}

/** Replacement options (P1): Normal ↔ Negated ↔ Set ↔ Reset, variable name preserved. */
const COIL_OPTIONS: { value: CoilType; label: string }[] = [
    { value: CoilType.Normal, label: '()' },
    { value: CoilType.Negated, label: '(/)' },
    { value: CoilType.Set, label: '(S)' },
    { value: CoilType.Reset, label: '(R)' },
];

export const CoilNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const d = data as unknown as LdCoilData;
    const coilType = str(d.coilType, 'Normal');
    const variableName = str(d.variableName, '??');
    const comment = str(d.comment, '');
    const color =
        coilType === 'Set' ? 'var(--ld-coil-set-fill, #ff9800)' :
        coilType === 'Reset' ? 'var(--ld-coil-reset-fill, #f44336)' :
        'var(--ld-coil-normal-fill, #4caf50)';

    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(variableName);

    const startEdit = (): void => {
        setDraft(variableName);
        setEditing(true);
    };
    const commit = (): void => {
        setEditing(false);
        const name = draft.trim();
        if (name.length > 0 && name !== variableName) {
            d.onRename?.(id, name);
        }
    };
    const cancel = (): void => setEditing(false);

    const labelTitle = comment
        ? `${comment} — double-click to rename`
        : 'Double-click to rename';

    return (
        <div className="ld-coil">
            {selected && (
                <NodeToolbar position={Position.Top} offset={6}>
                    <div className="ld-type-switch">
                        {COIL_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                className={coilType === opt.value ? 'ld-type-switch__active' : ''}
                                onClick={() => d.onChangeType?.(id, opt.value)}
                                title={`Switch to ${opt.label} coil`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </NodeToolbar>
            )}
            <svg width={CONTACT_SIZE} height={CONTACT_SIZE}>
                {selected && (
                    <rect
                        x={-4} y={-4}
                        width={CONTACT_SIZE + 8} height={CONTACT_SIZE + 8}
                        fill="none" stroke="var(--ld-selection-color, #2196f3)"
                        strokeWidth={2} strokeDasharray="4 2"
                    />
                )}
                <rect
                    x={0} y={0}
                    width={CONTACT_SIZE} height={CONTACT_SIZE}
                    fill="transparent" stroke={color} strokeWidth={2} rx={HALF}
                />
                {coilType === 'Negated' && (
                    <line
                        x1={6} y1={CONTACT_SIZE - 6} x2={CONTACT_SIZE - 6} y2={6}
                        stroke={color} strokeWidth={1.5}
                    />
                )}
                {(coilType === 'Set' || coilType === 'Reset') && (
                    <text
                        x={HALF} y={HALF + 5}
                        textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}
                    >
                        {coilType === 'Set' ? 'S' : 'R'}
                    </text>
                )}
            </svg>
            {editing ? (
                <input
                    className="ld-node-rename"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') cancel();
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                />
            ) : (
                <div className="ld-node-label" onDoubleClick={startEdit} title={labelTitle}>
                    {variableName}
                </div>
            )}
            <Handle type="target" position={Position.Left} id="in" style={HANDLE_STYLE} />
            <Handle type="source" position={Position.Right} id="out" style={HANDLE_STYLE} />
        </div>
    );
};
