# @your-org/api-utils — Complete Documentation

A framework-agnostic core (response envelopes + a Zod-backed validation engine) with thin, optional integrations for Express (`server`), the browser/Node (`client`), and response-shaping helpers (`utils`).

```
src/
  core/       ApiResponse, ErrorCode, ValidationRule types — no external deps
  validation/ Zod-backed validation engine built on core/validation.types
  server/     Express middleware + error handling
  client/     Fetch-based ApiClient (frontend or server-to-server)
  utils/      ResponseHandler — Express response shortcuts
  index.ts    Everything re-exported from one place
```

Everything is available from the root package, or from focused subpaths (`/core`, `/validation`, `/server`, `/client`, `/utils`) if you want to keep a browser bundle free of Express types.

---

## 1. Installation & Import Style

```ts
// Root import — pulls in everything (core + validation + server + client + utils)
import {
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
  ApiClient,
  validateRequest,
  apiResponseMiddleware,
  ResponseHandler,
} from '@your-org/api-utils';
```

If you're bundling for the browser and don't want Express types pulled in, import from the subpaths instead:

```ts
// Frontend bundle — no Express
import { ApiClient } from '@your-org/api-utils/client';
import { ErrorCode, isApiResponse } from '@your-org/api-utils/core';

// Backend
import { apiResponseMiddleware, apiErrorMiddleware, validateRequestRules } from '@your-org/api-utils/server';
import { validateRequest, customValidators, validationSchemas } from '@your-org/api-utils/validation';
```

---

## 2. Core Response Envelope

Every response — success or failure — is shaped as an `ApiResponse<T>`:

```ts
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;          // ISO string, set automatically
  errors?: ApiError[];
  metadata?: ApiMetadata;     // userId, duration, requestId, source, ...(open-ended)
  pagination?: PaginationInfo;
  correlationId?: string;
  version?: string;
  duration?: number;
}

interface ApiError {
  code: string;
  message: string;
  field?: string;    // which input field this error is about
  details?: string;
  stack?: string;    // only ever populated when you opt in (dev mode)
  path?: string[];   // e.g. ['body', 'age'] for nested validation errors
}
```

`PaginationInfo`:

```ts
interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
  hasMore: boolean; next?: string; previous?: string;
}
```

### `ErrorCode` and the HTTP status map

`ErrorCode` is a fixed enum (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `DATABASE_ERROR`, `CACHE_ERROR`, `INSUFFICIENT_PERMISSIONS`, `RESOURCE_LOCKED`, `INVALID_STATE`, `DUPLICATE_ENTRY`, `EXTERNAL_SERVICE_ERROR`, `PAYMENT_FAILED`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `UPLOAD_FAILED`). `HttpStatusMap` maps every one of these to its HTTP status (e.g. `CONFLICT → 409`, `RESOURCE_LOCKED → 423`, `PAYMENT_FAILED → 402`). Use `getStatusCodeFromResponse()` rather than hardcoding a status when you already have an `ApiResponse`.

---

## 3. Building Responses

### 3.1 `createSuccessResponse`

```ts
function createSuccessResponse<T>(
  data: T,
  message?: string,                // default: 'Success'
  metadata?: ApiMetadata,
  pagination?: PaginationInfo,
  options?: { duration?: number; correlationId?: string; version?: string }
): ApiResponse<T>;
```

```ts
const res = createSuccessResponse({ id: 1, name: 'Ada' }, 'User loaded');
// { success: true, message: 'User loaded', data: {...}, timestamp: '...' }
```

### 3.2 `createErrorResponse` (overloaded)

Two call shapes:

```ts
// (A) Single ErrorCode + options — message defaults from getDefaultErrorMessage(code)
createErrorResponse(ErrorCode.NOT_FOUND, { message: 'User not found' });

// (B) An array of ApiError — for multi-field errors (e.g. validation)
createErrorResponse(
  [{ code: ErrorCode.CONFLICT, message: 'Email taken', field: 'email' }],
  { message: 'Conflict' }
);
```

`CreateErrorOptions`: `{ message?, metadata?, field?, details?, path? }`. `field`/`details`/`path` only apply to the single-code overload and are merged onto that one error.

If you omit `message` entirely, `createErrorResponse` falls back to a built-in default per code (`UNAUTHORIZED → 'Unauthorized'`, `NOT_FOUND → 'Resource not found'`, etc.) so you never end up with an empty message.

### 3.3 Purpose-built helpers (all just wrap `createErrorResponse`)

```ts
createValidationErrorResponse(
  fieldErrors: Array<{ field: string; message: string; code?: string }>,
  message = 'Validation failed'
): ApiResponse;
// each fieldError defaults to ErrorCode.UNPROCESSABLE_ENTITY if no code given

createNotFoundResponse(resource: string, id?: string): ApiResponse;
// message: "User not found" or "User with ID abc-123 not found"

createUnauthorizedResponse(message = 'Unauthorized'): ApiResponse;
createForbiddenResponse(message = 'Insufficient permissions'): ApiResponse;
createConflictResponse(message = 'Resource conflict', details?: string): ApiResponse;

createPaginatedResponse<T>(
  data: T[], pagination: PaginationInfo, message = 'Success',
  metadata?: ApiMetadata, options?: { duration?; correlationId?; version? }
): ApiResponse<T[]>;
```

### 3.4 `ResponseBuilder` — fluent construction

```ts
const res = new ResponseBuilder()
  .withSuccess(true)
  .withMessage('Loaded')
  .withData({ id: 1 })
  .withPagination(pageInfo)
  .withCorrelationId(reqId)
  .build();
```

Rules enforced by `.build()`:
- Throws `'Success status is required'` if `withSuccess` was never called.
- Throws `'Message is required'` if `withMessage` was never called.
- Throws `'Data is required for success responses'` if `success: true` and `withData` was never called. Error responses are exempt — `data` is forced to `null`.

Static shortcuts, useful when you don't need the fluent chain:

```ts
ResponseBuilder.success(data, message);
ResponseBuilder.error('Something broke');                 // string → ErrorCode.INTERNAL_ERROR
ResponseBuilder.error([{ code: ErrorCode.CONFLICT, message: 'dup' }]);
ResponseBuilder.paginated(items, pagination, message);
```

### 3.5 Type guards & status resolution

```ts
isApiResponse(x: any): x is ApiResponse;
// true iff x has success, message, data, timestamp keys

isErrorResponse<T>(res: ApiResponse<T>): res is ApiResponse<T> & { errors: ApiError[] };
// true iff success === false AND errors is a non-empty array

getStatusCodeFromResponse(res: ApiResponse): number;
// 200 if success; otherwise HttpStatusMap[res.errors[0].code] ?? 500
```

