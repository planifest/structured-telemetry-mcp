# Go — Test Framework Standards

> See `testing-standards.md` for how to write tests.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit | `testing` (stdlib) + `testify` | `gocheck`, `ginkgo` (unless BDD required) | testify provides assert/require/mock; stdlib testing is sufficient for simple cases |
| Integration | `testing` + `testcontainers-go` | mocking the database | Real DB via testcontainers is more reliable than mock |
| Contract | `pact-go` | hand-rolled | Consumer-driven contract testing |
| E2E / HTTP | `net/http/httptest` + `testing` | Separate E2E tool for most cases | httptest is sufficient for API smoke tests |
| Performance / load | `k6` (external) or `testing.B` | — | Benchmarks with `testing.B`; load tests with k6 |

## Notes

- `testify/mock` for mocking interfaces; avoid hand-rolled mocks unless the interface is trivial
- Table-driven tests are idiomatic Go — use them for unit tests with multiple input cases
- `golangci-lint` in CI for static analysis
