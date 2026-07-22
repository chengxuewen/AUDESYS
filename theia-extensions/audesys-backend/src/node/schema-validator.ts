/**
 * Input validation for napi-rs RPC calls.
 *
 * Matches STH-015:
 *   - source strings: ≤ 1MB
 *   - signal names: pattern `component.interface.name`
 */

const SOURCE_MAX_BYTES = 1_048_576; // 1MB
const SIGNAL_NAME_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function validateSource(source: unknown, paramName: string): asserts source is string {
    if (typeof source !== 'string') {
        throw new ValidationError(`${paramName}: expected string, got ${typeof source}`);
    }
    if (source.length === 0) {
        throw new ValidationError(`${paramName}: must not be empty`);
    }
    if (Buffer.byteLength(source, 'utf-8') > SOURCE_MAX_BYTES) {
        throw new ValidationError(`${paramName}: exceeds 1MB limit`);
    }
}

export function validateSignalName(name: unknown, paramName: string): asserts name is string {
    if (typeof name !== 'string') {
        throw new ValidationError(`${paramName}: expected string, got ${typeof name}`);
    }
    if (!SIGNAL_NAME_PATTERN.test(name)) {
        throw new ValidationError(
            `${paramName}: must match pattern "component.interface.name" (e.g. "axis.0.pos"), got "${name}"`
        );
    }
}

export function validateString(value: unknown, paramName: string): asserts value is string {
    if (typeof value !== 'string') {
        throw new ValidationError(`${paramName}: expected string, got ${typeof value}`);
    }
}

export function validateNumber(value: unknown, paramName: string): asserts value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValidationError(`${paramName}: expected finite number, got ${typeof value}`);
    }
}

export function validateNonEmptyString(value: unknown, paramName: string): asserts value is string {
    validateString(value, paramName);
    if (value.length === 0) {
        throw new ValidationError(`${paramName}: must not be empty`);
    }
}