---

## 4. Validation Engine (Zod under the hood)

The validation engine lets you describe rules as a plain object (`ValidationRules`) instead of hand-writing Zod schemas, while still getting Zod's coercion and async-refinement machinery underneath.

### 4.1 The rule shape

```ts
type ValidationRules = Record<string, string | ValidationRule>;

interface ValidationRule {
  required?: boolean;
  string?: boolean; number?: boolean; boolean?: boolean; array?: boolean; object?: boolean; date?: boolean;

  // string extras
  email?: boolean; uuid?: boolean; url?: boolean;
  regex?: RegExp; pattern?: string;
  trim?: boolean; lowercase?: boolean; uppercase?: boolean;

  // numeric / string length
  min?: number; max?: number;

  enum?: readonly (string | number)[];

  custom?: (value: any, ctx?: { field: string; data: any }) => boolean | string | Promise<boolean | string>;
  customMessage?: string;

  array?: boolean; arrayOf?: ValidationRule; minItems?: number; maxItems?: number;
  object?: boolean; shape?: Record<string, ValidationRule>; strict?: boolean;

  minDate?: Date | string; maxDate?: Date | string;

  when?: { field: string; is: any | ((v: any) => boolean); then: ValidationRule; otherwise?: ValidationRule };
}
```

### 4.1a Shorthand string rules (`'required|string|min:2'`)

For simple fields you don't need the full `ValidationRule` object — a pipe-delimited string is parsed into one internally (`parseRuleString`). Every field in a `ValidationRules` map can independently be either form:

```ts
const rules: ValidationRules = {
  name: 'required|string|min:2|max:100',
  bio: 'string|max:500',                 // optional (no `required` token) string, capped length
  age: 'number|min:0|max:130',
  isActive: 'boolean',
  website: 'url',
  createdAt: 'date',
  role: 'enum:admin,editor,viewer',
  slug: 'required|string|regex:^[a-z0-9-]+$',
  username: 'required|string|pattern:^[a-zA-Z0-9_]{3,20}$',
};

await validateRequest({ name: 'Ada', age: '36' }, rules);
// age coerced to a number the same as with the object form
```

Flag-style tokens (no value, just presence): `required`, `string`, `number`, `boolean`, `array`, `object`, `email`, `uuid`, `url`, `date`, `trim`, `lowercase`, `uppercase`.

Value-style tokens (`token:value`):

| Token | Equivalent object field | Example |
|---|---|---|
| `min:N` | `min: N` (string length **or** numeric minimum, depending on `string`/`number`) | `min:8` |
| `max:N` | `max: N` | `max:255` |
| `minItems:N` | `minItems: N` (only meaningful combined with `array`) | `minItems:1` |
| `maxItems:N` | `maxItems: N` | `maxItems:10` |
| `regex:<pattern>` | `regex: new RegExp(pattern)` | `regex:^[A-Z]{2}\d{4}$` |
| `pattern:<pattern>` | `pattern: <string>` (compiled the same way as `regex`, kept as a separate field so you can tell "structured RegExp" and "raw pattern string" apart in tooling) | `pattern:^\+?[0-9]+$` |
| `enum:a,b,c` | `enum: ['a','b','c']` | `enum:draft,published,archived` |

Notes and limits on the shorthand form:
- Tokens are split on `|` and trimmed, so whitespace around tokens is fine: `'required | string | min:2'` works.
- There's no shorthand for `custom`, `customMessage`, `arrayOf`, `shape`, `when`, `minDate`/`maxDate`, or `trim`/`lowercase`/`uppercase` combined with transforms beyond the flags above — anything needing a function, a nested rule, or a `Date` value has to be the full `ValidationRule` object. Mix and match freely field-by-field in the same `ValidationRules` map:

```ts
const rules: ValidationRules = {
  slug: 'required|string|regex:^[a-z0-9-]+$',      // shorthand
  password: customValidators.password(10),          // object form (needs a custom fn)
  tags: { array: true, arrayOf: { string: true } }, // object form (needs arrayOf)
};
```
- An unrecognized token (e.g. a typo) is silently ignored rather than throwing — `parseRuleString` only ever sets fields it recognizes, so double-check spelling if a rule seems to have no effect.
- Invalid `regex:`/`pattern:` values that fail `new RegExp(...)` are logged (`[VALIDATION] Invalid regex pattern: ...`) and skipped rather than throwing.

Supported tokens, all together: `required`, `string`, `number`, `boolean`, `array`, `object`, `email`, `uuid`, `url`, `date`, `trim`, `lowercase`, `uppercase`, `min:N`, `max:N`, `minItems:N`, `maxItems:N`, `regex:<pattern>`, `pattern:<pattern>`, `enum:a,b,c`.

### 4.2 `validateRequest` — the main entry point

```ts
async function validateRequest(
  data: any,
  rules: ValidationRules,
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
): Promise<ValidationResult>;

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];   // { field, message, code?, value?, path? }
  data?: any;                  // present when isValid: true — the coerced/cleaned data
}
```

This function is framework-agnostic: it just validates a plain object. For Express, either merge `req.body`/`req.query`/`req.params` yourself before calling it, or use `validateRequestRules` from `server/middleware.ts` (§5.5), which does that merge for you.

```ts
import { validateRequest } from '@your-org/api-utils/validation';

const rules: ValidationRules = {
  email: { string: true, email: true, required: true, max: 255, lowercase: true, trim: true },
  age: { number: true, min: 0, max: 130, required: false },
};

const result = await validateRequest({ email: 'A@Example.com  ', age: '30' }, rules);
// result.isValid === true
// result.data === { email: 'a@example.com', age: 30 }   ← trimmed, lowercased, coerced
```

### 4.3 `ValidationOptions`

```ts
interface ValidationOptions {
  strictTypes?: boolean;    // default false — when true, disables number/boolean coercion entirely
  coerceBooleans?: boolean; // default true
  coerceNumbers?: boolean;  // default true
  cacheSchemas?: boolean;   // default true
  cacheSize?: number;       // default 1000 (LRU, 1 hour TTL)
}
```

**Coercion semantics** (important, and different from naive Zod usage):
- Numbers: `number: true` fields coerce `"2" → 2` via `z.coerce.number()` unless `coerceNumbers: false` or `strictTypes: true`, in which case a non-number value fails validation instead of being coerced.
- Booleans: `boolean: true` fields do **not** use `z.coerce.boolean()` (which treats *any* non-empty string, including the literal string `"false"`, as `true`). Instead the engine explicitly maps the strings `"true"`/`"false"` (case-insensitively) to real booleans and leaves everything else to Zod's own boolean check. This makes it safe to use directly on query-string input (`?active=false` → `false`, not `true`).

