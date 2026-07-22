// ModeStatusBarItem — status bar contribution that renders current mode indicator

import { injectable, inject } from '@theia/core/shared/inversify';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { AudesysModeManager, StudioMode, STUDIO_MODES } from './audesys-mode-manager';

interface ModeUIConfig {
    mode: StudioMode;
    icon: string;
    label: string;
}

const MODE_CONFIGS: ModeUIConfig[] = [
    { mode: 'edit', icon: '$(edit)', label: 'Edit' },
    { mode: 'debug', icon: '$(debug-alt)', label: 'Debug' },
    { mode: 'commissioning', icon: '$(gear)', label: 'Cm.' },
];

const ACTIVE_COLOR = 'var(--theia-activityBar-activeBorder)';
const ENTRY_PREFIX = 'audesys-mode-';

/**
 * Renders three clickable mode indicators in the left status bar:
 * Edit (pencil), Debug (bug), Commissioning (gear).
 * The currently active mode is highlighted with the Theia accent color.
 */
@injectable()
export class ModeStatusBarItem {
    @inject(StatusBar)
    private readonly statusBar!: StatusBar;

    @inject(AudesysModeManager)
    private readonly modeManager!: AudesysModeManager;

    /** Render status bar entries and subscribe to mode changes. */
    show(): void {
        for (const cfg of MODE_CONFIGS) {
            this.renderEntry(cfg);
        }
        this.modeManager.onModeChange(() => this.refresh());
    }

    private refresh(): void {
        for (const cfg of MODE_CONFIGS) {
            this.renderEntry(cfg);
        }
    }

    private renderEntry(cfg: ModeUIConfig): void {
        const active = this.modeManager.mode === cfg.mode;
        this.statusBar.setElement(`${ENTRY_PREFIX}${cfg.mode}`, {
            text: `${cfg.icon} ${cfg.label}`,
            alignment: StatusBarAlignment.LEFT,
            priority: 100,
            command: `audesys.mode.switch.${cfg.mode}`,
            tooltip: `Switch to ${cfg.label} mode`,
            color: active ? ACTIVE_COLOR : undefined,
        });
    }
}
