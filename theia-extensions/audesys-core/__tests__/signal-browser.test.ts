/**
 * T3.1t Signal Browser Tests
 *
 * Tests SignalTreeModel grouping, filtering, and refresh.
 */
import { describe, expect, test } from 'vitest';
import { SignalTreeModel } from '../src/browser/signal-browser/signal-tree-model';
import type { SignalEntry } from '../src/common/signal-bridge-protocol';

// ── Helpers ──────────────────────────────────────────────────────────────
function makeSignal(name: string, value = '0'): SignalEntry {
    return { name, value };
}

function namesOf(groups: ReturnType<SignalTreeModel['getGroups']>): string[] {
    return groups.flatMap(g => g.signals.map(s => s.name));
}

// ── Grouping by namespace ────────────────────────────────────────────────
describe('SignalTreeModel grouping', () => {
    test('groups signals by namespace (first dot-segment)', () => {
        const model = new SignalTreeModel();
        const signals: SignalEntry[] = [
            makeSignal('axis.x.position', '10'),
            makeSignal('axis.y.position', '20'),
            makeSignal('sensor.temp.value', '42'),
            makeSignal('sensor.hum.value', '60'),
        ];

        model.update(signals);
        const groups = model.getGroups();

        expect(groups).toHaveLength(2);
        expect(groups[0].namespace).toBe('axis');
        expect(groups[0].signals).toHaveLength(2);
        expect(groups[1].namespace).toBe('sensor');
        expect(groups[1].signals).toHaveLength(2);
    });

    test('puts dotless signals into "ungrouped" bucket', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('plain_signal'), makeSignal('axis.x')]);

        const groups = model.getGroups();
        const ungrouped = groups.find(g => g.namespace === 'ungrouped');

        expect(ungrouped).toBeDefined();
        expect(ungrouped!.signals).toHaveLength(1);
        expect(ungrouped!.signals[0].name).toBe('plain_signal');
    });

    test('sorts groups alphabetically and signals within each group', () => {
        const model = new SignalTreeModel();
        model.update([
            makeSignal('zebra.a'),
            makeSignal('apple.b'),
            makeSignal('apple.a'),
        ]);

        const groups = model.getGroups();
        expect(groups[0].namespace).toBe('apple');
        expect(groups[0].signals[0].name).toBe('apple.a');
        expect(groups[0].signals[1].name).toBe('apple.b');
        expect(groups[1].namespace).toBe('zebra');
    });

    test('first group defaults to expanded, rest collapsed', () => {
        const model = new SignalTreeModel();
        model.update([
            makeSignal('first.x'),
            makeSignal('second.y'),
        ]);

        const groups = model.getGroups();
        expect(groups[0].expanded).toBe(true);
        expect(groups[1].expanded).toBe(false);
    });
});

// ── Pattern filter ───────────────────────────────────────────────────────
describe('SignalTreeModel.filter', () => {
    const signals: SignalEntry[] = [
        makeSignal('axis.x.position'),
        makeSignal('axis.y.speed'),
        makeSignal('sensor.temp.value'),
        makeSignal('motor.current'),
        makeSignal('other'),
    ];

    test('"*" returns everything', () => {
        const result = SignalTreeModel.filter(signals, '*');
        expect(result).toHaveLength(signals.length);
    });

    test('empty pattern returns everything', () => {
        const result = SignalTreeModel.filter(signals, '');
        expect(result).toHaveLength(signals.length);
    });

    test('"axis.*" matches only axis-prefixed signals', () => {
        const result = SignalTreeModel.filter(signals, 'axis.*');
        expect(result).toHaveLength(2);
        expect(result.every(s => s.name.startsWith('axis.'))).toBe(true);
    });

    test('exact name match works', () => {
        const result = SignalTreeModel.filter(signals, 'other');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('other');
    });

    test('"*temp*" matches signals containing "temp"', () => {
        const result = SignalTreeModel.filter(signals, '*temp*');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('sensor.temp.value');
    });

    test('no-match pattern returns empty', () => {
        const result = SignalTreeModel.filter(signals, 'nonexistent.*');
        expect(result).toHaveLength(0);
    });

    test('case-insensitive matching', () => {
        const result = SignalTreeModel.filter(signals, 'AXIS.*');
        expect(result).toHaveLength(2);
    });
});

// ── Empty / edge cases ───────────────────────────────────────────────────
describe('SignalTreeModel empty state', () => {
    test('getGroups returns empty array for no signals', () => {
        const model = new SignalTreeModel();
        model.update([]);

        expect(model.getGroups()).toHaveLength(0);
    });

    test('update with empty list clears previous groups', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('a.b')]);
        expect(model.getGroups()).toHaveLength(1);

        model.update([]);
        expect(model.getGroups()).toHaveLength(0);
    });
});

// ── Refresh and state preservation ───────────────────────────────────────
describe('SignalTreeModel refresh', () => {
    test('update replaces old signals', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('old.signal')]);

        model.update([makeSignal('new.signal')]);
        const names = namesOf(model.getGroups());

        expect(names).toEqual(['new.signal']);
    });
    test('preserves expand state across updates (except first group always expands)', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('a.x'), makeSignal('b.y')]);

        // Collapse first group, expand second
        model.toggleGroup('a');
        model.toggleGroup('b');

        // Update with new signals in same namespaces
        model.update([makeSignal('a.changed'), makeSignal('b.changed')]);

        const groups = model.getGroups();
        // first group always defaults to expanded (|| this.groups.length === 0)
        expect(groups[0].expanded).toBe(true);  // a: always expanded as first
        expect(groups[1].expanded).toBe(true);  // b: preserved from toggle
    });

    test('explicit expandedNamespaces overrides preserved state', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('a.x'), makeSignal('b.y')]);
        model.toggleGroup('a'); // collapse a

        // Override: expand a, collapse b
        model.update(
            [makeSignal('a.x'), makeSignal('b.y')],
            new Set(['a']),
        );

        const groups = model.getGroups();
        expect(groups[0].expanded).toBe(true);  // explicitly expanded
        expect(groups[1].expanded).toBe(false); // not in set
    });
});

// ── Toggle group ─────────────────────────────────────────────────────────
describe('SignalTreeModel toggleGroup', () => {
    test('toggles expand state and returns new value', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('g.sig')]);

        expect(model.getGroups()[0].expanded).toBe(true); // default

        const collapsed = model.toggleGroup('g');
        expect(collapsed).toBe(false);
        expect(model.getGroups()[0].expanded).toBe(false);

        const expanded = model.toggleGroup('g');
        expect(expanded).toBe(true);
        expect(model.getGroups()[0].expanded).toBe(true);
    });

    test('returns false for unknown namespace', () => {
        const model = new SignalTreeModel();
        model.update([makeSignal('a.x')]);

        expect(model.toggleGroup('nonexistent')).toBe(false);
    });
});