```ts
await validateRequest({ page: '2' }, { page: { number: true } });               // data.page === 2
await validateRequest({ page: '2' }, { page: { number: true } }, { coerceNumbers: false }); // isValid === false

await validateRequest({ active: 'false' }, { active: { boolean: true } });      // data.active === false
```

### 4.4 Custom validators — return type contract

A `custom` function returns:
- `true` → passes.
- `false` → fails, using `customMessage` (or a generic `"<field> validation failed"` if none given).
- a `string` → fails, and that string **is** the error message (overriding `customMessage`).

```ts
const rules: ValidationRules = {
  even: {
    number: true, required: true,
    custom: (v: number) => v % 2 === 0,
    customMessage: 'must be even',
  },
};
```

This return-type contract matters: a validator that returns a non-empty string is *always* a failure, even though a naive `Boolean(result)` check would treat it as truthy/success. Don't wire `custom` functions into raw `.refine()` yourself if you're extending this engine — use the same three-way handling.

### 4.5 Conditional validation (`when`)

`when` lets one field's rule depend on a sibling field's value:

```ts
const rules: ValidationRules = {
  accountType: { string: true, required: true, enum: ['personal', 'business'] },
  companyName: {
    string: true,
    required: false,
    when: {
      field: 'accountType',
      is: 'business',                       // or a predicate: (v) => v < 18
      then: { string: true, required: true, min: 1 },
      otherwise: undefined,                  // optional — rule to use when the condition is false
    },
  },
};

await validateRequest({ accountType: 'business' }, rules);                       // isValid: false (companyName missing)
await validateRequest({ accountType: 'personal' }, rules);                       // isValid: true
await validateRequest({ accountType: 'business', companyName: 'Acme' }, rules);  // isValid: true
```

`is` can be a literal value (strict equality) or a predicate function, e.g. `is: (age) => age < 18` to require a guardian name for minors.

### 4.6 Arrays — items are required by default

```ts
{ tags: { array: true, arrayOf: { string: true } } }
```

Unlike top-level object fields (which default to `required: false` unless you say otherwise), items inside `arrayOf` default to `required: true`. An array item is a positional value, not an omittable named field, so `['a', null, 'b']` **fails** by default. Opt out explicitly if you want to allow holes:

```ts
{ tags: { array: true, arrayOf: { string: true, required: false } } }
// now ['a', null, 'b'] is valid
```

`minItems` / `maxItems` bound the array length.

### 4.7 Nested objects — `shape` and `strict`

```ts
{
  profile: {
    object: true,
    strict: true,                         // reject unknown keys instead of silently stripping them
    shape: { name: { string: true, required: true } },
  },
}
```

