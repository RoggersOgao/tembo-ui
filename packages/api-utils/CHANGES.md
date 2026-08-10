# Fixes applied to v2.0.0

This is the v2 "enterprise" rewrite you pasted, made to actually work. I laid
out the full source tree in a sandbox, compiled it with `tsc --noEmit`, built
it with `tsup`, ran it under Node (both `require()` and `import`), and wrote
a real test suite (42 tests, `npx vitest run` — all passing). Every bug below
was confirmed by making it fail first, then fixing it and re-verifying.

## Critical — silently broke core functionality

**1. Every `custom` validator always passed, regardless of input.**
`validation/engine.ts` wired `rule.custom` into `z.refine()` like this:
```ts
schema.refine(async (value) => {
  const result = await rule.custom!(value);
  return result === true || typeof result === 'string' ? result : true;
}, { message: ... });
```
`CustomValidator` returns `true` (valid), `false` (invalid), or a `string`
(invalid, with a message) — but `.refine()` only checks truthiness of the
return value, and **every one of those three cases evaluates to something
truthy** (`true`, a non-empty string, or the literal `true` for the `false`
case via the `: true` fallback). That means `customValidators.password`,
`.phone`, `.postalCode`, `.creditCard`, `.dateRange`, and
`validationSchemas.id`/`.json` — every built-in validator that returns a
string on failure — silently accepted anything. Confirmed with a minimal
repro before fixing: a known-too-short "password" parsed as valid.

Fixed by switching to `superRefine`, which lets the three return shapes be
interpreted correctly and attaches the validator's own message when it
returns one:
```ts
schema.superRefine(async (value, ctx) => {
  const result = await customFn(value, { field: fieldName, data: value });
  if (result === true) return;
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: typeof result === 'string' ? result : defaultMessage });
});
```

**2. `ApiClient.request()` threw `ReferenceError: timeoutId is not defined` on every network error, timeout, or retry.**
```ts
try {
  const controller = new AbortController();
  const timeoutId = setTimeout(...);   // declared inside the try block
  ...
} catch (error) {
  clearTimeout(timeoutId);             // out of scope here — throws
  ...
}
```
`timeoutId` was declared with `const` inside the `try`, so the `catch`
block — which runs on every failed `fetch`, including plain network errors
and aborts — couldn't see it. Confirmed by reproducing the exact throw in
isolation. Every failed request threw instead of returning the intended
`ApiResponse` error shape. `upload()` didn't have this bug (`timeoutId` was
already declared outside its `try`), which is what tipped me off that
`request()`'s version was a mistake, not a deliberate pattern. Fixed by
moving `controller`/`timeoutId` outside the `try`, matching `upload()`.

**3. `apiErrorMiddleware` never showed the real error message in development, for any ordinary (unnamed) error.**
```ts
let message = 'Internal server error';
if (error.name === 'ValidationError') { ...; message = error.message || '...'; }
else if (error.name === 'UnauthorizedError') { ...; message = error.message || '...'; }
// ...no fallback branch sets `message = error.message` for anything else
```
The later `isDev`/`shouldExposeStack` logic clearly intends to surface real
error details in development — but `message` only ever gets set from
`error.message` inside the five named branches (`ValidationError`,
`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`).
Any other error — a `TypeError`, a driver error, anything thrown without one
of those exact `.name`s, which in practice is most errors — fell through
with the hardcoded default regardless of `NODE_ENV`. I only caught this by
actually running the built `dist/` output with `NODE_ENV=development` and
checking the response body, not by reading the source. Fixed by defaulting
`message = error.message || 'Internal server error'` up front, so the named
branches only override it when they want a nicer default for an empty
message.

## Packaging — the build didn't actually run

**4. Missing `src/core/index.ts`.**
`package.json`'s `"./core"` export and `tsup.config.ts`'s `core` entry both
point at `src/core/index.ts`, which was never included — `npx tsup` failed
immediately with `Cannot find core: src/core/index.ts`. Added the barrel
file (`export * from './api.types.js'; export * from './validation.types.js';`).

