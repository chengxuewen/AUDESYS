// AudesysModeManager — Edit/Debug/Commissioning mode state machine
// Adapted from apps/studio/src/core/ShellMode.ts to Theia's DI + PreferenceService

import { injectable, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { PreferenceService } from '@theia/core/lib/common';

/** Three editor modes matching ShellMode from the original Tauri Studio. */
export type StudioMode = 'edit' | 'debug' | 'commissioning';

export const STUDIO_MODES: StudioMode[] = ['edit', 'debug', 'commissioning'];

/** Preference key for persisting the active mode across restarts. */
export const MODE_PREFERENCE_KEY = 'audesys.studio.mode';

/** Fired on every successful mode switch. */
export interface ModeChangeEvent {
    previous: StudioMode;
    current: StudioMode;
}

export class InvalidModeError extends Error {
    constructor(mode: string) {
        super(`Invalid mode: "${mode}". Valid modes: edit, debug, commissioning`);
        this.name = 'InvalidModeError';
    }
}

/**
 * Singleton manager for the three-mode system.
 *
 * Persists the current mode via Theia PreferenceService so the selection
 * survives restarts. Emits ModeChangeEvent on every transition so toolbar,
 * status bar, and command filters can react.
 */
@injectable()
export class AudesysModeManager {
    private _mode: StudioMode = 'edit';
    private onModeChangedEmitter = new Emitter<ModeChangeEvent>();

    @inject(PreferenceService)
    private readonly preferenceService!: PreferenceService;

    /** Read the current mode. Always valid. */
    get mode(): StudioMode {
        return this._mode;
    }

    /** Subscribe to mode transitions. Returns a disposable. */
    get onModeChanged(): Event<ModeChangeEvent> {
        return this.onModeChangedEmitter.event;
    }

    /**
     * Load persisted mode from preferences. Must be called once during
     * app startup (ModeContribution.onStart).
     */
    init(): void {
        const saved: unknown = this.preferenceService.get(MODE_PREFERENCE_KEY, 'edit');
        if (typeof saved === 'string' && (STUDIO_MODES as readonly string[]).includes(saved)) {
            this._mode = saved as StudioMode;
        }
    }

    /**
     * Transition to a new mode.
     * Validates the mode name, persists the choice, and fires ModeChangeEvent.
     * No-ops if the new mode equals the current mode.
     */
    switchMode(newMode: StudioMode): void {
        if (!(STUDIO_MODES as readonly string[]).includes(newMode)) {
            throw new InvalidModeError(newMode);
        }
        if (newMode === this._mode) {
            return;
        }
        const previous = this._mode;
        this._mode = newMode;
        // ponytail: fire-and-forget persist — non-critical if it fails
        this.preferenceService.set(MODE_PREFERENCE_KEY, newMode);
        this.onModeChangedEmitter.fire({ previous, current: newMode });
    }

    /** Convenience: register a callback. Returns disposable. */
    onModeChange(callback: (event: ModeChangeEvent) => void): { dispose(): void } {
        return this.onModeChanged(callback);
    }
}
