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
export declare class SignalTreeModel {
    private groups;
    /** Rebuild the tree from a fresh signal snapshot. */
    update(signals: SignalEntry[], expandedNamespaces?: Set<string>): void;
    /** Return all groups. */
    getGroups(): readonly SignalGroup[];
    /** Toggle expand state of a group. Returns new state. */
    toggleGroup(namespace: string): boolean;
    /** Filter signals by pattern (glob-like wildcard * and ?). */
    static filter(signals: SignalEntry[], pattern: string): SignalEntry[];
}
//# sourceMappingURL=signal-tree-model.d.ts.map