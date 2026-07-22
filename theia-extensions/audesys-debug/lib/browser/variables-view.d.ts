/**
 * Variables View — TreeView for VM register values (r0–r13).
 *
 * Renders via innerHTML. No React/JSX dependency.
 */
import { BaseWidget, Message } from '@theia/core/lib/browser';
export interface RegisterEntry {
    name: string;
    value: string;
}
export declare class VariablesViewWidget extends BaseWidget {
    static readonly ID = "audesys-variables-view";
    private registers;
    private loading;
    constructor();
    setRegisters(regs: RegisterEntry[]): void;
    setLoading(v: boolean): void;
    protected onUpdateRequest(_msg: Message): void;
    private renderHtml;
    private refresh;
    private el;
    private esc;
}
//# sourceMappingURL=variables-view.d.ts.map