# Python — Test Framework Standards

> See `testing-standards.md` for how to write tests.

---

| Test Type | Preferred Framework | Avoid | Notes |
|-----------|-------------------|-------|-------|
| Unit | `pytest` | `unittest` | pytest fixtures, parametrise, and plugins are far superior to unittest |
| Integration | `pytest` + `httpx` (async client) | `requests` in tests | Use httpx AsyncClient with FastAPI's TestClient |
| Contract | `pact-python` | hand-rolled | Consumer-driven contract testing |
| E2E | `playwright` (Python) | `selenium` | Playwright Python bindings are well maintained |
| Performance / load | `locust` | `ab`, manual | Locust is scriptable Python, has web UI |

## Plugins

| Plugin | Purpose |
|--------|---------|
| `pytest-asyncio` | Required for async FastAPI / sqlalchemy tests |
| `pytest-cov` | Coverage reporting |
| `pytest-mock` | `mocker` fixture wrapping `unittest.mock` |
| `factory-boy` | Test data factories — avoid hardcoded fixtures |

## Notes

- Use `anyio` backend for `pytest-asyncio` when testing with multiple async backends
- `testcontainers-python` for tests requiring a real database
- Do not mock `httpx` calls at the module level — use `respx` for network mocking
