/**
 * Breakpoints View — Breakpoint list with add/remove.
 *
 * Renders via innerHTML. No React/JSX dependency.
 */
import { BaseWidget, Message } from '@theia/core/lib/browser';
interface BpEntry {
    ip: number;
    line?: number;
    verified: boolean;
}
export declare class BreakpointsViewWidget extends BaseWidget {
    static readonly ID = "audesys-breakpoints-view";
    private breakpoints;
    private inputValue;
    constructor();
    setBreakpoints(bps: BpEntry[]): void;
    protected onUpdateRequest(_msg: Message): void;
    private renderHtml;
    private attachListeners;
    private el;
}
export {};
//# sourceMappingURL=breakpoints-view.d.ts.map