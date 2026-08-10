import { z, ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { LRUCache } from 'lru-cache';
import {
  ValidationResult,
  ValidationRules,
  ValidationRule,
  ConditionalValidation,
  ValidationOptions,
  DEFAULT_VALIDATION_OPTIONS,
} from '../core/validation.types.js';

const validationSchemaCache = new LRUCache<string, ZodSchema>({
  max: DEFAULT_VALIDATION_OPTIONS.cacheSize!,
  ttl: 1000 * 60 * 60,
});

const functionIdMap = new WeakMap<Function, number>();
let functionIdCounter = 0;

function cacheKeyReplacer(_key: string, value: any) {
  if (value instanceof RegExp) {
    return { __regex: value.source, __flags: value.flags };
  }
  if (typeof value === 'function') {
    if (!functionIdMap.has(value)) {
      functionIdMap.set(value, ++functionIdCounter);
    }
    return { __fn: functionIdMap.get(value) };
  }
  return value;
}

function getCacheKey(rules: ValidationRules): string {
  return JSON.stringify(rules, cacheKeyReplacer);
}

/**
 * Build (or fetch from cache) a Zod schema for a `ValidationRules` map.
 *
 * CACHING CAVEAT: the cache key is derived from the rules object's JSON
 * shape, with RegExp and function values mapped to a stable id keyed off
 * *reference identity* (see `cacheKeyReplacer`/`functionIdMap`). That means
 * caching only pays off when the same `ValidationRules` object (or one
 * built from the same function references, e.g. `customValidators.password`
 * called once and reused) is passed in across calls. Rebuilding your rules
 * object — and especially re-invoking `customValidators.*`/inline `custom`
 * closures — inside a per-request code path (e.g. inside an Express route
 * handler body) creates a fresh function reference every time, so the
 * cache key never matches and you silently lose the caching benefit
 * without any error. Define `ValidationRules` once at module scope and
 * reuse the same object across requests.
 */
export function createValidationSchema(
  rules: ValidationRules,
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
): ZodSchema {
  if (!options.cacheSchemas) {
    return buildObjectSchema(rules, options);
  }

  const cacheKey = getCacheKey(rules);

  if (validationSchemaCache.has(cacheKey)) {
    return validationSchemaCache.get(cacheKey)!;
  }

  const schema = buildObjectSchema(rules, options);
  validationSchemaCache.set(cacheKey, schema);

  return schema;
}

function buildObjectSchema(
  rules: ValidationRules,
  options: ValidationOptions
): ZodSchema {
  const schemaObject: Record<string, ZodTypeAny> = {};
  const conditionalRules: Array<{ field: string; cond: ConditionalValidation }> = [];

  for (const [field, rule] of Object.entries(rules)) {
    const validationRule = typeof rule === 'string'
      ? parseRuleString(rule)
      : rule;

    schemaObject[field] = createZodSchemaForRule(field, validationRule, options);

    if (validationRule.when) {
      conditionalRules.push({ field, cond: validationRule.when });
    }
  }

  let schema: ZodSchema = z.object(schemaObject);

  // `when` depends on a sibling field's value, so it's applied as a
  // whole-object refinement rather than on a single field's schema.
  if (conditionalRules.length > 0) {
    schema = (schema as any).superRefine(async (data: any, ctx: z.RefinementCtx) => {
      for (const { field, cond } of conditionalRules) {
        const conditionMet = typeof cond.is === 'function'
          ? cond.is(data?.[cond.field])
          : data?.[cond.field] === cond.is;

        const activeRule = conditionMet ? cond.then : cond.otherwise;
        if (!activeRule) continue;

        const fieldSchema = createZodSchemaForRule(field, activeRule, options);
        const result = await fieldSchema.safeParseAsync(data?.[field]);

        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ ...issue, path: [field, ...issue.path] });
          }
        }
      }
    });
  }

  return schema;
}

/**
 * Validate a plain data object against a `ValidationRules` map.
 *
 * This function is framework-agnostic — it does not know about Express.
 * If you're validating an Express request, merge `req.body`, `req.query`,
 * and `req.params` yourself before calling this (or use the Express
 * integration exported from `@your-org/api-utils/server`, which does that
 * merge for you).
 */
