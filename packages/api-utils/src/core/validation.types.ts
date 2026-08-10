export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: any;
  path?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

export type CustomValidator = (
  value: any,
  context?: { field: string; data: any }
) => boolean | string | Promise<boolean | string>;

export interface ConditionalValidation {
  field: string;
  is: any | ((value: any) => boolean);
  then: ValidationRule;
  otherwise?: ValidationRule;
}

export interface ValidationRule {
  // Type validations
  required?: boolean;
  string?: boolean;
  number?: boolean;
  boolean?: boolean;
  array?: boolean;
  object?: boolean;
  date?: boolean;

  // String validations
  email?: boolean;
  uuid?: boolean;
  url?: boolean;
  regex?: RegExp;
  pattern?: string;

  // Numeric validations
  min?: number;
  max?: number;

  // Enum validation
  enum?: readonly (string | number)[];

  // Custom validation
  custom?: CustomValidator;
  customMessage?: string;

  // Array validations
  arrayOf?: ValidationRule;
  minItems?: number;
  maxItems?: number;

  // Object validations
  shape?: Record<string, ValidationRule>;
  strict?: boolean;

  // Additional string validations
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;

  // Date validations
  minDate?: Date | string;
  maxDate?: Date | string;

  // Conditional validations
  when?: ConditionalValidation;
}

export type ValidationRules = Record<string, string | ValidationRule>;

export interface ValidationOptions {
  strictTypes?: boolean;
  coerceBooleans?: boolean;
  coerceNumbers?: boolean;
  cacheSchemas?: boolean;
  cacheSize?: number;
}

export const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  strictTypes: false,
  coerceBooleans: true,
  coerceNumbers: true,
  cacheSchemas: true,
  cacheSize: 1000,
};

export const customValidators = {
  password: (minLength: number = 8): ValidationRule => ({
    required: true,
    string: true,
    min: minLength,
    custom: (value: any): boolean | string => {
      if (typeof value !== 'string') {
        return 'Password must be a string';
      }

      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

      if (!hasUpperCase) {
        return 'Password must contain at least one uppercase letter';
      }
      if (!hasLowerCase) {
        return 'Password must contain at least one lowercase letter';
      }
      if (!hasNumbers) {
        return 'Password must contain at least one number';
      }
      if (!hasSpecialChar) {
        return 'Password must contain at least one special character';
      }

      return true;
    }
  }),

  phone: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;
      if (!value && required) return 'Phone number is required';

      if (typeof value !== 'string') {
        return 'Phone number must be a string';
      }

      const cleaned = value.replace(/[^\d+]/g, '');
      const isValidLength = cleaned.length >= 10 && cleaned.length <= 15;

      if (!isValidLength) {
        return 'Phone number must be between 10 and 15 digits';
      }

      return true;
    }
  }),

  url: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;
      if (!value && required) return 'URL is required';

      if (typeof value !== 'string') {
        return 'URL must be a string';
      }

      try {
        new URL(value);
        return true;
      } catch {
        return 'Invalid URL format';
      }
    }
  }),

  username: (minLength: number = 3, maxLength: number = 30): ValidationRule => ({
    required: true,
    string: true,
    min: minLength,
    max: maxLength,
    regex: /^[a-zA-Z0-9_-]+$/,
    customMessage: 'Username can only contain letters, numbers, hyphens, and underscores'
  }),

  alphanumeric: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    regex: /^[a-zA-Z0-9]+$/,
    customMessage: 'Field must contain only letters and numbers'
  }),

  postalCode: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;
      if (!value && required) return 'Postal code is required';

      if (typeof value !== 'string') {
        return 'Postal code must be a string';
      }

      const patterns = [
        /^\d{5}(-\d{4})?$/,
        /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
        /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
      ];

      const isValid = patterns.some(pattern => pattern.test(value));

      if (!isValid) {
        return 'Invalid postal code format';
      }

      return true;
    }
  }),

  creditCard: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;
      if (!value && required) return 'Credit card number is required';

      if (typeof value !== 'string') {
        return 'Credit card number must be a string';
      }

      const cleaned = value.replace(/\s|-/g, '');

      if (!/^\d{13,19}$/.test(cleaned)) {
        return 'Credit card number must be between 13 and 19 digits';
      }

      let sum = 0;
      let isEven = false;

      for (let i = cleaned.length - 1; i >= 0; i--) {
        const char = cleaned[i];
        if (char === undefined) continue;

        let digit = parseInt(char, 10);

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      if (sum % 10 !== 0) {
        return 'Invalid credit card number';
      }

      return true;
    }
  }),

  dateRange: (minDate?: Date | string, maxDate?: Date | string): ValidationRule => ({
    required: false,
    date: true,
    minDate,
    maxDate,
    custom: (value: any): boolean | string => {
      if (!value) return true;

      const date = new Date(value);

      if (isNaN(date.getTime())) {
        return 'Invalid date format';
      }

      if (minDate) {
        const min = new Date(minDate);
        if (date < min) {
          return `Date must be after ${min.toLocaleDateString()}`;
        }
      }

      if (maxDate) {
        const max = new Date(maxDate);
        if (date > max) {
          return `Date must be before ${max.toLocaleDateString()}`;
        }
      }

      return true;
    }
  }),
};

