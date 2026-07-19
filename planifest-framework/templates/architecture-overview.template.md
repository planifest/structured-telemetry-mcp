# Architecture Overview

> Living document. Reflects current system state. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: {feature-id}

---

## System Summary

{2-3 sentence description of what this system does and who it serves}

---

## Components

| Component | Type | Purpose | Status |
|-----------|------|---------|--------|
| {component-id} | microservice / frontend / library | {one-liner} | active / deprecated |

---

## Communication Patterns

```mermaid
flowchart LR
    A[{component}] -->|{method}| B[{component}]
    B -->|{method}| C[{component}]
```

---

## Data Ownership

| Data Store | Owner | Consumers |
|------------|-------|-----------|
| {store} | {component-id} | {read-only consumers} |

---

## External Dependencies

| Dependency | Type | Components That Use It |
|-----------|------|----------------------|
| {service / library} | API / npm / database | {component-id} |

---

## Key Architectural Decisions

Reference ADRs from `docs/decisions-index.md` that shaped this architecture.

- {ADR-001}: {one-line summary of decision and consequence}

---

*Template: architecture-overview.template.md*
