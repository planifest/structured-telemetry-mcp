# JavaScript — Node.js — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/javascript/nodejs/prefer-avoid.md` first.
> TypeScript Node.js projects should additionally follow `typescript/prefer-avoid.md`.

---

## Web Framework

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP framework | `fastify` or `hono` | `express` (unless legacy), `koa`, `restify` | Fastify: fastest Node.js framework, schema validation built-in. Hono: edge-ready, ultralight |
| Framework choice guide | `fastify` for complex APIs with plugins; `hono` for edge/serverless/simple APIs | — | Both are acceptable; record choice in ADR |

## Database / ORM

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| ORM | `drizzle` or `prisma` | `sequelize`, `typeorm`, `objection` | Sequelize/TypeORM have poor TS support and leaky abstractions |
| Query builder | `drizzle` or `kysely` | `knex` | Knex lacks type safety; drizzle/kysely are TS-first |
| Raw SQL (PostgreSQL) | `postgres` (porsager) or `pg` | — | For cases where ORM is overkill |

## HTTP Client

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP client | `fetch` (native Node 18+) or `ky` | `axios`, `got`, `node-fetch`, `request` | `request` is deprecated; native fetch is preferred |

## Validation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Input validation | `zod` | `joi`, `yup`, `class-validator` | See TypeScript standards |

## Authentication

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| JWT | `jose` | `jsonwebtoken` | `jose` supports Web Crypto API, works in edge runtimes |
| Password hashing | `argon2` | `bcrypt` (acceptable), `md5`, `sha1` | Argon2 is the current best-practice algorithm |

## Queues / Background Jobs

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Job queue | `bullmq` | `bull` (deprecated), `agenda`, `node-cron` for heavy work | BullMQ is the maintained successor to Bull |

## Logging

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Logging | `pino` | `winston`, `morgan` alone | Pino is fastest, structured JSON by default |

## Environment

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Env parsing | `zod` + manual | `dotenv` alone | Type-safe env validation prevents runtime surprises |
