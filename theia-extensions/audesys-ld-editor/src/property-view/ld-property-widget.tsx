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

import React from '@theia/core/shared/react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { LdPropertyState, SelectedElement } from './ld-property-state';

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

// ============================================================================
// Field Components
// ============================================================================

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange }) => (
  <div className="ld-property__field">
    <label className="ld-property__label">{label}</label>
    <input
      className="ld-property__input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onChange }) => (
  <div className="ld-property__field">
    <label className="ld-property__label">{label}</label>
    <select
      className="ld-property__select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

interface ReadonlyFieldProps {
  label: string;
  value: string;
}

const ReadonlyField: React.FC<ReadonlyFieldProps> = ({ label, value }) => (
  <div className="ld-property__field">
    <label className="ld-property__label">{label}</label>
    <div className="ld-property__readonly">{value}</div>
  </div>
);

// ============================================================================
// Position Display (shared)
// ============================================================================

interface PositionDisplayProps {
  position: { x: number; y: number } | null;
}

const PositionDisplay: React.FC<PositionDisplayProps> = ({ position }) => {
  if (!position) return null;
  return (
    <>
      <div className="ld-property__section-label">Position</div>
      <div className="ld-property__position">
        <div className="ld-property__position-field">
          <div className="ld-property__label">X</div>
          <div className="ld-property__readonly">{position.x}</div>
        </div>
        <div className="ld-property__position-field">
          <div className="ld-property__label">Y</div>
          <div className="ld-property__readonly">{position.y}</div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// Type-Specific Property Forms
// ============================================================================

interface PropertyFormProps {
  element: SelectedElement;
  onPropertyChange: (property: string, value: unknown) => void;
  elementId: string;
}

const ContactForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'contact' };
  return (
    <>
      <div className="ld-property__header">Contact Properties</div>
      <TextField
        label="Variable Name"
        value={el.variableName}
        onChange={(v) => onPropertyChange('variableName', v)}
      />
      <SelectField
        label="Contact Type"
        value={el.contactType}
        options={[
          { label: 'NO (Normally Open)', value: 'NO' },
          { label: 'NC (Normally Closed)', value: 'NC' },
        ]}
        onChange={(v) => onPropertyChange('contactType', v)}
      />
      <PositionDisplay position={el.position} />
    </>
  );
};

const CoilForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'coil' };
  return (
    <>
      <div className="ld-property__header">Coil Properties</div>
      <TextField
        label="Variable Name"
        value={el.variableName}
        onChange={(v) => onPropertyChange('variableName', v)}
      />
      <SelectField
        label="Coil Type"
        value={el.coilType}
        options={[
          { label: 'Normal', value: 'Normal' },
          { label: 'Negated', value: 'Negated' },
          { label: 'Set (Latch)', value: 'Set' },
          { label: 'Reset (Unlatch)', value: 'Reset' },
        ]}
        onChange={(v) => onPropertyChange('coilType', v)}
      />
      <PositionDisplay position={el.position} />
    </>
  );
};

const FbForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'fb' };
  return (
    <>
      <div className="ld-property__header">Function Block Properties</div>
      <TextField
        label="FB Type"
        value={el.fbType}
        onChange={(v) => onPropertyChange('fbType', v)}
      />
      <PositionDisplay position={el.position} />
    </>
  );
};

const RungForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'rung' };
  return (
    <>
      <div className="ld-property__header">Rung Properties</div>
      <ReadonlyField label="Rung Number" value={String(el.rungNumber)} />
      <TextField
        label="Comment"
        value={el.comment}
        onChange={(v) => onPropertyChange('comment', v)}
      />
    </>
  );
};

const WireForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'wire' };
  return (
    <>
      <div className="ld-property__header">Wire Properties</div>
      <ReadonlyField label="Source" value={el.sourceId} />
      <ReadonlyField label="Target" value={el.targetId} />
      <PositionDisplay position={el.position} />
    </>
  );
};

const PowerRailForm: React.FC<PropertyFormProps> = ({ element, onPropertyChange, elementId }) => {
  const el = element as SelectedElement & { elementType: 'powerrail' };
  return (
    <>
      <div className="ld-property__header">Power Rail Properties</div>
      <ReadonlyField label="Side" value={el.side} />
      <PositionDisplay position={el.position} />
    </>
  );
};

// ============================================================================
// Property View (Root Component)
// ============================================================================

interface PropertyViewProps {
  propertyState: LdPropertyState;
}

const PropertyView: React.FC<PropertyViewProps> = ({ propertyState }) => {
  const [selected, setSelected] = React.useState<SelectedElement | null>(null);

  React.useEffect(() => {
    const sub = propertyState.onDidChangeSelection((el: SelectedElement | null) => {
      setSelected(el);
    });
    return () => sub.dispose();
  }, [propertyState]);

  const handlePropertyChange = (property: string, value: unknown): void => {
    if (!selected) return;
    propertyState.updateProperty(selected.id, property, value);
  };

  if (!selected) {
    return (
      <div className="ld-property">
        <div className="ld-property__empty">No element selected</div>
      </div>
    );
  }

  const renderForm = (): React.ReactNode => {
    const common = { element: selected, onPropertyChange: handlePropertyChange, elementId: selected.id };
    switch (selected.elementType) {
      case 'contact': return <ContactForm {...common} />;
      case 'coil': return <CoilForm {...common} />;
      case 'fb': return <FbForm {...common} />;
      case 'rung': return <RungForm {...common} />;
      case 'wire': return <WireForm {...common} />;
      case 'powerrail': return <PowerRailForm {...common} />;
    }
  };

  return (
    <div className="ld-property">
      <ReadonlyField label="Element ID" value={selected.id} />
      {renderForm()}
    </div>
  );
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
export class LdPropertyWidget extends ReactWidget {
  static readonly ID = 'audesys-ld-property';
  static readonly LABEL = 'LD Properties';

  private propertyState: LdPropertyState;

  constructor(propertyState: LdPropertyState) {
    super();
    this.propertyState = propertyState;
    this.id = LdPropertyWidget.ID;
    this.title.label = LdPropertyWidget.LABEL;
    this.title.caption = 'Ladder Diagram element properties';
    this.title.closable = true;
  }

  protected override onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.injectStyles();
  }

  protected render(): React.ReactNode {
    return React.createElement(PropertyView, { propertyState: this.propertyState });
  }

  /** Inject property-view CSS into the document head (once). */
  private injectStyles(): void {
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