- Without `shape`, `object: true` is a free-form object (`z.record`) — `strict` there only narrows the *value* type (`unknown` vs `any`); it can't reject keys because there's no fixed key set to check against.
- With `shape` and no `strict`, unknown keys are silently dropped (Zod's default) and `result.data.profile` only contains the declared keys.
- With `shape: {...}, strict: true`, an unexpected key makes the whole validation fail.

### 4.8 Dates

```ts
{ startsAt: { date: true, minDate: '2024-01-01', maxDate: new Date() } }
```

Uses `z.coerce.date()`, so ISO strings, timestamps, and `Date` objects are all accepted and normalized to a `Date`.

### 4.9 Schema caching — how it works, and the one gotcha

`createValidationSchema(rules, options)` builds a Zod schema from your `ValidationRules` and (by default, `cacheSchemas: true`) caches it in an LRU (`max: 1000`, `ttl: 1h`) keyed by a JSON serialization of the rules.

`RegExp` and function values (i.e. `regex` and `custom`) can't be JSON-serialized meaningfully, so the cache key replacer maps each one to a stable id: `RegExp` by its `source`/`flags`, functions by *reference identity* (a `WeakMap<Function, number>`).

```ts
createValidationSchema({ code: { string: true, regex: /^[a-z]+$/ } });
createValidationSchema({ code: { string: true, regex: /^[0-9]+$/ } });
createValidationSchema({ code: { string: true, custom: fnA } });
createValidationSchema({ code: { string: true, custom: fnB } });
// 4 distinct cache entries — different regex sources / different function references
```

**The gotcha:** caching only pays off when the *same* `ValidationRules` object (or one built from the same function references — e.g. a `customValidators.password(8)` call reused across requests) is passed in every time. If you rebuild the rules object — and especially if you re-invoke `customValidators.*` or write an inline `custom` closure — inside a per-request code path (e.g. inside an Express route handler body), you create a fresh function reference on every request. The cache key then never matches anything previously cached, so you silently lose all caching benefit with no error or warning.

```ts
// ❌ Bad — new function reference (and therefore new cache key) on every request
app.post('/signup', async (req, res) => {
  const rules = { password: customValidators.password(8) }; // rebuilt every call
  await validateRequest(req.body, rules);
});

// ✅ Good — built once, reused
const signupRules: ValidationRules = { password: customValidators.password(8) };
app.post('/signup', async (req, res) => {
  await validateRequest(req.body, signupRules);
});
```

Cache management:

```ts
clearValidationCache(): void;       // wipe the whole cache — handy in test beforeEach()
getValidationCacheSize(): number;   // current entry count
```

---

## 5. Built-in Validators & Schemas (`core/validation.types.ts`)

### 5.1 `customValidators` — factories returning a `ValidationRule`

| Factory | Notes |
|---|---|
| `customValidators.password(minLength = 8)` | Requires upper, lower, digit, and special character; each missing requirement gets its own specific message (`'Password must contain at least one uppercase letter'`, etc.), checked in that order. |
| `customValidators.phone(required = false)` | Strips non-digits (keeps `+`), requires 10–15 digits. |
| `customValidators.url(required = false)` | Delegates to the `URL` constructor. |
| `customValidators.username(min = 3, max = 30)` | `^[a-zA-Z0-9_-]+$` |
| `customValidators.alphanumeric(required = true)` | `^[a-zA-Z0-9]+$` |
| `customValidators.postalCode(required = false)` | Accepts US ZIP, UK postcode, or Canadian postal code patterns. |
| `customValidators.creditCard(required = false)` | 13–19 digits + a real Luhn checksum (not just a length check). |
| `customValidators.dateRange(minDate?, maxDate?)` | Validates against an optional min/max window. |

### 5.2 `validationSchemas` — common field shapes

| Factory | Purpose |
|---|---|
| `validationSchemas.uuid(required = true)` | |
| `validationSchemas.email(required = true)` | trims + lowercases, max 255 |
| `validationSchemas.name(required, min = 2, max = 100)` | letters/spaces/hyphens/apostrophes only |
| `validationSchemas.page(default = 1)` | non-negotiably an integer ≥ 1 |
| `validationSchemas.limit(default = 20, max = 100)` | integer, bounded |
| `validationSchemas.sortOrder()` | `enum: ['asc','desc','ASC','DESC']`, lowercased |
| `validationSchemas.id(required = true)` | accepts a UUID **or** a positive integer-looking string/number — good for routes that take either kind of ID |
| `validationSchemas.searchQuery(min = 1, max = 200)` | trimmed |
| `validationSchemas.slug(required = true)` | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, lowercased |
| `validationSchemas.hexColor(required = false)` | `#RGB` or `#RRGGBB` |
| `validationSchemas.json(required = false)` | valid, parseable JSON string |

Example — pagination query validation:

```ts
const listRules: ValidationRules = {
  page: validationSchemas.page(),
  limit: validationSchemas.limit(20, 50),
  sort: validationSchemas.sortOrder(),
  q: validationSchemas.searchQuery(),
};
```

---

## 6. Express (Backend) Integration — `server/`

### 6.1 `apiResponseMiddleware(options?)` — wrap `res.json()`

```ts
app.use(apiResponseMiddleware({ enableCorrelationId: true }));
```

This is a **factory** — you must call it (`apiResponseMiddleware()`), never pass the bare function to `app.use()`. Passing the un-called factory means Express invokes *it* as `(req, res, next)`, which just returns another function and never calls `next()` — every request hangs.

What it does:
- Patches `res.json` so that any payload that *isn't* already an `ApiResponse` (per `isApiResponse`) gets auto-wrapped via `createSuccessResponse`, with `duration` computed from a `startTime` recorded at the very start of the request (independent of any other option — you always get a real number, never `NaN`).
- If the payload is already a well-formed `ApiResponse` (e.g. you called `ResponseHandler`/`createErrorResponse` yourself), it's passed through untouched.
- `204`/`304` responses are sent with `res.send()` (no body), never wrapped.
- With `enableCorrelationId: true`: reads `x-correlation-id` from the request (or generates one), stores it on the response header, and includes it in the emitted `ApiResponse`.

```ts
app.get('/users/:id', (req, res) => {
  res.json({ id: 1, name: 'Ada' });
  // client receives:
  // { success: true, message: 'Success', data: {...}, timestamp, duration, correlationId? }
});
```

### 6.2 `apiErrorMiddleware(options?)` — centralized error handler

Register **last**, after all routes:

```ts
app.use(apiErrorMiddleware({ exposeStackTraces: true }));
```

Behavior:
- Logs the error (`message`, `stack`, `path`, `method`, `ip`) via `console.error`.
- Maps well-known `error.name` values to a status/code/message: `ValidationError → 422/UNPROCESSABLE_ENTITY` (kept consistent with `validateRequestRules`/`validateRequestSchema`/`createValidationErrorResponse`, which all use 422), `UnauthorizedError → 401`, `ForbiddenError → 403`, `NotFoundError → 404`, `ConflictError → 409`, and `PrismaClientKnownRequestError` is delegated to a dedicated Prisma handler (§6.6).
- Respects `error.statusCode` / `error.code` if your error already carries them.
- **Message safety:** for an *unrecognized* error with status ≥ 500, outside development, the client only ever sees the generic `'Internal server error'` — never the raw `error.message` (which could leak internals like a DB connection string). Known 4xx errors, or anything in `development`, surface the real message.
- `exposeStackTraces: true` **and** `NODE_ENV=development` together attach `error.stack` onto `apiResponse.errors[0].stack`.
- Propagates an existing `x-correlation-id` onto the error response if present.

```ts
class NotFoundError extends Error { name = 'NotFoundError' as const; }
app.get('/users/:id', asyncController(async (req, res) => {
  const user = await db.users.find(req.params.id);
  if (!user) throw new NotFoundError('User not found');
  res.json(user);
}));
```

### 6.3 Validating requests — two flavors

**A. `ValidationRules` shorthand (recommended)** — merges `req.body`, `req.query`, `req.params` (later sources win on key collision) and validates the combined object; on success, `req.body` is replaced with the validated/coerced data so downstream handlers see clean types.

```ts
const createUserRules: ValidationRules = { // define once, outside the handler (§4.9)
  email: validationSchemas.email(),
  name: validationSchemas.name(),
  password: customValidators.password(10),
};

router.post('/users', validateRequestRules(createUserRules), asyncController(async (req, res) => {
  // req.body.email is trimmed+lowercased, password already validated
  const user = await createUser(req.body);
  res.status(201).json(user);
}));
```

On failure it responds `422` directly (does **not** call `next()`):

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "code": "UNPROCESSABLE_ENTITY", "message": "email must be a valid email address", "field": "email" }]
}
```

**B. A pre-built Zod schema** (`validateRequestSchema(schema)`) — for when you've written raw Zod yourself instead of the `ValidationRules` shorthand. It calls `schema.parseAsync({ body, query, params })` and responds `422` with `error.message` on failure. It does **not** replace `req.body` with parsed data (unlike `validateRequestRules`) — plan handlers accordingly.

**C. Calling `validateRequest` directly inside a handler.** `validateRequestRules` is just a convenience wrapper — there's nothing stopping you from calling the underlying, framework-agnostic `validateRequest(data, rules, options?)` straight inside a route/controller function yourself. This is the way to go when you want to validate `body`, `query`, and `params` **separately** (different rule sets, different error handling per source) instead of merging them into one object, or when you're not using the `validateRequestRules` middleware at all — e.g. inside a `tRPC`/GraphQL resolver, a queue worker, a CLI command, or any non-Express context.

```ts
import { validateRequest } from '@your-org/api-utils/validation';
import { ResponseHandler } from '@your-org/api-utils/utils';

// Rules defined once, module scope (see the caching note in §4.9)
const listUsersQueryRules: ValidationRules = {
  page: validationSchemas.page(),
  limit: validationSchemas.limit(20, 50),
  sort: validationSchemas.sortOrder(),
};
const userIdParamRules: ValidationRules = { id: validationSchemas.id() };
const createUserBodyRules: ValidationRules = {
  email: validationSchemas.email(),
  name: validationSchemas.name(),
  password: customValidators.password(10),
};

// Validate req.query only
router.get('/users', asyncController(async (req, res) => {
  const queryResult = await validateRequest(req.query, listUsersQueryRules);
  if (!queryResult.isValid) return ResponseHandler.validationError(res, queryResult.errors);

  const users = await db.users.list(queryResult.data); // .data.page is a number, already coerced
  res.json(users);
}));

