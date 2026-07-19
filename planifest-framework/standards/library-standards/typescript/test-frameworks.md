# TypeScript — Test Framework Standards

> See `testing-standards.md` for how to write tests. This file covers which framework to use.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit | `vitest` | `jest`, `mocha`, `jasmine` | Vitest is faster, native ESM, compatible with Vite projects |
| Integration | `vitest` | `jest` | Same runner; use `vi.fn()` for mocks |
| Contract | `pact` | hand-rolled JSON comparison | Pact provides consumer-driven contract testing |
| E2E | `playwright` | `cypress`, `selenium`, `puppeteer` | Playwright supports all browsers, has better async handling |
| Performance / load | `k6` | `artillery`, `locust` | k6 scripts in TypeScript/JavaScript; good CI integration |

## Coverage

Use `vitest` built-in coverage (`@vitest/coverage-v8`). Avoid `istanbul` or `nyc` standalone — they are redundant when vitest coverage is configured.

## Notes

- If the project predates Vitest and Jest is already deeply integrated, jest is acceptable — record in `quirks.md`
- Playwright over Cypress for new projects: Playwright's auto-wait model reduces flakiness
