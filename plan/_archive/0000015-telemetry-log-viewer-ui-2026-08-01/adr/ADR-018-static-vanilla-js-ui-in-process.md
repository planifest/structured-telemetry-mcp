---
title: "ADR 018: Static Vanilla-JS UI Served In-Process (No New Component, No Build Step)"
summary: "The log-viewer UI is plain HTML/CSS/vanilla JS with no build step, served as static assets from the existing server-http.ts process rather than as a new component."
status: "accepted"
version: "0.1.0"
---
# ADR-018 - Static Vanilla-JS UI Served In-Process (No New Component, No Build Step)

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Component:** structured-telemetry-mcp
**Date:** 2026-08-01

## Context

This is the project's first frontend of any kind — the existing component manifest declares `frontend: "none"`. A UI needs to exist somewhere, built with something, and served from somewhere. The confirmed design's target user is a single local developer with no auth requirement, and the project's existing posture (component manifest `contract.breakingChangePolicy`, `exceptions` list) explicitly avoids adding infrastructure surface area beyond what's needed.

## Decision

The UI is plain HTML/CSS and vanilla JavaScript (ES modules), with **no build step, bundler, or new frontend dependency**. It is served as static assets by the **existing** `server-http.ts` process via a new `GET /ui` route, added directly to that file's existing `createServer` request handler — the same pattern already used for `/health`, `/emit`, and `/query`. No new component, process, or port is created; `src/structured-telemetry-mcp/component.yml`'s `stack.frontend` moves from `"none"` to describing this plain-JS approach (the design's stack declaration, not a new choice made here).

The UI calls the existing `POST /query` endpoint via `fetch()`, using the extended `event_log` mode (ADR-016, ADR-017).

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Small React app with Vite/esbuild build step | More structure for a growing UI; familiar component model | New toolchain, new dependencies, a build step to keep in sync with source, more moving parts for a single-developer local tool with 4 simple views | Rejected per confirmed design — the scope (one table, filters, a detail view) doesn't justify the overhead |
| New standalone microfrontend component with its own process/port | Clean separation, independently deployable | Requires its own deployment/service-management story (another launchd/systemd/nssm target), CORS configuration to talk to :3741, and violates the project's existing single-component-project posture without a clear need | Rejected — no requirement calls for independent deployment or scaling of the UI |
| Serve the UI from a completely separate lightweight static file server (e.g. `serve`, `http-server` package) | Decouples UI serving from the API backend | New dependency and new process for something `server-http.ts`'s existing raw `node:http` handler can do in a few lines | Rejected — unnecessary dependency for a handful of static routes |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/server-http.ts` gains a `GET /ui` (and static asset) route; new static HTML/CSS/JS files added under the component; `component.yml` stack.frontend description updated to reflect the plain-JS approach |

## Consequences

**Positive:**
- Zero new dependencies, zero new build tooling, zero new deployment surface — the UI ships and deploys exactly like the rest of the backend (`npm run deploy` restarts the one existing service)
- Matches the confirmed NFRs (no external network calls, no auth, 127.0.0.1-only) with no extra work — a static page with no framework has nothing to phone home with

**Negative:**
- No component model, no JSX, no reactive state library — all DOM updates and URL-state synchronization (filters/page/sort persistence) are hand-written vanilla JS, which is more verbose than a framework would be for the same behavior
- If the UI's scope grows significantly beyond the four confirmed features (e.g. the deferred aggregation-dashboard views), this decision may need revisiting

**Risks:**
- Hand-written vanilla JS state management is more error-prone to get subtly wrong (e.g. URL-state round-tripping) than a framework's built-in patterns — mitigated by req-003's explicit acceptance criterion that URL-state round-tripping is tested

## Related ADRs

- None directly, but implements the stack decision already recorded in `plan/current/design.md`

## Supersedes

- None

## Superseded By

- None