// Validate req.params only
router.get('/users/:id', asyncController(async (req, res) => {
  const paramsResult = await validateRequest(req.params, userIdParamRules);
  if (!paramsResult.isValid) return ResponseHandler.validationError(res, paramsResult.errors);

  const user = await db.users.find(paramsResult.data.id);
  if (!user) return ResponseHandler.notFound(res, 'User', req.params.id);
  res.json(user);
}));

// Validate req.body only
router.post('/users', asyncController(async (req, res) => {
  const bodyResult = await validateRequest(req.body, createUserBodyRules);
  if (!bodyResult.isValid) return ResponseHandler.validationError(res, bodyResult.errors);

  const user = await db.users.create(bodyResult.data);
  ResponseHandler.created(res, user);
}));

// Validate body + params together, but keep them as distinct results
// (e.g. a PATCH where the id comes from the URL and the patch payload from the body)
router.patch('/users/:id', asyncController(async (req, res) => {
  const [paramsResult, bodyResult] = await Promise.all([
    validateRequest(req.params, userIdParamRules),
    validateRequest(req.body, { name: validationSchemas.name(false), email: validationSchemas.email(false) }),
  ]);
  if (!paramsResult.isValid) return ResponseHandler.validationError(res, paramsResult.errors);
  if (!bodyResult.isValid) return ResponseHandler.validationError(res, bodyResult.errors);

  const user = await db.users.update(paramsResult.data.id, bodyResult.data);
  res.json(user);
}));
```

Because `validateRequest` just takes a plain object, the same function works identically whether you pass it `req.body`, `req.query`, `req.params`, a merged spread of all three (what `validateRequestRules` does under the hood — `{ ...req.body, ...req.query, ...req.params }`), or something that has nothing to do with Express at all (a message off a queue, a WebSocket payload, CLI args). There's no framework-specific `validateRequestBody`/`validateRequestQuery`/`validateRequestParams` export — `validateRequest(source, rules)` **is** that function; you choose what `source` to hand it.

### 6.3-D Worked example: validating `req.query` and `req.params`, and reading the errors when it fails

This walks through one endpoint end-to-end — `GET /users/:id?includeArchived=true` — validating the URL param (`id`) and the query string (`includeArchived`) separately, and shows exactly what you get back in both the success and failure cases.

```ts
import { Router } from 'express';
import { asyncController } from '@your-org/api-utils/server';
import { ResponseHandler } from '@your-org/api-utils/utils';
import { validateRequest, validationSchemas, ValidationRules } from '@your-org/api-utils/validation';

// Note req.params values arrive as strings even though they represent an id;
// note req.query values arrive as strings too ('true'/'false', not real booleans)
// — that's exactly what the engine's coercion (§4.3) is for.
const paramsRules: ValidationRules = {
  id: validationSchemas.id(),                                // accepts a UUID or a positive numeric string
};
const queryRules: ValidationRules = {
  includeArchived: { boolean: true, required: false },       // 'true'/'false' strings coerced correctly
};

const router = Router();

router.get('/users/:id', asyncController(async (req, res) => {
  // 1. Validate req.params
  const paramsResult = await validateRequest(req.params, paramsRules);
  if (!paramsResult.isValid) {
    // paramsResult.isValid === false, paramsResult.data is undefined
    return ResponseHandler.validationError(res, paramsResult.errors);
  }

  // 2. Validate req.query — completely independent of step 1, its own error set
  const queryResult = await validateRequest(req.query, queryRules);
  if (!queryResult.isValid) {
    return ResponseHandler.validationError(res, queryResult.errors);
  }

  // 3. Both passed — use the coerced/cleaned values, not the raw req.params/req.query
  const user = await db.users.find(paramsResult.data.id, {
    includeArchived: queryResult.data.includeArchived ?? false, // real boolean here, not a string
  });
  if (!user) return ResponseHandler.notFound(res, 'User', paramsResult.data.id);

  res.json(user);
}));
```

**Request 1 — a valid call:**

```
GET /users/550e8400-e29b-41d4-a716-446655440000?includeArchived=true
```

`paramsResult` and `queryResult` both come back as:

```json
{
  "isValid": true,
  "errors": [],
  "data": { "id": "550e8400-e29b-41d4-a716-446655440000" }
}
```
```json
{
  "isValid": true,
  "errors": [],
  "data": { "includeArchived": true }
}
```

The client receives (wrapped automatically if you're also using `apiResponseMiddleware`, or built manually here via `res.json(user)`):

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Ada Lovelace", "email": "ada@example.com" },
  "timestamp": "2026-08-11T09:12:03.441Z",
  "duration": 4
}
```

**Request 2 — an invalid `:id` in the URL:**

```
GET /users/not-a-real-id
```

`validateRequest(req.params, paramsRules)` returns:

```json
{
  "isValid": false,
  "errors": [
    { "field": "id", "message": "Invalid ID format", "code": "custom", "path": ["id"] }
  ]
}
```

`ResponseHandler.validationError(res, paramsResult.errors)` sends this to the client, with HTTP status **422**:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "timestamp": "2026-08-11T09:13:47.108Z",
  "errors": [
    { "code": "UNPROCESSABLE_ENTITY", "message": "Invalid ID format", "field": "id" }
  ]
}
```

Note that `ResponseHandler.validationError` (via `createValidationErrorResponse`, §3.3) normalizes every error's `code` to `ErrorCode.UNPROCESSABLE_ENTITY` unless the underlying `ValidationError` already specified one — that's why the `code` you see on the wire (`"UNPROCESSABLE_ENTITY"`) differs from the raw engine-level code (`"custom"`) shown in the `ValidationResult` a step earlier. If you want the *raw* Zod-derived code (`invalid_type`, `too_small`, `custom`, etc.) surfaced to the client instead, build the response yourself with `createErrorResponse(result.errors.map(e => ({ code: e.code, message: e.message, field: e.field })))` rather than going through `validationError`/`createValidationErrorResponse`.

**Request 3 — a bad query string:**

```
GET /users/550e8400-e29b-41d4-a716-446655440000?includeArchived=maybe
```

Here `paramsResult.isValid` is `true` (the id is fine), so execution reaches step 2. `validateRequest(req.query, queryRules)` returns:

```json
{
  "isValid": false,
  "errors": [
    { "field": "includeArchived", "message": "includeArchived must be a boolean, received string", "code": "invalid_type", "path": ["includeArchived"] }
  ]
}
```

And the client gets, again at **422**:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "timestamp": "2026-08-11T09:14:12.902Z",
  "errors": [
    { "code": "UNPROCESSABLE_ENTITY", "message": "includeArchived must be a boolean, received string", "field": "includeArchived" }
  ]
}
```

