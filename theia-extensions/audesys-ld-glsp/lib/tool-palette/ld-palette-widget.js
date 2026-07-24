"use strict";
/**
 * LD Palette Widget — React-based tool palette for the Ladder Diagram editor.
 *
 * Renders a vertical palette of selectable LD elements organized into
 * two sections: "Contacts & Coils" and "Structure".
 *
 * Each tool item displays an ASCII icon and label. Clicking an item
 * selects the tool in the shared LdToolState.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdPaletteWidget = void 0;
const react_1 = __importDefault(require("@theia/core/shared/react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
/** All palette tool items, ordered for display. */
const TOOL_ITEMS = [
    // Section: Contacts & Coils
    { type: 'no-contact', icon: '─┤ ├─', label: 'NO Contact', section: 'contacts-coils' },
    { type: 'nc-contact', icon: '─┤/├─', label: 'NC Contact', section: 'contacts-coils' },
    { type: 'coil', icon: '─( )─', label: 'Coil', section: 'contacts-coils' },
    { type: 'negated-coil', icon: '─(/ )─', label: 'Negated Coil', section: 'contacts-coils' },
    { type: 'set-coil', icon: '─(S)─', label: 'Set Coil', section: 'contacts-coils' },
    { type: 'reset-coil', icon: '─(R)─', label: 'Reset Coil', section: 'contacts-coils' },
    { type: 'fb-placeholder', icon: '[FB]', label: 'FB Placeholder', section: 'contacts-coils' },
    // Section: Structure
    { type: 'horizontal-wire', icon: '───', label: 'Horizontal Wire', section: 'structure' },
    { type: 'vertical-wire', icon: '│', label: 'Vertical Wire', section: 'structure' },
    { type: 'power-rail-left', icon: '╟─', label: 'Power Rail Left', section: 'structure' },
    { type: 'power-rail-right', icon: '─╢', label: 'Power Rail Right', section: 'structure' },
    { type: 'rung', icon: '☰', label: 'Rung', section: 'structure' },
];
const ToolButton = ({ item, isSelected, onSelect }) => {
    const handleClick = () => {
        onSelect(item.type);
    };
    return (react_1.default.createElement("button", { className: `ld-palette-button ${isSelected ? 'ld-palette-button--selected' : ''}`, onClick: handleClick, title: item.label, "aria-label": item.label, "aria-pressed": isSelected },
        react_1.default.createElement("span", { className: "ld-palette-button__icon" }, item.icon),
        react_1.default.createElement("span", { className: "ld-palette-button__label" }, item.label)));
};
/** Main palette React component. */
const Palette = ({ toolState }) => {
    const [selected, setSelected] = react_1.default.useState(null);
    react_1.default.useEffect(() => {
        console.debug('[LdPalette] subscribing to toolState.onDidChangeTool');
        const sub = toolState.onDidChangeTool((tool) => {
            console.debug('[LdPalette] onDidChangeTool fired:', tool);
            setSelected(tool);
        });
        return () => { console.debug('[LdPalette] unsubscribing from toolState'); sub.dispose(); };
    }, [toolState]);
    const sub = toolState.onDidChangeTool((tool) => {
        setSelected(tool);
    });
    return () => sub.dispose();
}, [toolState];
const handleSelect = (type) => {
    console.debug('[LdPalette] handleSelect:', type, 'currently selected:', selected);
    if (selected === type) {
        if (selected === type) {
            toolState.deselectTool();
        }
        else {
            toolState.selectTool(type);
        }
    }
    ;
    const contactsItems = TOOL_ITEMS.filter((i) => i.section === 'contacts-coils');
    const structureItems = TOOL_ITEMS.filter((i) => i.section === 'structure');
    return (react_1.default.createElement("div", { className: "ld-palette" },
        react_1.default.createElement(SectionHeader, { title: "Contacts & Coils" }),
        contactsItems.map((item) => (react_1.default.createElement(ToolButton, { key: item.type, item: item, isSelected: selected === item.type, onSelect: handleSelect }))),
        react_1.default.createElement(SectionHeader, { title: "Structure" }),
        structureItems.map((item) => (react_1.default.createElement(ToolButton, { key: item.type, item: item, isSelected: selected === item.type, onSelect: handleSelect })))));
};
// ============================================================================
// CSS-in-JS Styles
// ============================================================================
const PALETTE_STYLE = `
.ld-palette {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    overflow-y: auto;
    font-family: var(--theia-ui-font-family);
    user-select: none;
}

.ld-palette-section-header {
    padding: 6px 8px 2px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theia-descriptionForeground);
    border-top: 1px solid var(--theia-sideBarSectionHeader-border);
    margin-top: 4px;
}

.ld-palette-section-header:first-child {
    border-top: none;
    margin-top: 0;
}

.ld-palette-button {
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

.ld-palette-button:hover {
    background: var(--theia-list-hoverBackground);
}

.ld-palette-button:focus-visible {
    outline: 1px solid var(--theia-focusBorder);
    outline-offset: -1px;
}

.ld-palette-button--selected {
    background: var(--theia-list-activeSelectionBackground);
    color: var(--theia-list-activeSelectionForeground);
    border-color: var(--theia-focusBorder);
}

.ld-palette-button--selected:hover {
    background: var(--theia-list-activeSelectionBackground);
}

.ld-palette-button__icon {
    flex-shrink: 0;
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    min-width: 48px;
    text-align: center;
    color: inherit;
}

.ld-palette-button__label {
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
 * Theia ReactWidget that renders the LD tool palette.
 *
 * This widget is intended to be placed in the left panel of the application
 * shell when the LD editor is active.
 */
class LdPaletteWidget extends react_widget_1.ReactWidget {
    constructor(toolState) {
        super();
        this.toolState = toolState;
        this.id = LdPaletteWidget.ID;
        this.title.label = LdPaletteWidget.LABEL;
        this.title.iconClass = 'codicon codicon-symbol-boolean';
        this.title.caption = 'Ladder Diagram tool palette';
        this.title.closable = true;
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.injectStyles();
        this.update(); // trigger React render when manually created via new
    }
    render() {
        return react_1.default.createElement(Palette, { toolState: this.toolState });
    }
    /** Inject palette CSS into the document head (once). */
    injectStyles() {
        const styleId = 'ld-palette-styles';
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = PALETTE_STYLE;
        document.head.appendChild(style);
    }
}
exports.LdPaletteWidget = LdPaletteWidget;
LdPaletteWidget.ID = 'audesys-ld-palette';
LdPaletteWidget.LABEL = 'LD Tool Palette';
const SectionHeader = ({ title }) => (react_1.default.createElement("div", { className: "ld-palette-section-header", dangerouslySetInnerHTML: { __html: title } }));
//# sourceMappingURL=ld-palette-widget.js.map