export const validationSchemas = {
  uuid: (required: boolean = true): ValidationRule => ({
    required,
    uuid: true
  }),

  email: (required: boolean = true): ValidationRule => ({
    required,
    email: true,
    max: 255,
    lowercase: true,
    trim: true
  }),

  name: (required: boolean = true, minLength: number = 2, maxLength: number = 100): ValidationRule => ({
    required,
    string: true,
    min: minLength,
    max: maxLength,
    trim: true,
    regex: /^[a-zA-Z\s'-]+$/,
    customMessage: 'Name can only contain letters, spaces, hyphens, and apostrophes'
  }),

  page: (_defaultValue: number = 1): ValidationRule => ({
    required: false,
    number: true,
    min: 1,
    custom: (value: any): boolean => {
      if (value === undefined || value === null) return true;
      return Number.isInteger(Number(value));
    }
  }),

  limit: (_defaultLimit: number = 20, maxLimit: number = 100): ValidationRule => ({
    required: false,
    number: true,
    min: 1,
    max: maxLimit,
    custom: (value: any): boolean => {
      if (value === undefined || value === null) return true;
      return Number.isInteger(Number(value));
    }
  }),

  sortOrder: (): ValidationRule => ({
    required: false,
    string: true,
    enum: ['asc', 'desc', 'ASC', 'DESC'],
    lowercase: true
  }),

  id: (required: boolean = true): ValidationRule => ({
    required,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;

      if (typeof value === 'number' && value > 0) return true;
      if (typeof value === 'string') {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          return true;
        }
        if (/^\d+$/.test(value) && parseInt(value, 10) > 0) {
          return true;
        }
      }

      return 'Invalid ID format';
    }
  }),

  searchQuery: (minLength: number = 1, maxLength: number = 200): ValidationRule => ({
    required: false,
    string: true,
    min: minLength,
    max: maxLength,
    trim: true
  }),

  slug: (required: boolean = true): ValidationRule => ({
    required,
    string: true,
    regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    min: 3,
    max: 100,
    lowercase: true,
    customMessage: 'Slug must be lowercase letters, numbers, and hyphens only'
  }),

  hexColor: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    regex: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    customMessage: 'Invalid hex color format (e.g., #FF5733 or #F57)'
  }),

  json: (required: boolean = false): ValidationRule => ({
    required,
    string: true,
    custom: (value: any): boolean | string => {
      if (!value && !required) return true;

      try {
        JSON.parse(value);
        return true;
      } catch {
        return 'Invalid JSON format';
      }
    }
  }),
};
