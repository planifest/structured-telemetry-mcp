# TypeScript — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/typescript/prefer-avoid.md` first — overrides take precedence.

---

## Validation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Schema validation | `zod` | `joi`, `yup`, `ajv` (direct) | Zod provides TypeScript-first type inference; joi/yup lack native TS type generation |
| Form validation | `zod` + `react-hook-form` | `formik` + `yup` | Zod + RHF has better TS integration and smaller bundle |

## HTTP Client

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP client | `fetch` (native) or `ky` | `axios` (unless legacy), `got`, `node-fetch` | Native fetch is available in Node 18+; ky is a thin fetch wrapper |

## Date/Time

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Date manipulation | `date-fns` or `Temporal` (native) | `moment`, `dayjs` | Moment is deprecated and bundle-heavy; date-fns is tree-shakeable |

## Utilities

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Utility functions | Native JS/TS | `lodash`, `underscore`, `ramda` | Modern JS covers most lodash use cases natively; lodash adds bundle weight |
| Environment variables | `zod` + manual parse | `dotenv` alone | Zod provides type-safe env parsing; raw dotenv has no validation |

## Logging

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Logging | `pino` | `winston`, `bunyan`, `log4js` | Pino is fastest and outputs structured JSON by default |

## Linting / Formatting

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Linting | `eslint` + `typescript-eslint` | `tslint` | TSLint is deprecated |
| Formatting | `prettier` | `beautify` | Prettier is the de facto standard |

## Build

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Bundler (frontend) | `vite` | `webpack` (unless legacy), `parcel`, `rollup` (unless library) | Vite is significantly faster for development |
| Bundler (library) | `tsup` or `rollup` | `webpack` | tsup/rollup produce smaller, cleaner library output |
| Compiler | `tsc` or `esbuild` | `babel` alone for TS | Babel strips types without checking them; always run tsc for type safety |

## TypeScript Config

| Concern | Rule |
|---------|------|
| `strict` | Must be `true` |
| `noUncheckedIndexedAccess` | Enable — prevents silent `undefined` from array access |
| `exactOptionalPropertyTypes` | Enable for new projects |
| `any` | Never use `any` — use `unknown` and narrow |
