// packages/logger/src/redact/index.ts
import { DEFAULT_REDACT_KEYS } from '../types/index.js';

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/**
 * Recursively walk an object/array and replace the value of any key that
 * matches (case-insensitive substring) one of `extraKeys` combined with
 * DEFAULT_REDACT_KEYS. Non-plain-object values (Error, Date, class
 * instances, etc.) are passed through as-is rather than descended into.
 *
 * Designed to run on log metadata before it hits a transport, so secrets
 * never reach disk, stdout, or a third-party log shipper (CloudWatch,
 * Logtail, etc.) even if a caller accidentally logs a full request body,
 * user object, or headers.
 */
export const redact = (
    value: unknown,
    extraKeys: readonly string[] = [],
    depth = 0
): unknown => {
    if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
        return value;
    }

    const keys = new Set(
        [...DEFAULT_REDACT_KEYS, ...extraKeys].map((k) => k.toLowerCase())
    );

    const matchesRedactKey = (key: string): boolean => {
        const lower = key.toLowerCase();
        for (const k of keys) {
            if (lower.includes(k)) return true;
        }
        return false;
    };

    if (Array.isArray(value)) {
        return value.map((item) => redact(item, extraKeys, depth + 1));
    }

    // Only walk plain objects — skip Error instances, Dates, Buffers, class
    // instances, etc. so we don't mangle their structure/prototype chain.
    const proto = Object.getPrototypeOf(value);
    const isPlainObject = proto === Object.prototype || proto === null;
    if (!isPlainObject) {
        return value;
    }

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (matchesRedactKey(key)) {
            out[key] = REDACTED;
        } else {
            out[key] = redact(val, extraKeys, depth + 1);
        }
    }
    return out;
};