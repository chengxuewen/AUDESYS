/**
 * FBD GLSP Frontend Module — unified inversify ContainerModule for the
 * Function Block Diagram editor.
 *
 * Registers:
 * - FbdToolState (shared singleton: palette ↔ editor)
 * - FbdGModelState (shared singleton: undo/redo/dirty tracking)
 * - FbdOperationHandler (shared singleton: model mutations + compile)
 * - FbdEditorOpenHandler (opens .fbd files)
 * - FbdEditorCommandContribution (Compile, Undo, Redo, Save commands)
 *
 * NOTE: FbdToolState and FbdPaletteContribution are already registered in
 * fbd-palette-frontend-module. This module adds only the editor bindings
 * on top of the palette module.
 *
 * Ponytail: separate palette module + editor module — clean separation.
 * The studio-theia app loads both modules via theiaExtensions in package.json.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
declare const _default: ContainerModule;
export default _default;
//# sourceMappingURL=fbd-editor-frontend-module.d.ts.map