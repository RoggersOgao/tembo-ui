// utils/validation.util.ts

import { logger } from '@repo/logger';
import { Request } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

/**
 * Rule definition for field validation
 */
export interface ValidationRule {
  required?: boolean;
  string?: boolean;
  number?: boolean;
  boolean?: boolean;
  array?: boolean;
  object?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  email?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  regex?: RegExp;
  enum?: any[];
  in?: any[]; // Alias for enum
  url?: boolean;
  date?: boolean;
  nullable?: boolean;
  custom?: (value: any) => boolean | string;
}

/**
 * Validation rules definition
 */
export type ValidationRuleSet =
  | string
  | ValidationRule
  | { [key: string]: ValidationRuleSet };

export interface ValidationRules {
  [field: string]: ValidationRuleSet;
}


/**
 * Recursively build a z.object() schema for nested rule objects
 */
function createNestedObjectSchema(parentField: string, rules: ValidationRules): z.ZodTypeAny {
  const nestedSchemaObject: any = {};

  for (const [field, ruleSet] of Object.entries(rules)) {
    const fullFieldName = `${parentField}.${field}`;
    let validationRule: ValidationRule;

    if (typeof ruleSet === 'string') {
      validationRule = parseRuleString(ruleSet);
    } else if (
      'required' in ruleSet ||
      'string' in ruleSet ||
      'number' in ruleSet ||
      'boolean' in ruleSet ||
      'array' in ruleSet ||
      'object' in ruleSet
    ) {
      validationRule = ruleSet as ValidationRule;
    } else {
      // Another level of nesting — recurse
      nestedSchemaObject[field] = createNestedObjectSchema(fullFieldName, ruleSet as ValidationRules);
      continue;
    }

    nestedSchemaObject[field] = createZodSchemaForRule(fullFieldName, validationRule);
  }

  return z.object(nestedSchemaObject).passthrough();
}
/**
 * Cache for compiled validation schemas
 */
const validationSchemaCache = new Map<string, ZodSchema>();

/**
 * Parse validation rule string into ValidationRule object
 */
function parseRuleString(ruleString: string): ValidationRule {
  const rules: ValidationRule = {};
  const ruleParts = ruleString.split('|');

  logger.debug('Parsing rule string', {
    ruleString,
    rulePartsCount: ruleParts.length
  });

  for (const part of ruleParts) {
    const trimmedPart = part.trim();

    if (trimmedPart === 'required') {
      rules.required = true;
    } else if (trimmedPart === 'optional') {
      rules.required = false;
    } else if (trimmedPart === 'nullable') {
      rules.nullable = true;
    } else if (trimmedPart === 'string') {
      rules.string = true;
    } else if (trimmedPart === 'number') {
      rules.number = true;
    } else if (trimmedPart === 'integer') {
      rules.integer = true;
      rules.number = true; // Integer implies number
    } else if (trimmedPart === 'boolean') {
      rules.boolean = true;
    } else if (trimmedPart === 'array') {
      rules.array = true;
    } else if (trimmedPart === 'object') {
      rules.object = true;
    } else if (trimmedPart === 'email') {
      rules.email = true;
      if (!rules.string) {
        rules.string = true;
      }
    } else if (trimmedPart === 'uuid') {
      rules.uuid = true;
      if (!rules.string) {
        rules.string = true;
      }
    } else if (trimmedPart === 'cuid') {
      rules.cuid = true;
      if (!rules.string) {
        rules.string = true;
      }
    } else if (trimmedPart === 'url') {
      rules.url = true;
      if (!rules.string) {
        rules.string = true;
      }
    } else if (trimmedPart === 'date') {
      rules.date = true;
      if (!rules.string) {
        rules.string = true;
      }
    } else if (trimmedPart.startsWith('min:')) {
      const value = trimmedPart.split(':')[1];
      rules.min = parseFloat(value);
    } else if (trimmedPart.startsWith('max:')) {
      const value = trimmedPart.split(':')[1];
      rules.max = parseFloat(value);
    } else if (trimmedPart.startsWith('regex:')) {
      const regexPattern = trimmedPart.substring(6); // Remove 'regex:'
      try {
        rules.regex = new RegExp(regexPattern);
      } catch (e) {
        logger.error('Invalid regex pattern', { pattern: regexPattern });
      }
    } else if (trimmedPart.startsWith('enum:') || trimmedPart.startsWith('in:')) {
      const values = trimmedPart.substring(trimmedPart.indexOf(':') + 1).split(',').map((v: string) => v.trim());
      rules.enum = values;
      rules.in = values; // Support both enum and in
    } else if (trimmedPart === 'ip') {
      rules.regex = /^(\d{1,3}\.){3}\d{1,3}$|^([a-fA-F0-9:]+)$/; // basic IPv4/v6
    }
  }

  logger.debug('Parsed rules', {
    result: rules
  });

  return rules;
}

