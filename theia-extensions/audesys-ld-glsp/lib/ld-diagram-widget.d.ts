/**
 * LD Sprotty Diagram Widget — Theia ReactWidget hosting a Sprotty diagram renderer.
 *
 * Bridges LdGModelState → Sprotty's LocalModelSource for live rendering
 * of ladder diagrams within Theia.
 *
 * Ponytail: ReactWidget + Sprotty container + polling sync.
 * Replace poll with push when LdGModelState gains onDidChange event.
 */
import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { LdGModelState } from './server/ld-gmodel-state';
export declare class LdSprottyDiagramWidget extends ReactWidget {
    static readonly ID = "audesys-ld-sprotty-diagram";
    private readonly modelState;
    private readonly divId;
    private container;
    private modelSource;
    private pollTimer;
    private lastGraphJson;
    constructor(modelState: LdGModelState);
    protected onAfterAttach(msg: Message): void;
    protected onBeforeDetach(msg: Message): void;
    protected render(): React.ReactNode;
    /** Force an immediate model sync. Call after applyOperation / undo / redo. */
    syncModel(): void;
    private createHiddenDivs;
    private removeHiddenDivs;
    private createSprottyContainer;
    private disposeSprottyContainer;
}
//# sourceMappingURL=ld-diagram-widget.d.ts.map