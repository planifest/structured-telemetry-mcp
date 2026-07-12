# Library Version Policy

> Applies to all agents scaffolding dependency manifests. Follow these rules before writing any `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `pubspec.yaml`, or equivalent.

---

## Rules

### 1. Target the latest stable release

Use the latest stable version of each library at the time of scaffolding. Do not pin to an old major unless a specific compatibility constraint is documented in `quirks.md`.

### 2. Exact or tilde pinning — no `^latest` or floating ranges

| Ecosystem | Correct | Incorrect |
|-----------|---------|-----------|
| npm / package.json | `"zod": "3.23.8"` or `"~3.23.8"` | `"^3.23.8"`, `"latest"`, `"*"` |
| Python / pyproject.toml | `zod = "3.23.8"` or `zod = "~3.23.8"` | `zod = ">=3.23"` without upper bound |
| Go / go.mod | pinned via `go get library@v1.2.3` | floating pseudo-versions without good reason |
| Rust / Cargo.toml | `zod = "=1.2.3"` or `"~1.2"` | `"*"` or overly broad ranges |

Lockfiles commit exact resolutions. The version in the manifest is the declared constraint; the lockfile is the ground truth.

### 3. Check the changelog before upgrading

Before bumping a major version, read the library's changelog for breaking changes. Record the review in a commit message or `quirks.md` if the upgrade required code changes.

### 4. Peer dependency satisfaction

If a library declares peer dependencies, verify that the versions you are installing satisfy those ranges. Mismatched peer dependencies are a CI failure, not a warning.

### 5. Avoid-list exception

If an avoid-listed library is the only viable option for a specific requirement, record the exception in `src/{component-id}/docs/quirks.md` with:
- The avoided library and version
- Why no alternative exists
- What would trigger a re-evaluation

Do not silently use an avoided library. The exception must be documented.