**Reading errors, in general:** every `ValidationResult.errors` entry (from `validateRequest`, regardless of whether the source was `body`, `query`, or `params`) has this shape — this is what you inspect to build form-field errors, log validation failures, or decide which HTTP status to send:

```ts
interface ValidationError {
  field: string;      // dot-path into the input, e.g. 'email' or 'profile.address.zip'
  message: string;     // human-readable, ready to show a user
  code?: string;        // Zod issue code: 'invalid_type' | 'too_small' | 'too_big' | 'invalid_string' | 'custom' | ...
  value?: any;          // not populated by this engine today — reserved
  path?: string[];      // same info as `field`, but as an array (useful for nested objects/arrays)
}
```

If you're using the `validateRequestRules` middleware (§6.3-A) instead of calling `validateRequest` yourself, you don't write any of the above by hand — it already does step 1/2/3 for you (merged into one object) and responds with the same `422` + `UNPROCESSABLE_ENTITY` shape automatically. Reach for the manual `validateRequest` calls shown here specifically when you want `params`/`query`/`body` validated and reported **separately**.

### 6.4 Other middleware

```ts
app.use(requestIdMiddleware);   // ensures x-request-id header in and out
app.use(loggingMiddleware);     // structured console log per request, keyed by status severity
app.use(corsMiddleware);        // see below
app.get('/health', healthCheck);
app.use('/api', rateLimiter, rateLimitExceeded); // 429 handler for your rate limiter to call
```

`healthCheck` responds `{ status: 'OK', timestamp, uptime }` wrapped as a normal success `ApiResponse`.

`corsMiddleware` — **never combines a wildcard origin with credentials**, which browsers reject anyway per the Fetch/CORS spec:
- If `ALLOWED_ORIGINS` (comma-separated) is set and the request's `Origin` is in that list: reflects that exact origin back with `Access-Control-Allow-Credentials: true` and `Vary: Origin`.
- Otherwise: `Access-Control-Allow-Origin: *`, with **no** credentials header — i.e. open to any origin, but only for non-credentialed requests.

```bash
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

### 6.5 `asyncController`

Wraps an async Express handler so a thrown/rejected error is passed to `next(error)` automatically instead of crashing the process or hanging the request:

```ts
router.get('/users/:id', asyncController(async (req, res) => {
  const user = await db.users.findOrThrow(req.params.id); // any throw → apiErrorMiddleware
  res.json(user);
}));
```

### 6.6 Prisma error mapping (used internally by `apiErrorMiddleware`, also standalone)

`P2002` (unique constraint) → 409 `DUPLICATE_ENTRY`, with the offending field name extracted from `error.meta.target[0]`. `P2025` (record not found) → 404 `NOT_FOUND`. `P2003` (FK violation) → 400 `BAD_REQUEST`. Anything else → 500 `DATABASE_ERROR`, logged.

---

## 7. `ResponseHandler` — Express response shortcuts (`utils/`)

A static-method helper so route handlers don't have to hand-build `ApiResponse`s + status codes every time.

```ts
import { ResponseHandler, asyncHandler } from '@your-org/api-utils/utils';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.users.find(req.params.id);
  if (!user) return ResponseHandler.notFound(res, 'User', req.params.id);
  ResponseHandler.success(res, user);
}));

router.post('/users', asyncHandler(async (req, res) => {
  const result = await validateRequest(req.body, createUserRules);
  if (!result.isValid) return ResponseHandler.validationError(res, result.errors);

  const existing = await db.users.findByEmail(result.data.email);
  if (existing) return ResponseHandler.conflict(res, 'Email already registered');

  const user = await db.users.create(result.data);
  ResponseHandler.created(res, user);
}));
```

Full method list:

| Method | Status | Purpose |
|---|---|---|
| `success(res, data, message?, statusCode = 200, metadata?)` | 200 (default) | Generic success |
| `created(res, data, message?, metadata?)` | 201 | Resource created |
| `paginated(res, data, pagination, message?, metadata?)` | 200 | List + pagination envelope |
| `noContent(res)` | 204 | Empty body |
| `error(res, error, message?, statusCode?)` | derived via `getStatusCodeFromResponse` unless `statusCode` given | Accepts a string **or** a pre-built `ApiResponse` |
| `validationError(res, errors, message = 'Validation failed')` | 422 | Takes `ValidationResult['errors']` directly |
| `badRequest(res, message?, details?)` | 400 | |
| `unauthorized(res, message?)` | 401 | |
| `forbidden(res, message?)` | 403 | |
| `notFound(res, resource, id?)` | 404 | |
| `conflict(res, message?, details?)` | 409 | |
| `internalError(res, error?, message?)` | 500 | Attaches `error.stack` only when `NODE_ENV === 'development'` |
| `handlePrismaError(res, error)` | varies | Same P2002/P2025/P2003 mapping as §6.6 |

`asyncHandler(handler)` is the `utils/` sibling of `asyncController` from `server/` — same job (catch async errors), but on catch it calls `ResponseHandler.internalError(res, error)` directly instead of forwarding to Express's `next(error)` chain. Use `asyncController` + `apiErrorMiddleware` if you want centralized error mapping (Validation/NotFound/etc. by `error.name`); use `asyncHandler` if you'd rather every uncaught error just becomes a flat 500 unless you've already handled it inside the route.

---

## 8. Frontend / Client Integration — `client/`

### 8.1 `ApiClient`

```ts
import { ApiClient } from '@your-org/api-utils/client';

const api = new ApiClient({
  baseUrl: 'https://api.example.com',
  defaultHeaders: { 'Content-Type': 'application/json' },
  timeout: 10_000,          // ms, default 10s
  credentials: 'include',   // default
  retryCount: 2,            // default 0 — retries on network failure, exponential backoff
  retryDelay: 1000,         // base delay in ms; actual delay = retryDelay * 2^attempt
  onRetry: (attempt, error) => console.warn(`retry ${attempt}`, error),
});
```

All methods return `Promise<ApiResponse<T>>` — **they never throw** for HTTP-level or network failures; failures are represented as `{ success: false, ... }` so callers can use one code path for both success and failure (`stream`/`upload` are the exceptions — see below). This is the core idea behind the client: no matter which method you call, no matter whether the server responded, responded with an error, or wasn't reachable at all, you always get the *same* `ApiResponse<T>` shape back and can check `res.success` the same way every time. §8.1a walks through exactly what that object looks like for each method and each outcome.

### 8.1a Every method, worked in full — request, and exact response shape

Assume `const api = new ApiClient({ baseUrl: 'https://api.example.com' });` for all of these.

**`GET` — fetching a single resource**

```ts
const res = await api.get<User>('/users/1');
```

Success (server responded `200` with a body already shaped as `ApiResponse`, or the client wraps a plain payload the same way — see §8.1b):

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com" },
  "timestamp": "2026-08-11T09:20:00.000Z",
  "duration": 12
}
```

