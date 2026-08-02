# Python — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/python/prefer-avoid.md` first.

---

## Web Framework

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| API framework | `fastapi` | `flask` (unless legacy/simple), `django` (unless full-stack), `bottle` | FastAPI: async, automatic OpenAPI, pydantic-native validation |
| Simple / edge | `fastapi` with uvicorn | `flask` | Flask lacks async support; FastAPI is not significantly more complex |

## Validation / Serialisation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Data validation | `pydantic` v2 | `marshmallow`, `cerberus`, `attrs` alone, pydantic v1 | Pydantic v2 is rewritten in Rust; 5–50× faster than v1 |
| Settings / config | `pydantic-settings` | `python-dotenv` alone | Type-safe settings with pydantic-settings; dotenv is fine alongside it |

## Database

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| ORM | `sqlalchemy` 2.x (async) | `peewee`, `tortoise-orm`, sqlalchemy 1.x patterns | SQLAlchemy 2.x has proper async support; see also `databases/` for client choices |
| Migrations | `alembic` | `yoyo-migrations` | |

## Task Queue

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Background tasks | `celery` + `redis` or `arq` | `rq` (limited), `huey` | Celery is battle-tested; arq is async-native and simpler |

## HTTP Client & CLI

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP client | `httpx` | `requests`, `aiohttp` | httpx supports both sync and async; requests is sync-only |
| CLI framework | `typer` | `argparse`, `click` (acceptable) | Typer is built on click with automatic type inference from type hints |

## Packaging

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Package manager | `uv` | `pip` + `virtualenv` manually, `poetry` | uv is dramatically faster and handles venv + lockfile |
| Dependency spec | `pyproject.toml` | `requirements.txt` alone | PEP 517/518 standard |
