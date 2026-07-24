import type { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
/**
 * Forces the browser tab title to always show "AUDESYS Studio"
 * regardless of which workspace folder is open.
 */
export declare class WindowTitleContribution implements FrontendApplicationContribution {
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=window-title-contribution.d.ts.map