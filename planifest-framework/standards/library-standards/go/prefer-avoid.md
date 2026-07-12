# Go — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/go/prefer-avoid.md` first.

---

## Web Framework / Router

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP router | `chi` or `echo` | `gorilla/mux` (archived), `gin` (acceptable) | gorilla/mux is archived; chi is idiomatic stdlib-compatible; echo has good middleware |
| Framework choice guide | `chi` for stdlib-compatible minimal routing; `echo` for middleware-rich APIs | — | Record choice in ADR |

## Database

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| PostgreSQL client | `pgx` v5 | `database/sql` + `lib/pq` alone, `gorm` | pgx is the most capable PostgreSQL driver; gorm's magic causes subtle bugs |
| Query generation | `sqlc` | `gorm`, `ent` | sqlc generates type-safe Go from SQL — no runtime ORM magic |
| Migrations | `golang-migrate` | `goose` (acceptable) | golang-migrate is the most widely used |

## HTTP Client

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP client | stdlib `net/http` | third-party wrappers | Go's stdlib HTTP client is excellent; add `resty` only if needed |

## Validation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Struct validation | `go-playground/validator` v10 | hand-rolled reflection | validator is the de facto standard |

## Logging

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Logging | `slog` (stdlib, Go 1.21+) | `logrus`, `zap` (unless high-perf) | slog is now in the standard library; zap for high-throughput services |

## Configuration

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Config | `viper` or `envconfig` | hand-rolled os.Getenv | viper handles multi-source config; envconfig for struct-based env mapping |

## Concurrency

| Rule | Detail |
|------|--------|
| Use `errgroup` for concurrent goroutines | `golang.org/x/sync/errgroup` — never fire-and-forget goroutines without error collection |
| Use `context` for cancellation | Always pass context through the call stack |
