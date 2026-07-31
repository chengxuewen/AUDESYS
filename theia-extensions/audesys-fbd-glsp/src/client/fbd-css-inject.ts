/**
 * FBD CSS Inject — injects FBD editor CSS variables into the document.
 *
 * Called once when the GLSP diagram widget is created.
 */
let injected = false;

export function injectFbdCssVariables(): void {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.id = 'fbd-editor-theme-css';
    style.textContent = `
      /* FBD Editor — CSS Variables (light theme defaults) */
      .fbd-editor {
        --fbd-gate-fill: #37474f;
        --fbd-gate-stroke: #4caf50;
        --fbd-gate-label-color: #fff;
        --fbd-fb-fill: #263238;
        --fbd-fb-stroke: #4caf50;
        --fbd-fb-label-color: #fff;
        --fbd-port-input-fill: #4caf50;
        --fbd-port-output-fill: #2196f3;
        --fbd-port-bidi-fill: #ff9800;
        --fbd-port-label-color: #888;
        --fbd-signal-color: #666;
        --fbd-selection-color: #2196f3;
        --fbd-grid-color: #333;
      }
      /* Dark theme overrides */
      .theia-dark .fbd-editor, .theia-dark.fbd-editor {
        --fbd-gate-fill: #455a64;
        --fbd-fb-fill: #37474f;
        --fbd-signal-color: #888;
        --fbd-grid-color: #555;
        --fbd-port-label-color: #aaa;
      }
    `;
    document.head.appendChild(style);
}