export async function validateRequest(
  data: any,
  rules: ValidationRules,
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
): Promise<ValidationResult> {
  try {
    const schema = createValidationSchema(rules, options);
    const validatedData = await schema.parseAsync(data);

    return {
      isValid: true,
      errors: [],
      data: validatedData
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        isValid: false,
        errors: formatZodError(error)
      };
    }

    console.error('[VALIDATION] Unexpected error:', error);

    return {
      isValid: false,
      errors: [{
        field: 'system',
        message: 'Validation system error',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

function parseRuleString(ruleString: string): ValidationRule {
  const rules: ValidationRule = {};
  const ruleParts = ruleString.split('|').map(part => part.trim());

  for (const part of ruleParts) {
    if (part === 'required') {
      rules.required = true;
    } else if (part === 'string') {
      rules.string = true;
    } else if (part === 'number') {
      rules.number = true;
    } else if (part === 'boolean') {
      rules.boolean = true;
    } else if (part === 'array') {
      rules.array = true;
    } else if (part === 'object') {
      rules.object = true;
    } else if (part === 'email') {
      rules.email = true;
    } else if (part === 'uuid') {
      rules.uuid = true;
    } else if (part === 'url') {
      rules.url = true;
    } else if (part === 'date') {
      rules.date = true;
    } else if (part === 'trim') {
      rules.trim = true;
    } else if (part === 'lowercase') {
      rules.lowercase = true;
    } else if (part === 'uppercase') {
      rules.uppercase = true;
    } else if (part.startsWith('min:')) {
      const value = part.substring(4);
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        rules.min = parsedValue;
      }
    } else if (part.startsWith('max:')) {
      const value = part.substring(4);
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        rules.max = parsedValue;
      }
    } else if (part.startsWith('minItems:')) {
      const parsedValue = parseInt(part.substring(9), 10);
      if (!isNaN(parsedValue)) rules.minItems = parsedValue;
    } else if (part.startsWith('maxItems:')) {
      const parsedValue = parseInt(part.substring(9), 10);
      if (!isNaN(parsedValue)) rules.maxItems = parsedValue;
    } else if (part.startsWith('regex:')) {
      const regexPattern = part.substring(6);
      if (regexPattern) {
        try {
          rules.regex = new RegExp(regexPattern);
        } catch (error) {
          console.error(`[VALIDATION] Invalid regex pattern: ${regexPattern}`);
        }
      }
    } else if (part.startsWith('pattern:')) {
      rules.pattern = part.substring(8);
    } else if (part.startsWith('enum:')) {
      const enumValues = part.substring(5);
      if (enumValues) {
        rules.enum = enumValues.split(',').map(v => v.trim()).filter(Boolean);
      }
    }
  }

  return rules;
}

/**
 * @param defaultRequired What `rule.required` should default to when the
 * caller didn't set it explicitly. Object/top-level fields default to
 * `false` (optional-unless-marked-required) — that's the original,
 * unchanged behavior. Array items passed via `rule.arrayOf` default to
 * `true` instead: an array item is a positional value, not a named field
 * that can simply be "absent", so `arrayOf: { string: true }` means an
 * array of strings, not an array that may silently contain `null`/
 * `undefined` entries unless you opt out with `arrayOf: { string: true,
 * required: false }`. An explicit `rule.required` always wins over this
 * default either way.
 */
function createZodSchemaForRule(
  fieldName: string,
  rule: ValidationRule,
  options: ValidationOptions,
  defaultRequired: boolean = false
): ZodTypeAny {
  let schema: ZodTypeAny;

  if (rule.date) {
    schema = z.coerce.date({
      // zod rejects combining `invalid_type_error` with a custom
      // `errorMap` in the same call — only use one.
      invalid_type_error: `${fieldName} must be a valid date`,
    });

    if (rule.minDate !== undefined) {
      const min = new Date(rule.minDate);
      schema = (schema as z.ZodDate).min(min, {
        message: `${fieldName} must be after ${min.toLocaleDateString()}`
      });
    }

    if (rule.maxDate !== undefined) {
      const max = new Date(rule.maxDate);
      schema = (schema as z.ZodDate).max(max, {
        message: `${fieldName} must be before ${max.toLocaleDateString()}`
      });
    }
  } else if (rule.string) {
    schema = z.string();

    if (rule.email) {
      schema = (schema as z.ZodString).email({
        message: `${fieldName} must be a valid email address`
      });
    }

    if (rule.uuid) {
      schema = (schema as z.ZodString).uuid({
        message: `${fieldName} must be a valid UUID`
      });
    }

    if (rule.url) {
      schema = (schema as z.ZodString).url({
        message: `${fieldName} must be a valid URL`
      });
    }

    if (rule.trim) {
      schema = (schema as z.ZodString).trim();
    }
    if (rule.lowercase) {
      schema = (schema as z.ZodString).toLowerCase();
    }
    if (rule.uppercase) {
      schema = (schema as z.ZodString).toUpperCase();
    }

    if (rule.min !== undefined) {
      schema = (schema as z.ZodString).min(rule.min, {
        message: `${fieldName} must be at least ${rule.min} characters`
      });
    }

    if (rule.max !== undefined) {
      schema = (schema as z.ZodString).max(rule.max, {
        message: `${fieldName} must be at most ${rule.max} characters`
      });
    }

    if (rule.regex) {
      schema = (schema as z.ZodString).regex(rule.regex, {
        message: `${fieldName} format is invalid`
      });
    }

    if (rule.pattern) {
      try {
        schema = (schema as z.ZodString).regex(new RegExp(rule.pattern), {
          message: `${fieldName} format is invalid`
        });
      } catch {
        console.error(`[VALIDATION] Invalid pattern for field "${fieldName}": ${rule.pattern}`);
      }
    }
  } else if (rule.number) {
    schema = (options.strictTypes || !options.coerceNumbers)
      ? z.number()
      : z.coerce.number();

    if (rule.min !== undefined) {
      schema = (schema as z.ZodNumber).min(rule.min, {
        message: `${fieldName} must be at least ${rule.min}`
      });
    }

    if (rule.max !== undefined) {
      schema = (schema as z.ZodNumber).max(rule.max, {
        message: `${fieldName} must be at most ${rule.max}`
      });
    }
  } else if (rule.boolean) {
    if (options.strictTypes || !options.coerceBooleans) {
      schema = z.boolean();
    } else {
      // Not `z.coerce.boolean()` — that treats any non-empty string,
      // including the string "false", as `true`.
      schema = z.preprocess((value) => {
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') return true;
          if (value.toLowerCase() === 'false') return false;
        }
        return value;
      }, z.boolean());
    }
  } else if (rule.array) {
    const itemSchema = rule.arrayOf
      ? createZodSchemaForRule(`${fieldName}[]`, rule.arrayOf, options, true)
      : z.any();

    schema = z.array(itemSchema);

    if (rule.minItems !== undefined) {
      schema = (schema as z.ZodArray<any>).min(rule.minItems, {
        message: `${fieldName} must contain at least ${rule.minItems} item(s)`
      });
    }

    if (rule.maxItems !== undefined) {
      schema = (schema as z.ZodArray<any>).max(rule.maxItems, {
        message: `${fieldName} must contain at most ${rule.maxItems} item(s)`
      });
    }
  } else if (rule.object) {
    if (rule.shape) {
      const shapeObject: Record<string, ZodTypeAny> = {};
      for (const [key, nestedRule] of Object.entries(rule.shape)) {
        const validationRule = typeof nestedRule === 'string'
          ? parseRuleString(nestedRule)
          : nestedRule;
        shapeObject[key] = createZodSchemaForRule(`${fieldName}.${key}`, validationRule, options);
      }
      // `.strict()` rejects (rather than silently stripping, which is
      // Zod's default) any key on the input that isn't declared in
      // `rule.shape`. Previously `rule.strict` was never read here, so a
      // shaped object field could never actually reject unknown keys —
      // it would just drop them from the output without telling the
      // caller, regardless of what `strict` was set to.
      schema = rule.strict ? z.object(shapeObject).strict() : z.object(shapeObject);
    } else {
      // No `shape` means this is a free-form object field (`object:
      // true` with no declared keys) — `z.record(...)` is inherently
      // open to arbitrary keys by design, so "reject unknown keys" isn't
      // a meaningful distinction here. `strict` only narrows the
      // permitted *value* type (unknown vs any); it does not, and can't,
      // reject keys the way it does for a shaped object above.
      schema = rule.strict ? z.record(z.unknown()) : z.record(z.any());
    }
  } else {
    schema = z.any();
  }

  // Enum membership as a refinement (not `z.enum(...)`, which would
  // replace — and discard — any min/max/regex/date constraints already
  // built above, and only supports string values).
  if (rule.enum && rule.enum.length > 0) {
    const allowedValues = rule.enum;
    schema = schema.refine(
      (value: any) => (allowedValues as readonly unknown[]).includes(value),
      { message: `${fieldName} must be one of: ${allowedValues.join(', ')}` }
    );
  }

  if (rule.custom) {
    // IMPORTANT: `CustomValidator` returns `true` (valid), `false`
    // (invalid, use the default/customMessage), or a `string` (invalid,
    // use that string as the message) — see `customValidators.password`
    // etc. Wiring that straight into `z.refine(fn, { message })` is
    // broken: `.refine()` treats *any* truthy return value — including a
    // non-empty error-message string, and even the literal string
    // "false" — as success, and only `false` counts as a failure. Using
    // `superRefine` lets us interpret the three return shapes correctly
    // and attach the validator's own message when it returns one.
    const customFn = rule.custom;
    const defaultMessage = rule.customMessage || `${fieldName} validation failed`;
    schema = schema.superRefine(async (value: any, ctx: z.RefinementCtx) => {
      const result = await customFn(value, { field: fieldName, data: value });
      if (result === true) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: typeof result === 'string' ? result : defaultMessage,
      });
    });
  }

  const isRequired = rule.required !== undefined ? rule.required : defaultRequired;
  if (!isRequired) {
    schema = schema.optional().nullable();
  }

  return schema;
}

