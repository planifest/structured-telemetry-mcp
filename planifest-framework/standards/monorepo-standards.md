# Planifest Monorepo Standards

---

## 1. Directory Structure

```
src/
├── {component-a}/
│   ├── component.yml
│   ├── package.json (or equivalent)
│   ├── src/
│   ├── tests/
│   └── docs/
├── {component-b}/
│   ├── component.yml
│   ├── ...
└── shared/
    ├── types/
    ├── utils/
    └── contracts/
```

---

## 2. Dependency Rules

- **Components never import from each other's `src/` directory.** Cross-component communication goes through defined interfaces (APIs, events, shared types).
- **Shared code lives in `src/shared/`.** It must be genuinely shared - used by 2+ components. Do not preemptively create shared modules.
- **Each component has its own dependency manifest** (`package.json`, `go.mod`, etc.). Dependency versions may differ between components.

---

## 3. Component Boundaries

- Data ownership is per-component - one component, one database/schema
- If two components need the same data, one owns it and exposes an API - the other consumes it

---

## 4. Versioning

- Each component has its own version in `component.yml`
