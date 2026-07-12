# Java — Test Framework Standards

> See `testing-standards.md` for how to write tests.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit | `JUnit 5` + `Mockito` | `JUnit 4`, `TestNG` | JUnit 5 has better extension model; Mockito for mocking |
| Integration | `Spring Boot Test` + `Testcontainers` | H2 in-memory DB for integration tests | Real DB via Testcontainers; H2 dialect differences cause false passes |
| Contract | `Spring Cloud Contract` or `Pact JVM` | hand-rolled | Choose based on provider-driven (Spring CC) vs consumer-driven (Pact) |
| E2E | `REST Assured` or `Playwright` (Java) | `Selenium` alone | REST Assured for API E2E; Playwright for UI E2E |
| Performance / load | `Gatling` | `JMeter` | Gatling scenarios are code (Scala DSL), better CI integration |

## Notes

- `AssertJ` over JUnit 5 assertions for fluent, readable assertions
- `@SpringBootTest` with `RANDOM_PORT` for integration tests requiring the full context
- Testcontainers `@Container` + `@DynamicPropertySource` for database integration tests