You use it as: `if (res.success) { console.log(res.data.name); }`.

**`GET` with query params — fetching a list**

```ts
const res = await api.get<User[]>('/users', { page: 2, limit: 20 });
// GET https://api.example.com/users?page=2&limit=20
```

```json
{
  "success": true,
  "message": "Success",
  "data": [
    { "id": 21, "name": "Grace Hopper", "email": "grace@example.com" },
    { "id": 22, "name": "Alan Turing", "email": "alan@example.com" }
  ],
  "timestamp": "2026-08-11T09:21:00.000Z",
  "pagination": { "page": 2, "limit": 20, "total": 143, "totalPages": 8, "hasMore": true }
}
```

`res.data` is a plain array here (`ApiResponse<User[]>`); pagination info lives alongside it in `res.pagination`, never mixed into `res.data`.

**`POST` — creating a resource**

```ts
const res = await api.post<User>('/users', { name: 'Ada', email: 'ada@example.com', password: 'Str0ng!Pass' });
```

Success (server used `ResponseHandler.created`, status `201`):

```json
{
  "success": true,
  "message": "Resource created successfully",
  "data": { "id": 42, "name": "Ada", "email": "ada@example.com" },
  "timestamp": "2026-08-11T09:22:00.000Z"
}
```

Failure — the server rejected it with a validation error (status `422`). The client returns this **exact same body** the server sent, since it's already a well-formed `ApiResponse` (`isApiResponse(data) === true` short-circuits the client's own wrapping logic):

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "timestamp": "2026-08-11T09:22:05.000Z",
  "errors": [
    { "code": "UNPROCESSABLE_ENTITY", "message": "email must be a valid email address", "field": "email" }
  ]
}
```

```ts
if (!res.success) {
  res.errors?.forEach(e => console.warn(`${e.field}: ${e.message}`)); // drive form field errors directly
}
```

**`PUT` — full replace**

```ts
const res = await api.put<User>('/users/1', { name: 'Ada Lovelace', email: 'ada@example.com' });
```

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com" },
  "timestamp": "2026-08-11T09:23:00.000Z"
}
```

**`PATCH` — partial update**

```ts
const res = await api.patch<User>('/users/1', { name: 'Ada L.' });
```

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": 1, "name": "Ada L.", "email": "ada@example.com" },
  "timestamp": "2026-08-11T09:24:00.000Z"
}
```

Failure — resource doesn't exist (server used `ResponseHandler.notFound`, status `404`):

```json
{
  "success": false,
  "message": "User with ID 999 not found",
  "data": null,
  "timestamp": "2026-08-11T09:24:05.000Z",
  "errors": [{ "code": "NOT_FOUND", "message": "User with ID 999 not found" }]
}
```

**`DELETE`**

```ts
const res = await api.delete('/users/1');
```

If the server responds `204 No Content` (`ResponseHandler.noContent`), most backends send no JSON body at all — handle that case explicitly, since `res.json()` on an empty body will fail:

```ts
// Prefer a 200 with an explicit body from the server for DELETE if the client needs to read `res.success`:
// { "success": true, "message": "Success", "data": { "deleted": true }, "timestamp": "..." }
```

### 8.1b How the client normalizes *any* server response into the same shape

You don't need the backend to be built with this same package for the client to work — `ApiClient` normalizes whatever comes back into `ApiResponse<T>` using this priority:

1. **Already an `ApiResponse`** (has `success`, `message`, `data`, `timestamp` — checked with `isApiResponse`) → returned as-is, untouched.
2. **A non-2xx response with some other JSON shape** → wrapped as:
   ```json
   {
     "success": false,
     "message": "<data.message, or 'Request failed with status 500'>",
     "data": null,
     "timestamp": "2026-08-11T09:25:00.000Z",
     "errors": "<data.errors, or [{ code: 'INTERNAL_ERROR', message: 'Request failed' }]>"
   }
   ```
3. **A network failure** (DNS failure, connection refused, offline, CORS block, etc.) → :
   ```json
   { "success": false, "message": "ECONNREFUSED", "data": null, "timestamp": "...", "errors": [{ "code": "SERVICE_UNAVAILABLE", "message": "ECONNREFUSED" }] }
   ```
4. **A timeout** (request exceeded `timeout` ms, internally an `AbortError`) → :
   ```json
   { "success": false, "message": "Request timed out", "data": null, "timestamp": "...", "errors": [{ "code": "SERVICE_UNAVAILABLE", "message": "Request timed out" }] }
   ```

This is the "unification" the package gives you on the frontend: **every single call site — `get`, `post`, `put`, `patch`, `delete` — resolves to the same `ApiResponse<T>` shape whether the request succeeded, the server rejected it, or the network failed entirely.** You write exactly one `if (!res.success) { ... }` branch per call, instead of a `try/catch` for network errors plus a separate `if (!response.ok)` check plus a separate check for whether the error body happens to be JSON.

**Retries:** on any thrown error (not just network — includes a JSON parse failure, etc.), the client retries up to `retryCount` times with exponential backoff (`retryDelay * 2^attempt`), calling `onRetry(attempt, error)` before each. Only after all retries are exhausted does it return the final error `ApiResponse` shown above — your calling code never sees the intermediate failed attempts, only the final outcome.

### 8.2 `createServerApiClient(baseUrl?)`

A preconfigured `ApiClient` for server-to-server calls (e.g. a Next.js server component/action calling your own API): `baseUrl` from `NEXT_PUBLIC_API_URL` (or `http://localhost:3000/api`), `credentials: 'include'`, `timeout: 15000`, `retryCount: 2`.

### 8.3 File upload

```ts
const file = fileInput.files[0];
const res = await api.upload('/uploads', file, {
  fieldName: 'avatar',
  additionalData: { userId: '123' },   // each value JSON.stringify'd into the FormData
});
```

The client strips any `Content-Type` you (or `defaultHeaders`) set, so the browser can set the correct `multipart/form-data; boundary=...` itself. On failure it returns an `ErrorCode.UPLOAD_FAILED` response rather than throwing.

### 8.4 Streaming

```ts
const stream = await api.stream<ChunkType>('/events');
for await (const chunk of stream) {
  console.log(chunk);
}
```

Unlike the other methods, `stream()` **throws** (`Error('Stream request failed: <status>')`) on a non-OK response or a missing body — there's no `ApiResponse` to return here since you're getting a `ReadableStream`, not a parsed payload. It expects newline-delimited JSON and silently skips any line that fails to parse.

