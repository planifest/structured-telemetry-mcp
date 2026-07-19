# JavaScript — React — Test Framework Standards

> See `testing-standards.md` for how to write tests.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit (components) | `vitest` + `@testing-library/react` | `enzyme`, `jest` (new projects) | RTL tests behaviour, not implementation; enzyme is deprecated |
| Unit (hooks / logic) | `vitest` | `jest` | Same runner as components |
| Integration | `vitest` + `@testing-library/react` | Cypress component testing | RTL is sufficient for component integration |
| E2E | `playwright` | `cypress`, `selenium` | Playwright has better multi-browser and async support |
| Visual regression | `playwright` screenshots or `storybook` + `chromatic` | manual | Automate visual checks in CI |

## Notes

- `@testing-library/user-event` v14+ over `fireEvent` for simulating user interactions
- Avoid snapshot tests for component HTML — they are brittle and don't test behaviour
- Mock at the network layer (`msw`) not at the module level for integration tests
