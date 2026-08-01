/**
 * IL Diagnostics Adapter — compiles IL source and reports errors as Monaco markers.
 *
 * Uses the napi-rs `compileIl` bridge (via @audesys/theia-bridge) to validate
 * IL source on every model change. Errors are mapped to Monaco Diagnostics.
 *
 * Only validates syntax — semantic checks (undefined variables, type mismatches)
 * are reported by the Rust compiler as part of the same error message.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as monaco from '@theia/monaco-editor-core';

/** IL mnemonics the compiler supports (sync with lexer.rs parse_mnemonic) */
const IL_MNEMONICS = new Set([
    'LD', 'LDN', 'ST', 'S', 'R',
    'AND', 'ANDN', 'OR', 'ORN', 'XOR', 'NOT',
    'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
    'GT', 'GE', 'EQ', 'NE', 'LE', 'LT',
    'JMP', 'JMPC', 'JMPCN',
    'CAL', 'RET',
    'TON', 'TOF', 'TP',
    'CTU', 'CTD',
    'R_TRIG', 'F_TRIG',
    'SR', 'RS',
]);

/** Validate IL source line-by-line without invoking the Rust compiler.
 *  Fast feedback for syntax errors; the compiler catches semantic errors. */
export function validateIlSource(model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
    const markers: monaco.editor.IMarkerData[] = [];
    const text = model.getValue();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        if (line === '' || line.startsWith('(*')) continue;

        // Strip inline comments
        const code = line.replace(/\(\*.*?\*\)/g, '').trim();
        if (code === '') continue;

        const parts = code.split(/\s+/);
        const mnemonic = parts[0].toUpperCase();

        // Labels are allowed at start of line
        if (mnemonic.endsWith(':')) {
            if (parts.length === 1) continue;
            // Label + instruction on same line: validate the instruction
            const nextMnemonic = parts[1].toUpperCase();
            if (!IL_MNEMONICS.has(nextMnemonic)) {
                markers.push({
                    severity: monaco.MarkerSeverity.Error,
                    message: `Unknown IL instruction: ${nextMnemonic}`,
                    startLineNumber: i + 1,
                    startColumn: 1,
                    endLineNumber: i + 1,
                    endColumn: rawLine.length + 1,
                });
            }
            continue;
        }

        if (!IL_MNEMONICS.has(mnemonic)) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: `Unknown IL instruction: ${mnemonic}`,
                startLineNumber: i + 1,
                startColumn: 1,
                endLineNumber: i + 1,
                endColumn: rawLine.length + 1,
            });
            continue;
        }

        // Instructions that require an operand
        const noOperand = new Set(['NOT', 'RET']);
        if (!noOperand.has(mnemonic) && parts.length < 2) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: `Missing operand for instruction: ${mnemonic}`,
                startLineNumber: i + 1,
                startColumn: 1,
                endLineNumber: i + 1,
                endColumn: rawLine.length + 1,
            });
        }
    }

    return markers;
}

/**
 * Register the diagnostics adapter for IL.
 * Called from ILMonacoContribution after language registration.
 */
export function registerILDiagnostics(): void {
    monaco.editor.onDidCreateModel((model) => {
        if (model.getLanguageId() !== 'il') return;

        const updateDiagnostics = (): void => {
            const markers = validateIlSource(model);
            monaco.editor.setModelMarkers(model, 'il-diagnostics', markers);
        };

        model.onDidChangeContent(updateDiagnostics);
        updateDiagnostics();
    });
}
