import { describe, it, expect, beforeEach } from 'vitest';
import { validateRequest, clearValidationCache } from './engine.js';
import { ValidationRules } from '../core/validation.types.js';

beforeEach(() => {
    clearValidationCache();
});

describe('fix: array items required by default', () => {
    it('rejects null/undefined entries in arrayOf by default', async () => {
        const rules: ValidationRules = { tags: { array: true, arrayOf: { string: true } } };
        const result = await validateRequest({ tags: ['a', null, 'b'] }, rules);
        expect(result.isValid).toBe(false);
    });

    it('still allows a clean array of strings', async () => {
        const rules: ValidationRules = { tags: { array: true, arrayOf: { string: true } } };
        const result = await validateRequest({ tags: ['a', 'b'] }, rules);
        expect(result.isValid).toBe(true);
    });

    it('allows null entries when explicitly opted out with required: false', async () => {
        const rules: ValidationRules = { tags: { array: true, arrayOf: { string: true, required: false } } };
        const result = await validateRequest({ tags: ['a', null, 'b'] }, rules);
        expect(result.isValid).toBe(true);
    });
});

describe('fix: rule.strict rejects unknown keys on shaped objects', () => {
    it('rejects an unexpected key when strict: true', async () => {
        const rules: ValidationRules = {
            profile: {
                object: true,
                strict: true,
                shape: { name: { string: true, required: true } },
            },
        };
        const result = await validateRequest({ profile: { name: 'Roggers', extra: 'nope' } }, rules);
        expect(result.isValid).toBe(false);
    });

    it('silently strips unknown keys when strict is not set (unchanged default)', async () => {
        const rules: ValidationRules = {
            profile: { object: true, shape: { name: { string: true, required: true } } },
        };
        const result = await validateRequest({ profile: { name: 'Roggers', extra: 'nope' } }, rules);
        expect(result.isValid).toBe(true);
        expect(result.data.profile).toEqual({ name: 'Roggers' });
    });
});