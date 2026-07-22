import URI from '@theia/core/lib/common/uri';
import { LabelProviderContribution } from '@theia/core/lib/browser/label-provider';
/**
 * IEC Navigator Decorator.
 * Appends resource-type labels ([Program], [HMI], [CNC]) to file names
 * in Theia's File Explorer, tab headers, and breadcrumbs for instant
 * identification of IEC 61131-3 / CNC / HMI resource types.
 */
export declare class IecNavigatorDecorator implements LabelProviderContribution {
    /**
     * Only handle URIs whose file extension maps to a known IEC resource type.
     * Non-IEC files pass through to the default label provider.
     */
    canHandle(uri: URI): number;
    /**
     * Append the resource-type suffix to the base file name.
     * Example: "main.st" → "main.st [Program]"
     */
    getName(uri: URI): string;
    /**
     * Return the icon class for IEC/CNC/HMI files based on extension.
     * The label provider fallback chain picks the highest canHandle priority,
     * so our decorator takes precedence over default for these file types.
     */
    getIcon(uri: URI): string;
    private resolveExt;
}
//# sourceMappingURL=iec-navigator-decorator.d.ts.map