"use strict";
/**
 * LD Property Widget — React-based bottom panel widget that displays
 * and edits properties of the currently selected LD element.
 *
 * Renders a form that changes based on element type:
 * - ContactNode: variableName + ContactType dropdown
 * - CoilNode: variableName + CoilType dropdown
 * - FB Placeholder: fbType text field
 * - Rung: rungNumber (read-only) + comment
 * - Wire: sourceId → targetId (read-only)
 * - Power Rail: side + position (read-only)
 *
 * Common to all types: position {x, y} display (read-only).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdPropertyWidget = void 0;
const react_1 = __importDefault(require("@theia/core/shared/react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
// ============================================================================
// Inline Styles (CSS-in-JS)
// ============================================================================
const PROPERTY_STYLE = `
.ld-property {
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow-y: auto;
  font-family: var(--theia-ui-font-family);
  font-size: 12px;
  color: var(--theia-foreground);
  user-select: none;
}

.ld-property__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--theia-descriptionForeground);
  font-style: italic;
  padding: 16px;
  text-align: center;
}

.ld-property__header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--theia-descriptionForeground);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--theia-sideBarSectionHeader-border);
}

.ld-property__field {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.ld-property__label {
  font-size: 11px;
  color: var(--theia-descriptionForeground);
  margin-bottom: 2px;
}

.ld-property__input {
  padding: 3px 6px;
  border: 1px solid var(--theia-input-border);
  border-radius: 2px;
  background: var(--theia-input-background);
  color: var(--theia-input-foreground);
  font-size: 12px;
  font-family: var(--theia-ui-font-family);
  outline: none;
}

.ld-property__input:focus {
  border-color: var(--theia-focusBorder);
}

.ld-property__select {
  padding: 3px 6px;
  border: 1px solid var(--theia-input-border);
  border-radius: 2px;
  background: var(--theia-input-background);
  color: var(--theia-input-foreground);
  font-size: 12px;
  font-family: var(--theia-ui-font-family);
  outline: none;
  cursor: pointer;
}

.ld-property__select:focus {
  border-color: var(--theia-focusBorder);
}

.ld-property__readonly {
  padding: 4px 6px;
  color: var(--theia-descriptionForeground);
  font-size: 12px;
  font-family: monospace;
  word-break: break-all;
}

.ld-property__position {
  display: flex;
  gap: 8px;
}

.ld-property__position-field {
  flex: 1;
}

.ld-property__position-field .ld-property__label {
  font-size: 10px;
  text-transform: uppercase;
}

.ld-property__section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--theia-descriptionForeground);
  margin-top: 8px;
  margin-bottom: 2px;
}
`;
const TextField = ({ label, value, onChange }) => (react_1.default.createElement("div", { className: "ld-property__field" },
    react_1.default.createElement("label", { className: "ld-property__label" }, label),
    react_1.default.createElement("input", { className: "ld-property__input", type: "text", value: value, onChange: (e) => onChange(e.target.value) })));
const SelectField = ({ label, value, options, onChange }) => (react_1.default.createElement("div", { className: "ld-property__field" },
    react_1.default.createElement("label", { className: "ld-property__label" }, label),
    react_1.default.createElement("select", { className: "ld-property__select", value: value, onChange: (e) => onChange(e.target.value) }, options.map((opt) => (react_1.default.createElement("option", { key: opt.value, value: opt.value }, opt.label))))));
const ReadonlyField = ({ label, value }) => (react_1.default.createElement("div", { className: "ld-property__field" },
    react_1.default.createElement("label", { className: "ld-property__label" }, label),
    react_1.default.createElement("div", { className: "ld-property__readonly" }, value)));
const PositionDisplay = ({ position }) => {
    if (!position)
        return null;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__section-label" }, "Position"),
        react_1.default.createElement("div", { className: "ld-property__position" },
            react_1.default.createElement("div", { className: "ld-property__position-field" },
                react_1.default.createElement("div", { className: "ld-property__label" }, "X"),
                react_1.default.createElement("div", { className: "ld-property__readonly" }, position.x)),
            react_1.default.createElement("div", { className: "ld-property__position-field" },
                react_1.default.createElement("div", { className: "ld-property__label" }, "Y"),
                react_1.default.createElement("div", { className: "ld-property__readonly" }, position.y)))));
};
const ContactForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Contact Properties"),
        react_1.default.createElement(TextField, { label: "Variable Name", value: el.variableName, onChange: (v) => onPropertyChange('variableName', v) }),
        react_1.default.createElement(SelectField, { label: "Contact Type", value: el.contactType, options: [
                { label: 'NO (Normally Open)', value: 'NO' },
                { label: 'NC (Normally Closed)', value: 'NC' },
            ], onChange: (v) => onPropertyChange('contactType', v) }),
        react_1.default.createElement(PositionDisplay, { position: el.position })));
};
const CoilForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Coil Properties"),
        react_1.default.createElement(TextField, { label: "Variable Name", value: el.variableName, onChange: (v) => onPropertyChange('variableName', v) }),
        react_1.default.createElement(SelectField, { label: "Coil Type", value: el.coilType, options: [
                { label: 'Normal', value: 'Normal' },
                { label: 'Negated', value: 'Negated' },
                { label: 'Set (Latch)', value: 'Set' },
                { label: 'Reset (Unlatch)', value: 'Reset' },
            ], onChange: (v) => onPropertyChange('coilType', v) }),
        react_1.default.createElement(PositionDisplay, { position: el.position })));
};
const FbForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Function Block Properties"),
        react_1.default.createElement(TextField, { label: "FB Type", value: el.fbType, onChange: (v) => onPropertyChange('fbType', v) }),
        react_1.default.createElement(PositionDisplay, { position: el.position })));
};
const RungForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Rung Properties"),
        react_1.default.createElement(ReadonlyField, { label: "Rung Number", value: String(el.rungNumber) }),
        react_1.default.createElement(TextField, { label: "Comment", value: el.comment, onChange: (v) => onPropertyChange('comment', v) })));
};
const WireForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Wire Properties"),
        react_1.default.createElement(ReadonlyField, { label: "Source", value: el.sourceId }),
        react_1.default.createElement(ReadonlyField, { label: "Target", value: el.targetId }),
        react_1.default.createElement(PositionDisplay, { position: el.position })));
};
const PowerRailForm = ({ element, onPropertyChange, elementId }) => {
    const el = element;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ld-property__header" }, "Power Rail Properties"),
        react_1.default.createElement(ReadonlyField, { label: "Side", value: el.side }),
        react_1.default.createElement(PositionDisplay, { position: el.position })));
};
const PropertyView = ({ propertyState }) => {
    const [selected, setSelected] = react_1.default.useState(null);
    react_1.default.useEffect(() => {
        const sub = propertyState.onDidChangeSelection((el) => {
            setSelected(el);
        });
        return () => sub.dispose();
    }, [propertyState]);
    const handlePropertyChange = (property, value) => {
        if (!selected)
            return;
        propertyState.updateProperty(selected.id, property, value);
    };
    if (!selected) {
        return (react_1.default.createElement("div", { className: "ld-property" },
            react_1.default.createElement("div", { className: "ld-property__empty" }, "No element selected")));
    }
    const renderForm = () => {
        const common = { element: selected, onPropertyChange: handlePropertyChange, elementId: selected.id };
        switch (selected.elementType) {
            case 'contact': return react_1.default.createElement(ContactForm, { ...common });
            case 'coil': return react_1.default.createElement(CoilForm, { ...common });
            case 'fb': return react_1.default.createElement(FbForm, { ...common });
            case 'rung': return react_1.default.createElement(RungForm, { ...common });
            case 'wire': return react_1.default.createElement(WireForm, { ...common });
            case 'powerrail': return react_1.default.createElement(PowerRailForm, { ...common });
        }
    };
    return (react_1.default.createElement("div", { className: "ld-property" },
        react_1.default.createElement(ReadonlyField, { label: "Element ID", value: selected.id }),
        renderForm()));
};
// ============================================================================
// Widget
// ============================================================================
/**
 * Theia ReactWidget that renders the LD element property view.
 *
 * This widget is intended to be placed in the bottom panel of the
 * application shell when the LD editor is active.
 */
class LdPropertyWidget extends react_widget_1.ReactWidget {
    constructor(propertyState) {
        super();
        this.propertyState = propertyState;
        this.id = LdPropertyWidget.ID;
        this.title.label = LdPropertyWidget.LABEL;
        this.title.caption = 'Ladder Diagram element properties';
        this.title.closable = true;
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.injectStyles();
    }
    render() {
        return react_1.default.createElement(PropertyView, { propertyState: this.propertyState });
    }
    /** Inject property-view CSS into the document head (once). */
    injectStyles() {
        const styleId = 'ld-property-styles';
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = PROPERTY_STYLE;
        document.head.appendChild(style);
    }
}
exports.LdPropertyWidget = LdPropertyWidget;
LdPropertyWidget.ID = 'audesys-ld-property';
LdPropertyWidget.LABEL = 'LD Properties';
//# sourceMappingURL=ld-property-widget.js.map