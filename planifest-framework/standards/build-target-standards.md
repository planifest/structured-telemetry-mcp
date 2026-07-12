---
title: "Build Target Standards"
version: "1.0.0"
---
# Build Target Standards

Agents read `Build target` from the confirmed design stack declaration and adjust all environment assumptions accordingly. Never infer the build target from `compute` or `iac` fields — always read the explicit declaration.

---

## Tiers

### `local`

The default. Build and test operations run on the developer's host machine.

**Agent behaviour:**
- Check host-installed runtimes and tools as needed (e.g. `node --version`, `dotnet --version`)
- Run lint, typecheck, test, and build commands directly against the host toolchain
- Scaffold standard project structure without mandatory Docker configuration

---

### `docker`

Build and test operations run inside a container. Host-installed runtimes are irrelevant.

**Agent behaviour:**
- **Never** check host-installed runtimes or tools. Do not run `node`, `dotnet`, `python`, `go`, `ruby`, `java`, `mvn`, `gradle`, or equivalent CLI commands directly against the host
- **Never** fail or warn because a runtime is absent on the host — it is expected to be absent
- Scaffold Dockerfile-first: a working `Dockerfile` (multi-stage where applicable) is the primary build artifact, not a host-runnable project
- Run all validation checks via `docker build` and `docker run` — not via host toolchain
- Codegen: generate `Dockerfile` and `docker-compose.yml` (or equivalent) before any source code
- Validate: CI checks run as:
  ```bash
  docker build -t {image} .
  docker run --rm {image} {test-command}
  ```
- Infrastructure: any IaC referencing the container image must use the Dockerfile as the source of truth

---

### `ci-only`

Build and test operations run only in the CI pipeline. No local execution is assumed or required.

**Agent behaviour:**
- Do not attempt to run build or test commands locally
- Scaffold CI workflow files as the primary validation mechanism
- Codegen: generate CI configuration (e.g. `.github/workflows/`) alongside source code
- Validate: report that validation requires a CI run; do not attempt local execution
- Flag any acceptance criterion that requires local execution as a scope mismatch

---

## Where to read `Build target`

```
plan/current/design.md → Engineering Layer → Stack → Build target
```

If the field is absent (pre-0000007 feature briefs), default to `local` and note the assumption in the build log.
