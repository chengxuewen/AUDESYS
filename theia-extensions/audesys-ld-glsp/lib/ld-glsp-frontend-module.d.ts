/**
 * LD GLSP Frontend Module — unified inversify ContainerModule.
 *
 * Registers ALL contributions in one module:
 * - LdToolState (shared singleton: palette ↔ editor)
 * - LdGModelState (shared singleton: undo/redo/dirty tracking)
 * - LdOperationHandler (shared singleton: model mutations + compile)
 * - LdPaletteContribution (left panel palette widget)
 * - LdEditorOpenHandler (opens .ld files)
 * - LdEditorCommandContribution (Compile, Undo, Redo, Save commands)
 *
 * This replaces the old ld-palette-frontend-module as the package's single
 * theiaExtensions entry point.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
declare const _default: ContainerModule;
export default _default;
//# sourceMappingURL=ld-glsp-frontend-module.d.ts.map