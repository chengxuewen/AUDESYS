/**
 * POU wizard pure model (A1-4).
 * Maps a POU type + programming language → { directory, extension, template }.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
export type PouType = 'Program' | 'FunctionBlock' | 'Function' | 'GVL';
export type PouLanguage = 'ST' | 'IL' | 'GVL';
export interface PouTarget {
    /** Subdirectory under the workspace root (Programs/FBs/Functions/GVL). */
    dir: string;
    /** File extension including the leading dot. */
    ext: string;
    template: (name: string) => string;
}
export declare const POU_TYPES: Readonly<PouType[]>;
/**
 * Languages offered by each POU type. GVL has no language choice — it is always
 * a `.gvl` file, so it yields a single "GVL" option (the wizard skips the
 * language step when only one option exists).
 */
export declare function languagesFor(type: PouType): Readonly<PouLanguage[]>;
/** Valid IEC 61131-3 identifier: starts with a letter or underscore, then letters/digits/underscores. */
export declare function validatePouName(name: string): boolean;
/** Resolve the file target for a POU type + language. */
export declare function pouTarget(type: PouType, language: PouLanguage): PouTarget;
//# sourceMappingURL=pou-wizard-model.d.ts.map