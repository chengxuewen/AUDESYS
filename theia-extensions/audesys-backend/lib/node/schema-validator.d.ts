/**
 * Input validation for napi-rs RPC calls.
 *
 * Matches STH-015:
 *   - source strings: ≤ 1MB
 *   - signal names: pattern `component.interface.name`
 */
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare function validateSource(source: unknown, paramName: string): asserts source is string;
export declare function validateSignalName(name: unknown, paramName: string): asserts name is string;
export declare function validateString(value: unknown, paramName: string): asserts value is string;
export declare function validateNumber(value: unknown, paramName: string): asserts value is number;
export declare function validateNonEmptyString(value: unknown, paramName: string): asserts value is string;
//# sourceMappingURL=schema-validator.d.ts.map