import type { SignalEntry } from '../../common/signal-bridge-protocol';

/**
 * Group key extracted from a signal name.
 * Everything before the first dot is the namespace (group).
 */
export interface SignalGroup {
    /** Namespace prefix, e.g. "axis", "sensor" */
    namespace: string;
    /** Signals belonging to this group */
    signals: SignalEntry[];
    /** Whether the group is expanded in the tree */
    expanded: boolean;
}

/**
 * Organises flat signal lists into a collapsible group tree.
 *
 * Groups are determined by the first dot-separated segment of each signal name.
 * Signals without dots go into an "ungrouped" bucket.
 */
export class SignalTreeModel {
    private groups: SignalGroup[] = [];

    /** Rebuild the tree from a fresh signal snapshot. */
    update(signals: SignalEntry[], expandedNamespaces?: Set<string>): void {
        const groupMap = new Map<string, SignalEntry[]>();

        for (const sig of signals) {
            const dot = sig.name.indexOf('.');
            const ns = dot > 0 ? sig.name.slice(0, dot) : 'ungrouped';
            let arr = groupMap.get(ns);
            if (!arr) {
                arr = [];
                groupMap.set(ns, arr);
            }
            arr.push(sig);
        }

        // Preserve expand state
        const prevExpanded = new Set<string>();
        for (const g of this.groups) {
            if (g.expanded) {
                prevExpanded.add(g.namespace);
            }
        }

        this.groups = [];
        for (const [namespace, sigs] of groupMap) {
            sigs.sort((a, b) => a.name.localeCompare(b.name));
            this.groups.push({
                namespace,
                signals: sigs,
                expanded: expandedNamespaces
                    ? expandedNamespaces.has(namespace)
                    : prevExpanded.has(namespace) || this.groups.length === 0,
            });
        }
        this.groups.sort((a, b) => a.namespace.localeCompare(b.namespace));
    }

    /** Return all groups. */
    getGroups(): readonly SignalGroup[] {
        return this.groups;
    }

    /** Toggle expand state of a group. Returns new state. */
    toggleGroup(namespace: string): boolean {
        const g = this.groups.find(g => g.namespace === namespace);
        if (g) {
            g.expanded = !g.expanded;
            return g.expanded;
        }
        return false;
    }

    /** Filter signals by pattern (glob-like wildcard * and ?). */
    static filter(signals: SignalEntry[], pattern: string): SignalEntry[] {
        if (pattern === '*' || pattern === '') {
            return signals;
        }
        // Convert glob to regex
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp('^' + escaped + '$', 'i');
        return signals.filter(s => regex.test(s.name));
    }
}