**5. `package.json` + `tsup` output extensions didn't match the `exports` map.**
The `exports` map expects `.mjs` for the `import` condition and plain `.js`
for `require`. Once transcribed with an added `"type": "module"` field
(a mistake on my end while typing it out, not present in what you pasted),
`tsup`'s default extension inference flips: ESM output becomes `.js` and CJS
becomes `.cjs`, which no longer matches. Removed `"type": "module"` (matching
what you actually pasted) and pinned `tsup`'s `outExtension` explicitly so
this can't silently drift again. Verified both `require('./dist/index.js')`
and `import('./dist/index.mjs')` resolve and work correctly against the
built output.

**6. TypeScript compile errors** (`tsc --noEmit` was not clean):
- `ApiMetadata` used in `utils/response.handler.ts` type signatures but
  never imported.
- Missing `DOM` lib in `tsconfig.json` (needed for `fetch`, `FormData`,
  `ReadableStream`, `RequestCredentials` used in the client) — my own
  transcription slip while retyping your `tsconfig.json`, not present in
  what you pasted.
- `apiErrorMiddleware`'s Prisma branch (`return handlePrismaError(...)`)
  made one code path return a `Response` while every other path returned
  `undefined`, tripping `noImplicitReturns`.
- A few `noUnusedLocals`/`noUnusedParameters` violations (`next` in the
  4-arg error-handler signature — required for Express to recognize it as
  error-handling middleware by arity, even though the value itself isn't
  used; `defaultValue`/`defaultLimit` params on `validationSchemas.page`/
  `.limit()` that were accepted but never applied by the rule).
- `upload()`'s header handling: `HeadersInit` includes shapes (`Headers`,
  `string[][]`) TS won't let you `delete` a key from after a spread; narrowed
  to `Record<string, string>` explicitly.

## Consistency fix (not a crash, but a real inconsistency)

**7. Two different HTTP statuses for the same kind of failure.**
`validateRequestSchema`, `createValidationErrorResponse`, and
`ResponseHandler.validationError` all use `422`/`UNPROCESSABLE_ENTITY` for
validation failures — but `apiErrorMiddleware`'s `ValidationError`-name
branch returned `400`/`BAD_REQUEST`. Same failure category, two different
statuses depending on which code path threw it. Unified on `422` everywhere.

**8. Duration was always `NaN` unless an unrelated option happened to be on.**
`apiResponseMiddleware`'s `res.json` override always computed
`Date.now() - req.startTime`, but `req.startTime` was only ever set when
`options.enableRequestLogging` was `true`. With default options (nothing
set), every response got `duration: NaN`. Now `startTime` is always
recorded, independent of that option.

## Also added

**`validateRequestRules(rules, options?)`** in `server/middleware.ts` — the
v2 rewrite kept a middleware for a pre-built Zod schema
(`validateRequestSchema`) but dropped the Express integration for the more
commonly used `ValidationRules`-object workflow entirely (the new
`validateRequest(data, rules)` in `validation/engine.ts` is intentionally
framework-agnostic and takes plain data, not a `Request`). Added this back so
`ValidationRules` can still be used directly as Express middleware — it
merges `body`/`query`/`params`, validates, and replaces `req.body` with the
validated/coerced result on success.

## Verified, not just fixed

- `tsc --noEmit`: clean.
- `npx tsup`: builds all five entry points (`index`, `server`, `client`,
  `validation`, `core`) in both CJS and ESM with `.d.ts`.
- `require('./dist/index.js')` and `import('./dist/index.mjs')`: both load
  and the exported functions work correctly.
- All five subpath exports (`.`, `./server`, `./client`, `./validation`,
  `./core`) load their expected members.
- `npx vitest run`: **42/42 passing**, covering every fix above plus the
  existing `createErrorResponse` overloads, CORS credentials handling, and
  conditional (`when`) validation.