---

## 9. How Response Shape Is Unified Across the Whole Stack

This is the core design of the package, spelled out explicitly: **there is exactly one response shape, `ApiResponse<T>` (§2), and every layer — backend success paths, backend error paths, and the frontend client — funnels into it.** No matter which of these produced the response, the caller checks the exact same two fields (`success`, then `data` or `errors`) to know what happened:

| Where the response comes from | What produces it | Resulting shape |
|---|---|---|
| A route handler returns a plain value via `res.json(x)`, with `apiResponseMiddleware` installed | `createSuccessResponse` (auto-called by the middleware) | `{ success: true, data: x, message: 'Success', timestamp, duration, ... }` |
| A route handler calls `ResponseHandler.success/created/paginated(...)` | `ResponseBuilder.success` → `createSuccessResponse` | Same shape as above |
| `validateRequestRules` middleware rejects the input | `createErrorResponse` with mapped `UNPROCESSABLE_ENTITY` errors | `{ success: false, errors: [...], message: 'Validation failed', data: null }` |
| A route handler calls `ResponseHandler.notFound/conflict/badRequest/...` | `createNotFoundResponse` / `createConflictResponse` / etc. → `createErrorResponse` | `{ success: false, errors: [{code, message}], data: null }` |
| A handler throws, caught by `apiErrorMiddleware` | `createErrorResponse(errorCode, { message })` | `{ success: false, errors: [{code, message}], data: null }` |
| The frontend `ApiClient` receives any of the above over HTTP | Passed through untouched (`isApiResponse` is true) | Identical shape, unchanged |
| The frontend `ApiClient` hits a non-`ApiResponse` error body, a network failure, or a timeout | The client synthesizes one (§8.1b) | Same shape, client-constructed instead of server-constructed |

Because of this, application code — on the server *and* the client — never needs to branch on **where** a failure came from (a Zod validation issue vs. a thrown `NotFoundError` vs. a dead network connection vs. a Prisma unique-constraint violation). It only ever needs to branch on `res.success`, and if `false`, read `res.message` / `res.errors`:

```ts
// This one helper works identically regardless of *why* a request failed —
// validation, a 404, a 409 from Prisma, a network drop, or a timeout.
function describeFailure(res: ApiResponse): string {
  if (res.success) return '';
  return res.errors?.map(e => `${e.field ? e.field + ': ' : ''}${e.message}`).join('; ') || res.message;
}
```

The same discipline applies to **status codes**: rather than hardcoding a number at each call site, `getStatusCodeFromResponse(res)` derives it from `res.errors[0].code` via `HttpStatusMap` (§2), so a `DUPLICATE_ENTRY` error is always `409` and an `UNPROCESSABLE_ENTITY` error is always `422`, everywhere in the codebase, without every handler needing to remember the mapping itself.

## 10. End-to-End Example

**Backend (Express):**

```ts
import express from 'express';
import {
  apiResponseMiddleware, apiErrorMiddleware, corsMiddleware,
  requestIdMiddleware, loggingMiddleware, validateRequestRules,
  asyncController,
} from '@your-org/api-utils/server';
import { ResponseHandler } from '@your-org/api-utils/utils';
import { validationSchemas, customValidators, ValidationRules } from '@your-org/api-utils/validation';

const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(requestIdMiddleware);
app.use(loggingMiddleware);
app.use(apiResponseMiddleware({ enableCorrelationId: true }));

const createUserRules: ValidationRules = {
  email: validationSchemas.email(),
  name: validationSchemas.name(),
  password: customValidators.password(10),
};

app.post('/users', validateRequestRules(createUserRules), asyncController(async (req, res) => {
  const user = await db.users.create(req.body); // req.body is validated + coerced
  res.status(201).json(user); // auto-wrapped into ApiResponse by apiResponseMiddleware
}));

app.get('/users/:id', asyncController(async (req, res) => {
  const user = await db.users.find(req.params.id);
  if (!user) return ResponseHandler.notFound(res, 'User', req.params.id);
  res.json(user);
}));

app.use(apiErrorMiddleware({ exposeStackTraces: true })); // last
```

**Frontend:**

```ts
import { ApiClient } from '@your-org/api-utils/client';

const api = new ApiClient({ baseUrl: '/api', retryCount: 2 });

async function createUser(input: { email: string; name: string; password: string }) {
  const res = await api.post('/users', input);
  if (!res.success) {
    // res.errors is field-annotated — easy to map onto a form
    res.errors?.forEach(e => console.warn(e.field, e.message));
    return null;
  }
  return res.data;
}
```

---

## 11. Quick Reference — HTTP Status per `ErrorCode`

| Code | Status |
|---|---|
| BAD_REQUEST | 400 |
| UNAUTHORIZED | 401 |
| PAYMENT_FAILED | 402 |
| FORBIDDEN, INSUFFICIENT_PERMISSIONS | 403 |
| NOT_FOUND | 404 |
| CONFLICT, DUPLICATE_ENTRY | 409 |
| INVALID_STATE | 400 |
| UNPROCESSABLE_ENTITY | 422 |
| RESOURCE_LOCKED | 423 |
| TOO_MANY_REQUESTS | 429 |
| INTERNAL_ERROR | 500 |
| DATABASE_ERROR | 500 |
| CACHE_ERROR | 500 |
| UPLOAD_FAILED | 500 |
| EXTERNAL_SERVICE_ERROR | 502 |
| SERVICE_UNAVAILABLE | 503 |
| FILE_TOO_LARGE | 413 |
| INVALID_FILE_TYPE | 415 |

---

## 12. Gotchas Checklist

- Call the middleware factories: `apiResponseMiddleware()` / `apiErrorMiddleware()` — not the bare function reference.
- Register `apiErrorMiddleware` **last**, after all routes.
- Define `ValidationRules` objects (and any `customValidators.*(...)` calls inside them) **once**, at module scope — rebuilding them per-request defeats schema caching silently (§4.9).
- `arrayOf` items are `required: true` by default — opt out per item if you want to allow `null`/`undefined` entries.
- `object: true` without `shape` can't enforce `strict` key rejection — only shaped objects can reject unknown keys.
- `custom` validators must return `true` / `false` / a message string — a truthy non-`true` return is still correctly treated as failure by this engine (don't reimplement with a raw `.refine()`).
- In production, `apiErrorMiddleware` hides real error messages for unrecognized 5xx errors — set `NODE_ENV=development` (or throw a named error type) if you need the real message client-side while debugging.
- `corsMiddleware` never sends `Access-Control-Allow-Credentials: true` alongside a wildcard origin — set `ALLOWED_ORIGINS` if you need credentialed cross-origin requests.