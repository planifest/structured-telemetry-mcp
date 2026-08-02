# Planifest Testing Standards

Tests are the requirements' executable counterpart. Every acceptance criterion becomes a test, every contract becomes a contract test, every edge case the requirements identify becomes a test case.

---

## 1. Test Pyramid

Every component must have tests at three levels:

| Level | What It Tests | Speed | Scope | Required Coverage |
|-------|--------------|-------|-------|-------------------|
| **Unit** | Pure functions, business logic, transformations | Fast (< 100ms each) | Single function/class | Every exported pure function |
| **Integration** | API endpoints, database queries, service interactions | Medium (< 5s each) | Single component boundary | Every endpoint, every query |
| **Contract** | Cross-component interface agreements | Medium | Component boundary pair | Every consumed interface |

E2E tests are recommended but not required at the component level.

---

## 2. Agentic TDD & Requirement Traceability

Agents must employ **Agentic TDD (Test-Driven Development)** to guarantee semantic correctness deterministically, rather than evaluating success probabilistically.

**The Agentic TDD Loop:**
1. Read the functional requirement (`plan/current/requirements/req-*.md`).
2. Write the failing test case *first*.
3. Execute the test to verify it fails (establishing the boundary).
4. Write the implementation logic.
5. Execute the test to verify it passes.

**Requirement Traceability:**
Every functional requirement must be explicitly traceable to a test. You MUST include the requirement ID in the test description or suite name.

```javascript
// Correct: Traceable to req-001-auth
describe("req-001-auth: user login flow", () => {
  test("returns 401 when password is mathematically invalid", () => {
    // ...
  })
})
```

**Rules:**
- Test names describe behaviour, not implementation: "returns 404 when order does not exist" not "test getOrder"
- One assertion concept per test. Multiple `expect` calls are fine if they verify the same logical assertion.
- No shared mutable state between tests, and no test interdependence - each test sets up its own data and all tests must pass in any order.

---

## 3. What to Test

Always test the happy path for every acceptance criterion, error cases, boundary conditions, and state transitions. Never test framework internals, private implementation details, or third-party library behaviour.

---

## 4. Test Data

Use factories or builders, not raw object literals repeated across tests. Test data should be minimal - only fields relevant to the test. Never use production data or hardcode dates. Database tests must clean up after themselves or use transactions that roll back.

---

## 5. Mocking

Contract tests verify the mock matches reality: if a consumer test mocks a service, the provider must have a corresponding contract test that verifies the mock's behaviour.

---

## 6. Flakiness Policy

A flaky test is worse than no test - it erodes trust in the suite. If a test fails intermittently, fix it or delete it; do not retry-and-ignore. All tests must be deterministic - use dependency injection for time, randomness, and external state.

---

## 7. Coverage

Coverage is a proxy, not a target. The goal is confidence that the requirements are implemented correctly.

| Metric | Minimum | Target |
|--------|---------|--------|
| Line coverage | 80% | 90%+ |
| Branch coverage | 70% | 85%+ |
| Critical path coverage | 100% | 100% |

"Critical path" = the primary user-facing flows identified in the design requirements' acceptance criteria.
