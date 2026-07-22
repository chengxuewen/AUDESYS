"use strict";
/**
 * Input validation for napi-rs RPC calls.
 *
 * Matches STH-015:
 *   - source strings: ≤ 1MB
 *   - signal names: pattern `component.interface.name`
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateSource = validateSource;
exports.validateSignalName = validateSignalName;
exports.validateString = validateString;
exports.validateNumber = validateNumber;
exports.validateNonEmptyString = validateNonEmptyString;
const SOURCE_MAX_BYTES = 1048576; // 1MB
const SIGNAL_NAME_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
function validateSource(source, paramName) {
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
function validateSignalName(name, paramName) {
    if (typeof name !== 'string') {
        throw new ValidationError(`${paramName}: expected string, got ${typeof name}`);
    }
    if (!SIGNAL_NAME_PATTERN.test(name)) {
        throw new ValidationError(`${paramName}: must match pattern "component.interface.name" (e.g. "axis.0.pos"), got "${name}"`);
    }
}
function validateString(value, paramName) {
    if (typeof value !== 'string') {
        throw new ValidationError(`${paramName}: expected string, got ${typeof value}`);
    }
}
function validateNumber(value, paramName) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValidationError(`${paramName}: expected finite number, got ${typeof value}`);
    }
}
function validateNonEmptyString(value, paramName) {
    validateString(value, paramName);
    if (value.length === 0) {
        throw new ValidationError(`${paramName}: must not be empty`);
    }
}
//# sourceMappingURL=schema-validator.js.map