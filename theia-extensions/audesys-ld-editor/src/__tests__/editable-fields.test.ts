/**
 * A3: editable-field sequence for keyboard navigation (§7.1).
 * Tab advances the sequence, Shift+Tab goes back, Enter opens the
 * current field's editor.
 */
import { describe, it, expect } from 'vitest';
import { editableFieldsFor } from '../components/LdCanvas';

describe('editableFieldsFor (A3 keyboard navigation)', () => {
    it('contact exposes the variableName field', () => {
        expect(editableFieldsFor({ type: 'contact' })).toEqual(['variableName']);
    });

    it('coil exposes the variableName field', () => {
        expect(editableFieldsFor({ type: 'coil' })).toEqual(['variableName']);
    });

    it('rung exposes title then comment (Tab order)', () => {
        expect(editableFieldsFor({ type: 'rung' })).toEqual(['title', 'comment']);
    });

    it('fb has no keyboard-editable fields yet', () => {
        expect(editableFieldsFor({ type: 'fb' })).toEqual([]);
    });

    it('unknown node types are skipped', () => {
        expect(editableFieldsFor({ type: 'powerrail' })).toEqual([]);
        expect(editableFieldsFor({ type: 'insert-point' })).toEqual([]);
    });
});