/**
 * Convert string/number query parameters to correct types
 */
function coerceQueryValue(value: any, rule: ValidationRule): any {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  // Handle boolean conversion
  if (rule.boolean) {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return value;
  }

  // Handle number conversion (including integer)
  if (rule.number || rule.integer) {
    if (typeof value === 'string') {
      const num = rule.integer ? parseInt(value, 10) : parseFloat(value);
      return isNaN(num) ? value : num;
    }
    return value;
  }

  // Handle array conversion
  if (rule.array && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map(v => v.trim());
    }
  }

  return value;
}

/**
 * Preprocess data based on validation rules (for query params)
 */
function preprocessData(data: any, rules: ValidationRules, isQuery: boolean = false): any {
  if (!isQuery) return data;

  const processed: any = {};

  for (const [key, value] of Object.entries(data)) {
    const ruleSet = rules[key];
    if (!ruleSet) {
      processed[key] = value;
      continue;
    }

    const rule = typeof ruleSet === 'string' ? parseRuleString(ruleSet) : ruleSet;
    processed[key] = coerceQueryValue(value, rule as ValidationRule);
  }

  return processed;
}

/**
 * Convert ValidationRule to Zod schema
 */
function createZodSchemaForRule(fieldName: string, rule: ValidationRule): any {
  let schema: any;
  const isRequired = rule.required ?? false;
  const isNullable = rule.nullable ?? false;

  logger.debug('Creating Zod schema for field', {
    fieldName,
    rule
  });

  // Handle type validation - START WITH BASE TYPE
  if (rule.string) {
    schema = z.string({
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} must be a string`
    });
  } else if (rule.number) {
    schema = z.number({
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} must be a number`
    });
  } else if (rule.boolean) {
    schema = z.boolean({
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} must be a boolean`
    });
  } else if (rule.array) {
    schema = z.array(z.any(), {
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} must be an array`
    });
  } else if (rule.object) {
    schema = z.object({}, {
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} must be an object`
    }).passthrough();
  } else {
    // Default to any for fields without explicit type
    schema = z.any();
  }

  // Apply integer validation for numbers
  if (rule.integer && rule.number) {
    schema = schema.int({
      message: `${fieldName} must be an integer`
    });
  }

  // Apply string-specific validations
  if (rule.string) {
    if (rule.min !== undefined) {
      schema = schema.min(rule.min, {
        message: `${fieldName} must be at least ${rule.min} characters`
      });
    }
    if (rule.max !== undefined) {
      schema = schema.max(rule.max, {
        message: `${fieldName} must be at most ${rule.max} characters`
      });
    }
  }

  // Apply number-specific validations
  if (rule.number) {
    if (rule.min !== undefined) {
      schema = schema.min(rule.min, {
        message: `${fieldName} must be at least ${rule.min}`
      });
    }
    if (rule.max !== undefined) {
      schema = schema.max(rule.max, {
        message: `${fieldName} must be at most ${rule.max}`
      });
    }
  }

  // Apply email validation
  if (rule.email) {
    schema = schema.email({
      message: `${fieldName} must be a valid email address`
    });
  }

  // Apply UUID validation
  if (rule.uuid) {
    schema = schema.uuid({
      message: `${fieldName} must be a valid UUID`
    });
  }

  // Apply CUID validation
  if (rule.cuid) {
    schema = schema.cuid({
      message: `${fieldName} must be a valid CUID`
    });
  }

  // Apply URL validation
  if (rule.url) {
    schema = schema.url({
      message: `${fieldName} must be a valid URL`
    });
  }

  // Apply date validation
  if (rule.date) {
    schema = schema.refine(
      (val: string) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: `${fieldName} must be a valid date` }
    );
  }

  // Apply regex validation
  if (rule.regex) {
    schema = schema.regex(rule.regex, {
      message: `${fieldName} has an invalid format`
    });
  }

  // Apply enum/in validation
  if (rule.enum || rule.in) {
    const enumValues = rule.enum || rule.in!;
    // Chain onto existing schema instead of replacing it
    schema = schema.refine(
      (val: any) => enumValues.includes(val),
      { message: `${fieldName} must be one of: ${enumValues.join(', ')}` }
    );
  }

  // Apply custom validation
  if (rule.custom) {
    schema = schema.refine(
      (val: any) => {
        const result = rule.custom!(val);
        return result === true;
      },
      {
        message: (val: any) => {
          const result = rule.custom!(val);
          return typeof result === 'string' ? result : `${fieldName} validation failed`;
        }
      }
    );
  }
  // Handle optional/nullable
  if (!isRequired && isNullable) {
    // For optional and nullable, use nullish() which accepts undefined and null
    schema = schema.nullish();
  } else if (!isRequired) {
    // For optional only
    schema = schema.optional();
  } else if (isNullable) {
    // For required but nullable
    schema = schema.nullable();
  }
  return schema;
}

/**
 * Create Zod schema from validation rules
 */
function createValidationSchema(rules: ValidationRules): ZodSchema {
  const cacheKey = JSON.stringify(rules);

  if (validationSchemaCache.has(cacheKey)) {
    logger.debug('Using cached validation schema');
    return validationSchemaCache.get(cacheKey)!;
  }

  logger.debug('Creating new validation schema', {
    fieldsCount: Object.keys(rules).length,
    fields: Object.keys(rules)
  });

  const schemaObject: any = {};

  for (const [field, ruleSet] of Object.entries(rules)) {
    let validationRule: ValidationRule;

    if (typeof ruleSet === 'string') {
      validationRule = parseRuleString(ruleSet);
    } else if ('required' in ruleSet || 'string' in ruleSet || 'number' in ruleSet) {
      validationRule = ruleSet as ValidationRule;
    } else {
      // Recursive nested object validation
      schemaObject[field] = createNestedObjectSchema(field, ruleSet as ValidationRules);
      continue; // Skip the createZodSchemaForRule call below
    }

    try {
      schemaObject[field] = createZodSchemaForRule(field, validationRule);
    } catch (error) {
      logger.error('Failed to create schema for field', {
        field,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  const schema = z.object(schemaObject).passthrough();
  validationSchemaCache.set(cacheKey, schema);

  logger.debug('Validation schema created and cached');

  return schema;
}

/**
 * Format Zod error to ValidationError
 */
function formatZodError(error: ZodError): ValidationError[] {
  logger.debug('Formatting Zod errors', { errorsCount: error.errors.length });

  return error.errors.map((err) => {
    const field = err.path.join('.') || 'unknown';
    let message = err.message;

    // Customize messages for specific error codes
    if (err.code === 'invalid_type') {
      if (err.received === 'undefined') {
        message = `${field} is required`;
      } else {
        message = `${field} must be a ${err.expected}, received ${err.received}`;
      }
    } else if (err.code === 'too_small') {
      if (err.type === 'string') {
        message = `${field} must be at least ${err.minimum} characters`;
      } else if (err.type === 'number') {
        message = `${field} must be at least ${err.minimum}`;
      } else if (err.type === 'array') {
        message = `${field} must contain at least ${err.minimum} items`;
      }
    } else if (err.code === 'too_big') {
      if (err.type === 'string') {
        message = `${field} must be at most ${err.maximum} characters`;
      } else if (err.type === 'number') {
        message = `${field} must be at most ${err.maximum}`;
      } else if (err.type === 'array') {
        message = `${field} must contain at most ${err.maximum} items`;
      }
    } else if (err.code === 'invalid_string') {
      if (err.validation === 'email') {
        message = `${field} must be a valid email address`;
      } else if (err.validation === 'url') {
        message = `${field} must be a valid URL`;
      } else if (err.validation === 'uuid') {
        message = `${field} must be a valid UUID`;
      } else if (err.validation === 'cuid') {
        message = `${field} must be a valid CUID`;
      } else if (err.validation === 'regex') {
        message = `${field} has an invalid format`;
      }
    } else if (err.code === 'invalid_enum_value') {
      const options = (err as any).options || [];
      message = `${field} must be one of: ${options.join(', ')}`;
    }

    return {
      field,
      message,
      code: err.code
    };
  });
}

/**
 * Main validation function
 */
export async function validateRequest(
  req: Request,
  rules: ValidationRules
): Promise<ValidationResult> {
  logger.debug('Starting request validation', {
    rulesCount: Object.keys(rules).length
  });

  try {
    const data = {
      ...req.body,
      ...req.query,
      ...req.params
    };

    // Preprocess query data (type coercion)
    const processedData = preprocessData(data, rules, true);

    logger.debug('Validation input', {
      original: data,
      processed: processedData
    });

    const schema = createValidationSchema(rules);
    const validatedData = await schema.parseAsync(processedData);

    logger.debug('Validation successful');

    return {
      isValid: true,
      errors: [],
      data: validatedData
    };
  } catch (error) {
    if (error instanceof ZodError) {
      logger.debug('Validation failed', {
        errorsCount: error.errors.length,
        errors: error.errors
      });
      return {
        isValid: false,
        errors: formatZodError(error)
      };
    }

    logger.error('Validation system error', {
      error: error instanceof Error ? error.message : String(error)
    });

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

/**
 * Validate request body only
 */
export async function validateRequestBody(
  req: Request,
  rules: ValidationRules
): Promise<ValidationResult> {
  logger.debug('Starting body validation');

  try {
    const data = req.body || {};
    const schema = createValidationSchema(rules);
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

    logger.error('Body validation error', {
      error: error instanceof Error ? error.message : String(error)
    });

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

/**
 * Validate request query only
 */
export async function validateRequestQuery(
  req: Request,
  rules: ValidationRules
): Promise<ValidationResult> {
  logger.debug('Starting query validation', {
    query: req.query,
    rules: Object.keys(rules)
  });

  try {
    const data = req.query || {};

    // Preprocess query parameters (convert strings to proper types)
    const processedData = preprocessData(data, rules, true);

    logger.debug('Query data preprocessed', {
      original: data,
      processed: processedData
    });

    const schema = createValidationSchema(rules);
    const validatedData = await schema.parseAsync(processedData);

    logger.debug('Query validation successful');

    return {
      isValid: true,
      errors: [],
      data: validatedData
    };
  } catch (error) {
    if (error instanceof ZodError) {
      logger.debug('Query validation failed', {
        errors: error.errors
      });
      return {
        isValid: false,
        errors: formatZodError(error)
      };
    }

    logger.error('Query validation error', {
      error: error instanceof Error ? error.message : String(error)
    });

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

/**
 * Validate request params only
 */
export async function validateRequestParams(
  req: Request,
  rules: ValidationRules
): Promise<ValidationResult> {
  logger.debug('Starting params validation');

  try {
    const data = req.params || {};
    const schema = createValidationSchema(rules);
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

    logger.error('Params validation error', {
      error: error instanceof Error ? error.message : String(error)
    });

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

/**
 * Sanitize input data
 */
export function sanitizeInput<T>(data: T): T {
  if (typeof data === 'string') {
    return data.trim() as any;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item)) as any;
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Custom validation rules
 */
export const customValidators = {
  password: (minLength: number = 8): ValidationRule => ({
    required: true,
    string: true,
    min: minLength,
    custom: (value: string) => {
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

      if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
      if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
      if (!hasNumbers) return 'Password must contain at least one number';
      if (!hasSpecialChar) return 'Password must contain at least one special character';
      return true;
    }
  }),

  phone: (): ValidationRule => ({
    required: false,
    string: true,
    regex: /^[\+]?[1-9][\d]{0,15}$/,
    custom: (value: string) => {
      if (!value) return true;
      const cleaned = value.replace(/[^\d+]/g, '');
      return cleaned.length >= 10 && cleaned.length <= 15 || 'Phone number must be between 10 and 15 digits';
    }
  }),

  url: (): ValidationRule => ({
    required: false,
    url: true
  }),

  date: (): ValidationRule => ({
    required: false,
    date: true
  }),

  positiveNumber: (): ValidationRule => ({
    required: false,
    number: true,
    min: 0
  }),

  integer: (): ValidationRule => ({
    required: false,
    integer: true,
    number: true
  }),

  minItems: (min: number): ValidationRule => ({
    required: false,
    array: true,
    custom: (value: any[]) => {
      if (!value) return true;
      return value.length >= min || `Must contain at least ${min} items`;
    }
  }),

  maxItems: (max: number): ValidationRule => ({
    required: false,
    array: true,
    custom: (value: any[]) => {
      if (!value) return true;
      return value.length <= max || `Must contain at most ${max} items`;
    }
  })
};

/**
 * Predefined validation schemas
 */
export const validationSchemas = {
  uuid: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    uuid: true
  }),

  cuid: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    cuid: true
  }),

  email: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    email: true,
    max: 255
  }),

  name: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    min: 2,
    max: 100,
    regex: /^[a-zA-Z\s'-]+$/
  }),

  slug: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    min: 2,
    max: 100,
    regex: /^[a-z0-9-]+$/
  }),

  description: (required: boolean = false, maxLength: number = 500): ValidationRule => ({
    required,
    string: true,
    max: maxLength
  }),

  page: (): ValidationRule => ({
    required: false,
    integer: true,
    number: true,
    min: 1
  }),

  limit: (max: number = 100): ValidationRule => ({
    required: false,
    integer: true,
    number: true,
    min: 1,
    max
  }),

  sortOrder: (): ValidationRule => ({
    required: false,
    string: true,
    in: ['asc', 'desc']
  }),

  boolean: (required: boolean = false): ValidationRule => ({
    required,
    boolean: true
  })
};

/**
 * Helper to create validation rules with common patterns
 */
export function createValidationRules(
  fields: Record<string, ValidationRule | string>
): ValidationRules {
  return fields;
}

/**
 * Validation middleware
 */
export function validate(
  rules: ValidationRules,
  options: {
    source?: 'body' | 'query' | 'params' | 'all';
    sanitize?: boolean;
  } = {}
) {
  return async (req: Request, res: any, next: any) => {
    try {
      let validationResult: ValidationResult;

      switch (options.source) {
        case 'body':
          validationResult = await validateRequestBody(req, rules);
          break;
        case 'query':
          validationResult = await validateRequestQuery(req, rules);
          break;
        case 'params':
          validationResult = await validateRequestParams(req, rules);
          break;
        default:
          validationResult = await validateRequest(req, rules);
      }

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
          timestamp: new Date().toISOString()
        });
      }

      if (options.sanitize && validationResult.data) {
        req.validatedData = sanitizeInput(validationResult.data);
      } else {
        req.validatedData = validationResult.data;
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error instanceof Error ? error.message : String(error)
      });

      return res.status(500).json({
        success: false,
        message: 'Validation error',
        errors: [{
          field: 'system',
          message: 'Internal validation error',
          code: 'INTERNAL_ERROR'
        }],
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Helper to create validation error response
 */
export function createValidationErrorResponse(errors: ValidationError[]) {
  return {
    success: false,
    message: 'Validation failed',
    errors,
    timestamp: new Date().toISOString()
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
    }
  }
}

export default {
  validateRequest,
  validateRequestBody,
  validateRequestQuery,
  validateRequestParams,
  sanitizeInput,
  customValidators,
  validationSchemas,
  createValidationRules,
  validate,
  createValidationErrorResponse
};