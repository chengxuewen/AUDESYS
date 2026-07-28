"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectLdCssVariables = injectLdCssVariables;
/**
 * LD CSS Inject — injects LD editor CSS variables into the document.
 *
 * Replaces LdEditorWidget.injectCssContent() which was deleted in Phase 1.
 * Called once when the GLSP diagram widget is created.
 */
let injected = false;
function injectLdCssVariables() {
    if (injected)
        return;
    injected = true;
    const style = document.createElement('style');
    style.id = 'ld-editor-theme-css';
    style.textContent = `
      /* LD Editor — CSS Variables (light theme defaults) */
      .ld-editor {
        --ld-power-rail-color: #2196f3;
        --ld-contact-no-fill: #4caf50;
        --ld-contact-nc-fill: #f44336;
        --ld-coil-normal-fill: #4caf50;
        --ld-coil-set-fill: #ff9800;
        --ld-coil-reset-fill: #f44336;
        --ld-rung-label-color: #888;
        --ld-selection-color: #2196f3;
        --ld-wire-color: #666;
        --ld-grid-color: #333;
        --ld-fb-fill: #37474f;
        --ld-fb-stroke: #4caf50;
      }
      /* Dark theme overrides */
      .theia-dark .ld-editor, .theia-dark.ld-editor {
        --ld-power-rail-color: #64b5f6;
        --ld-contact-no-fill: #81c784;
        --ld-wire-color: #888;
        --ld-grid-color: #555;
        --ld-rung-label-color: #aaa;
        --ld-fb-fill: #455a64;
      }
    `;
    document.head.appendChild(style);
}
//# sourceMappingURL=ld-css-inject.js.map