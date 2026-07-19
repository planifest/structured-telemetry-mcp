# JavaScript — Node.js — Test Framework Standards

> See `testing-standards.md` for how to write tests.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit | `vitest` | `jest`, `mocha`, `tap` | Vitest is faster, native ESM, no config overhead |
| Integration | `vitest` + `supertest` or native `fetch` | `jest` | For HTTP endpoint tests; supertest wraps fastify/express |
| Contract | `pact` | hand-rolled | Consumer-driven contract tests |
| E2E / API smoke | `playwright` (API mode) or `k6` | `cucumber` alone | Playwright API mode for HTTP E2E; k6 for load |
| Performance / load | `k6` | `artillery`, `autocannon` | k6 is scriptable TypeScript/JS, good CI integration |

## Notes

- Use `testcontainers` for integration tests that need a real database — do not mock the DB
- Vitest over Jest for new projects: Jest requires Babel or ts-jest for ESM; Vitest is native