function formatZodError(error: ZodError): Array<{ field: string; message: string; code?: string; path?: string[] }> {
  return error.issues.map((err) => {
    const field = err.path.length > 0 ? err.path.join('.') : 'unknown';
    let message = err.message;

    if (err.code === 'invalid_type') {
      const expected = (err as any).expected;
      const received = (err as any).received;
      message = `${field} must be a ${expected}, received ${received}`;
    } else if (err.code === 'too_small') {
      const minimum = (err as any).minimum;
      const type = (err as any).type;

      if (type === 'string') {
        message = `${field} must be at least ${minimum} characters`;
      } else if (type === 'number') {
        message = `${field} must be greater than or equal to ${minimum}`;
      } else if (type === 'array') {
        message = `${field} must contain at least ${minimum} item(s)`;
      } else if (type === 'date') {
        message = err.message;
      }
    } else if (err.code === 'too_big') {
      const maximum = (err as any).maximum;
      const type = (err as any).type;

      if (type === 'string') {
        message = `${field} must be at most ${maximum} characters`;
      } else if (type === 'number') {
        message = `${field} must be less than or equal to ${maximum}`;
      } else if (type === 'array') {
        message = `${field} must contain at most ${maximum} item(s)`;
      } else if (type === 'date') {
        message = err.message;
      }
    } else if (err.code === 'invalid_string') {
      const validation = (err as any).validation;

      if (validation === 'email') {
        message = `${field} must be a valid email address`;
      } else if (validation === 'uuid') {
        message = `${field} must be a valid UUID`;
      } else if (validation === 'url') {
        message = `${field} must be a valid URL`;
      } else if (validation === 'regex') {
        message = `${field} format is invalid`;
      }
    } else if (err.code === 'invalid_enum_value') {
      const opts = (err as any).options;
      message = `${field} must be one of: ${opts.join(', ')}`;
    } else if (err.code === 'custom') {
      // Enum membership and `custom` validators both surface as `custom`
      // issues; `err.message` already carries the right message (either
      // the validator's own string, or the field's customMessage/default)
      // set via `ctx.addIssue({ message })` above.
      message = err.message;
    }

    return {
      field,
      message,
      code: err.code,
      path: err.path.map(p => String(p)),
    };
  });
}

export function clearValidationCache(): void {
  validationSchemaCache.clear();
}

export function getValidationCacheSize(): number {
  return validationSchemaCache.size;
}