import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRequest,
  createValidationSchema,
  clearValidationCache,
  getValidationCacheSize,
} from './engine.js';
import { customValidators, validationSchemas, ValidationRules } from '../core/validation.types.js';

beforeEach(() => {
  clearValidationCache();
});

describe('custom validators (regression: previously always passed regardless of input)', () => {
  it('customValidators.password rejects a password missing requirements, with the real message', async () => {
    const rules: ValidationRules = { password: customValidators.password(8) };
    const result = await validateRequest({ password: 'alllowercase' }, rules);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.message).toBe('Password must contain at least one uppercase letter');
  });

  it('customValidators.password accepts a strong password', async () => {
    const rules: ValidationRules = { password: customValidators.password(8) };
    const result = await validateRequest({ password: 'Str0ng!Pass' }, rules);
    expect(result.isValid).toBe(true);
  });

  it('customValidators.phone rejects a too-short number', async () => {
    const rules: ValidationRules = { phone: customValidators.phone(true) };
    const result = await validateRequest({ phone: '123' }, rules);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.message).toContain('between 10 and 15 digits');
  });

  it('customValidators.creditCard rejects a number that fails the Luhn check', async () => {
    const rules: ValidationRules = { card: customValidators.creditCard(true) };
    const result = await validateRequest({ card: '4111111111111112' }, rules); // last digit tampered
    expect(result.isValid).toBe(false);
  });

  it('customValidators.creditCard accepts a valid test number', async () => {
    const rules: ValidationRules = { card: customValidators.creditCard(true) };
    const result = await validateRequest({ card: '4111111111111111' }, rules);
    expect(result.isValid).toBe(true);
  });

  it('customValidators.postalCode rejects a malformed code', async () => {
    const rules: ValidationRules = { zip: customValidators.postalCode(true) };
    const result = await validateRequest({ zip: 'not-a-zip' }, rules);
    expect(result.isValid).toBe(false);
  });

  it('validationSchemas.id rejects a malformed id', async () => {
    const rules: ValidationRules = { id: validationSchemas.id() };
    const result = await validateRequest({ id: 'not-an-id!!' }, rules);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.message).toBe('Invalid ID format');
  });

  it('validationSchemas.id accepts a UUID or positive numeric string', async () => {
    const rules: ValidationRules = { id: validationSchemas.id() };
    expect((await validateRequest({ id: '550e8400-e29b-41d4-a716-446655440000' }, rules)).isValid).toBe(true);
    expect((await validateRequest({ id: '42' }, rules)).isValid).toBe(true);
  });

  it('validationSchemas.json rejects malformed JSON', async () => {
    const rules: ValidationRules = { payload: validationSchemas.json(true) };
    const result = await validateRequest({ payload: '{not valid json' }, rules);
    expect(result.isValid).toBe(false);
  });

  it('a custom validator returning boolean false still fails (not just string returns)', async () => {
    const rules: ValidationRules = {
      even: { number: true, required: true, custom: (v: number) => v % 2 === 0, customMessage: 'must be even' },
    };
    const result = await validateRequest({ even: 3 }, rules);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.message).toBe('must be even');
  });
});

describe('conditional `when` validation', () => {
  const rules: ValidationRules = {
    accountType: { string: true, required: true, enum: ['personal', 'business'] },
    companyName: {
      string: true,
      required: false,
      when: { field: 'accountType', is: 'business', then: { string: true, required: true, min: 1 } },
    },
  };

  it('requires companyName only when accountType is business', async () => {
    expect((await validateRequest({ accountType: 'business' }, rules)).isValid).toBe(false);
    expect((await validateRequest({ accountType: 'personal' }, rules)).isValid).toBe(true);
    expect(
      (await validateRequest({ accountType: 'business', companyName: 'Acme' }, rules)).isValid
    ).toBe(true);
  });

  it('supports a function predicate for `is`', async () => {
    const predicateRules: ValidationRules = {
      age: { number: true, required: true },
      guardianName: {
        string: true,
        required: false,
        when: { field: 'age', is: (v: number) => v < 18, then: { string: true, required: true } },
      },
    };
    expect((await validateRequest({ age: 10 }, predicateRules)).isValid).toBe(false);
    expect((await validateRequest({ age: 30 }, predicateRules)).isValid).toBe(true);
  });
});

describe('number/boolean coercion', () => {
  it('coerces numeric strings by default (query-param style input)', async () => {
    const result = await validateRequest({ page: '2' }, { page: validationSchemas.page() });
    expect(result.isValid).toBe(true);
    expect(result.data.page).toBe(2);
  });

  it('does not coerce when coerceNumbers is disabled', async () => {
    const result = await validateRequest(
      { page: '2' },
      { page: { number: true, required: false } },
      { coerceNumbers: false }
    );
    expect(result.isValid).toBe(false);
  });

  it('maps "true"/"false" strings correctly, unlike z.coerce.boolean()', async () => {
    const rules: ValidationRules = { active: { boolean: true, required: false } };
    expect((await validateRequest({ active: 'true' }, rules)).data.active).toBe(true);
    expect((await validateRequest({ active: 'false' }, rules)).data.active).toBe(false);
  });
});

describe('schema cache', () => {
  it('does not collide for rules that differ only by RegExp or a custom function', () => {
    createValidationSchema({ code: { string: true, regex: /^[a-z]+$/ } });
    createValidationSchema({ code: { string: true, regex: /^[0-9]+$/ } });
    createValidationSchema({ code: { string: true, custom: (v: any) => v === 'A' } });
    createValidationSchema({ code: { string: true, custom: (v: any) => v === 'B' } });
    expect(getValidationCacheSize()).toBe(4);
  });
});
