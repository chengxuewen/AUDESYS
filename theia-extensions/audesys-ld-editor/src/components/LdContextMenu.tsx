/**
 * LdContextMenu — right-click context menu for the IEC 61131-3 LD editor.
 *
 * Four context kinds (paragraph A2), mirroring CODESYS LD2:
 *   - contact: Edit submenu (Rename / Negate / Edge Detection) + Delete +
 *              Copy + Cross Reference
 *   - coil:    Edit submenu (Rename / Negate / Set / Reset) + Delete +
 *              Copy + Cross Reference
 *   - rung:    Open Branch / Close Branch / Insert Network / Delete /
 *              Outcommented
 *   - blank:   Undo / Redo / Paste / Insert Network
 *   - wire:    Add Parallel Branch / Delete / Cross Reference
 *
 * The menu is a pure view: it never mutates the graph itself. Every item
 * delegates to an action callback owned by LdCanvas (which routes through
 * LdOperationHandler → tryApply), then closes itself.
 */

import React from '@theia/core/shared/react';

/** What was right-clicked and where (viewport coords for fixed positioning). */
export interface CtxMenuState {
    x: number;
    y: number;
    kind: 'node' | 'edge' | 'rung' | 'pane';
    /** RF node type: 'contact' | 'coil' (only when kind === 'node'). */
    nodeType?: string;
    nodeId?: string;
    edgeId?: string;
    rungId?: string;
    variableName?: string;
    contactType?: string;
    coilType?: string;
}

export interface LdContextMenuActions {
    rename: (id: string, currentName: string) => void;
    changeContactType: (id: string, type: string) => void;
    changeCoilType: (id: string, type: string) => void;
    delete: (id: string) => void;
    /** Copy the given node id into the clipboard (right-click Copy). */
    copy: (nodeId: string) => void;
    crossRef: (variableName: string) => void;
    /** Open a parallel branch at the rung's last series contact. */
    openBranch: (rungId: string) => void;
    closeBranch: (rungId: string) => void;
    insertNetwork: () => void;
    undo: () => void;
    redo: () => void;
    paste: () => void;
    outcomment: (rungId: string) => void;
    /** Open a parallel branch at the source contact of a wire edge. */
    addParallelBranch: (edgeId: string) => void;
}

export interface LdContextMenuProps {
    menu: CtxMenuState;
    actions: LdContextMenuActions;
    onClose: () => void;
}

interface MenuItem {
    label?: string;
    action?: () => void;
    /** Nested submenu (hover to expand). */
    items?: MenuItem[];
    separator?: boolean;
    disabled?: boolean;
}

const MENU_EST_WIDTH = 200;
const MENU_EST_HEIGHT = 260;

