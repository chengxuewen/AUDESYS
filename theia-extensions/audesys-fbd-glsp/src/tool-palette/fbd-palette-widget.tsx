/**
 * FBD Palette Widget — React-based tool palette for the Function Block Diagram editor.
 *
 * Renders a vertical palette of selectable FBD elements organized into
 * two sections: "Logic Gates" and "Comparison & Other".
 *
 * Each tool item displays an icon and label. Clicking an item
 * selects the tool in the shared FbdToolState.
 */

import React from '@theia/core/shared/react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { FbdToolState, FbdToolType } from './fbd-tool-state';

// ============================================================================
// Tool Item Data
// ============================================================================

interface ToolItem {
    type: FbdToolType;
    icon: string;
    label: string;
    section: 'logic-gates' | 'comparison-other';
}

/** All palette tool items, ordered for display. */
const TOOL_ITEMS: ToolItem[] = [
    // Section: Logic Gates
    { type: 'and-gate',     icon: '&',      label: 'AND Gate',      section: 'logic-gates' },
    { type: 'or-gate',      icon: '≥1',     label: 'OR Gate',       section: 'logic-gates' },
    { type: 'xor-gate',     icon: '=1',     label: 'XOR Gate',      section: 'logic-gates' },
    { type: 'not-gate',     icon: '1',      label: 'NOT Gate',      section: 'logic-gates' },
    { type: 'mux-gate',     icon: 'MUX',    label: 'MUX',           section: 'logic-gates' },

    // Section: Comparison & Other
    { type: 'eq-cmp',       icon: '=',      label: 'EQ Compare',    section: 'comparison-other' },
    { type: 'gt-cmp',       icon: '>',      label: 'GT Compare',    section: 'comparison-other' },
    { type: 'lt-cmp',       icon: '<',      label: 'LT Compare',    section: 'comparison-other' },
    { type: 'fb-instance',  icon: '[FB]',   label: 'FB Instance',   section: 'comparison-other' },
    { type: 'wire',         icon: '─',      label: 'Wire',          section: 'comparison-other' },
];

// ============================================================================
// React Component
// ============================================================================

interface PaletteProps {
    toolState: FbdToolState;
}

interface ToolButtonProps {
    item: ToolItem;
    isSelected: boolean;
    onSelect: (type: FbdToolType) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ item, isSelected, onSelect }: ToolButtonProps) => {
    const handleClick = (): void => {
        onSelect(item.type);
    };

    return (
        <button
            className={`fbd-palette-button ${isSelected ? 'fbd-palette-button--selected' : ''}`}
            onClick={handleClick}
            title={item.label}
            aria-label={item.label}
            aria-pressed={isSelected}
        >
            <span className="fbd-palette-button__icon">{item.icon}</span>
            <span className="fbd-palette-button__label">{item.label}</span>
        </button>
    );
};

/** Main palette React component. */
const Palette: React.FC<PaletteProps> = ({ toolState }: PaletteProps) => {
    const [selected, setSelected] = React.useState<FbdToolType | null>(null);

    React.useEffect(() => {
        const sub = toolState.onDidChangeTool((tool: FbdToolType | null) => {
            setSelected(tool);
        });
        return () => sub.dispose();
    }, [toolState]);

    const handleSelect = (type: FbdToolType): void => {
        if (selected === type) {
            toolState.deselectTool();
        } else {
            toolState.selectTool(type);
        }
    };

    const gatesItems = TOOL_ITEMS.filter((i) => i.section === 'logic-gates');
    const otherItems = TOOL_ITEMS.filter((i) => i.section === 'comparison-other');

    return (
        <div className="fbd-palette">
            <SectionHeader title="Logic Gates" />
            {gatesItems.map((item) => (
                <ToolButton
                    key={item.type}
                    item={item}
                    isSelected={selected === item.type}
                    onSelect={handleSelect}
                />
            ))}

            <SectionHeader title="Comparison &amp; Other" />
            {otherItems.map((item) => (
                <ToolButton
                    key={item.type}
                    item={item}
                    isSelected={selected === item.type}
                    onSelect={handleSelect}
                />
            ))}
        </div>
    );
};

// ============================================================================
// CSS-in-JS Styles
// ============================================================================

const PALETTE_STYLE = `
.fbd-palette {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    overflow-y: auto;
    font-family: var(--theia-ui-font-family);
    user-select: none;
}

.fbd-palette-section-header {
    padding: 6px 8px 2px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theia-descriptionForeground);
    border-top: 1px solid var(--theia-sideBarSectionHeader-border);
    margin-top: 4px;
}

.fbd-palette-section-header:first-child {
    border-top: none;
    margin-top: 0;
}

.fbd-palette-button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: var(--theia-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}

.fbd-palette-button:hover {
    background: var(--theia-list-hoverBackground);
}

.fbd-palette-button:focus-visible {
    outline: 1px solid var(--theia-focusBorder);
    outline-offset: -1px;
}

.fbd-palette-button--selected {
    background: var(--theia-list-activeSelectionBackground);
    color: var(--theia-list-activeSelectionForeground);
    border-color: var(--theia-focusBorder);
}

.fbd-palette-button--selected:hover {
    background: var(--theia-list-activeSelectionBackground);
}

.fbd-palette-button__icon {
    flex-shrink: 0;
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    min-width: 48px;
    text-align: center;
    color: inherit;
}

.fbd-palette-button__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
}
`;

// ============================================================================
// Widget
// ============================================================================

/**
 * Theia ReactWidget that renders the FBD tool palette.
 *
 * This widget is intended to be placed in the left panel of the application
 * shell when the FBD editor is active.
 */
export class FbdPaletteWidget extends ReactWidget {
    static readonly ID = 'audesys-fbd-palette';
    static readonly LABEL = 'FBD Tool Palette';

    private toolState: FbdToolState;

    constructor(toolState: FbdToolState) {
        super();
        this.toolState = toolState;
        this.id = FbdPaletteWidget.ID;
        this.title.label = FbdPaletteWidget.LABEL;
        this.title.iconClass = 'codicon codicon-symbol-interface';
        this.title.caption = 'Function Block Diagram tool palette';
        this.title.closable = true;
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.injectStyles();
    }

    protected render(): React.ReactNode {
        return React.createElement(Palette, { toolState: this.toolState });
    }

    /** Inject palette CSS into the document head (once). */
    private injectStyles(): void {
        const styleId = 'fbd-palette-styles';
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = PALETTE_STYLE;
        document.head.appendChild(style);
    }
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
    title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }: SectionHeaderProps) => (
    <div className="fbd-palette-section-header" dangerouslySetInnerHTML={{ __html: title }} />
);
