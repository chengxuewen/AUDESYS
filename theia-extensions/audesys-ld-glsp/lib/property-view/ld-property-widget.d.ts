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
import { LdPropertyState } from './ld-property-state';
/**
 * Theia ReactWidget that renders the LD element property view.
 *
 * This widget is intended to be placed in the bottom panel of the
 * application shell when the LD editor is active.
 */
export declare class LdPropertyWidget extends ReactWidget {
    static readonly ID = "audesys-ld-property";
    static readonly LABEL = "LD Properties";
    private propertyState;
    constructor(propertyState: LdPropertyState);
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    /** Inject property-view CSS into the document head (once). */
    private injectStyles;
}
//# sourceMappingURL=ld-property-widget.d.ts.map