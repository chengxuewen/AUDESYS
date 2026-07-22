import type { IconTheme } from '@theia/core/lib/browser/icon-theme-service';
import type { IconThemeContribution } from '@theia/core/lib/browser/icon-theme-contribution';
import type { IconThemeService } from '@theia/core/lib/browser/icon-theme-service';
import type { Disposable } from '@theia/core/lib/common/disposable';
/**
 * IEC 61131-3 File Icon Theme.
 * Registers a custom icon theme for IEC 61131-3 programming languages,
 * G-code CNC programs, and HMI layout files.
 *
 * The actual icon-to-extension mapping is handled by `IecNavigatorDecorator`
 * (LabelProviderContribution), which resolves codicons per IEC file type.
 * This theme registration makes the theme selectable in Theia's icon theme picker
 * and ensures the IEC-aware label provider is activated.
 */
export declare class IecFileIconTheme implements IconTheme, IconThemeContribution {
    readonly id = "audesys-iec-icons";
    readonly label = "AUDESYS IEC 61131-3 Icons";
    readonly description = "Custom icons for IEC 61131-3 (.st/.il/.ld/.fbd/.sfc), CNC (.gcode/.nc/.gco), and HMI (.hmi) files";
    readonly hasFileIcons = true;
    readonly hasFolderIcons = false;
    registerIconThemes(iconThemes: IconThemeService): void;
    activate(): Disposable;
}
//# sourceMappingURL=iec-icons.d.ts.map