function buildItems(menu: CtxMenuState, a: LdContextMenuActions): MenuItem[] {
    switch (menu.kind) {
        case 'node': {
            if (menu.nodeType === 'contact') {
                return [
                    {
                        label: 'Edit',
                        items: [
                            { label: 'Rename', action: () => a.rename(menu.nodeId!, menu.variableName ?? '') },
                            {
                                label: 'Negate',
                                action: () => a.changeContactType(menu.nodeId!, menu.contactType === 'NC' ? 'NO' : 'NC'),
                            },
                            {
                                label: 'Edge Detection',
                                items: [
                                    { label: 'Rising Edge (P)', action: () => a.changeContactType(menu.nodeId!, 'P') },
                                    { label: 'Falling Edge (N)', action: () => a.changeContactType(menu.nodeId!, 'N') },
                                ],
                            },
                        ],
                    },
                    { separator: true },
                    { label: 'Delete', action: () => a.delete(menu.nodeId!) },
                    { label: 'Copy', action: () => a.copy(menu.nodeId!) },
                    { separator: true },
                    { label: 'Cross Reference', action: () => a.crossRef(menu.variableName ?? '') },
                ];
            }
            // coil
            return [
                {
                    label: 'Edit',
                    items: [
                        { label: 'Rename', action: () => a.rename(menu.nodeId!, menu.variableName ?? '') },
                        {
                            label: 'Negate',
                            action: () => a.changeCoilType(menu.nodeId!, menu.coilType === 'Negated' ? 'Normal' : 'Negated'),
                        },
                        { label: 'Set', action: () => a.changeCoilType(menu.nodeId!, 'Set') },
                        { label: 'Reset', action: () => a.changeCoilType(menu.nodeId!, 'Reset') },
                    ],
                },
                { separator: true },
                { label: 'Delete', action: () => a.delete(menu.nodeId!) },
                { label: 'Copy', action: () => a.copy(menu.nodeId!) },
                { separator: true },
                { label: 'Cross Reference', action: () => a.crossRef(menu.variableName ?? '') },
            ];
        }
        case 'rung':
            return [
                { label: 'Open Branch', action: () => a.openBranch(menu.rungId!) },
                { label: 'Close Branch', action: () => a.closeBranch(menu.rungId!) },
                { separator: true },
                { label: 'Insert Network', action: a.insertNetwork },
                { label: 'Delete', action: () => a.delete(menu.rungId!) },
                { separator: true },
                { label: 'Outcommented', action: () => a.outcomment(menu.rungId!) },
            ];
        case 'edge':
            return [
                { label: 'Add Parallel Branch', action: () => a.addParallelBranch(menu.edgeId!) },
                { separator: true },
                { label: 'Delete', action: () => a.delete(menu.edgeId!) },
                { separator: true },
                { label: 'Cross Reference', action: () => a.crossRef(menu.variableName ?? '') },
            ];
        case 'pane':
        default:
            return [
                { label: 'Undo', action: a.undo },
                { label: 'Redo', action: a.redo },
                { separator: true },
                { label: 'Paste', action: a.paste },
                { separator: true },
                { label: 'Insert Network', action: a.insertNetwork },
            ];
    }
}

/**
 * Recursive menu panel. Each panel tracks which of its own children has an
 * open submenu, so nested submenus (Edit → Edge Detection) stay independent.
 */
const MenuPanel: React.FC<{ items: MenuItem[]; depth: number; onAction: () => void }> = ({
    items,
    depth,
    onAction,
}) => {
    const [openIdx, setOpenIdx] = React.useState<number | null>(null);
    return (
        <div
            className="ld-ctx-menu__panel"
            style={depth > 0 ? { position: 'absolute', left: '100%', top: -6 } : undefined}
        >
            {items.map((it, i) => {
                if (it.separator) {
                    return <div key={i} className="ld-ctx-menu__sep" />;
                }
                const isOpen = openIdx === i;
                return (
                    <div
                        key={i}
                        className={
                            'ld-ctx-menu__item'
                            + (isOpen ? ' is-open' : '')
                            + (it.disabled ? ' is-disabled' : '')
                        }
                        onMouseEnter={() => setOpenIdx(it.items ? i : null)}
                        onClick={() => {
                            if (it.action && !it.disabled) {
                                it.action();
                                onAction();
                            }
                        }}
                    >
                        <span className="ld-ctx-menu__label">{it.label}</span>
                        {it.items && <span className="ld-ctx-menu__caret">▸</span>}
                        {isOpen && it.items && (
                            <MenuPanel items={it.items} depth={depth + 1} onAction={onAction} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export const LdContextMenu: React.FC<LdContextMenuProps> = ({ menu, actions, onClose }) => {
    const items = React.useMemo(() => buildItems(menu, actions), [menu, actions]);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('mousedown', onClose);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClose);
        };
    }, [onClose]);

    // Clamp so the menu never opens off-screen.
    const x = Math.min(Math.max(0, menu.x), window.innerWidth - MENU_EST_WIDTH);
    const y = Math.min(Math.max(0, menu.y), window.innerHeight - MENU_EST_HEIGHT);

    return (
        <div
            className="ld-ctx-menu"
            style={{ left: x, top: y }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <MenuPanel items={items} depth={0} onAction={onClose} />
        </div>
    );
};